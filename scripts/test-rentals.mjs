// npm run test:rentals — leases, rent schedule, arrears, revision and owner statements (law 67-12).
import { addMonths, depositMax, depositReturnBy, leaseArrears, leaseSchedule, managementFee, managementFees, monthName, ownerShare, ownerStatement, periodsBetween, rentFor, rentReminder, revisionStatus } from '../src/shared/lib/rentals.ts'

let pass = 0
let fail = 0
const ok = (name, cond, extra = '') => {
  if (cond) pass++
  else fail++
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}${extra ? '  -> ' + extra : ''}`)
}
const today = new Date(2026, 9, 26) // 26 October 2026

// ------------------------------------------------------------ months
ok('add months across years', addMonths('2025-11', 3) === '2026-02' && addMonths('2026-01', -1) === '2025-12' && addMonths('2026-12', 1) === '2027-01')
ok('months between, both included', periodsBetween('2026-10', '2027-01').join(',') === '2026-10,2026-11,2026-12,2027-01')

// ------------------------------------------------------------ rent after revisions
const lease = {
  id: 'L1',
  start_date: '2025-09-01',
  end_date: null,
  rent: 6000,
  charges: 300,
  pay_day: 5,
  usage: 'housing',
  revisions: [{ from: '2026-09', rent: 6480, charges: 300, note: null }],
  managed: true,
  management_rate: 8,
  status: 'active',
  ended_at: null,
  owner_client_id: 'O1',
}
ok('rent before the revision', rentFor(lease, '2026-08').rent === 6000)
ok('rent from the revision month', rentFor(lease, '2026-09').rent === 6480 && rentFor(lease, '2027-03').rent === 6480)

// ------------------------------------------------------------ schedule and arrears
const pay = (period, rent, charges, extra = {}) => ({ id: `p-${period}-${rent}`, no: '', lease_id: 'L1', period, rent, charges, method: 'cash', reference: null, paid_at: `${period}-06`, status: 'valid', remitted_at: null, notes: null, ...extra })
const payments = [
  ...periodsBetween('2025-09', '2026-08').map((p) => pay(p, 6000, 300)),
  pay('2026-09', 6480, 300),
  pay('2026-10', 3000, 0), // half of October
  pay('2026-10', 3000, 0, { status: 'cancelled', id: 'x' }),
]
const sched = leaseSchedule(lease, payments, today)
ok('schedule runs from the start to next month', sched[0].period === '2025-09' && sched[sched.length - 1].period === '2026-11', `${sched[0].period}..${sched[sched.length - 1].period}`)
const oct = sched.find((r) => r.period === '2026-10')
ok('October: half paid, 21 days late (due on the 5th)', oct.status === 'partial' && oct.paid === 3000 && oct.amount === 6780 && oct.late === 21, JSON.stringify(oct))
ok('November: upcoming, not late', sched.find((r) => r.period === '2026-11').status === 'upcoming' && sched.find((r) => r.period === '2026-11').late === 0)
ok('cancelled receipts do not count', !oct.payments.some((p) => p.status === 'cancelled'))
const arr = leaseArrears(lease, payments, today)
ok('arrears: what is left of October', arr.months === 1 && arr.amount === 3780 && arr.oldest === '2026-10', JSON.stringify(arr))
const ended = { ...lease, status: 'ended', ended_at: '2026-06-30' }
ok('an ended lease stops at its last month', leaseSchedule(ended, payments, today).pop().period === '2026-06')
const fixed = { ...lease, end_date: '2026-03-31' }
ok('a fixed-term lease stops at its end', leaseSchedule(fixed, payments, today).pop().period === '2026-03')

// ------------------------------------------------------------ revision (art. 33-34)
const r1 = revisionStatus({ ...lease, revisions: [] }, today)
ok('housing: not before 3 years', !r1.eligible && r1.next === '2028-09-01' && r1.cap === 8, JSON.stringify(r1))
const old = { ...lease, start_date: '2023-05-01', revisions: [], rent: 3500 }
const r2 = revisionStatus(old, today)
ok('housing: after 3 years, up to 8 %', r2.eligible && r2.suggested === 3780 && r2.cap === 8, JSON.stringify(r2))
ok('professional premises: up to 10 %', revisionStatus({ ...old, usage: 'professional' }, today).suggested === 3850)
ok('the clock restarts at the last revision', revisionStatus(lease, today).next === '2029-09-01')

// ------------------------------------------------------------ deposit (art. 20)
ok('deposit at most two months of rent', depositMax(6500) === 13000)
ok('deposit back within a month of the keys', depositReturnBy({ ended_at: '2026-10-15', deposit: 13000, deposit_returned_at: null }) === '2026-11-15')
ok('nothing to give back when already returned', depositReturnBy({ ended_at: '2026-10-15', deposit: 13000, deposit_returned_at: '2026-10-20' }) === null)

// ------------------------------------------------------------ management and owner statement
ok('agency fee on the rent only', managementFee({ rent: 6480 }, 8) === 518.4 && ownerShare({ rent: 6480, charges: 300 }, 8) === 6261.6)
const fees = managementFees([lease, { id: 'L2', managed: false, management_rate: 8 }], [...payments, pay('2026-10', 4000, 0, { lease_id: 'L2', id: 'other' })])
ok('fees only from managed leases and valid receipts', fees.length === 14 && fees.every((f) => f.amount > 0), String(fees.length))
const st = ownerStatement([lease], payments.map((p) => (p.period < '2026-10' ? { ...p, remitted_at: `${p.period}-10` } : p)), 'O1', '2026-09-01', '2026-10-31')
ok('owner statement: collected, fee, net, to remit', st.rows.length === 2 && st.total.collected === 9780 && st.total.fees === 758.4 && st.total.net === 9021.6 && st.total.toRemit === 2760, JSON.stringify(st.total))

// ------------------------------------------------------------ reminders
const ar = rentReminder('late', 'ar', { name: 'إيمان الزياني', period: '2026-10', amount: '6.780 د.م.', ref: 'SH-1011', due: '2026-10-05', agency: 'سويت هاوس' })
ok('Arabic late reminder', ar.startsWith('السلام عليكم إيمان') && ar.includes('SH-1011') && ar.includes('6.780 د.م.') && ar.includes('أكتوبر'), ar)
const fr = rentReminder('due', 'fr', { name: 'Pierre Dubois', period: '2026-11', amount: '6 780 DH', ref: 'SH-1011', due: '2026-11-05', agency: 'Sweet House' })
ok('French reminder', fr.startsWith('Bonjour Pierre') && fr.includes('novembre 2026') && fr.includes('5 novembre'), fr)
ok('month names', monthName('2026-12', 'es').includes('diciembre'))

console.log(`\n${pass} passed, ${fail} failed`)
process.exit(fail ? 1 : 0)
