// npm run test:billing — invoices, receipts, deal file and yearly accounts, with hand-computed cases.
import {
  amountInWordsFr,
  billingMissing,
  checklistProgress,
  commissionLine,
  dealCollected,
  dealResult,
  DEFAULT_BILLING,
  defaultChecklist,
  DEMO_BILLING,
  htFromTtc,
  invoicePaid,
  invoiceRest,
  invoiceTotals,
  isDone,
  isOverdue,
  nextDocNumber,
  numberToFrench,
  partyDue,
  receivables,
  vatInvoiced,
  yearAccounts,
} from '../src/shared/lib/billing.ts'

let pass = 0
let fail = 0
const ok = (name, cond, extra = '') => {
  if (cond) pass++
  else fail++
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}${extra ? '  -> ' + extra : ''}`)
}

// ------------------------------------------------------------ numbers in words (French rules)
const words = {
  0: 'zéro',
  1: 'un',
  16: 'seize',
  17: 'dix-sept',
  21: 'vingt et un',
  22: 'vingt-deux',
  61: 'soixante et un',
  70: 'soixante-dix',
  71: 'soixante et onze',
  77: 'soixante-dix-sept',
  80: 'quatre-vingts',
  81: 'quatre-vingt-un',
  90: 'quatre-vingt-dix',
  91: 'quatre-vingt-onze',
  99: 'quatre-vingt-dix-neuf',
  100: 'cent',
  101: 'cent un',
  180: 'cent quatre-vingts',
  200: 'deux cents',
  201: 'deux cent un',
  1000: 'mille',
  1200: 'mille deux cents',
  21000: 'vingt et un mille',
  42500: 'quarante-deux mille cinq cents',
  80000: 'quatre-vingt mille',
  200000: 'deux cent mille',
  1000000: 'un million',
  2500000: 'deux millions cinq cent mille',
  80000000: 'quatre-vingts millions',
  200000000: 'deux cents millions',
}
for (const [n, w] of Object.entries(words)) ok(`${n} → ${w}`, numberToFrench(Number(n)) === w, numberToFrench(Number(n)))
ok('amount: 21 250 DH', amountInWordsFr(21250) === 'Vingt et un mille deux cent cinquante dirhams', amountInWordsFr(21250))
ok('amount with centimes', amountInWordsFr(17708.33) === 'Dix-sept mille sept cent huit dirhams et trente-trois centimes', amountInWordsFr(17708.33))
ok('one dirham, singular', amountInWordsFr(1) === 'Un dirham')
ok('a round million takes «de»', amountInWordsFr(2000000) === 'Deux millions de dirhams' && amountInWordsFr(1500000) === 'Un million cinq cent mille dirhams', amountInWordsFr(2000000))

// ------------------------------------------------------------ totals and VAT
const t = invoiceTotals([{ qty: 1, unit: 17708.33 }], 20)
ok('commission 21 250 TTC → 17 708.33 HT + 3 541.67 VAT', htFromTtc(21250, 20) === 17708.33 && t.ht === 17708.33 && t.vat === 3541.67 && t.ttc === 21250, JSON.stringify(t))
ok('no VAT: HT = TTC', htFromTtc(18000, 0) === 18000 && invoiceTotals([commissionLine('x', 18000, 0)], 0).ttc === 18000)
ok('several lines', invoiceTotals([{ qty: 2, unit: 1000 }, { qty: 1, unit: 500.5 }], 20).ttc === 3000.6)
const odd = [27500, 4200, 3800, 55000, 100.01, 13333]
ok('every commission comes back to the same TTC', odd.every((v) => invoiceTotals([commissionLine('x', v, 20)], 20).ttc === v), odd.map((v) => invoiceTotals([commissionLine('x', v, 20)], 20).ttc).join(','))

// ------------------------------------------------------------ numbering (demo)
ok('first number of the year', nextDocNumber([], 'F', 2026) === 'F-2026-0001')
ok('next number, other series and years ignored', nextDocNumber(['F-2026-0001', 'F-2026-0007', 'AV-2026-0009', 'F-2025-0042', 'R-2026-0003'], 'F', 2026) === 'F-2026-0008')
ok('credit notes have their own series', nextDocNumber(['F-2026-0007', 'AV-2026-0001'], 'AV', 2026) === 'AV-2026-0002')

// ------------------------------------------------------------ deal file
ok('a deal without stage is done', isDone({}) && isDone({ stage: 'done' }) && !isDone({ stage: 'signing' }) && !isDone({ stage: 'cancelled' }))
let n = 0
const cl = defaultChecklist('sale', () => `i${++n}`)
ok('sale checklist: title deed, syndic, notary…', cl.length === 9 && cl.some((x) => x.label.includes('شهادة الملكية')) && cl.some((x) => x.label.includes('السانديك')) && cl.every((x) => !x.done))
ok('rent checklist differs', defaultChecklist('rent', () => 'x').some((x) => x.label.includes('عقد الكراء')))
cl[0].done = true
cl[1].done = true
ok('progress', JSON.stringify(checklistProgress(cl)) === JSON.stringify({ done: 2, total: 9, pct: 22 }))

const deal = {
  id: 'd1',
  kind: 'sale',
  amount: 850000,
  commission: 42500,
  commission_seller: 21250,
  commission_buyer: 21250,
  received: 0,
  stage: 'done',
  closed_at: '2026-03-10T12:00:00Z',
  shares: [{ id: 's', party: 'broker', ref_id: 'b', name: 'B', side: 'client', mode: 'percent', value: 50, paid: 0, paid_at: null }],
}
ok('what each party owes', partyDue(deal, 'seller') === 21250 && partyDue(deal, 'buyer') === 21250 && partyDue(deal, 'other') === 0)
ok('old deal (no split): the buyer pays all', partyDue({ commission: 18000 }, 'buyer') === 18000 && partyDue({ commission: 18000 }, 'seller') === 0)
const pays = [
  { deal_id: 'd1', invoice_id: 'i1', party: 'buyer', amount: 21250, status: 'valid' },
  { deal_id: 'd1', invoice_id: 'i2', party: 'seller', amount: 10000, status: 'valid' },
  { deal_id: 'd1', invoice_id: 'i2', party: 'seller', amount: 5000, status: 'cancelled' },
]
ok('collected from receipts (cancelled ignored)', dealCollected(deal, pays) === 31250 && dealCollected(deal, pays, 'seller') === 10000 && dealCollected(deal, pays, 'buyer') === 21250)
const legacy = { id: 'd0', commission: 40000, commission_seller: 10000, commission_buyer: 30000, received: 20000 }
ok('deal without receipts keeps its typed amount, shared in proportion', dealCollected(legacy, []) === 20000 && dealCollected(legacy, [], 'seller') === 5000 && dealCollected(legacy, [], 'buyer') === 15000)
ok('old deal without «received» is fully collected', dealCollected({ id: 'x', commission: 18000 }, []) === 18000)
const rec = receivables([deal, { ...deal, id: 'd2', stage: 'signing' }, { ...legacy, stage: 'done', closed_at: '2026-01-01T00:00:00Z', kind: 'sale' }], pays)
ok('receivables: done deals only, oldest first', rec.length === 2 && rec[0].deal.id === 'd0' && rec[0].rest === 20000 && rec[1].rest === 11250, JSON.stringify(rec.map((r) => [r.deal.id, r.rest])))

// ------------------------------------------------------------ invoices
ok('invoice paid from its receipts', invoicePaid({ id: 'i2' }, pays) === 10000)
ok('rest to pay', invoiceRest({ total_ttc: 21250, paid: 10000, status: 'issued', kind: 'invoice' }) === 11250 && invoiceRest({ total_ttc: 21250, paid: 0, status: 'cancelled', kind: 'invoice' }) === 0)
ok(
  'overdue only when unpaid and past due',
  isOverdue({ due_at: '2026-03-01', status: 'issued', kind: 'invoice', total_ttc: 100, paid: 0 }, '2026-03-02') &&
    !isOverdue({ due_at: '2026-03-03', status: 'issued', kind: 'invoice', total_ttc: 100, paid: 0 }, '2026-03-02') &&
    !isOverdue({ due_at: '2026-03-01', status: 'paid', kind: 'invoice', total_ttc: 100, paid: 100 }, '2026-03-02') &&
    !isOverdue({ due_at: null, status: 'issued', kind: 'invoice', total_ttc: 100, paid: 0 }, '2026-03-02'),
)
const invs = [
  { issued_at: '2026-01-15', total_vat: 3541.67 },
  { issued_at: '2026-02-01', total_vat: 1000 },
  { issued_at: '2026-02-03', total_vat: -1000 },
  { issued_at: '2026-04-01', total_vat: 700 },
]
ok('VAT of the quarter: a credit note cancels its invoice', vatInvoiced(invs, '2026-01-01', '2026-03-31') === 3541.67)

// ------------------------------------------------------------ accounts of the year
const deals = [
  deal,
  { ...deal, id: 'd2', commission: 4200, commission_seller: 0, commission_buyer: 4200, shares: [], closed_at: '2026-03-20T12:00:00Z' },
  { ...deal, id: 'd3', stage: 'paperwork', closed_at: '2026-03-25T12:00:00Z' },
  { ...deal, id: 'd4', closed_at: '2025-03-25T12:00:00Z' },
]
const exps = [
  { spent_at: '2026-03-01', amount: 4000, deal_id: null },
  { spent_at: '2026-03-15', amount: 1500, deal_id: 'd1' },
  { spent_at: '2026-04-02', amount: 4000, deal_id: null },
  { spent_at: '2025-12-31', amount: 999, deal_id: null },
]
const acc = yearAccounts(deals, exps, 2026, 20)
const mar = acc.months[2]
ok('March: done deals only', mar.commission === 46700, JSON.stringify(mar))
ok('March: VAT inside the commissions (20 %)', mar.vat === 7783.33, String(mar.vat))
ok('March: partners and expenses', mar.shares === 21250 && mar.expenses === 5500)
ok('March: net = commission − VAT − partners − expenses', mar.net === 12166.67, String(mar.net))
ok('year totals (April expense, other years ignored)', acc.total.commission === 46700 && acc.total.expenses === 9500 && acc.total.net === 8166.67, JSON.stringify(acc.total))
ok('no VAT when the agency does not charge it', yearAccounts(deals, [], 2026, 0).total.vat === 0)
const res = dealResult(deal, exps, 20)
ok('result of one deal', res.commission === 42500 && res.vat === 7083.33 && res.shares === 21250 && res.expenses === 1500 && res.net === 12666.67, JSON.stringify(res))

// ------------------------------------------------------------ billing identity
ok('empty identity: everything to fill', billingMissing(DEFAULT_BILLING).length === 6)
ok('demo identity complete', billingMissing(DEMO_BILLING).length === 0)
ok('VAT 20 % by default (standard rate for services)', DEFAULT_BILLING.vat_rate === 20)

console.log(`\n${pass} passed, ${fail} failed`)
process.exit(fail ? 1 : 0)
