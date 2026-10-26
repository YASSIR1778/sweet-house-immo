import { getSupabase } from '@/shared/lib/supabase'
import type { Permission, Role, Staff } from '@/shared/lib/types'

/** Calls the Supabase Edge Function «re-staff» (supabase/functions/re-staff): team log-ins, owner only. */
export type StaffAction =
  | { action: 'check' }
  | { action: 'create'; full_name: string; email: string; password: string; phone: string | null; title: string | null; role: Role; permissions: Permission[] }
  | { action: 'set_password'; user_id: string; password: string }
  | { action: 'set_email'; user_id: string; email: string }
  | { action: 'delete'; user_id: string }

const MESSAGES: Record<string, string> = {
  not_signed_in: 'انتهت الجلسة. سجّل الدخول من جديد.',
  not_admin: 'هذه العملية خاصة بالمدير.',
  missing_name: 'اكتب اسم الموظف.',
  invalid_email: 'البريد الإلكتروني غير صحيح.',
  weak_password: 'كلمة المرور يجب أن تتكون من 8 أحرف على الأقل.',
  email_exists: 'هذا البريد مستعمل في حساب آخر من الفريق.',
  protected: 'هذا الحساب لا يغيّره إلا صاحب الوكالة.',
  self: 'لا يمكنك حذف حسابك أنت.',
  not_found: 'هذا العضو غير موجود. حدّث الصفحة ثم أعد المحاولة.',
  not_installed: 'خدمة حسابات الفريق غير مثبتة بعد على Supabase.',
  network: 'تعذر الاتصال بالخادم. تحقق من الإنترنت ثم أعد المحاولة.',
  service_error: 'تعذر تنفيذ العملية على الخادم. أعد المحاولة بعد قليل.',
}

export class StaffServiceError extends Error {
  code: string
  constructor(code: string) {
    super(MESSAGES[code] ?? MESSAGES.service_error)
    this.code = code
  }
}

export async function staffService<T = { ok: true }>(body: StaffAction): Promise<T> {
  const { data, error } = await getSupabase().functions.invoke('re-staff', { body })
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
    throw new StaffServiceError(code)
  }
  throw new StaffServiceError('network')
}

export type CreatedStaff = { staff: Staff; linked: boolean }

/** A readable password: 10 letters / digits without look-alikes (0/O, 1/l/I). */
export function generatePassword(): string {
  const chars = 'abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  const bytes = new Uint32Array(10)
  crypto.getRandomValues(bytes)
  let s = Array.from(bytes, (b) => chars[b % chars.length]).join('')
  if (!/\d/.test(s)) s = s.slice(0, 9) + String(2 + (bytes[0] % 8))
  return s
}

export const LOGIN_URL = () => `${location.origin}${import.meta.env.BASE_URL}admin`

export function credentialsText(name: string, email: string, password: string): string {
  return [`مرحباً ${name}،`, 'هذه بيانات دخولك إلى لوحة فريق سويت هاوس للعقار:', `الرابط: ${LOGIN_URL()}`, `البريد: ${email}`, `كلمة المرور: ${password}`, 'يمكنك تغيير كلمة المرور من زر المفتاح أسفل القائمة بعد الدخول.'].join('\n')
}
