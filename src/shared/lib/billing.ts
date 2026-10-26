import { sharesTotal } from './commission.ts'
import type { BillingSettings, BillParty, ChecklistItem, Deal, DealStage, Expense, Invoice, InvoiceLine, Payment, Purpose } from './types'

/*
 * Deal file, invoices, receipts and the agency's accounts. Pure functions (tests: npm run test:billing).
 *
 * The commission recorded in a deal is what each party pays (VAT included when the agency charges
 * it); an invoice shows that amount split into HT + VAT. Invoices and receipts are numbered by the
 * database (one gap-free series per year) and never rewritten: an invoice is cancelled by a credit note.
 */

export const DEFAULT_BILLING: BillingSettings = {
  company: '',
  legal_form: '',
  capital: '',
  address: '',
  city: 'Tétouan',
  rc: '',
  fiscal_id: '',
  ice: '',
  tp: '',
  cnss: '',
  vat_rate: 20,
  bank: '',
  rib: '',
  payment_days: 0,
  footer: '',
}

/** Sample identity for the demo only (numbers are obviously fictitious). */
export const DEMO_BILLING: BillingSettings = {
  ...DEFAULT_BILLING,
  company: 'Sweet House Immobilier SARL',
  legal_form: 'SARL',
  capital: '100 000 DH',
  address: 'Avenue Mohammed V, Tétouan',
  rc: '00000 (exemple)',
  fiscal_id: '00000000 (exemple)',
  ice: '000000000000000',
  tp: '00000000 (exemple)',
  bank: 'Banque (exemple)',
  rib: '000 000 0000000000000000 00',
}

export const r2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100

/** Fields a legal invoice needs that are still empty (article 145 of the tax code). */
export function billingMissing(b: BillingSettings): string[] {
  const need: [keyof BillingSettings, string][] = [
    ['company', 'الاسم التجاري'],
    ['address', 'العنوان'],
    ['ice', 'ICE'],
    ['fiscal_id', 'IF'],
    ['rc', 'RC'],
    ['tp', 'TP'],
  ]
  return need.filter(([k]) => !String(b[k] ?? '').trim()).map(([, label]) => label)
}

export function invoiceTotals(lines: Pick<InvoiceLine, 'qty' | 'unit'>[], vatRate: number) {
  const ht = r2(lines.reduce((s, l) => s + r2((l.qty || 0) * (l.unit || 0)), 0))
  const vat = r2((ht * (vatRate || 0)) / 100)
  return { ht, vat, ttc: r2(ht + vat) }
}

/** Price before VAT that gives `ttc` once VAT is added. */
export function htFromTtc(ttc: number, vatRate: number): number {
  return r2(ttc / (1 + (vatRate || 0) / 100))
}

/** One invoice line for a commission paid by a party (the amount includes VAT). */
export function commissionLine(label: string, ttc: number, vatRate: number): InvoiceLine {
  return { label, qty: 1, unit: htFromTtc(ttc, vatRate) }
}

/** Next free number of a series in the demo store: F-2026-0007. */
export function nextDocNumber(existing: string[], series: string, year: number): string {
  const prefix = `${series}-${year}-`
  let max = 0
  for (const no of existing) if (no.startsWith(prefix)) max = Math.max(max, Number(no.slice(prefix.length)) || 0)
  return `${prefix}${String(max + 1).padStart(4, '0')}`
}

/* ------------------------------------------------------------------ */
/* Amounts in words (French, as on Moroccan invoices)                   */
/* ------------------------------------------------------------------ */
const UNITS = ['zéro', 'un', 'deux', 'trois', 'quatre', 'cinq', 'six', 'sept', 'huit', 'neuf', 'dix', 'onze', 'douze', 'treize', 'quatorze', 'quinze', 'seize', 'dix-sept', 'dix-huit', 'dix-neuf']
const TENS = ['', '', 'vingt', 'trente', 'quarante', 'cinquante', 'soixante', 'soixante', 'quatre-vingt', 'quatre-vingt']

/** `end`: the number ends here (so «quatre-vingts», «deux cents» take their s). */
function below100(n: number, end: boolean): string {
  if (n < 20) return UNITS[n]
  const t = Math.floor(n / 10)
  const u = n % 10
  if (t === 7 || t === 9) return t === 7 && u === 1 ? 'soixante et onze' : `${TENS[t]}-${UNITS[10 + u]}`
  if (u === 0) return t === 8 && end ? 'quatre-vingts' : TENS[t]
  if (u === 1 && t !== 8) return `${TENS[t]} et un`
  return `${TENS[t]}-${UNITS[u]}`
}

function below1000(n: number, end: boolean): string {
  const h = Math.floor(n / 100)
  const r = n % 100
  const head = h === 0 ? '' : h === 1 ? 'cent' : `${UNITS[h]} cent${r === 0 && end ? 's' : ''}`
  if (!r) return head
  return head ? `${head} ${below100(r, end)}` : below100(r, end)
}

export function numberToFrench(value: number): string {
  const n = Math.floor(Math.abs(value))
  if (n === 0) return 'zéro'
  const billions = Math.floor(n / 1e9)
  const millions = Math.floor((n % 1e9) / 1e6)
  const thousands = Math.floor((n % 1e6) / 1e3)
  const rest = n % 1e3
  const parts: string[] = []
  // «million(s)» and «milliard(s)» are nouns: what comes before them keeps its plural
  if (billions) parts.push(`${below1000(billions, true)} milliard${billions > 1 ? 's' : ''}`)
  if (millions) parts.push(`${below1000(millions, true)} million${millions > 1 ? 's' : ''}`)
  // «mille» never takes an s, and makes «cent» / «quatre-vingt» before it invariable
  if (thousands) parts.push(thousands === 1 ? 'mille' : `${below1000(thousands, false)} mille`)
  if (rest) parts.push(below1000(rest, true))
  return parts.join(' ')
}

/** «Vingt et un mille deux cent cinquante dirhams», with centimes when there are some. */
export function amountInWordsFr(amount: number): string {
  const cents100 = Math.round(Math.abs(amount) * 100)
  const whole = Math.floor(cents100 / 100)
  const cents = cents100 % 100
  const words = numberToFrench(whole)
  const de = whole >= 1e6 && whole % 1e6 === 0 ? ' de' : ''
  let out = `${words}${de} dirham${whole > 1 ? 's' : ''}`
  if (cents) out += ` et ${numberToFrench(cents)} centime${cents > 1 ? 's' : ''}`
  return out.charAt(0).toUpperCase() + out.slice(1)
}

/* ------------------------------------------------------------------ */
/* Deal file                                                            */
/* ------------------------------------------------------------------ */
export const OPEN_STAGES: DealStage[] = ['agreement', 'paperwork', 'signing']
export const STAGE_ORDER: DealStage[] = ['agreement', 'paperwork', 'signing', 'done']

/** Deals recorded before stages existed have none: they are done. */
export const isDone = (d: Pick<Deal, 'stage'>) => !d.stage || d.stage === 'done'
export const isOpenDeal = (d: Pick<Deal, 'stage'>) => Boolean(d.stage && OPEN_STAGES.includes(d.stage))

const SALE_STEPS = [
  'نسخ البطاقات الوطنية للبائع والمشتري',
  'شهادة الملكية حديثة من المحافظة العقارية',
  'شهادة أداء ضريبة الخدمات الجماعية',
  'شهادة السانديك بأداء واجبات الملكية المشتركة',
  'توقيع الوعد بالبيع وأداء العربون',
  'موافقة البنك على القرض (إن وُجد)',
  'توقيع العقد النهائي عند الموثق',
  'تسليم المفاتيح ومحضر التسليم',
  'تحصيل العمولة وتسليم الفاتورة',
]
const RENT_STEPS = [
  'نسخ البطاقات الوطنية للمالك والمكتري',
  'ضمانات المكتري: شهادة العمل أو كشف الأجرة',
  'توقيع عقد الكراء وتصحيح الإمضاءات',
  'أداء الضمانة والشهر الأول',
  'محضر معاينة حالة المحل وتسليم المفاتيح',
  'نقل عدادات الماء والكهرباء',
  'تحصيل العمولة وتسليم الفاتورة',
]

export function defaultChecklist(kind: Purpose, newId: () => string): ChecklistItem[] {
  return (kind === 'rent' ? RENT_STEPS : SALE_STEPS).map((label) => ({ id: newId(), label, done: false, at: null }))
}

export function checklistProgress(items: ChecklistItem[] | undefined) {
  const total = items?.length ?? 0
  const done = items?.filter((i) => i.done).length ?? 0
  return { done, total, pct: total ? Math.round((done / total) * 100) : 0 }
}

/** What a party pays for a deal (deals recorded before the split are paid by the buyer). */
export function partyDue(d: Pick<Deal, 'commission' | 'commission_seller' | 'commission_buyer'>, party: BillParty): number {
  if (party === 'seller') return d.commission_seller ?? 0
  if (party === 'buyer') return d.commission_buyer ?? (d.commission_seller == null ? d.commission : 0)
  return 0
}

/**
 * Money received for a deal: its valid receipts; a deal without receipts keeps the amount typed in
 * it (shared between the parties in proportion of what each owes).
 */
export function dealCollected(d: Pick<Deal, 'id' | 'commission' | 'commission_seller' | 'commission_buyer' | 'received'>, payments: Pick<Payment, 'deal_id' | 'amount' | 'status' | 'party'>[], party?: BillParty): number {
  const own = payments.filter((p) => p.deal_id === d.id && p.status === 'valid')
  if (own.length) return r2(own.filter((p) => !party || p.party === party).reduce((s, p) => s + p.amount, 0))
  const received = d.received ?? d.commission
  if (!party) return received
  return d.commission > 0 ? r2((received * partyDue(d, party)) / d.commission) : 0
}

/** Done deals that still owe the agency part of its commission, the oldest first. */
export function receivables(deals: Deal[], payments: Payment[]) {
  return deals
    .filter(isDone)
    .map((deal) => {
      const collected = dealCollected(deal, payments)
      return { deal, due: deal.commission, collected, rest: r2(Math.max(0, deal.commission - collected)) }
    })
    .filter((x) => x.rest > 0)
    .sort((a, b) => a.deal.closed_at.localeCompare(b.deal.closed_at))
}

/** Received so far on an invoice, from its valid receipts. */
export function invoicePaid(inv: Pick<Invoice, 'id'>, payments: Pick<Payment, 'invoice_id' | 'amount' | 'status'>[]): number {
  return r2(payments.filter((p) => p.invoice_id === inv.id && p.status === 'valid').reduce((s, p) => s + p.amount, 0))
}

export const invoiceRest = (inv: Pick<Invoice, 'total_ttc' | 'paid' | 'status' | 'kind'>) => (inv.status === 'cancelled' || inv.kind === 'credit' ? 0 : r2(Math.max(0, inv.total_ttc - (inv.paid || 0))))

/** Unpaid invoice past its due date (yyyy-mm-dd comparison). */
export const isOverdue = (inv: Pick<Invoice, 'due_at' | 'status' | 'kind' | 'total_ttc' | 'paid'>, today: string) => inv.status === 'issued' && inv.kind === 'invoice' && Boolean(inv.due_at && inv.due_at < today) && invoiceRest({ ...inv, status: 'issued' }) > 0

/** VAT invoiced between two dates (credit notes count negative; a cancelled invoice and its credit note cancel out). */
export function vatInvoiced(invoices: Pick<Invoice, 'issued_at' | 'total_vat'>[], from: string, to: string): number {
  return r2(invoices.filter((i) => i.issued_at >= from && i.issued_at <= to).reduce((s, i) => s + (i.total_vat || 0), 0))
}

/* ------------------------------------------------------------------ */
/* Accounts of a year                                                   */
/* ------------------------------------------------------------------ */
export interface MonthFigures {
  /** commissions of the deals done that month */
  commission: number
  /** VAT inside those commissions (owed to the State) */
  vat: number
  /** partners' shares */
  shares: number
  expenses: number
  /** commission - VAT - shares - expenses */
  net: number
}

const zero = (): MonthFigures => ({ commission: 0, vat: 0, shares: 0, expenses: 0, net: 0 })

export function yearAccounts(deals: Deal[], expenses: Pick<Expense, 'spent_at' | 'amount'>[], year: number, vatRate: number) {
  const months = Array.from({ length: 12 }, zero)
  for (const d of deals) {
    if (!isDone(d)) continue
    const at = new Date(d.closed_at)
    if (at.getFullYear() !== year) continue
    const m = months[at.getMonth()]
    m.commission += d.commission
    m.vat += r2(d.commission - htFromTtc(d.commission, vatRate))
    m.shares += sharesTotal(d.shares ?? [], d.commission)
  }
  for (const e of expenses) {
    if (Number(e.spent_at.slice(0, 4)) !== year) continue
    months[Number(e.spent_at.slice(5, 7)) - 1].expenses += e.amount
  }
  const total = zero()
  for (const m of months) {
    m.commission = r2(m.commission)
    m.vat = r2(m.vat)
    m.shares = r2(m.shares)
    m.expenses = r2(m.expenses)
    m.net = r2(m.commission - m.vat - m.shares - m.expenses)
    for (const k of Object.keys(total) as (keyof MonthFigures)[]) total[k] = r2(total[k] + m[k])
  }
  return { months, total }
}

/** Result of one deal: commission - VAT - partners - the expenses tied to it. */
export function dealResult(d: Deal, expenses: Pick<Expense, 'deal_id' | 'amount'>[], vatRate: number) {
  const vat = r2(d.commission - htFromTtc(d.commission, vatRate))
  const shares = sharesTotal(d.shares ?? [], d.commission)
  const spent = r2(expenses.filter((e) => e.deal_id === d.id).reduce((s, e) => s + e.amount, 0))
  return { commission: d.commission, vat, shares, expenses: spent, net: r2(d.commission - vat - shares - spent) }
}
