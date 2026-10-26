// npm run test:owners — mandate states, owner commission and the owner report message.
import { buildOwnerReport, currentMandate, daysOnMarket, mandateCommission, mandateState, ownerReportText } from '../src/shared/lib/owners.ts'

let pass = 0
let fail = 0
const ok = (name, cond, extra = '') => {
  if (cond) pass++
  else fail++
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}${extra ? '  -> ' + extra : ''}`)
}

const today = new Date(2026, 9, 26, 10, 0, 0) // 26 Oct 2026
let s = mandateState({ status: 'active', end_date: '2026-12-31' }, today)
ok('active mandate far from its end', s.state === 'active' && s.daysLeft === 66, JSON.stringify(s))
s = mandateState({ status: 'active', end_date: '2026-11-10' }, today)
ok('expiring within 30 days', s.state === 'expiring' && s.daysLeft === 15, JSON.stringify(s))
s = mandateState({ status: 'active', end_date: '2026-10-26' }, today)
ok('ends today: still expiring, 0 days left', s.state === 'expiring' && s.daysLeft === 0, JSON.stringify(s))
s = mandateState({ status: 'active', end_date: '2026-10-20' }, today)
ok('past its end: expired', s.state === 'expired' && s.daysLeft < 0, JSON.stringify(s))
ok('no end date: active', mandateState({ status: 'active', end_date: null }, today).state === 'active')
ok('ended / cancelled kept as is', mandateState({ status: 'ended', end_date: '2026-01-01' }, today).state === 'ended' && mandateState({ status: 'cancelled', end_date: null }, today).state === 'cancelled')

const list = [
  { id: 'a', property_id: 'p1', status: 'ended', start_date: '2026-01-01' },
  { id: 'b', property_id: 'p1', status: 'active', start_date: '2026-03-01' },
  { id: 'c', property_id: 'p1', status: 'active', start_date: '2026-06-01' },
  { id: 'd', property_id: 'p2', status: 'active', start_date: '2026-09-01' },
]
ok('current mandate = latest active of the property', currentMandate(list, 'p1')?.id === 'c' && currentMandate(list, 'p3') === undefined)

ok('owner commission: % of the sale price', mandateCommission({ commission_rate: 2.5, commission_amount: null }, 1_000_000, 'sale') === 25_000)
ok('owner commission: months of rent', mandateCommission({ commission_rate: 1, commission_amount: null }, 4_500, 'rent') === 4_500)
ok('owner commission: fixed amount wins', mandateCommission({ commission_rate: 2.5, commission_amount: 15_000 }, 1_000_000, 'sale') === 15_000)
ok('owner commission: nothing agreed', mandateCommission({ commission_rate: null, commission_amount: null }, 1_000_000, 'sale') === null)
ok('days on the market', daysOnMarket('2026-10-16T10:00:00', today) === 10)

const rep = {
  name: 'خديجة',
  lang: 'ar',
  generated_at: '',
  properties: [{ ref: 'SH-1004', title: 'رياض', purpose: 'sale', type: 'riad', status: 'available', published: true, price: 2_100_000, image: null, views: 312, created_at: '', leads: 4, visits_done: 3, visits_planned: 1, last_visit: null, prices: [], mandate: null }],
}
const fmt = (n) => `${n.toLocaleString('fr-FR').replace(/ /g, ' ')} DH`
let txt = ownerReportText(rep, 'سويت هاوس', 'https://x/p/abc', fmt)
ok('report AR: greeting, figures, link, signature', txt.startsWith('السلام عليكم خديجة') && txt.includes('المشاهدات على الموقع 312') && txt.includes('الزيارات المبرمجة 1') && txt.includes('https://x/p/abc') && txt.endsWith('مع تحيات فريق سويت هاوس'), txt)
txt = ownerReportText({ ...rep, lang: 'fr', name: 'Youssef', properties: [{ ...rep.properties[0], visits_planned: 0 }] }, 'Sweet House', null, fmt)
ok('report FR: no planned visits, no link', txt.startsWith('Bonjour Youssef') && !txt.includes('prévues') && !txt.includes('http') && txt.includes('Prix actuel : 2 100 000 DH'), txt)
ok('report ES without properties', ownerReportText({ ...rep, lang: 'es', properties: [] }, 'Sweet House', null, fmt).includes('No hay ningún inmueble'))

const built = buildOwnerReport(
  { id: 'c1', full_name: 'خديجة الريسوني', lang: 'ar' },
  [
    { id: 'p1', ref: 'SH-1', title: 'رياض', purpose: 'sale', type: 'riad', status: 'available', published: true, price: 2_000_000, images: ['a.jpg'], views: 50, created_at: '2026-01-01', owner_client_id: 'c1' },
    { id: 'p2', ref: 'SH-2', title: 'آخر', purpose: 'sale', type: 'villa', status: 'available', published: true, price: 1, images: [], views: 0, created_at: '2026-01-01', owner_client_id: 'other' },
  ],
  [{ property_id: 'p1' }, { property_id: 'p1' }, { property_id: 'p2' }],
  [
    { property_id: 'p1', kind: 'visit', status: 'done', starts_at: '2026-10-01T10:00:00Z' },
    { property_id: 'p1', kind: 'visit', status: 'scheduled', starts_at: '2026-11-01T10:00:00Z' },
    { property_id: 'p1', kind: 'call', status: 'done', starts_at: '2026-10-02T10:00:00Z' },
  ],
  [
    { property_id: 'p1', new_price: 2_200_000, created_at: '2026-01-01' },
    { property_id: 'p1', new_price: 2_000_000, created_at: '2026-06-01' },
  ],
  [{ property_id: 'p1', status: 'active', kind: 'exclusive', start_date: '2026-01-01', end_date: '2026-12-31' }],
  today,
)
const bp = built.properties[0]
ok('report from the tables: only his properties, counts, prices, mandate', built.name === 'خديجة' && built.properties.length === 1 && bp.leads === 2 && bp.visits_done === 1 && bp.visits_planned === 1 && bp.prices.length === 2 && bp.mandate?.kind === 'exclusive' && bp.image === 'a.jpg', JSON.stringify(bp))

console.log(`\n${pass} passed, ${fail} failed`)
process.exit(fail ? 1 : 0)
