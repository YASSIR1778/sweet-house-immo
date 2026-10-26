// npm run test:fees — checks the cost calculators and the commission sharing with hand-computed cases.
import { DEFAULT_COMMISSION, DEFAULT_FEES, DEFAULT_NETWORK } from '../src/shared/lib/fee-defaults.ts'
import { bracketAmount, buyerCosts, coefficient, sellerCosts } from '../src/shared/lib/fees.ts'
import { agencyNet, defaultCommission, partnerBalance, shareAmount, suggestShares } from '../src/shared/lib/commission.ts'

let pass = 0
let fail = 0
const ok = (name, cond, extra = '') => {
  if (cond) pass++
  else fail++
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}${extra ? '  -> ' + extra : ''}`)
}
const line = (r, key) => r.lines.find((l) => l.key === key)?.amount ?? 0
const F = DEFAULT_FEES
const C = DEFAULT_COMMISSION

// ------------------------------------------------------------ buyer
let b = buyerCosts({ price: 1_000_000, kind: 'built', cash: 0, loan: 0, agency: true, date: '2026-10-26' }, F, C)
ok('built 1 000 000: registration 4 %', line(b, 'registration') === 40_000)
ok('built: land registry 1.5 % + 100', line(b, 'conservation') === 15_100)
ok('built: notary 1 % estimate + VAT 10 %', line(b, 'notary') === 10_000 && line(b, 'notary_vat') === 1_000)
ok('built: agency 2.5 %', line(b, 'agency') === 25_000)
ok('built: total', b.total === 40_000 + 15_100 + 10_000 + 1_000 + 1_500 + 25_000, String(b.total))
ok('built: no cash surcharge when paid by bank', line(b, 'cash_extra') === 0)

b = buyerCosts({ price: 1_000_000, kind: 'built', cash: 200_000, loan: 0, agency: false, date: '2026-10-26' }, F, C)
ok('cash part: +2 % only on the cash part', line(b, 'cash_extra') === 4_000)
b = buyerCosts({ price: 1_000_000, kind: 'built', cash: 200_000, loan: 0, agency: false, date: '2026-06-30' }, F, C)
ok('cash part before 1 July 2026: no surcharge', line(b, 'cash_extra') === 0)
b = buyerCosts({ price: 280_000, kind: 'built', cash: 280_000, loan: 0, agency: false, date: '2026-10-26' }, F, C)
ok('price under 300 000: no surcharge (DGI example)', line(b, 'cash_extra') === 0 && line(b, 'registration') === 11_200)

b = buyerCosts({ price: 500_000, kind: 'land', cash: 0, loan: 0, agency: false }, F, C)
ok('bare land 5 %', line(b, 'registration') === 25_000)
b = buyerCosts({ price: 250_000, kind: 'social', cash: 0, loan: 0, agency: false }, F, C)
ok('social housing first sale 3 %', line(b, 'registration') === 7_500 && b.aid === 100_000)
ok('small price: land registry minimum 500 / notary minimum 4 000', buyerCosts({ price: 20_000, kind: 'built', cash: 0, loan: 0, agency: false }, F, C).lines.find((l) => l.key === 'conservation').amount === 500 && line(buyerCosts({ price: 20_000, kind: 'built', cash: 0, loan: 0, agency: false }, F, C), 'notary') === 4_000)

ok('mortgage scale 1 000 000: 0.5 % then 1.5 %', bracketAmount(1_000_000, F.loan.brackets) === 1_250 + 11_250)
ok('mortgage scale 6 000 000: three slices', bracketAmount(6_000_000, F.loan.brackets) === 1_250 + 71_250 + 5_000)
b = buyerCosts({ price: 1_000_000, kind: 'built', cash: 0, loan: 800_000, agency: false }, F, C)
ok('loan 800 000: land registry 0.5 %/1.5 % + 100', line(b, 'loan_conservation') === 1_250 + 8_250 + 100)
ok('loan: registration fixed 200 DH (LF 2026)', line(b, 'loan_registration') === 200)
ok('cash needed = price + costs − loan', b.cashNeeded === 1_000_000 + b.total - 800_000)
ok('aid only up to 700 000', buyerCosts({ price: 650_000, kind: 'built', cash: 0, loan: 0, agency: false }, F, C).aid === 70_000 && b.aid === 0)

// ------------------------------------------------------------ seller
ok('coefficient 2010 = 1.296, 2025 = 1, 2026 = 1', coefficient(2010, F) === 1.296 && coefficient(2025, F) === 1 && coefficient(2026, F) === 1)
let s = sellerCosts({ price: 1_800_000, mode: 'purchase', year: 2010, acquired: 900_000, actualCosts: null, investments: 80_000, interest: 0, otherCosts: 0, agency: true, residence: false, social: false, small: true, release: false, releaseFees: 0, localTaxes: 0, loanBalance: 0 }, F, C)
// (900 000 + 15 % + 80 000) × 1.296 = 1 445 040 ; agency 45 000 ; profit 1 800 000 − 45 000 − 1 445 040 = 309 960 ; 20 % = 61 992
ok('TPI: revalued cost', s.revalued === 1_445_040, String(s.revalued))
ok('TPI: profit after agency fee', s.profit === 309_960, String(s.profit))
ok('TPI: 20 % of the profit above the 3 % minimum', s.tpi === 61_992 && s.taxMin === 54_000, String(s.tpi))
ok('seller: net = price − TPI − agency − certificate', s.net === 1_800_000 - 61_992 - 45_000 - 100, String(s.net))

s = sellerCosts({ price: 900_000, mode: 'purchase', year: 2015, acquired: 1_000_000, actualCosts: null, investments: 0, interest: 0, otherCosts: 0, agency: false, residence: false, social: false, small: true, release: false, releaseFees: 0, localTaxes: 0, loanBalance: 0 }, F, C)
ok('loss: minimum 3 % of the price still due', s.profit < 0 && s.tpi === 27_000)

s = sellerCosts({ price: 5_000_000, mode: 'purchase', year: 2015, acquired: 2_000_000, actualCosts: null, investments: 0, interest: 0, otherCosts: 0, agency: false, residence: true, social: false, small: true, release: false, releaseFees: 0, localTaxes: 0, loanBalance: 0 }, F, C)
ok('main residence: exempt, 3 % on the part above 4 000 000', s.exemption === 'residence' && s.tpi === 30_000)
s = sellerCosts({ price: 3_000_000, mode: 'purchase', year: 2015, acquired: 1_000_000, actualCosts: null, investments: 0, interest: 0, otherCosts: 0, agency: false, residence: true, social: false, small: true, release: false, releaseFees: 0, localTaxes: 0, loanBalance: 0 }, F, C)
ok('main residence under 4 000 000: no tax', s.tpi === 0)
s = sellerCosts({ price: 130_000, mode: 'purchase', year: 2015, acquired: 50_000, actualCosts: null, investments: 0, interest: 0, otherCosts: 0, agency: false, residence: false, social: false, small: true, release: false, releaseFees: 0, localTaxes: 0, loanBalance: 0 }, F, C)
ok('sales of the year up to 140 000: exempt', s.exemption === 'small' && s.tpi === 0)
s = sellerCosts({ price: 240_000, mode: 'purchase', year: 2018, acquired: 200_000, actualCosts: null, investments: 0, interest: 0, otherCosts: 0, agency: false, residence: false, social: true, small: false, release: false, releaseFees: 0, localTaxes: 0, loanBalance: 0 }, F, C)
ok('first sale of social housing occupied 4 years: exempt', s.exemption === 'social' && s.tpi === 0)
s = sellerCosts({ price: 1_000_000, mode: 'inheritance', year: 2020, acquired: 600_000, actualCosts: null, investments: 0, interest: 0, otherCosts: 0, agency: false, residence: false, social: false, small: false, release: true, releaseFees: 3_000, localTaxes: 1_200, loanBalance: 150_000 }, F, C)
ok('inheritance: no flat 15 % on the declared value', s.acquisitionCosts === 0 && s.revalued === Math.round(600_000 * 1.164))
ok('mortgage release: 500 land registry + 200 duty + bank fees', line(s, 'release_conservation') === 500 && line(s, 'release_registration') === 200 && line(s, 'release_fees') === 3_000)
ok('net after repaying the loan', s.netAfterLoan === s.net - 150_000)

// ------------------------------------------------------------ commission and partners
ok('sale 1 000 000: 2.5 % from each side', JSON.stringify(defaultCommission('sale', 1_000_000, C)) === JSON.stringify({ seller: 25_000, buyer: 25_000 }))
ok('rent 4 000: one month from each side', JSON.stringify(defaultCommission('rent', 4_000, C)) === JSON.stringify({ seller: 4_000, buyer: 4_000 }))
ok('VAT 20 % added when set', defaultCommission('sale', 1_000_000, { ...C, vat: 20 }).buyer === 30_000)

const broker = (id, extra = {}) => ({ id, full_name: id, phone: '', whatsapp: null, email: null, kind: 'broker', company: null, zones: [], specialties: [], agreement_mode: 'side', agreement_value: 0, rating: null, active: true, notes: null, created_by: null, created_at: '', updated_at: '', ...extra })
let sh = suggestShares({ listing: [], client: [broker('A')] }, DEFAULT_NETWORK)
ok('one broker brings the client: he gets the client side (50 %)', sh.length === 1 && sh[0].value === 50 && shareAmount(sh[0], 50_000) === 25_000)
ok('agency keeps the listing side', agencyNet(50_000, sh) === 25_000)
sh = suggestShares({ listing: [broker('L')], client: [broker('A'), broker('B')] }, DEFAULT_NETWORK)
ok('two brokers on the client side share it equally', sh.filter((x) => x.side === 'client').every((x) => x.value === 25) && agencyNet(40_000, sh) === 0)
sh = suggestShares({ listing: [], client: [broker('A'), broker('P', { agreement_mode: 'percent', agreement_value: 30 })], referrers: [broker('R', { kind: 'referrer' })] }, DEFAULT_NETWORK)
ok('own agreement 30 % + referrer 10 %', sh.find((x) => x.ref_id === 'P').value === 30 && sh.find((x) => x.ref_id === 'R').value === 10 && sh.find((x) => x.ref_id === 'A').value === 50)
sh = suggestShares({ listing: [broker('F', { agreement_mode: 'fixed', agreement_value: 5_000 })], client: [], staff: { id: 'u1', name: 'سلمى' } }, { ...DEFAULT_NETWORK, staff_bonus: 5 })
ok('fixed amount + staff bonus', shareAmount(sh[0], 60_000) === 5_000 && sh[1].party === 'staff' && shareAmount(sh[1], 60_000) === 3_000)
ok('a developer never takes a share', suggestShares({ listing: [broker('D', { kind: 'developer', agreement_mode: 'percent', agreement_value: 2 })], client: [] }, DEFAULT_NETWORK).length === 0)
const bal = partnerBalance([{ commission: 50_000, shares: [{ ...sh[0], ref_id: 'F', mode: 'percent', value: 50, paid: 10_000 }] }, { commission: 20_000, shares: [{ ...sh[0], ref_id: 'F', mode: 'fixed', value: 3_000, paid: 3_000 }] }], 'F')
ok('partner statement: due, paid, rest', bal.due === 28_000 && bal.paid === 13_000 && bal.rest === 15_000 && bal.count === 2)

console.log(`\n${pass} passed, ${fail} failed`)
process.exit(fail ? 1 : 0)
