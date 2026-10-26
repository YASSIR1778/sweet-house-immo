// npm run test:db — runs supabase/schema.sql in an in-memory Postgres (PGlite) with Supabase-like
// stubs (roles, auth.users, storage), twice, then checks every security rule as
// website visitor / owner / active secretary / pending secretary. Nothing touches a real database.
import { readFileSync } from 'node:fs'
import { PGlite } from '@electric-sql/pglite'

let pgcrypto
try {
  ;({ pgcrypto } = await import('@electric-sql/pglite/contrib/pgcrypto'))
} catch {
  pgcrypto = undefined
}

const schemaPath = process.argv[2] ?? new URL('../supabase/schema.sql', import.meta.url)
const OWNER_EMAIL = 'owner@agency.test'
const schema = readFileSync(schemaPath, 'utf8').replace("'OWNER_EMAIL@example.com'", `'${OWNER_EMAIL}'`)

const db = new PGlite(pgcrypto ? { extensions: { pgcrypto } } : {})
let pass = 0
let fail = 0
const ok = (name, cond, extra = '') => {
  if (cond) pass++
  else fail++
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}${extra ? '  -> ' + extra : ''}`)
}
const fails = async (name, fn, expect = /./) => {
  try {
    await fn()
    ok(name, false, 'no error')
  } catch (e) {
    ok(name, expect.test(String(e.message)), String(e.message).slice(0, 90))
  }
}
const one = async (sql, params) => (await db.query(sql, params)).rows[0]
const count = async (sql, params) => Number((await db.query(sql, params)).rows[0].n)

async function as(uid, fn) {
  await db.exec(`select set_config('request.jwt.claim.sub', '${uid ?? ''}', false); set role ${uid ? 'authenticated' : 'anon'};`)
  try {
    return await fn()
  } finally {
    await db.exec(`reset role; select set_config('request.jwt.claim.sub', '', false);`)
  }
}

// ------------------------------------------------------------ Supabase stand-ins
await db.exec(`
  create role anon nologin; create role authenticated nologin; create role service_role nologin;
  grant usage on schema public to anon, authenticated, service_role;
  alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
  alter default privileges in schema public grant all on functions to anon, authenticated, service_role;
  alter default privileges in schema public grant all on sequences to anon, authenticated, service_role;

  create schema auth;
  create table auth.users (id uuid primary key default gen_random_uuid(), email text, raw_user_meta_data jsonb default '{}'::jsonb, created_at timestamptz default now());
  create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
  grant usage on schema auth to anon, authenticated, service_role;
  grant execute on function auth.uid() to anon, authenticated, service_role;

  create schema storage;
  create table storage.buckets (id text primary key, name text not null, public boolean default false, file_size_limit bigint, allowed_mime_types text[]);
  create table storage.objects (id uuid primary key default gen_random_uuid(), bucket_id text references storage.buckets (id), name text, owner uuid);
  alter table storage.objects enable row level security;
  grant usage on schema storage to anon, authenticated, service_role;
  grant all on storage.objects, storage.buckets to anon, authenticated, service_role;
`)
if (!pgcrypto) await db.exec(`create schema if not exists ext_stub;`) // pgcrypto line may fail below if the extension is missing

// ------------------------------------------------------------ schema, twice (idempotent)
try {
  await db.exec(schema)
  ok('schema runs (1st time)', true)
} catch (e) {
  ok('schema runs (1st time)', false, e.message)
  process.exit(1)
}

const OWNER = '00000000-0000-0000-0000-00000000000a'
const SEC = '00000000-0000-0000-0000-00000000000b'
const OTHER = '00000000-0000-0000-0000-00000000000c'
const LATE = '00000000-0000-0000-0000-00000000000d'

// ------------------------------------------------------------ sign-ups (auth trigger)
await db.query(`insert into auth.users (id, email, raw_user_meta_data) values ($1, $2, '{"full_name":"ياسر"}')`, [OWNER, OWNER_EMAIL])
await db.query(`insert into auth.users (id, email, raw_user_meta_data) values ($1, 'sec@agency.test', '{"app":"sweet-house-immo","full_name":"سلمى"}')`, [SEC])
await db.query(`insert into auth.users (id, email, raw_user_meta_data) values ($1, 'other@elsewhere.test', '{}')`, [OTHER])
let r = await one(`select role, active, full_name from re_staff where id = $1`, [OWNER])
ok('owner e-mail signs up → active admin', r?.role === 'admin' && r?.active === true, JSON.stringify(r))
r = await one(`select role, active, full_name from re_staff where id = $1`, [SEC])
ok('app sign-up → pending secretary', r?.role === 'secretary' && r?.active === false, JSON.stringify(r))
ok('account of another app → no staff row', (await count(`select count(*) n from re_staff where id = $1`, [OTHER])) === 0)

// ------------------------------------------------------------ pending secretary sees nothing
await as(SEC, async () => {
  ok('pending: sees no properties', (await count(`select count(*) n from re_properties`)) === 0)
  await fails('pending: cannot add a property', () => db.query(`insert into re_properties (ref, title) values ('SH-9', 'x')`), /row-level security/)
  ok('pending: can read own staff row', (await count(`select count(*) n from re_staff where id = $1`, [SEC])) === 1)
  ok('pending: cannot read other staff', (await count(`select count(*) n from re_staff where id <> $1`, [SEC])) === 0)
})

// ------------------------------------------------------------ owner activates the secretary
await as(OWNER, async () => {
  const u = await db.query(`update re_staff set active = true where id = $1`, [SEC])
  ok('owner activates secretary', u.affectedRows === 1)
  await db.query(`insert into re_settings (key, value) values ('agency', '{"phone":"0702873088"}')`)
  ok('owner writes settings', (await count(`select count(*) n from re_settings`)) === 1)
  const d = await db.query(`delete from re_staff where id = $1`, [OWNER])
  ok('owner cannot delete himself', d.affectedRows === 0)
})

// ------------------------------------------------------------ active secretary
let P1, P2, P3
await as(SEC, async () => {
  P1 = (await one(`insert into re_properties (ref, title, price, published, status, private_notes) values ('SH-1001', 'شقة', 900000, true, 'available', 'أقل ثمن 850000') returning id`)).id
  P2 = (await one(`insert into re_properties (ref, title, price, published, status) values ('SH-1002', 'مسودة', 500000, true, 'draft') returning id`)).id
  P3 = (await one(`insert into re_properties (ref, title, price, published, status) values ('SH-1003', 'مخفي', 700000, false, 'available') returning id`)).id
  ok('secretary adds properties', Boolean(P1 && P2 && P3))
  const u = await db.query(`update re_properties set price = 880000 where id = $1`, [P1])
  ok('secretary edits a property', u.affectedRows === 1)
  const d = await db.query(`delete from re_properties where id = $1`, [P1])
  ok('secretary cannot delete a property', d.affectedRows === 0)
  ok('secretary sees no deals', (await count(`select count(*) n from re_deals`)) === 0)
  await fails('secretary cannot add a deal', () => db.query(`insert into re_deals (amount, commission) values (1, 1)`), /row-level security/)
  await fails('secretary cannot write settings', () => db.query(`insert into re_settings (key, value) values ('site', '{}')`), /row-level security/)
  const p = await db.query(`update re_staff set role = 'admin' where id = $1`, [SEC])
  ok('secretary cannot promote herself', p.affectedRows === 0)
  await db.query(`insert into re_activity (actor, action, entity) values ($1, 'create', 'property')`, [SEC])
  ok('secretary logs her activity', true)
  await fails('secretary cannot log as someone else', () => db.query(`insert into re_activity (actor, action, entity) values ($1, 'create', 'property')`, [OWNER]), /row-level security/)
  ok('secretary cannot read the activity log', (await count(`select count(*) n from re_activity`)) === 0)
  await db.query(`insert into storage.objects (bucket_id, name) values ('property-images', '2026/a.jpg')`)
  ok('secretary uploads a photo', true)
  const c = (await one(`insert into re_clients (full_name, phone) values ('زبون', '0611223344') returning id`)).id
  await db.query(`insert into re_appointments (title, starts_at, ends_at, property_id, client_id) values ('زيارة', now(), now() + interval '45 minutes', $1, $2)`, [P1, c])
  await db.query(`insert into re_tasks (title) values ('مهمة')`)
  await db.query(`insert into re_calls (caller_name, phone, subject) values ('زبون', '0611223344', 'سؤال')`)
  ok('secretary uses clients, agenda, tasks, calls', true)
})

// ------------------------------------------------------------ owner sees everything
await as(OWNER, async () => {
  ok('owner reads the activity log', (await count(`select count(*) n from re_activity`)) === 1)
  await db.query(`insert into re_deals (property_id, amount, commission) values ($1, 900000, 22500)`, [P1])
  ok('owner records a deal', (await count(`select count(*) n from re_deals`)) === 1)
})

// ------------------------------------------------------------ permissions chosen by the owner
const setPerms = (perms, role = 'secretary') => as(OWNER, () => db.query(`update re_staff set permissions = $1, role = $2 where id = $3`, [perms, role, SEC]))
await setPerms([])
await as(SEC, async () => {
  ok('no «properties»: still reads properties', (await count(`select count(*) n from re_properties`)) === 3)
  await fails('no «properties»: cannot add a property', () => db.query(`insert into re_properties (ref, title) values ('SH-1100', 'x')`), /row-level security/)
  const u = await db.query(`update re_properties set price = 1 where id = $1`, [P1])
  ok('no «properties»: cannot edit a property', u.affectedRows === 0)
  await fails('no «properties»: cannot upload photos', () => db.query(`insert into storage.objects (bucket_id, name) values ('property-images', 'y.jpg')`), /row-level security/)
  await db.query(`insert into re_tasks (title) values ('مهمة يومية')`)
  ok('no «properties»: daily work still allowed', true)
  await fails('no «delete»: cannot delete a client', async () => {
    const c = (await one(`insert into re_clients (full_name, phone) values ('ل', '0600000008') returning id`)).id
    const d = await db.query(`delete from re_clients where id = $1`, [c])
    if (d.affectedRows === 0) throw new Error('blocked')
  }, /blocked/)
})
await setPerms(['delete', 'deals', 'settings', 'activity'])
await as(SEC, async () => {
  const c = (await one(`insert into re_clients (full_name, phone) values ('للحذف', '0600000009') returning id`)).id
  const d = await db.query(`delete from re_clients where id = $1`, [c])
  ok('«delete»: deletes a client', d.affectedRows === 1)
  ok('«deals»: sees the deals', (await count(`select count(*) n from re_deals`)) === 1)
  await db.query(`insert into re_deals (amount, commission) values (2, 1)`)
  ok('«deals»: records a deal', (await count(`select count(*) n from re_deals`)) === 2)
  const st = await db.query(`update re_settings set value = '{"phone":"0700000000"}' where key = 'agency'`)
  ok('«settings»: edits the settings', st.affectedRows === 1)
  ok('«activity»: reads the log', (await count(`select count(*) n from re_activity`)) >= 1)
  const self = await db.query(`update re_staff set permissions = '{properties,delete,deals,reports,export,settings,activity}', role = 'admin' where id = $1`, [SEC])
  ok('a member cannot change her own permissions', self.affectedRows === 0)
})
await fails('an unknown permission is refused', () => as(OWNER, () => db.query(`update re_staff set permissions = '{fly}' where id = $1`, [SEC])), /check constraint/)
// the owner's account is protected, even from a second admin
await setPerms(['properties'], 'admin')
await as(SEC, async () => {
  await db.query(`update re_staff set role = 'secretary', active = false, email = 'x@y.z' where id = $1`, [OWNER])
})
r = await one(`select role, active, email from re_staff where id = $1`, [OWNER])
ok('owner stays an active admin with the same e-mail', r.role === 'admin' && r.active === true && r.email === OWNER_EMAIL, JSON.stringify(r))
await as(OWNER, async () => {
  await db.query(`update re_staff set role = 'secretary', active = false where id = $1`, [OWNER])
})
r = await one(`select role, active from re_staff where id = $1`, [OWNER])
ok('owner cannot lock himself out by mistake', r.role === 'admin' && r.active === true, JSON.stringify(r))
await setPerms(['properties'])
r = await one(`select role, permissions from re_staff where id = $1`, [SEC])
ok('back to a normal secretary', r.role === 'secretary' && r.permissions.join() === 'properties', JSON.stringify(r))
await db.query(`delete from re_deals where amount = 2`)
await db.query(`delete from re_tasks where title = 'مهمة يومية'`)
await db.query(`delete from re_clients where phone = '0600000008'`)

// ------------------------------------------------------------ partners network and private settings
let BR
await as(SEC, async () => {
  BR = (await one(`insert into re_brokers (full_name, phone, agreement_mode, agreement_value) values ('وسيط', '0611000000', 'percent', 30) returning id`)).id
  ok('member adds a partner broker', Boolean(BR))
  const u = await db.query(`update re_brokers set notes = 'شريك قديم' where id = $1`, [BR])
  ok('member edits a partner', u.affectedRows === 1)
  const d = await db.query(`delete from re_brokers where id = $1`, [BR])
  ok('member without «delete» cannot delete a partner', d.affectedRows === 0)
  await db.query(`update re_properties set broker_id = $1 where id = $2`, [BR, P1])
  ok('member links a property to its broker', (await one(`select broker_id from re_properties where id = $1`, [P1])).broker_id === BR)
  ok('member reads private settings', (await count(`select count(*) n from re_private`)) === 0)
  await fails('member without «settings» cannot write private settings', () => db.query(`insert into re_private (key, value) values ('network', '{}')`), /row-level security/)
  await fails('unknown agreement mode refused', () => db.query(`insert into re_brokers (full_name, agreement_mode) values ('x', 'gift')`), /check constraint/)
})
await as(OWNER, async () => {
  await db.query(`insert into re_private (key, value) values ('network', '{"listing_share":50,"client_share":50}')`)
  ok('owner writes private settings', (await count(`select count(*) n from re_private`)) === 1)
  const dl = (await one(`insert into re_deals (property_id, amount, commission, commission_seller, commission_buyer, shares) values ($1, 1000000, 50000, 25000, 25000, $2::jsonb) returning shares, received`, [P1, JSON.stringify([{ id: 's1', party: 'broker', ref_id: BR, name: 'وسيط', side: 'client', mode: 'percent', value: 30, paid: 0, paid_at: null }])]))
  ok('deal keeps the shares of its partners', Array.isArray(dl.shares) && dl.shares[0].value === 30 && Number(dl.received) === 0)
  await db.query(`delete from re_deals where amount = 1000000`)
  const d = await db.query(`delete from re_brokers where id = $1`, [BR])
  ok('owner deletes a partner', d.affectedRows === 1)
})
ok('deleting a partner keeps the property', (await one(`select broker_id from re_properties where id = $1`, [P1])).broker_id === null)
await as(null, async () => {
  ok('anon: partners hidden', (await count(`select count(*) n from re_brokers`)) === 0)
  ok('anon: private settings hidden', (await count(`select count(*) n from re_private`)) === 0)
  const pub = await db.query(`select * from re_public_properties()`)
  ok('anon: no broker on public properties', !pub.fields.some((f) => f.name === 'broker_id'))
})
await db.query(`delete from re_private`)

// ------------------------------------------------------------ owners: mandates, documents, price history, owner link
const OWNERC = (await one(`insert into re_clients (full_name, phone, kind, lang) values ('خديجة الريسوني', '0655443322', 'owner', 'ar') returning id`)).id
await db.query(`update re_properties set owner_client_id = $1 where id = $2`, [OWNERC, P1])
ok('price history: starting price recorded for every property', (await count(`select count(*) n from re_price_history where property_id = $1 and old_price is null`, [P1])) === 1)
await as(SEC, async () => {
  const m = (await one(`insert into re_mandates (property_id, owner_client_id, kind, end_date, commission_rate) values ($1, $2, 'exclusive', current_date + 20, 2.5) returning id, status`, [P1, OWNERC]))
  ok('member with «properties» adds a mandate', m?.status === 'active')
  const d = await db.query(`delete from re_mandates where id = $1`, [m.id])
  ok('member without «delete» cannot delete a mandate', d.affectedRows === 0)
  const doc = (await one(`insert into re_documents (client_id, property_id, kind, title, path, file_name) values ($1, $2, 'title', 'شهادة الملكية', 'owners/a.pdf', 'a.pdf') returning id`, [OWNERC, P1])).id
  ok('member adds a document', Boolean(doc))
  const dd = await db.query(`delete from re_documents where id = $1`, [doc])
  ok('the uploader can remove his own document', dd.affectedRows === 1)
  await fails('a document needs an owner or a property', () => db.query(`insert into re_documents (kind, path) values ('other', 'x.pdf')`), /check constraint/)
  await db.query(`insert into storage.objects (bucket_id, name, owner) values ('property-docs', 'owners/b.pdf', $1)`, [SEC])
  ok('member uploads a private file', (await count(`select count(*) n from storage.objects where bucket_id = 'property-docs'`)) === 1)
  await db.query(`update re_properties set price = 870000 where id = $1`, [P1])
  await db.query(`update re_properties set title = 'شقة' where id = $1`, [P1])
  ok('price changes recorded, title change ignored', (await count(`select count(*) n from re_price_history where property_id = $1`, [P1])) === 3)
  await fails('member cannot write the price history by hand', () => db.query(`insert into re_price_history (property_id, new_price) values ($1, 1)`, [P1]), /row-level security/)
})
await setPerms([])
await as(SEC, async () => {
  await fails('member without «properties» cannot add a mandate', () => db.query(`insert into re_mandates (property_id) values ($1)`, [P1]), /row-level security/)
  ok('member without «properties» still reads mandates', (await count(`select count(*) n from re_mandates`)) === 1)
})
await setPerms(['properties'])
const TOKEN = '11111111-2222-3333-4444-555555555555'
await db.query(`update re_clients set share_token = $1 where id = $2`, [TOKEN, OWNERC])
await db.query(`insert into re_appointments (title, kind, starts_at, ends_at, property_id, status) values ('زيارة', 'visit', now() - interval '2 days', now() - interval '2 days' + interval '30 minutes', $1, 'done')`, [P1])
await as(null, async () => {
  ok('anon: mandates, documents and price history hidden', (await count(`select count(*) n from re_mandates`)) + (await count(`select count(*) n from re_documents`)) + (await count(`select count(*) n from re_price_history`)) === 0)
  ok('anon: private files hidden', (await count(`select count(*) n from storage.objects where bucket_id = 'property-docs'`)) === 0)
  const rep = (await one(`select re_owner_report($1) r`, [TOKEN])).r
  ok('owner link: report of his properties', rep?.name === 'خديجة' && rep.properties.length === 1 && rep.properties[0].ref === 'SH-1001', JSON.stringify(rep)?.slice(0, 120))
  const pr = rep?.properties?.[0] ?? {}
  ok('owner link: activity counts and price history', pr.visits_done === 1 && pr.prices.length === 3 && pr.mandate?.kind === 'exclusive')
  ok('owner link: no private data', !JSON.stringify(rep).match(/private_notes|0611223344|أقل ثمن|phone/))
  ok('owner link: wrong token gives nothing', (await one(`select re_owner_report('99999999-2222-3333-4444-555555555555') r`)).r === null)
})
await db.query(`delete from re_appointments where title = 'زيارة' and kind = 'visit' and status = 'done' and property_id = $1 and client_id is null`, [P1])
await db.query(`update re_properties set owner_client_id = null, price = 880000, title = 'شقة' where id = $1`, [P1])

// ------------------------------------------------------------ offers and visitors' feedback
const OWN2 = (await one(`insert into re_clients (full_name, phone, kind, share_token) values ('مالك العروض', '0600000066', 'owner', '22222222-3333-4444-5555-666666666666') returning id`)).id
await db.query(`update re_properties set owner_client_id = $1 where id = $2`, [OWN2, P3])
await as(SEC, async () => {
  const o = (await one(`insert into re_offers (property_id, amount, financing, conditions) values ($1, 650000, 'loan', 'بشرط موافقة البنك') returning id, status`, [P3]))
  ok('member records an offer', o?.status === 'pending')
  const u = await db.query(`update re_offers set status = 'countered', counter_amount = 680000 where id = $1`, [o.id])
  ok('member records a counter-offer', u.affectedRows === 1)
  await fails('unknown offer status refused', () => db.query(`update re_offers set status = 'maybe' where id = $1`, [o.id]), /check constraint/)
  const d = await db.query(`delete from re_offers where id = $1`, [o.id])
  ok('member without «delete» cannot delete an offer', d.affectedRows === 0)
  await db.query(`insert into re_appointments (title, kind, starts_at, ends_at, property_id, status, feedback_interest, feedback_price, feedback_note) values ('زيارة 1', 'visit', now() - interval '3 days', now() - interval '3 days' + interval '30 minutes', $1, 'done', 'hot', 'high', 'أعجبه الموقع')`, [P3])
  await db.query(`insert into re_appointments (title, kind, starts_at, ends_at, property_id, status, feedback_interest, feedback_price) values ('زيارة 2', 'visit', now() - interval '2 days', now() - interval '2 days' + interval '30 minutes', $1, 'done', 'cold', 'high')`, [P3])
  await fails('unknown feedback refused', () => db.query(`update re_appointments set feedback_price = 'cheap' where title = 'زيارة 1'`), /check constraint/)
})
await as(null, async () => {
  ok('anon: offers hidden', (await count(`select count(*) n from re_offers`)) === 0)
  const r = (await one(`select re_owner_report('22222222-3333-4444-5555-666666666666') r`)).r
  const pr = r?.properties?.[0] ?? {}
  ok('owner link: offers count and visitors feedback', pr.offers === 1 && pr.feedback?.hot === 1 && pr.feedback?.cold === 1 && pr.feedback?.price_high === 2, JSON.stringify(pr.feedback))
  ok('owner link: no offer amounts or visitor notes', !JSON.stringify(r).match(/650000|680000|أعجبه|بشرط/))
})
await db.query(`delete from re_appointments where title in ('زيارة 1', 'زيارة 2')`)
await db.query(`delete from re_offers`)
await db.query(`update re_properties set owner_client_id = null where id = $1`, [P3])
await db.query(`delete from re_clients where id = $1`, [OWN2])
await db.query(`delete from re_trash`)

// ------------------------------------------------------------ trash
await as(OWNER, async () => {
  const c = (await one(`insert into re_clients (full_name, phone) values ('للسلة', '0600000077') returning id`)).id
  await db.query(`insert into re_documents (client_id, kind, title, path) values ($1, 'id', 'بطاقة', 'x/card.pdf')`, [c])
  await db.query(`delete from re_clients where id = $1`, [c])
  const tr = await db.query(`select table_name, label, data from re_trash where row_id = $1`, [c])
  ok('deleted client kept in the trash with its data', tr.rows.length === 1 && tr.rows[0].table_name === 're_clients' && tr.rows[0].label === 'للسلة' && tr.rows[0].data.phone === '0600000077')
  ok('cascaded document kept too', (await count(`select count(*) n from re_trash where table_name = 're_documents' and data ->> 'client_id' = $1`, [c])) === 1)
  await db.query(`insert into re_clients select * from jsonb_populate_record(null::re_clients, (select data from re_trash where row_id = $1))`, [c])
  ok('owner restores it with the same id', (await count(`select count(*) n from re_clients where id = $1`, [c])) === 1)
  const purge = await db.query(`delete from re_trash where row_id = $1`, [c])
  ok('owner empties trash items', purge.affectedRows === 1)
  await db.query(`delete from re_documents where client_id = $1`, [c])
  await db.query(`delete from re_clients where id = $1`, [c])
})
await as(SEC, async () => {
  ok('member without «delete» does not see the trash', (await count(`select count(*) n from re_trash`)) === 0)
  await fails('nobody writes the trash by hand', () => db.query(`insert into re_trash (table_name, row_id, data) values ('re_clients', gen_random_uuid(), '{}')`), /row-level security/)
})
await as(null, async () => {
  ok('anon: trash hidden', (await count(`select count(*) n from re_trash`)) === 0)
})
await db.query(`delete from re_trash`)

// ------------------------------------------------------------ deal file, invoices, receipts, expenses
await setPerms(['properties'])
await as(SEC, async () => {
  ok('member without «deals» sees no invoice, receipt or expense', (await count(`select (select count(*) from re_invoices) + (select count(*) from re_payments) + (select count(*) from re_expenses) n`)) === 0)
  await fails('member without «deals» cannot issue an invoice', () => db.query(`insert into re_invoices (no, bill_name, total_ttc) values ('', 'زبون', 100)`), /row-level security/)
  await fails('member without «deals» cannot record an expense', () => db.query(`insert into re_expenses (label, amount) values ('كراء', 4000)`), /row-level security/)
})
await setPerms(['properties', 'deals'])
await as(SEC, async () => {
  const d = (await one(`insert into re_deals (kind, amount, commission, commission_buyer, stage, checklist, deposit, notary) values ('sale', 850000, 21250, 21250, 'paperwork', '[{"id":"1","label":"شهادة الملكية","done":true,"at":null}]', 85000, 'الموثق') returning id, stage`))
  ok('deal file: stage, checklist, deposit, notary', d?.stage === 'paperwork')
  await fails('unknown deal stage refused', () => db.query(`update re_deals set stage = 'maybe' where id = $1`, [d.id]), /check constraint/)
  const i1 = await one(`insert into re_invoices (no, deal_id, party, bill_name, lines, vat_rate, total_ht, total_vat, total_ttc, issued_at) values ('', $1, 'buyer', 'أحمد العلمي', '[{"label":"Honoraires","qty":1,"unit":17708.33}]', 20, 17708.33, 3541.67, 21250, '2026-03-02') returning id, no`, [d.id])
  const i2 = await one(`insert into re_invoices (no, party, bill_name, total_ttc, issued_at) values ('F-2026-0099', 'seller', 'البائع', 1000, '2026-03-03') returning id, no`)
  ok('invoices numbered by the database, in order, whatever the app sends', i1?.no === 'F-2026-0001' && i2?.no === 'F-2026-0002', `${i1?.no} ${i2?.no}`)
  const i3 = await one(`insert into re_invoices (no, bill_name, total_ttc, issued_at) values ('', 'زبون', 500, '2027-01-04') returning no`)
  ok('a new year starts a new series', i3?.no === 'F-2027-0001', i3?.no)
  const again = await one(`insert into re_invoices (id, no, deal_id, party, bill_name, lines, vat_rate, total_ht, total_vat, total_ttc, issued_at, status, paid) values ($1, $2, $3, 'buyer', 'أحمد العلمي', '[{"label":"Honoraires","qty":1,"unit":17708.33}]', 20, 17708.33, 3541.67, 21250, '2026-03-02', 'paid', 21250)
    on conflict (id) do update set status = excluded.status, paid = excluded.paid, no = excluded.no, lines = excluded.lines, total_ttc = excluded.total_ttc returning no, status`, [i1.id, i1.no, d.id])
  ok('saving an invoice again keeps its number', again?.no === 'F-2026-0001' && again?.status === 'paid')
  await fails('an issued invoice cannot be rewritten', () => db.query(`update re_invoices set total_ttc = 1 where id = $1`, [i1.id]), /document_locked/)
  await fails('nor its customer', () => db.query(`update re_invoices set bill_name = 'آخر' where id = $1`, [i1.id]), /document_locked/)
  const cn = await one(`insert into re_invoices (no, kind, ref_invoice_id, party, bill_name, total_ttc, issued_at) values ('', 'credit', $1, 'seller', 'البائع', -1000, '2026-03-05') returning no`, [i2.id])
  ok('credit note in its own series', cn?.no === 'AV-2026-0001', cn?.no)
  await db.query(`update re_invoices set status = 'cancelled' where id = $1`, [i2.id])
  await fails('a cancelled invoice stays cancelled', () => db.query(`update re_invoices set status = 'issued' where id = $1`, [i2.id]), /document_locked/)
  const del = await db.query(`delete from re_invoices where id = $1`, [i1.id])
  ok('an invoice is never deleted, even with «deals»', del.affectedRows === 0)
  const r1 = await one(`insert into re_payments (no, deal_id, invoice_id, party, payer_name, amount, method, reference, received_at) values ('', $1, $2, 'buyer', 'أحمد العلمي', 10000, 'cheque', 'CHQ 123', '2026-03-06') returning id, no`, [d.id, i1.id])
  ok('receipt numbered R-year-0001', r1?.no === 'R-2026-0001', r1?.no)
  await fails('receipt amount must be positive', () => db.query(`insert into re_payments (no, payer_name, amount) values ('', 'x', 0)`), /check constraint/)
  await fails('a receipt amount cannot be changed', () => db.query(`update re_payments set amount = 1 where id = $1`, [r1.id]), /document_locked/)
  const rc = await db.query(`update re_payments set status = 'cancelled', notes = 'شيك بدون رصيد' where id = $1`, [r1.id])
  ok('a receipt can be cancelled with a note', rc.affectedRows === 1)
  const e = (await one(`insert into re_expenses (category, label, amount, method) values ('ads', 'إعلان فيسبوك', 1200, 'card') returning id`)).id
  await fails('unknown expense category refused', () => db.query(`update re_expenses set category = 'party' where id = $1`, [e]), /check constraint/)
  const ed = await db.query(`delete from re_expenses where id = $1`, [e])
  ok('member without «delete» cannot delete an expense', ed.affectedRows === 0)
  ok('nobody resets the counters by hand', (await db.query(`update re_counters set n = 0`)).affectedRows === 0)
  await fails('nobody adds a counter by hand', () => db.query(`insert into re_counters (key, n) values ('F-2030', 5)`), /row-level security/)
  ok('counters are not readable', (await count(`select count(*) n from re_counters`)) === 0)
})
ok('the 2026 invoice counter moved only twice (no gap)', (await one(`select n from re_counters where key = 'F-2026'`))?.n === 2)
await setPerms(['properties', 'deals', 'delete'])
await as(SEC, async () => {
  const e = (await one(`select id from re_expenses limit 1`)).id
  const ed = await db.query(`delete from re_expenses where id = $1`, [e])
  ok('«deals» + «delete» deletes an expense, kept in the trash', ed.affectedRows === 1 && (await count(`select count(*) n from re_trash where row_id = $1`, [e])) === 1)
})
await setPerms(['properties'])
await as(null, async () => {
  ok('anon: invoices, receipts and expenses hidden', (await count(`select (select count(*) from re_invoices) + (select count(*) from re_payments) + (select count(*) from re_expenses) n`)) === 0)
})
await db.exec(`delete from re_payments; delete from re_invoices where kind = 'credit'; delete from re_invoices; delete from re_deals where notary = 'الموثق'; delete from re_trash;`)

// ------------------------------------------------------------ website visitor (anon)
const before = await one(`select updated_at from re_properties where id = $1`, [P1])
await as(null, async () => {
  ok('anon: base table hidden', (await count(`select count(*) n from re_properties`)) === 0)
  const pub = await db.query(`select * from re_public_properties()`)
  ok('anon: only published, non-draft properties', pub.rows.length === 1 && pub.rows[0].ref === 'SH-1001', pub.rows.map((x) => x.ref).join(','))
  ok('anon: no private columns', !pub.fields.some((f) => ['private_notes', 'owner_client_id', 'created_by'].includes(f.name)), pub.fields.map((f) => f.name).join(','))
  ok('anon: one property by ref', (await db.query(`select * from re_public_properties('SH-1001')`)).rows.length === 1)
  ok('anon: draft not reachable by ref', (await db.query(`select * from re_public_properties('SH-1002')`)).rows.length === 0)
  await db.query(`select re_increment_views($1)`, [P1])
  ok('anon: settings are public', (await count(`select count(*) n from re_settings`)) === 1)
  await db.query(`insert into re_leads (name, phone, kind, source, status) values ('زائر', '0699000001', 'inquiry', 'website', 'new')`)
  ok('anon: sends a request', true)
  ok('anon: cannot read requests', (await count(`select count(*) n from re_leads`)) === 0)
  await fails('anon: cannot send a «won» request', () => db.query(`insert into re_leads (name, phone, source, status) values ('x', '0699000002', 'website', 'won')`), /row-level security/)
  await fails('anon: cannot assign a request', () => db.query(`insert into re_leads (name, phone, source, assigned_to) values ('x', '0699000002', 'website', $1)`, [OWNER]), /row-level security/)
  await db.query(`insert into re_leads (name, phone, source) values ('زائر', '0699000001', 'website')`)
  await db.query(`insert into re_leads (name, phone, source) values ('زائر', '0699000001', 'website')`)
  await fails('anon: 4th request in 10 min is refused', () => db.query(`insert into re_leads (name, phone, source) values ('زائر', '0699000001', 'website')`), /rate_limited/)
  await fails('anon: cannot call re_join', () => db.query(`select re_join()`), /permission denied/)
  await fails('anon: cannot upload photos', () => db.query(`insert into storage.objects (bucket_id, name) values ('property-images', 'x.jpg')`), /row-level security/)
})
const after = await one(`select views, updated_at from re_properties where id = $1`, [P1])
ok('a page view counts but is not an edit', after.views === 1 && String(after.updated_at) === String(before.updated_at), JSON.stringify(after))

// ------------------------------------------------------------ re_join for accounts created before / elsewhere
await db.query(`insert into auth.users (id, email) values ($1, 'late@agency.test')`, [LATE]) // no app metadata → no row
await as(LATE, async () => {
  const j = (await db.query(`select * from re_join()`)).rows[0]
  ok('re_join: existing account → pending secretary', j?.role === 'secretary' && j?.active === false, JSON.stringify(j))
  const again = (await db.query(`select * from re_join()`)).rows[0]
  ok('re_join: second call returns the same row', again?.id === LATE)
})
await db.query(`delete from re_staff where id = $1`, [OWNER])
await as(OWNER, async () => {
  const j = (await db.query(`select * from re_join()`)).rows[0]
  ok('re_join: owner e-mail → active admin', j?.role === 'admin' && j?.active === true, JSON.stringify(j))
})

// ------------------------------------------------------------ re-run the whole file with data inside
try {
  await db.exec(schema)
  ok('schema runs again (idempotent)', true)
} catch (e) {
  ok('schema runs again (idempotent)', false, e.message)
}
ok('data kept after re-run', (await count(`select count(*) n from re_properties`)) === 3 && (await count(`select count(*) n from re_staff`)) === 3)
ok('bucket created once', (await count(`select count(*) n from storage.buckets where id = 'property-images'`)) === 1)

console.log(`\n${pass} passed, ${fail} failed${pgcrypto ? '' : ' (pgcrypto extension not loaded)'}`)
process.exit(fail ? 1 : 0)
