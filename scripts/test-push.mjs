// npm run test:push — runs the Edge Function supabase/functions/re-push against an in-memory
// stand-in of Supabase (log-in check + REST tables) and of the phone push services. Every
// message is opened again with Node's own crypto (an independent implementation of
// RFC 8291 / RFC 8292). Nothing touches a real project or a real phone.
import { createDecipheriv, createECDH, createPublicKey, hkdfSync, randomBytes, verify } from 'node:crypto'

const fn = await import('../supabase/functions/re-push/index.ts')
const { handle, encrypt, makeVapid, vapidAuth, leadMessage } = fn

let pass = 0
let fail = 0
const ok = (name, cond, extra = '') => {
  if (cond) pass++
  else fail++
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}${extra ? '  -> ' + extra : ''}`)
}

// ------------------------------------------------------------ opening a message like a phone does
function open(body, ua, auth) {
  const buf = Buffer.from(body)
  const salt = buf.subarray(0, 16)
  const rs = buf.readUInt32BE(16)
  const idlen = buf[20]
  const sender = buf.subarray(21, 21 + idlen)
  const sealed = buf.subarray(21 + idlen)
  const shared = ua.computeSecret(sender)
  const info = Buffer.concat([Buffer.from('WebPush: info\0'), ua.getPublicKey(), sender])
  const ikm = Buffer.from(hkdfSync('sha256', shared, auth, info, 32))
  const cek = Buffer.from(hkdfSync('sha256', ikm, salt, Buffer.from('Content-Encoding: aes128gcm\0'), 16))
  const nonce = Buffer.from(hkdfSync('sha256', ikm, salt, Buffer.from('Content-Encoding: nonce\0'), 12))
  const d = createDecipheriv('aes-128-gcm', cek, nonce)
  d.setAuthTag(sealed.subarray(sealed.length - 16))
  const plain = Buffer.concat([d.update(sealed.subarray(0, sealed.length - 16)), d.final()])
  let end = plain.length - 1
  while (end >= 0 && plain[end] === 0) end--
  if (plain[end] !== 2) throw new Error('no last-record delimiter')
  return { rs, idlen, text: plain.subarray(0, end).toString('utf8') }
}

function readVapid(header, publicKey) {
  const m = /^vapid t=([^,\s]+), k=(\S+)$/.exec(header ?? '')
  if (!m) return null
  const [h, c, s] = m[1].split('.')
  const raw = Buffer.from(publicKey, 'base64url')
  const key = createPublicKey({ key: { kty: 'EC', crv: 'P-256', x: raw.subarray(1, 33).toString('base64url'), y: raw.subarray(33, 65).toString('base64url') }, format: 'jwk' })
  return {
    signed: verify('sha256', Buffer.from(`${h}.${c}`), { key, dsaEncoding: 'ieee-p1363' }, Buffer.from(s, 'base64url')),
    k: m[2],
    head: JSON.parse(Buffer.from(h, 'base64url').toString()),
    claims: JSON.parse(Buffer.from(c, 'base64url').toString()),
  }
}

function device(id, staff, endpoint) {
  const ua = createECDH('prime256v1')
  ua.generateKeys()
  const auth = randomBytes(16)
  return { ua, auth, row: { id, staff_id: staff, endpoint, p256dh: ua.getPublicKey().toString('base64url'), auth: auth.toString('base64url'), last_ok_at: null } }
}

// ------------------------------------------------------------ the crypto alone
{
  const d = device('x', 'x', 'https://push.test/x')
  for (const size of [0, 1, 120, 3000]) {
    const msg = 'ب'.repeat(Math.floor(size / 2)) + 'a'.repeat(size % 2)
    const body = await encrypt(new TextEncoder().encode(msg), d.row.p256dh, d.row.auth)
    let opened = null
    try {
      opened = open(body, d.ua, d.auth)
    } catch (e) {
      opened = { text: 'ERROR ' + e.message }
    }
    ok(`encrypt: a ${size}-byte message opens on the device (record 4096, sender key 65 bytes)`, opened.text === msg && opened.rs === 4096 && opened.idlen === 65)
  }
  const a = await encrypt(new TextEncoder().encode('same'), d.row.p256dh, d.row.auth)
  const b = await encrypt(new TextEncoder().encode('same'), d.row.p256dh, d.row.auth)
  ok('encrypt: the same message never looks the same twice', Buffer.compare(Buffer.from(a), Buffer.from(b)) !== 0)
  const other = device('y', 'y', 'https://push.test/y')
  let leaked = false
  try {
    open(a, other.ua, other.auth)
    leaked = true
  } catch {
    leaked = false
  }
  ok('encrypt: another device cannot open it', !leaked)

  const v = await makeVapid()
  ok('vapid: public key is a 65-byte P-256 point', Buffer.from(v.publicKey, 'base64url').length === 65 && Buffer.from(v.publicKey, 'base64url')[0] === 4)
  const now = Date.UTC(2026, 9, 26, 12)
  const auth = readVapid(await vapidAuth('https://fcm.googleapis.com/fcm/send/abc', v, 'mailto:owner@agency.test', now), v.publicKey)
  ok('vapid: token signed with the agency key (ES256)', auth?.signed === true && auth.head.alg === 'ES256' && auth.k === v.publicKey)
  ok('vapid: token for this push service, valid one hour', auth?.claims.aud === 'https://fcm.googleapis.com' && auth.claims.exp === now / 1000 + 3600 && auth.claims.sub === 'mailto:owner@agency.test')
}

// ------------------------------------------------------------ messages
{
  const m = leadMessage({ id: 'L1', name: 'Laura Fernández', phone: '+34612345678', kind: 'booking', property_ref: 'SH-1019', message: 'Nos gustaría   pasar el fin de año.', meta: { booking: { check_in: '2026-12-29', check_out: '2027-01-02', guests: 4 } } })
  ok('message: a booking request with its dates', m.title === 'طلب حجز موسمي · SH-1019' && m.body === 'Laura Fernández · +34612345678\nمن 29/12 إلى 02/01 · 4 أشخاص\nNos gustaría pasar el fin de año.', JSON.stringify(m))
  ok('message: opens the request in the dashboard', m.url === 'admin/leads?open=L1' && m.tag === 'lead-L1')
  const v = leadMessage({ id: 'L2', name: 'سعيد', phone: '0611', kind: 'visit', property_ref: null, message: null, meta: null })
  ok('message: a visit request without a property', v.title === 'طلب زيارة' && v.body === 'سعيد · 0611')
  ok('message: an unknown kind still reads well', leadMessage({ id: 'L3', name: 'x', phone: '1', kind: 'other', property_ref: null, message: null, meta: null }).title === 'طلب جديد من الموقع')
  ok('message: long text is cut', leadMessage({ id: 'L4', name: 'x', phone: '1', kind: 'contact', property_ref: null, message: 'م'.repeat(500), meta: null }).body.length < 160)
}

// ------------------------------------------------------------ fake Supabase + push services
const BASE = 'https://ref.supabase.co'
const SECRET = 'svc-secret'
const ANON = 'eyJhbGciOiJIUzI1NiJ9.anon.sig'
const HOOK = 'h'.repeat(64)
const OWNER = '00000000-0000-0000-0000-00000000000a'
const SEC = '00000000-0000-0000-0000-00000000000b'
const OFF = '00000000-0000-0000-0000-00000000000c'
const LEAD = '11111111-1111-1111-1111-111111111111'
const devs = {
  a: device('a0000000-0000-0000-0000-000000000001', OWNER, 'https://fcm.googleapis.com/fcm/send/owner-phone'),
  b: device('b0000000-0000-0000-0000-000000000002', OWNER, 'https://updates.push.services.mozilla.com/wpush/v2/owner-old'),
  c: device('c0000000-0000-0000-0000-000000000003', SEC, 'https://web.push.apple.com/sec-iphone'),
  d: device('d0000000-0000-0000-0000-000000000004', OFF, 'https://fcm.googleapis.com/fcm/send/former-member'),
}
const db = {
  re_staff: [
    { id: OWNER, active: true },
    { id: SEC, active: true },
    { id: OFF, active: false },
  ],
  re_config: [{ id: 1, owner_email: 'owner@agency.test' }],
  re_push_config: [{ id: 1, hook_secret: HOOK, vapid_public: null, vapid_private: null, fn_url: null, fn_key: null }],
  re_push_subs: Object.values(devs).map((d) => ({ ...d.row })),
  re_leads: [{ id: LEAD, name: 'Laura Fernández', phone: '+34612345678', kind: 'booking', property_ref: 'SH-1019', message: 'Hola', meta: { booking: { check_in: '2026-12-29', check_out: '2027-01-02', guests: 4 } }, source: 'website' }],
}
const tokens = { 'tok-owner': OWNER, 'tok-sec': SEC, 'tok-off': OFF, 'tok-outsider': '00000000-0000-0000-0000-0000000000ff' }
const pushes = []
const gone = new Set(['https://updates.push.services.mozilla.com/wpush/v2/owner-old'])
let restDown = false

const json = (v, status = 200) => new Response(JSON.stringify(v), { status, headers: { 'Content-Type': 'application/json' } })
function matches(row, params) {
  for (const [k, v] of params) {
    if (k === 'select') continue
    const cell = row[k]
    if (v.startsWith('eq.')) {
      if (String(cell) !== v.slice(3)) return false
    } else if (v.startsWith('in.(')) {
      if (!v.slice(4, -1).split(',').includes(String(cell))) return false
    } else if (v === 'is.null') {
      if (cell != null) return false
    } else throw new Error('filter not supported in test: ' + k + '=' + v)
  }
  return true
}

async function fakeFetch(input, init = {}) {
  const url = new URL(typeof input === 'string' ? input : input.url)
  const headers = init.headers ?? {}
  if (url.origin === BASE) {
    if (url.pathname === '/auth/v1/user') {
      const id = tokens[(headers.Authorization ?? '').replace('Bearer ', '')]
      return id ? json({ id, email: id + '@x' }) : json({ msg: 'invalid JWT' }, 401)
    }
    if (url.pathname.startsWith('/rest/v1/')) {
      if (headers.apikey !== SECRET || headers.Authorization !== `Bearer ${SECRET}`) return json({ message: 'no key' }, 401)
      if (restDown) return json({ message: 'down' }, 503)
      const table = url.pathname.slice('/rest/v1/'.length)
      const rows = db[table]
      if (!rows) return json({ message: 'no table ' + table }, 404)
      const hits = rows.filter((r) => matches(r, url.searchParams))
      const method = init.method ?? 'GET'
      if (method === 'GET') return json(hits)
      if (method === 'PATCH') {
        const patch = JSON.parse(init.body)
        for (const r of hits) Object.assign(r, patch)
        return /return=representation/.test(headers.Prefer ?? '') ? json(hits) : new Response(null, { status: 204 })
      }
      if (method === 'DELETE') {
        db[table] = rows.filter((r) => !hits.includes(r))
        return new Response(null, { status: 204 })
      }
    }
    return json({ message: 'unexpected ' + url.pathname }, 500)
  }
  // a push service
  pushes.push({ endpoint: url.href, headers, body: init.body })
  return new Response(gone.has(url.href) ? 'expired' : '', { status: gone.has(url.href) ? 410 : 201 })
}

const ctx = { url: BASE, serviceKey: SECRET, anonKey: ANON, fetch: fakeFetch, now: () => Date.UTC(2026, 9, 26, 12) }
const call = async (body, { token, hook, method = 'POST', raw } = {}) => {
  const headers = { 'Content-Type': 'application/json' }
  if (token) headers.Authorization = `Bearer ${token}`
  if (hook) headers['x-hook-secret'] = hook
  const res = await handle(new Request(`${BASE}/functions/v1/re-push`, { method, headers, body: method === 'POST' ? raw ?? JSON.stringify(body) : undefined }), ctx)
  let j = null
  try {
    j = await res.json()
  } catch {
    /* empty */
  }
  return { status: res.status, json: j, res }
}

// ------------------------------------------------------------ transport and callers
let r = await handle(new Request(`${BASE}/functions/v1/re-push`, { method: 'OPTIONS' }), ctx)
ok('OPTIONS answers CORS', r.status === 200 && r.headers.get('Access-Control-Allow-Origin') === '*')
r = await call(null, { method: 'GET', token: 'tok-owner' })
ok('GET refused', r.status === 405)
r = await call(null, { raw: '{oops', token: 'tok-owner' })
ok('broken JSON → bad_request', r.status === 400)
r = await call({ action: 'key' })
ok('key: no log-in → not_signed_in', r.status === 401 && r.json.error === 'not_signed_in')
r = await call({ action: 'key' }, { token: 'tok-outsider' })
ok('key: an account outside the team → not_staff', r.status === 403 && r.json.error === 'not_staff')
r = await call({ action: 'key' }, { token: 'tok-off' })
ok('key: a deactivated member → not_staff', r.status === 403)
r = await call({ action: 'fly' }, { token: 'tok-owner' })
ok('unknown action → bad_request', r.status === 400)

// ------------------------------------------------------------ first use: keys and the trigger's route
const [k1, k2] = await Promise.all([call({ action: 'key' }, { token: 'tok-owner' }), call({ action: 'key' }, { token: 'tok-sec' })])
const cfg = db.re_push_config[0]
ok('key: a member gets the public key', k1.status === 200 && Buffer.from(k1.json.publicKey, 'base64url').length === 65, JSON.stringify(k1.json))
ok('key: two first calls at once end with ONE key pair', k2.json?.publicKey === k1.json?.publicKey && cfg.vapid_public === k1.json.publicKey && typeof cfg.vapid_private?.d === 'string')
ok('key: the private half never leaves the function', !JSON.stringify(k1.json).includes(cfg.vapid_private.d))
ok('key: the trigger learns where to call', cfg.fn_url === `${BASE}/functions/v1/re-push` && cfg.fn_key === ANON)
r = await call({ action: 'key' }, { token: 'tok-sec' })
ok('key: later calls keep the same key', r.json?.publicKey === k1.json.publicKey)

// ------------------------------------------------------------ the trigger's call
r = await call({ action: 'ping' })
ok('ping: without the secret → forbidden', r.status === 403)
r = await call({ action: 'lead', id: LEAD }, { hook: 'h'.repeat(63) + 'x' })
ok('lead: a wrong secret → forbidden, nothing sent', r.status === 403 && pushes.length === 0)
r = await call({ action: 'lead', id: LEAD }, { token: 'tok-owner' })
ok('lead: a member cannot trigger it (no secret)', r.status === 403 && pushes.length === 0)
r = await call({ action: 'ping' }, { hook: HOOK })
ok('ping: with the secret → devices counted', r.status === 200 && r.json.ok === true && r.json.devices === 4)
r = await call({ action: 'lead', id: 'not-a-uuid' }, { hook: HOOK })
ok('lead: a malformed id → bad_request', r.status === 400)
r = await call({ action: 'lead', id: '22222222-2222-2222-2222-222222222222' }, { hook: HOOK })
ok('lead: an unknown request → not_found', r.status === 404)

r = await call({ action: 'lead', id: LEAD }, { hook: HOOK })
ok('lead: sent to the active team, expired device removed', r.status === 200 && r.json.sent === 2 && r.json.removed === 1 && r.json.failed === 0, JSON.stringify(r.json))
const to = pushes.map((p) => p.endpoint)
ok('lead: the owner’s phone and the secretary’s iPhone, not a former member', to.includes(devs.a.row.endpoint) && to.includes(devs.c.row.endpoint) && !to.includes(devs.d.row.endpoint))
ok('lead: an expired device is forgotten', !db.re_push_subs.some((s) => s.id === devs.b.row.id) && db.re_push_subs.some((s) => s.id === devs.d.row.id))
ok('lead: delivered devices are dated', db.re_push_subs.find((s) => s.id === devs.a.row.id)?.last_ok_at === '2026-10-26T12:00:00.000Z')
const toA = pushes.find((p) => p.endpoint === devs.a.row.endpoint)
let seen = null
try {
  seen = JSON.parse(open(toA.body, devs.a.ua, devs.a.auth).text)
} catch (e) {
  seen = { error: e.message }
}
ok('lead: the owner’s phone opens the message', seen?.title === 'طلب حجز موسمي · SH-1019' && seen.body.includes('من 29/12 إلى 02/01') && seen.url === `admin/leads?open=${LEAD}`, JSON.stringify(seen))
const toC = pushes.find((p) => p.endpoint === devs.c.row.endpoint)
const vapid = readVapid(toC.headers.Authorization, k1.json.publicKey)
ok('lead: signed for Apple’s push service with the agency key', vapid?.signed === true && vapid.claims.aud === 'https://web.push.apple.com' && vapid.claims.sub === 'mailto:owner@agency.test')
ok('lead: sent as aes128gcm, kept a day, urgent', toC.headers['Content-Encoding'] === 'aes128gcm' && toC.headers.TTL === '86400' && toC.headers.Urgency === 'high')
let readByOther = true
try {
  open(toC.body, devs.a.ua, devs.a.auth)
} catch {
  readByOther = false
}
ok('lead: one member’s message cannot be opened with another device', !readByOther)

// ------------------------------------------------------------ test button
pushes.length = 0
r = await call({ action: 'test' }, { token: 'tok-sec' })
ok('test: only the caller’s own devices', r.status === 200 && r.json.sent === 1 && pushes.length === 1 && pushes[0].endpoint === devs.c.row.endpoint)
ok('test: the test message', JSON.parse(open(pushes[0].body, devs.c.ua, devs.c.auth).text).tag === 'test')
db.re_push_subs = db.re_push_subs.filter((s) => s.staff_id !== SEC)
r = await call({ action: 'test' }, { token: 'tok-sec' })
ok('test: no device yet → nothing sent', r.status === 200 && r.json.sent === 0)

// ------------------------------------------------------------ failures
restDown = true
r = await call({ action: 'lead', id: LEAD }, { hook: HOOK })
restDown = false
ok('database down → service_error, no crash', r.status === 500 && r.json.error === 'service_error')
db.re_push_config = []
r = await call({ action: 'ping' }, { hook: HOOK })
ok('service keys missing (schema not run) → forbidden', r.status === 403)
r = await call({ action: 'key' }, { token: 'tok-owner' })
ok('key: schema not run → not_installed', r.status === 500 && r.json.error === 'not_installed')

console.log(`\n${pass} passed, ${fail} failed`)
process.exit(fail ? 1 : 0)
