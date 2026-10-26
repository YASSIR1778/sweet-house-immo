import { repo } from '@/shared/lib/repo'
import { getSupabase } from '@/shared/lib/supabase'

/*
 * Phone notifications (web push) for this device. The service worker (public/sw.js) shows
 * them; the Edge Function «re-push» (supabase/functions/re-push) sends them when a request
 * arrives from the website. Each member turns them on per device.
 */

export type PushState = 'demo' | 'unsupported' | 'ios-install' | 'denied' | 'off' | 'on'

const MESSAGES: Record<string, string> = {
  not_signed_in: 'انتهت الجلسة. سجّل الدخول من جديد.',
  not_staff: 'هذا الحساب غير مفعّل في الفريق.',
  not_installed: 'خدمة الإشعارات غير مثبتة بعد على الخادم.',
  denied: 'لم تسمح بالإشعارات لهذا الموقع.',
  dismissed: 'أُغلقت نافذة الإذن دون اختيار. أعد المحاولة واختر «السماح».',
  unsupported: 'هذا المتصفح لا يدعم الإشعارات.',
  network: 'تعذر الاتصال بالخادم. تحقق من الإنترنت ثم أعد المحاولة.',
  service_error: 'تعذر تشغيل الإشعارات. أعد المحاولة بعد قليل.',
}

export class PushError extends Error {
  code: string
  constructor(code: string) {
    super(MESSAGES[code] ?? MESSAGES.service_error)
    this.code = code
  }
}

export const isIos = () => /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
const standalone = () => matchMedia('(display-mode: standalone)').matches || (navigator as Navigator & { standalone?: boolean }).standalone === true
const supported = () => 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window

/** «Android · Chrome», «iPhone · Safari»: to recognise the device in the team list. */
export function deviceName(): string {
  const ua = navigator.userAgent
  const os = /Android/.test(ua) ? 'Android' : /iPhone|iPod/.test(ua) ? 'iPhone' : /iPad/.test(ua) || isIos() ? 'iPad' : /Windows/.test(ua) ? 'Windows' : /Mac/.test(ua) ? 'Mac' : /Linux/.test(ua) ? 'Linux' : 'جهاز'
  const browser = /EdgA?\//.test(ua) ? 'Edge' : /SamsungBrowser/.test(ua) ? 'Samsung' : /Firefox|FxiOS/.test(ua) ? 'Firefox' : /Chrome|CriOS/.test(ua) ? 'Chrome' : /Safari/.test(ua) ? 'Safari' : ''
  return browser ? `${os} · ${browser}` : os
}

async function registration(): Promise<ServiceWorkerRegistration | null> {
  if (!('serviceWorker' in navigator)) return null
  const reg = await navigator.serviceWorker.getRegistration()
  if (reg) return reg
  // the published app registers it on load; the development server never does
  if (!import.meta.env.PROD) return null
  await navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`)
  return navigator.serviceWorker.ready
}

async function call<T>(body: { action: 'key' | 'test' }): Promise<T> {
  const { data, error } = await getSupabase().functions.invoke('re-push', { body })
  if (!error) return data as T
  const res = (error as { context?: unknown }).context
  if (res instanceof Response) {
    let code = res.status === 401 ? 'not_signed_in' : res.status === 404 ? 'not_installed' : 'service_error'
    try {
      const j = (await res.clone().json()) as { error?: unknown }
      if (typeof j?.error === 'string') code = j.error
    } catch {
      /* not JSON */
    }
    throw new PushError(code)
  }
  throw new PushError('network')
}

/** Is the service installed? (also lets the server learn its own address on first use) */
export const pushKey = () => call<{ publicKey: string }>({ action: 'key' }).then((r) => r.publicKey)

export async function pushState(): Promise<PushState> {
  if (repo.mode === 'demo') return 'demo'
  if (isIos() && !standalone()) return 'ios-install'
  if (!supported()) return 'unsupported'
  if (Notification.permission === 'denied') return 'denied'
  const reg = await registration()
  if (!reg) return 'unsupported'
  const sub = await reg.pushManager.getSubscription()
  return sub && Notification.permission === 'granted' ? 'on' : 'off'
}

const fromB64url = (s: string) => {
  const b64 = s.replace(/-/g, '+').replace(/_/g, '/')
  return Uint8Array.from(atob(b64 + '='.repeat((4 - (b64.length % 4)) % 4)), (c) => c.charCodeAt(0))
}
const sameBytes = (a: ArrayBuffer | null, b: Uint8Array) => {
  if (!a || a.byteLength !== b.length) return false
  const x = new Uint8Array(a)
  return x.every((v, i) => v === b[i])
}

async function save(sub: PushSubscription): Promise<void> {
  const j = sub.toJSON()
  const { error } = await getSupabase().rpc('re_push_register', { p_endpoint: j.endpoint, p_p256dh: j.keys?.p256dh, p_auth: j.keys?.auth, p_device: deviceName() })
  if (error) throw new PushError(/not_staff/.test(error.message) ? 'not_staff' : 'service_error')
}

/** Ask the permission (it must follow the tap at once), subscribe, tell the server. */
export async function enablePush(): Promise<void> {
  if (!supported()) throw new PushError('unsupported')
  const permission = await Notification.requestPermission()
  if (permission !== 'granted') throw new PushError(permission === 'denied' ? 'denied' : 'dismissed')
  const reg = await registration()
  if (!reg) throw new PushError('unsupported')
  const key = fromB64url(await pushKey())
  let sub = await reg.pushManager.getSubscription()
  // made with another key (service reinstalled): replace it
  if (sub && !sameBytes(sub.options.applicationServerKey, key)) {
    await sub.unsubscribe()
    sub = null
  }
  sub ??= await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: key })
  await save(sub)
}

export async function disablePush(): Promise<void> {
  const reg = await registration()
  const sub = await reg?.pushManager.getSubscription()
  if (!sub) return
  await getSupabase().rpc('re_push_unregister', { p_endpoint: sub.endpoint })
  await sub.unsubscribe()
}

export const testPush = () => call<{ sent: number; failed: number; removed: number }>({ action: 'test' })

/** On opening the dashboard: keep this device known to the server (its address can change). */
export async function syncPush(): Promise<void> {
  if (repo.mode === 'demo' || !supported() || Notification.permission !== 'granted') return
  const reg = await navigator.serviceWorker.getRegistration()
  const sub = await reg?.pushManager.getSubscription()
  if (sub) await save(sub)
}
