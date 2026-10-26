// Sweet House Immobilier — phone notifications (Supabase Edge Function «re-push»).
//
// Web push without any outside service. The dashboard subscribes each member's device, then:
//   key    (a signed-in active member)  the public key the device subscribes with
//   test   (a signed-in active member)  a test notification to the caller's own devices
//   lead   (the database trigger re_notify_lead, with the secret of re_push_config)
//          a request arrived from the website: every active member's devices are told
//   ping   (same secret)                checks the database → function path
// Each message is encrypted for its device (RFC 8291) and signed with the agency's VAPID key
// (RFC 8292). The keys are made here on first use and stay in re_push_config (no policy:
// visitors and members cannot read it). The secret key never leaves Supabase.

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

function reply(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { ...CORS, 'Content-Type': 'application/json' } })
}
const fail = (error: string, status = 400) => reply({ error }, status)

export interface Ctx {
  /** https://<project>.supabase.co */
  url: string
  /** secret key: database and log-in checks */
  serviceKey: string
  /** public key the database trigger calls this function with */
  anonKey: string
  fetch: typeof fetch
  now?: () => number
}

interface Config {
  id: number
  hook_secret: string
  vapid_public: string | null
  vapid_private: JsonWebKey | null
  fn_url: string | null
  fn_key: string | null
}
interface Sub {
  id: string
  staff_id: string
  endpoint: string
  p256dh: string
  auth: string
}
interface Lead {
  id: string
  name: string
  phone: string
  kind: string
  property_ref: string | null
  message: string | null
  meta: Record<string, unknown> | null
}
export interface Message {
  title: string
  body: string
  /** opened on tap, relative to the app (admin/leads?open=…) */
  url: string
  /** a newer message with the same tag replaces the older one */
  tag: string
}
export interface Vapid {
  publicKey: string
  privateJwk: JsonWebKey
}

// ---------------------------------------------------------------------- bytes
const encoder = new TextEncoder()
const utf8 = (s: string) => encoder.encode(s)

function concat(...parts: Uint8Array[]): Uint8Array {
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0))
  let at = 0
  for (const p of parts) {
    out.set(p, at)
    at += p.length
  }
  return out
}

export function b64url(bytes: Uint8Array): string {
  let s = ''
  for (const b of bytes) s += String.fromCharCode(b)
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

export function fromB64url(s: string): Uint8Array {
  const b64 = s.replace(/-/g, '+').replace(/_/g, '/')
  const bin = atob(b64 + '='.repeat((4 - (b64.length % 4)) % 4))
  return Uint8Array.from(bin, (c) => c.charCodeAt(0))
}

/** Same secret? (time does not tell how much of it was right) */
function same(a: string, b: string): boolean {
  if (!a || !b || a.length !== b.length) return false
  let x = 0
  for (let i = 0; i < a.length; i++) x |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return x === 0
}

// ---------------------------------------------------------------------- web push crypto
/** The agency's signing key pair (P-256); the public half goes to the devices. */
export async function makeVapid(): Promise<Vapid> {
  const pair = await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify'])
  const raw = new Uint8Array(await crypto.subtle.exportKey('raw', pair.publicKey))
  const jwk = await crypto.subtle.exportKey('jwk', pair.privateKey)
  return { publicKey: b64url(raw), privateJwk: { kty: jwk.kty, crv: jwk.crv, x: jwk.x, y: jwk.y, d: jwk.d } }
}

/** «Authorization: vapid t=…, k=…»: a short-lived token signed for the push service (RFC 8292). */
export async function vapidAuth(endpoint: string, vapid: Vapid, subject: string, now: number): Promise<string> {
  const head = b64url(utf8(JSON.stringify({ typ: 'JWT', alg: 'ES256' })))
  const claims = b64url(utf8(JSON.stringify({ aud: new URL(endpoint).origin, exp: Math.floor(now / 1000) + 3600, sub: subject })))
  const key = await crypto.subtle.importKey('jwk', vapid.privateJwk, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign'])
  const sig = new Uint8Array(await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, key, utf8(`${head}.${claims}`)))
  return `vapid t=${head}.${claims}.${b64url(sig)}, k=${vapid.publicKey}`
}

async function hkdf(salt: Uint8Array, ikm: Uint8Array, info: Uint8Array, length: number): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey('raw', ikm, 'HKDF', false, ['deriveBits'])
  return new Uint8Array(await crypto.subtle.deriveBits({ name: 'HKDF', hash: 'SHA-256', salt, info }, key, length * 8))
}

/** The message sealed for one device: only that device can open it (RFC 8291, aes128gcm). */
export async function encrypt(payload: Uint8Array, p256dh: string, authSecret: string): Promise<Uint8Array> {
  const device = fromB64url(p256dh)
  const auth = fromB64url(authSecret)
  const mine = await crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits'])
  const minePublic = new Uint8Array(await crypto.subtle.exportKey('raw', mine.publicKey))
  const theirs = await crypto.subtle.importKey('raw', device, { name: 'ECDH', namedCurve: 'P-256' }, false, [])
  const shared = new Uint8Array(await crypto.subtle.deriveBits({ name: 'ECDH', public: theirs }, mine.privateKey, 256))
  const ikm = await hkdf(auth, shared, concat(utf8('WebPush: info\u0000'), device, minePublic), 32)
  const salt = crypto.getRandomValues(new Uint8Array(16))
  const cek = await hkdf(salt, ikm, utf8('Content-Encoding: aes128gcm\u0000'), 16)
  const nonce = await hkdf(salt, ikm, utf8('Content-Encoding: nonce\u0000'), 12)
  const key = await crypto.subtle.importKey('raw', cek, { name: 'AES-GCM' }, false, ['encrypt'])
  // one record: the message, then the «last record» delimiter
  const sealed = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv: nonce }, key, concat(payload, new Uint8Array([2]))))
  const head = new Uint8Array(21)
  head.set(salt, 0)
  new DataView(head.buffer).setUint32(16, 4096)
  head[20] = minePublic.length
  return concat(head, minePublic, sealed)
}

// ---------------------------------------------------------------------- what the phone shows
const KIND: Record<string, string> = {
  inquiry: 'استفسار عن عقار',
  visit: 'طلب زيارة',
  sell: 'مالك يعرض عقاره',
  valuation: 'طلب تقدير ثمن',
  callback: 'طلب معاودة الاتصال',
  contact: 'رسالة من الموقع',
  booking: 'طلب حجز موسمي',
}
const dayMonth = (d: unknown) => (typeof d === 'string' && /^\d{4}-\d{2}-\d{2}/.test(d) ? `${d.slice(8, 10)}/${d.slice(5, 7)}` : '')
const people = (n: number) => (n === 1 ? 'شخص واحد' : n === 2 ? 'شخصان' : n <= 10 ? `${n} أشخاص` : `${n} شخصاً`)

export function leadMessage(l: Lead): Message {
  const lines = [[l.name, l.phone].filter(Boolean).join(' · ')]
  const stay = l.kind === 'booking' ? (l.meta?.booking as { check_in?: string; check_out?: string; guests?: number } | undefined) : undefined
  if (stay?.check_in && stay.check_out) lines.push(`من ${dayMonth(stay.check_in)} إلى ${dayMonth(stay.check_out)}${stay.guests ? ` · ${people(stay.guests)}` : ''}`)
  if (l.message) lines.push(l.message.replace(/\s+/g, ' ').trim().slice(0, 140))
  return {
    title: `${KIND[l.kind] ?? 'طلب جديد من الموقع'}${l.property_ref ? ` · ${l.property_ref}` : ''}`,
    body: lines.join('\n'),
    url: `admin/leads?open=${l.id}`,
    tag: `lead-${l.id}`,
  }
}

export const TEST_MESSAGE: Message = {
  title: 'سويت هاوس للعقار',
  body: 'الإشعارات تعمل على هذا الجهاز. ستصلك هنا طلبات الموقع فور وصولها.',
  url: 'admin',
  tag: 'test',
}

// ---------------------------------------------------------------------- the database (REST, secret key)
// deno-lint-ignore no-explicit-any
type Rest = (path: string, init?: { method?: string; body?: unknown; prefer?: string }) => Promise<any>

function restOf(ctx: Ctx): Rest {
  return async (path, init = {}) => {
    const headers: Record<string, string> = { apikey: ctx.serviceKey, Authorization: `Bearer ${ctx.serviceKey}`, 'Content-Type': 'application/json' }
    if (init.prefer) headers.Prefer = init.prefer
    const method = init.method ?? 'GET'
    const res = await ctx.fetch(`${ctx.url}/rest/v1/${path}`, { method, headers, body: init.body === undefined ? undefined : JSON.stringify(init.body) })
    const text = await res.text()
    if (!res.ok) throw new Error(`database ${method} ${path.split('?')[0]}: ${res.status} ${text.slice(0, 200)}`)
    return text ? JSON.parse(text) : null
  }
}

const config = async (rest: Rest): Promise<Config | null> => ((await rest('re_push_config?id=eq.1&select=*')) as Config[] | null)?.[0] ?? null

/** The signing keys, made once: a second call never replaces keys a device already uses. */
async function vapidOf(rest: Rest, cfg: Config): Promise<Vapid> {
  if (cfg.vapid_public && cfg.vapid_private) return { publicKey: cfg.vapid_public, privateJwk: cfg.vapid_private }
  const made = await makeVapid()
  const saved = await rest('re_push_config?id=eq.1&vapid_public=is.null', {
    method: 'PATCH',
    body: { vapid_public: made.publicKey, vapid_private: made.privateJwk, updated_at: new Date().toISOString() },
    prefer: 'return=representation',
  })
  if (Array.isArray(saved) && saved.length) return made
  const again = await config(rest)
  if (!again?.vapid_public || !again.vapid_private) throw new Error('vapid keys not saved')
  return { publicKey: again.vapid_public, privateJwk: again.vapid_private }
}

/** Where the database trigger calls this function, and with which public key. */
async function rememberRoute(ctx: Ctx, rest: Rest, cfg: Config): Promise<void> {
  const fnUrl = `${ctx.url}/functions/v1/re-push`
  if (!ctx.anonKey || (cfg.fn_url === fnUrl && cfg.fn_key === ctx.anonKey)) return
  await rest('re_push_config?id=eq.1', { method: 'PATCH', body: { fn_url: fnUrl, fn_key: ctx.anonKey, updated_at: new Date().toISOString() } })
}

/** The caller: a signed-in, active member of the agency (its id), or the refusal. */
async function member(req: Request, ctx: Ctx, rest: Rest): Promise<string | Response> {
  const token = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '').trim()
  if (!token) return fail('not_signed_in', 401)
  const res = await ctx.fetch(`${ctx.url}/auth/v1/user`, { headers: { apikey: ctx.serviceKey, Authorization: `Bearer ${token}` } })
  const user = res.ok ? ((await res.json()) as { id?: unknown }) : null
  if (!res.ok) await res.text().catch(() => '')
  if (typeof user?.id !== 'string') return fail('not_signed_in', 401)
  const rows = (await rest(`re_staff?select=id&id=eq.${encodeURIComponent(user.id)}&active=eq.true`)) as { id: string }[] | null
  return rows?.length ? user.id : fail('not_staff', 403)
}

// ---------------------------------------------------------------------- sending
export interface Delivery {
  sent: number
  failed: number
  removed: number
}

async function deliver(ctx: Ctx, rest: Rest, subs: Sub[], message: Message): Promise<Delivery> {
  if (!subs.length) return { sent: 0, failed: 0, removed: 0 }
  const cfg = await config(rest)
  if (!cfg) throw new Error('re_push_config missing')
  const vapid = await vapidOf(rest, cfg)
  const owner = ((await rest('re_config?id=eq.1&select=owner_email')) as { owner_email?: string }[] | null)?.[0]?.owner_email
  const subject = owner ? `mailto:${owner}` : 'mailto:contact@sweethouse.ma'
  const payload = utf8(JSON.stringify(message))
  const now = (ctx.now ?? Date.now)()
  const delivered: string[] = []
  const gone: string[] = []
  let failed = 0
  await Promise.all(
    subs.map(async (s) => {
      try {
        const res = await ctx.fetch(s.endpoint, {
          method: 'POST',
          headers: {
            Authorization: await vapidAuth(s.endpoint, vapid, subject, now),
            'Content-Encoding': 'aes128gcm',
            'Content-Type': 'application/octet-stream',
            TTL: '86400',
            Urgency: 'high',
          },
          body: await encrypt(payload, s.p256dh, s.auth),
        })
        const answer = await res.text().catch(() => '')
        if (res.status === 404 || res.status === 410) gone.push(s.id) // the device unsubscribed or was reset
        else if (res.ok) delivered.push(s.id)
        else {
          failed++
          console.error(`push ${new URL(s.endpoint).host}: ${res.status} ${answer.slice(0, 200)}`)
        }
      } catch (e) {
        failed++
        console.error('push', e)
      }
    }),
  )
  if (gone.length) await rest(`re_push_subs?id=in.(${gone.join(',')})`, { method: 'DELETE' })
  if (delivered.length) await rest(`re_push_subs?id=in.(${delivered.join(',')})`, { method: 'PATCH', body: { last_ok_at: new Date(now).toISOString() } })
  return { sent: delivered.length, failed, removed: gone.length }
}

const SUB_COLUMNS = 'select=id,staff_id,endpoint,p256dh,auth'
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

// ---------------------------------------------------------------------- the function
export async function handle(req: Request, ctx: Ctx): Promise<Response> {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })
  if (req.method !== 'POST') return fail('method_not_allowed', 405)
  let body: Record<string, unknown>
  try {
    body = await req.json()
  } catch {
    return fail('bad_request')
  }
  const rest = restOf(ctx)
  try {
    // 1) the database trigger, with the secret only the database knows
    if (body.action === 'lead' || body.action === 'ping') {
      const cfg = await config(rest)
      if (!cfg || !same(req.headers.get('x-hook-secret') ?? '', cfg.hook_secret)) return fail('forbidden', 403)
      if (body.action === 'ping') {
        const devices = (await rest('re_push_subs?select=id')) as unknown[] | null
        return reply({ ok: true, devices: devices?.length ?? 0 })
      }
      const id = typeof body.id === 'string' && UUID.test(body.id) ? body.id : ''
      if (!id) return fail('bad_request')
      const leads = (await rest(`re_leads?id=eq.${id}&select=id,name,phone,kind,property_ref,message,meta`)) as Lead[] | null
      if (!leads?.length) return fail('not_found', 404)
      const team = ((await rest('re_staff?select=id&active=eq.true')) as { id: string }[] | null) ?? []
      if (!team.length) return reply({ sent: 0, failed: 0, removed: 0 })
      const subs = ((await rest(`re_push_subs?${SUB_COLUMNS}&staff_id=in.(${team.map((m) => m.id).join(',')})`)) as Sub[] | null) ?? []
      return reply(await deliver(ctx, rest, subs, leadMessage(leads[0])))
    }

    // 2) the dashboard: a signed-in, active member
    const who = await member(req, ctx, rest)
    if (who instanceof Response) return who
    switch (body.action) {
      case 'key': {
        const cfg = await config(rest)
        if (!cfg) return fail('not_installed', 500)
        const vapid = await vapidOf(rest, cfg)
        await rememberRoute(ctx, rest, cfg)
        return reply({ publicKey: vapid.publicKey })
      }
      case 'test': {
        const subs = ((await rest(`re_push_subs?${SUB_COLUMNS}&staff_id=eq.${encodeURIComponent(who)}`)) as Sub[] | null) ?? []
        return reply(await deliver(ctx, rest, subs, TEST_MESSAGE))
      }
      default:
        return fail('bad_request')
    }
  } catch (e) {
    console.error(e)
    return fail('service_error', 500)
  }
}

// ---------------------------------------------------------------------- Supabase runtime
type DenoLike = { env: { get(name: string): string | undefined }; serve(handler: (req: Request) => Promise<Response>): unknown }
const D = (globalThis as unknown as { Deno?: DenoLike }).Deno

function keyFrom(d: DenoLike, list: string, legacy: string): string {
  try {
    const keys = JSON.parse(d.env.get(list) ?? '{}') as Record<string, string>
    const key = keys.default ?? Object.values(keys)[0]
    if (key) return key
  } catch {
    /* not set: use the legacy key */
  }
  return d.env.get(legacy) ?? ''
}

if (D) {
  const ctx: Ctx = {
    url: D.env.get('SUPABASE_URL') ?? '',
    serviceKey: keyFrom(D, 'SUPABASE_SECRET_KEYS', 'SUPABASE_SERVICE_ROLE_KEY'),
    // the legacy public key is a JWT: the trigger's call passes the gateway's JWT check with it
    anonKey: D.env.get('SUPABASE_ANON_KEY') || keyFrom(D, 'SUPABASE_PUBLISHABLE_KEYS', 'SUPABASE_ANON_KEY'),
    fetch: (input, init) => fetch(input, init),
  }
  D.serve((req) => handle(req, ctx))
}
