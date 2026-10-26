// Sweet House Immobilier — team accounts (Supabase Edge Function «re-staff»).
//
// Called by the dashboard's «الفريق» page, only by an active admin of the agency, to:
//   create   an employee log-in: e-mail + password chosen by the owner, job title, role, permissions
//   set_password / set_email   of a member
//   delete   a member's account
//   check    that the service is installed and working
// The secret key never leaves Supabase: Edge Functions receive it automatically.
import { createClient } from 'npm:@supabase/supabase-js@2'

const PERMISSIONS = ['properties', 'delete', 'deals', 'reports', 'export', 'settings', 'activity']

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

function reply(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { ...CORS, 'Content-Type': 'application/json' } })
}
const fail = (error: string, status = 400) => reply({ error }, status)

const text = (v: unknown, max: number) => (typeof v === 'string' ? v.trim().replace(/\s+/g, ' ').slice(0, max) : '')
const normEmail = (v: unknown) => text(v, 200).toLowerCase()
const validEmail = (e: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)
const sameEmail = (a?: string | null, b?: string | null) => Boolean(a && b && a.trim().toLowerCase() === b.trim().toLowerCase())
const validPassword = (v: unknown): v is string => typeof v === 'string' && v.length >= 8 && v.length <= 72
const cleanPermissions = (v: unknown): string[] =>
  Array.isArray(v) ? [...new Set(v.filter((p): p is string => typeof p === 'string' && PERMISSIONS.includes(p)))] : ['properties']
const isTaken = (e: { message?: string; code?: string }) => e.code === 'email_exists' || /already|exists|registered/i.test(e.message ?? '')
const authFail = (e: { message?: string; code?: string }) =>
  isTaken(e) ? fail('email_exists', 409) : e.code === 'weak_password' || /password/i.test(e.message ?? '') ? fail('weak_password') : fail('service_error', 500)

interface Member {
  id: string
  email: string
  role: string
  active: boolean
  full_name: string
}

// deno-lint-ignore no-explicit-any
type Admin = any

async function findUserByEmail(admin: Admin, email: string): Promise<{ id: string; user_metadata?: Record<string, unknown> } | null> {
  for (let page = 1; page <= 50; page++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 })
    if (error) throw error
    const users: { id: string; email?: string; user_metadata?: Record<string, unknown> }[] = data?.users ?? []
    const hit = users.find((u) => sameEmail(u.email, email))
    if (hit) return hit
    if (users.length < 200) return null
  }
  return null
}

export async function handle(req: Request, admin: Admin): Promise<Response> {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })
  if (req.method !== 'POST') return fail('method_not_allowed', 405)

  try {
    // 1) the caller: a signed-in, active admin of the agency
    const token = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '').trim()
    if (!token) return fail('not_signed_in', 401)
    const { data: who, error: whoError } = await admin.auth.getUser(token)
    if (whoError || !who?.user) return fail('not_signed_in', 401)
    const callerId: string = who.user.id
    const { data: caller } = await admin.from('re_staff').select('id, role, active').eq('id', callerId).maybeSingle()
    if (!caller || !caller.active || caller.role !== 'admin') return fail('not_admin', 403)

    const { data: config } = await admin.from('re_config').select('owner_email').eq('id', 1).maybeSingle()
    const ownerEmail: string = config?.owner_email ?? ''
    const callerIsOwner = sameEmail(who.user.email, ownerEmail)

    let body: Record<string, unknown>
    try {
      body = await req.json()
    } catch {
      return fail('bad_request')
    }

    // 2) the member an action is about. Another admin's account, and the owner's, can only be
    //    changed by the owner himself.
    const target = async (): Promise<Member | Response> => {
      const id = text(body.user_id, 64)
      if (!id) return fail('not_found', 404)
      const { data } = await admin.from('re_staff').select('id, email, role, active, full_name').eq('id', id).maybeSingle()
      if (!data) return fail('not_found', 404)
      if (data.id !== callerId && !callerIsOwner && (data.role === 'admin' || sameEmail(data.email, ownerEmail))) return fail('protected', 403)
      return data as Member
    }

    switch (body.action) {
      case 'check': {
        const { error } = await admin.auth.admin.listUsers({ page: 1, perPage: 1 })
        return error ? fail('service_error', 500) : reply({ ok: true })
      }

      case 'create': {
        const email = normEmail(body.email)
        const fullName = text(body.full_name, 80)
        if (!fullName) return fail('missing_name')
        if (!validEmail(email)) return fail('invalid_email')
        if (!validPassword(body.password)) return fail('weak_password')
        const password = body.password
        const profile = {
          full_name: fullName,
          email,
          phone: text(body.phone, 30) || null,
          title: text(body.title, 60) || null,
          role: body.role === 'admin' ? 'admin' : 'secretary',
          permissions: cleanPermissions(body.permissions),
          active: true,
        }
        const meta = { full_name: fullName, app: 'sweet-house-immo' }

        let userId: string
        let linked = false
        const { data: made, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true, user_metadata: meta })
        if (error) {
          if (!isTaken(error)) return authFail(error)
          // An account with this e-mail exists but is not in the team yet (e.g. made in the
          // Supabase dashboard): give it the password and add it to the team.
          const existing = await findUserByEmail(admin, email)
          if (!existing) return fail('email_exists', 409)
          const { data: inTeam } = await admin.from('re_staff').select('id').eq('id', existing.id).maybeSingle()
          if (inTeam) return fail('email_exists', 409)
          const { error: linkError } = await admin.auth.admin.updateUserById(existing.id, {
            password,
            email_confirm: true,
            user_metadata: { ...(existing.user_metadata ?? {}), ...meta },
          })
          if (linkError) return authFail(linkError)
          userId = existing.id
          linked = true
        } else {
          userId = made.user.id
        }

        const { data: staff, error: saveError } = await admin.from('re_staff').upsert({ id: userId, ...profile }, { onConflict: 'id' }).select().single()
        if (saveError) {
          if (!linked) await admin.auth.admin.deleteUser(userId) // no half-made accounts
          return fail('service_error', 500)
        }
        return reply({ staff, linked })
      }

      case 'set_password': {
        const t = await target()
        if (t instanceof Response) return t
        if (!validPassword(body.password)) return fail('weak_password')
        const { error } = await admin.auth.admin.updateUserById(t.id, { password: body.password })
        return error ? authFail(error) : reply({ ok: true })
      }

      case 'set_email': {
        const t = await target()
        if (t instanceof Response) return t
        if (sameEmail(t.email, ownerEmail)) return fail('protected', 403) // the owner's e-mail is the agency's key
        const email = normEmail(body.email)
        if (!validEmail(email)) return fail('invalid_email')
        if (sameEmail(email, t.email)) return reply({ ok: true })
        const { error } = await admin.auth.admin.updateUserById(t.id, { email, email_confirm: true })
        if (error) return authFail(error)
        await admin.from('re_staff').update({ email }).eq('id', t.id)
        return reply({ ok: true })
      }

      case 'delete': {
        const t = await target()
        if (t instanceof Response) return t
        if (t.id === callerId) return fail('self')
        if (sameEmail(t.email, ownerEmail)) return fail('protected', 403)
        const { error } = await admin.auth.admin.deleteUser(t.id) // the team row goes with it
        return error ? fail('service_error', 500) : reply({ ok: true })
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

function secretKey(d: DenoLike): string {
  try {
    const keys = JSON.parse(d.env.get('SUPABASE_SECRET_KEYS') ?? '{}') as Record<string, string>
    const key = keys.default ?? Object.values(keys)[0]
    if (key) return key
  } catch {
    /* not set: use the legacy key */
  }
  return d.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
}

if (D) {
  const admin = createClient(D.env.get('SUPABASE_URL') ?? '', secretKey(D), { auth: { persistSession: false, autoRefreshToken: false } })
  D.serve((req) => handle(req, admin))
}
