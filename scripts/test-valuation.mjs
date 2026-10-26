// npm run test:valuation — price estimate from comparable listings, market table and € display.
import { comparables, estimate, marketTable, median, toEur, typeGroup } from '../src/shared/lib/valuation.ts'

let pass = 0
let fail = 0
const ok = (name, cond, extra = '') => {
  if (cond) pass++
  else fail++
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}${extra ? '  -> ' + extra : ''}`)
}

let n = 0
const L = (x) => ({ id: `p${++n}`, ref: `SH-${1000 + n}`, purpose: 'sale', type: 'apartment', status: 'available', neighborhood: 'tabola', price: 900_000, area: 100, ...x })
const hoods = [
  { id: 'tabola', name: { ar: 'طابولة', fr: 'Tabola', es: 'Tabola' }, lat: 0, lng: 0 },
  { id: 'martil', name: { ar: 'مرتيل', fr: 'Martil', es: 'Martil' }, lat: 0, lng: 0, ref_sale_m2: 12_000, ref_rent_m2: 60 },
  { id: 'wafa', name: { ar: 'الوفاء', fr: 'Al Wafa', es: 'Al Wafa' }, lat: 0, lng: 0 },
]

ok('median', median([3, 1, 2]) === 2 && median([4, 1, 3, 2]) === 2.5 && median([]) === 0)
ok('type groups', typeGroup('duplex') === 'flat' && typeGroup('riad') === 'house' && typeGroup('office') === 'business' && typeGroup('land') === 'land')

const listings = [
  L({ price: 800_000, area: 100 }), // 8 000 /m²
  L({ price: 990_000, area: 110 }), // 9 000
  L({ price: 1_000_000, area: 100 }), // 10 000
  L({ type: 'duplex', price: 1_350_000, area: 150 }), // 9 000 (same group)
  L({ type: 'villa', price: 3_000_000, area: 300 }), // other group
  L({ purpose: 'rent', price: 4_500, area: 90 }), // rent
  L({ status: 'draft', price: 100, area: 100 }), // ignored
  L({ area: null }), // ignored (no area)
  L({ neighborhood: 'wafa', price: 700_000, area: 100 }), // 7 000
  L({ neighborhood: 'martil', price: 1_300_000, area: 100 }), // 13 000
]
ok('comparables: same purpose and group, priced, with an area', comparables(listings, 'sale', 'flat').length === 6)

// ------------------------------------------------------------ neighbourhood median
const base = { purpose: 'sale', type: 'apartment', neighborhood: 'tabola', area: 120, condition: 'good', features: [] }
const e1 = estimate(base, listings, hoods)
ok('4 comparables in the neighbourhood: their median per m²', e1.basis === 'neighborhood' && e1.perM2 === 9000 && e1.mid === 1_080_000 && e1.confidence === 'medium', JSON.stringify({ basis: e1.basis, perM2: e1.perM2, mid: e1.mid, c: e1.confidence }))
ok('range ±12 % rounded to 5 000', e1.low === 950_000 && e1.high === 1_210_000, `${e1.low} ${e1.high}`)
ok('closest areas first among comparables', e1.comps[0].area === 110 && e1.comps.length === 4)
const e2 = estimate({ ...base, condition: 'new', features: ['sea_view', 'parking', 'sea_view'] }, listings, hoods)
ok('new + sea view + parking (a feature counts once)', e2.mid === Math.round((9000 * 120 * 1.08 * 1.1 * 1.03) / 5000) * 5000, String(e2.mid))
ok('to renovate: lower', estimate({ ...base, condition: 'renovate' }, listings, hoods).mid === 920_000)

// ------------------------------------------------------------ few listings: the expert's reference
const e3 = estimate({ ...base, neighborhood: 'martil', area: 100 }, listings, hoods)
ok('1 listing + reference: blended (2/3 reference)', e3.basis === 'reference' && Math.round(e3.perM2) === Math.round((12_000 * 2 + 13_000) / 3) && e3.confidence === 'medium', JSON.stringify({ b: e3.basis, p: e3.perM2 }))
const e4 = estimate({ ...base, neighborhood: 'martil', area: 100 }, [], hoods)
ok('no listing: reference only, low confidence ±18 %', e4.basis === 'reference' && e4.perM2 === 12_000 && e4.confidence === 'low' && e4.low === 985_000 && e4.high === 1_415_000, `${e4.low} ${e4.high}`)

// ------------------------------------------------------------ fallback to the whole area, then nothing
const e5 = estimate({ ...base, neighborhood: 'wafa' }, listings, hoods)
ok('1 listing, no reference: median of the whole area', e5.basis === 'city' && e5.confidence === 'low' && e5.perM2 === 9000, JSON.stringify({ b: e5.basis, p: e5.perM2 }))
ok('nothing comparable: no estimate', estimate({ ...base, type: 'land' }, listings, hoods) === null)
ok('no area: no estimate', estimate({ ...base, area: 0 }, listings, hoods) === null)

// ------------------------------------------------------------ rent
const rentEst = estimate({ ...base, purpose: 'rent', neighborhood: 'martil', area: 80, furnished: true }, [], hoods)
ok('rent: reference per m² per month, furnished +15 %, rounded to 50', rentEst.mid === Math.round((60 * 80 * 1.15) / 50) * 50 && rentEst.perM2 === 60, String(rentEst.mid))

// ------------------------------------------------------------ market table
const table = marketTable(listings, hoods)
const tab = table.find((r) => r.id === 'tabola')
const mar = table.find((r) => r.id === 'martil')
ok('market: listings median when at least 2', tab.sale === 9000 && tab.saleCount === 4 && !tab.saleRef)
ok('market: reference when listings are few', mar.sale === 12_000 && mar.saleRef && mar.rent === 60 && mar.rentRef)
ok('market: neighbourhoods without data are left out, highest first', !table.some((r) => r.id === 'wafa') && table[0].id === 'martil')

// ------------------------------------------------------------ euros
ok('€ rounded to 100 above 10 000 €', toEur(1_080_000, 11) === 98_200, String(toEur(1_080_000, 11)))
ok('€ rounded to 10 for rents', toEur(4_500, 11) === 410, String(toEur(4_500, 11)))
ok('no rate: no €', toEur(1_000, 0) === null)

console.log(`\n${pass} passed, ${fail} failed`)
process.exit(fail ? 1 : 0)
