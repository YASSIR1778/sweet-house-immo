// npm run test:fn — runs the Edge Function supabase/functions/re-staff against an in-memory
// stand-in of Supabase Auth + the re_staff table. Nothing touches a real project.
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'

const src = readFileSync(new URL('../supabase/functions/re-staff/index.ts', import.meta.url), 'utf8')
const importLine = "import { createClient } from 'npm:@supabase/supabase-js@2'"
if (!src.includes(importLine)) throw new Error('import line changed: update the test')
const dir = mkdtempSync(join(tmpdir(), 're-staff-'))
const file = join(dir, 'index.mts')
writeFileSync(file, src.replace(importLine, 'const createClient = (..._a: unknown[]) => { throw new Error("not in tests") }'))
const { handle } = await import(pathToFileURL(file).href)

let pass = 0
let fail = 0
const ok = (name, cond, extra = '') => {
  if (cond) pass++
  else fail++
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}${extra ? '  -> ' + extra : ''}`)
}

// ------------------------------------------------------------ fake Supabase
const OWNER_EMAIL = 'owner@agency.test'
const state = { users: new Map(), staff: new Map(), tokens: new Map(), failUpsert: false }
const taken = { message: 'A user with this email address has already been registered', code: 'email_exists' }
function addUser({ id, email, password = 'x', staff }) {
  state.users.set(id, { id, email, password, user_metadata: {} })
  state.tokens.set('tok-' + id, id)
  if (staff) state.staff.set(id, { id, email, full_name: id, phone: null, title: null, permissions: ['properties'], ...staff })
}

class Query {
  constructor(table) {
    this.table = table
    this.filters = []
    this.op = 'select'
  }
  rows() {
    if (this.table === 're_staff') return [...state.staff.values()]
    if (this.table === 're_config') return [{ id: 1, owner_email: OWNER_EMAIL }]
    throw new Error('unexpected table ' + this.table)
  }
  match() {
    return this.rows().filter((r) => this.filters.every(([c, v]) => r[c] === v))
  }
  select() {
    return this
  }
  eq(c, v) {
    this.filters.push([c, v])
    return this
  }
  upsert(row) {
    this.op = 'upsert'
    this.row = row
    return this
  }
  update(patch) {
    this.op = 'update'
    this.patch = patch
    return this
  }
  async maybeSingle() {
    return { data: this.match()[0] ?? null, error: null }
  }
  async single() {
    if (this.op !== 'upsert') throw new Error('single() only after upsert in this test')
    if (state.failUpsert) return { data: null, error: { message: 'db down' } }
    const next = { ...(state.staff.get(this.row.id) ?? {}), ...this.row }
    state.staff.set(this.row.id, next)
    return { data: next, error: null }
  }
  then(resolve, reject) {
    try {
      if (this.op === 'update') for (const r of this.match()) Object.assign(r, this.patch)
      resolve({ data: null, error: null })
    } catch (e) {
      reject(e)
    }
  }
}

const admin = {
  from: (t) => new Query(t),
  auth: {
    async getUser(token) {
      const u = state.users.get(state.tokens.get(token))
      return u ? { data: { user: { id: u.id, email: u.email } }, error: null } : { data: { user: null }, error: { message: 'invalid JWT' } }
    },
    admin: {
      async listUsers({ page, perPage }) {
        return { data: { users: [...state.users.values()].slice((page - 1) * perPage, page * perPage) }, error: null }
      },
      async createUser({ email, password, email_confirm, user_metadata }) {
        if ([...state.users.values()].some((u) => u.email === email)) return { data: { user: null }, error: taken }
        const id = 'u' + (state.users.size + 1)
        state.users.set(id, { id, email, password, confirmed: email_confirm, user_metadata })
        // the auth trigger of schema.sql: an app sign-up gets a pending secretary row
        if (user_metadata?.app === 'sweet-house-immo') state.staff.set(id, { id, email, full_name: user_metadata.full_name, role: 'secretary', active: false, permissions: ['properties'], title: null, phone: null })
        return { data: { user: { id, email } }, error: null }
      },
      async updateUserById(id, attrs) {
        const u = state.users.get(id)
        if (!u) return { data: null, error: { message: 'User not found' } }
        if (attrs.email && [...state.users.values()].some((x) => x.email === attrs.email && x.id !== id)) return { data: null, error: taken }
        Object.assign(u, attrs)
        return { data: { user: u }, error: null }
      },
      async deleteUser(id) {
        state.users.delete(id)
        state.staff.delete(id) // on delete cascade
        return { data: {}, error: null }
      },
    },
  },
}

const call = async (body, who, { method = 'POST', raw } = {}) => {
  const headers = { 'Content-Type': 'application/json' }
  if (who) headers.Authorization = 'Bearer tok-' + who
  const res = await handle(new Request('https://x.supabase.co/functions/v1/re-staff', { method, headers, body: method === 'POST' ? raw ?? JSON.stringify(body) : undefined }), admin)
  let json = null
  try {
    json = await res.json()
  } catch {
    /* empty */
  }
  return { status: res.status, json, res }
}

// ------------------------------------------------------------ people
addUser({ id: 'owner', email: OWNER_EMAIL, staff: { role: 'admin', active: true } })
addUser({ id: 'sec', email: 'sec@agency.test', staff: { role: 'secretary', active: true } })
addUser({ id: 'boss2', email: 'boss2@agency.test', staff: { role: 'admin', active: true } })
addUser({ id: 'off', email: 'off@agency.test', staff: { role: 'admin', active: false } })
addUser({ id: 'outside', email: 'made.in.dashboard@agency.test' }) // auth account, not in the team

// ------------------------------------------------------------ transport and caller checks
let r = await handle(new Request('https://x/functions/v1/re-staff', { method: 'OPTIONS' }), admin)
ok('OPTIONS answers CORS', r.status === 200 && r.headers.get('Access-Control-Allow-Origin') === '*' && /authorization/.test(r.headers.get('Access-Control-Allow-Headers')))
r = await call(null, 'owner', { method: 'GET' })
ok('GET refused', r.status === 405)
r = await call({ action: 'check' })
ok('no token → not_signed_in', r.status === 401 && r.json.error === 'not_signed_in')
r = await call({ action: 'check' }, 'nobody')
ok('bad token → not_signed_in', r.status === 401)
r = await call({ action: 'check' }, 'sec')
ok('a secretary → not_admin', r.status === 403 && r.json.error === 'not_admin')
r = await call({ action: 'check' }, 'off')
ok('an inactive admin → not_admin', r.status === 403)
r = await call({ action: 'check' }, 'owner')
ok('owner: check works', r.status === 200 && r.json.ok === true)
r = await call(null, 'owner', { raw: '{oops' })
ok('broken JSON → bad_request', r.status === 400 && r.json.error === 'bad_request')
r = await call({ action: 'fly' }, 'owner')
ok('unknown action → bad_request', r.status === 400)

// ------------------------------------------------------------ create
const base = { action: 'create', full_name: 'سلمى الكاتبة', email: '  Salma@Agency.TEST ', password: 'Tetouan2026', title: 'كاتبة', phone: '0611223344', permissions: ['deals', 'fly', 'deals'] }
r = await call({ ...base, email: 'no-at-sign' }, 'owner')
ok('create: bad e-mail refused', r.status === 400 && r.json.error === 'invalid_email')
r = await call({ ...base, password: 'short' }, 'owner')
ok('create: short password refused', r.status === 400 && r.json.error === 'weak_password')
r = await call({ ...base, full_name: '   ' }, 'owner')
ok('create: missing name refused', r.status === 400 && r.json.error === 'missing_name')
r = await call(base, 'sec')
ok('create: a secretary cannot create accounts', r.status === 403)
r = await call(base, 'owner')
const salma = r.json?.staff
ok('create: account made', r.status === 200 && salma?.email === 'salma@agency.test', JSON.stringify(r.json))
ok('create: active member with chosen title and phone', salma?.active === true && salma?.role === 'secretary' && salma?.title === 'كاتبة' && salma?.phone === '0611223344')
ok('create: only known permissions, once', JSON.stringify(salma?.permissions) === '["deals"]', JSON.stringify(salma?.permissions))
const salmaUser = state.users.get(salma?.id)
ok('create: log-in confirmed with the owner\'s password', salmaUser?.password === 'Tetouan2026' && salmaUser?.confirmed === true && salmaUser?.user_metadata?.app === 'sweet-house-immo')
r = await call(base, 'owner')
ok('create: same e-mail twice → email_exists', r.status === 409 && r.json.error === 'email_exists')
r = await call({ ...base, email: OWNER_EMAIL }, 'owner')
ok('create: the owner\'s e-mail → email_exists', r.status === 409)
r = await call({ ...base, email: 'made.in.dashboard@agency.test', full_name: 'كريم', role: 'admin', permissions: undefined }, 'owner')
ok('create: existing log-in outside the team is linked', r.status === 200 && r.json.linked === true && r.json.staff?.id === 'outside' && r.json.staff?.role === 'admin', JSON.stringify(r.json))
ok('create: linked log-in gets the new password', state.users.get('outside').password === 'Tetouan2026')
state.failUpsert = true
const before = state.users.size
r = await call({ ...base, email: 'temp@agency.test' }, 'owner')
state.failUpsert = false
ok('create: database error → no half-made account', r.status === 500 && state.users.size === before && ![...state.users.values()].some((u) => u.email === 'temp@agency.test'))

// ------------------------------------------------------------ passwords and e-mails
r = await call({ action: 'set_password', user_id: salma.id, password: 'NewPass2026' }, 'owner')
ok('set_password: owner changes a member\'s password', r.status === 200 && state.users.get(salma.id).password === 'NewPass2026')
r = await call({ action: 'set_password', user_id: salma.id, password: '123' }, 'owner')
ok('set_password: short password refused', r.status === 400 && r.json.error === 'weak_password')
r = await call({ action: 'set_password', user_id: 'ghost', password: 'NewPass2026' }, 'owner')
ok('set_password: unknown member → not_found', r.status === 404)
r = await call({ action: 'set_password', user_id: 'owner', password: 'Hacked2026!' }, 'boss2')
ok('set_password: another admin cannot change the owner\'s password', r.status === 403 && r.json.error === 'protected' && state.users.get('owner').password === 'x')
r = await call({ action: 'set_password', user_id: 'outside', password: 'Hacked2026!' }, 'boss2')
ok('set_password: another admin cannot change an admin\'s password', r.status === 403)
r = await call({ action: 'set_password', user_id: salma.id, password: 'ByBoss2026' }, 'boss2')
ok('set_password: another admin can reset a secretary', r.status === 200)
r = await call({ action: 'set_password', user_id: 'boss2', password: 'Mine2026!' }, 'boss2')
ok('set_password: an admin can reset his own', r.status === 200)
r = await call({ action: 'set_email', user_id: salma.id, email: 'sec@agency.test' }, 'owner')
ok('set_email: e-mail of another member refused', r.status === 409 && r.json.error === 'email_exists')
r = await call({ action: 'set_email', user_id: salma.id, email: 'Salma.B@Agency.test' }, 'owner')
ok('set_email: changed in log-in and team', r.status === 200 && state.users.get(salma.id).email === 'salma.b@agency.test' && state.staff.get(salma.id).email === 'salma.b@agency.test')
r = await call({ action: 'set_email', user_id: 'owner', email: 'new@owner.test' }, 'owner')
ok('set_email: the owner\'s e-mail stays (agency key)', r.status === 403 && state.users.get('owner').email === OWNER_EMAIL)

// ------------------------------------------------------------ delete
r = await call({ action: 'delete', user_id: 'owner' }, 'owner')
ok('delete: nobody deletes himself', r.status === 400 && r.json.error === 'self' && state.users.has('owner'))
r = await call({ action: 'delete', user_id: 'owner' }, 'boss2')
ok('delete: the owner\'s account cannot be deleted', r.status === 403 && state.users.has('owner'))
r = await call({ action: 'delete', user_id: salma.id }, 'sec')
ok('delete: a secretary cannot delete', r.status === 403 && state.users.has(salma.id))
r = await call({ action: 'delete', user_id: salma.id }, 'owner')
ok('delete: owner deletes a member (log-in and team row)', r.status === 200 && !state.users.has(salma.id) && !state.staff.has(salma.id))

console.log(`\n${pass} passed, ${fail} failed`)
process.exit(fail ? 1 : 0)
