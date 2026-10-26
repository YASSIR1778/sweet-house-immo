import type { Lang, Lease, RentPayment } from './types'

/*
 * Rental management (law 67-12 on housing and professional leases). Pure functions
 * (tests: npm run test:rentals).
 *
 *  - art. 11: the landlord (or his agent) gives a signed receipt showing rent and charges apart;
 *  - art. 20: the deposit is at most two months of rent, returned within a month of the keys;
 *  - art. 33-34: without another agreement, the rent may be raised every 3 years at least,
 *    by 8 % for housing and 10 % for professional premises.
 */

const r2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100
const pad = (n: number) => String(n).padStart(2, '0')

/** yyyy-mm of a date (local time). */
export const periodOf = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}`

export function addMonths(period: string, n: number): string {
  const [y, m] = period.split('-').map(Number)
  const t = y * 12 + (m - 1) + n
  return `${Math.floor(t / 12)}-${pad((t % 12) + 1)}`
}

/** Every month from `from` to `to`, both included. */
export function periodsBetween(from: string, to: string): string[] {
  const out: string[] = []
  for (let p = from; p <= to && out.length < 600; p = addMonths(p, 1)) out.push(p)
  return out
}

/** Rent and charges of a month, after the revisions in force. */
export function rentFor(l: Pick<Lease, 'rent' | 'charges' | 'revisions'>, period: string): { rent: number; charges: number } {
  let cur = { rent: l.rent, charges: l.charges }
  for (const r of [...(l.revisions ?? [])].sort((a, b) => a.from.localeCompare(b.from))) if (r.from <= period) cur = { rent: r.rent, charges: r.charges }
  return cur
}

export type RentStatus = 'paid' | 'partial' | 'unpaid' | 'upcoming'
export interface ScheduleRow {
  period: string
  /** yyyy-mm-dd */
  due: string
  rent: number
  charges: number
  amount: number
  paid: number
  status: RentStatus
  /** days past the due date while not fully paid */
  late: number
  payments: RentPayment[]
}

/** Last month of a lease: its end, or the month it was ended. */
function lastPeriod(l: Pick<Lease, 'end_date' | 'ended_at' | 'status'>): string | null {
  const end = l.status !== 'active' ? l.ended_at ?? l.end_date : null
  return end ? end.slice(0, 7) : null
}

/** Month by month from the start of the lease to the next month: what is due, what was paid. */
export function leaseSchedule(l: Lease, payments: RentPayment[], today: Date = new Date()): ScheduleRow[] {
  const todayStr = `${today.getFullYear()}-${pad(today.getMonth() + 1)}-${pad(today.getDate())}`
  const until = [addMonths(periodOf(today), 1), lastPeriod(l), l.end_date?.slice(0, 7)].filter(Boolean).sort()[0] as string
  const own = payments.filter((p) => p.lease_id === l.id && p.status === 'valid')
  return periodsBetween(l.start_date.slice(0, 7), until).map((period) => {
    const { rent, charges } = rentFor(l, period)
    const ps = own.filter((p) => p.period === period)
    const paid = r2(ps.reduce((s, p) => s + p.rent + p.charges, 0))
    const amount = r2(rent + charges)
    const due = `${period}-${pad(Math.min(28, Math.max(1, l.pay_day || 1)))}`
    const status: RentStatus = paid >= amount - 0.009 ? 'paid' : paid > 0 ? 'partial' : due > todayStr ? 'upcoming' : 'unpaid'
    const late = status === 'unpaid' || (status === 'partial' && due <= todayStr) ? Math.max(0, Math.floor((Date.parse(todayStr) - Date.parse(due)) / 86_400_000)) : 0
    return { period, due, rent, charges, amount, paid, status, late, payments: ps }
  })
}

/** Rent owed and overdue today. */
export function leaseArrears(l: Lease, payments: RentPayment[], today: Date = new Date()) {
  const rows = leaseSchedule(l, payments, today).filter((r) => r.late > 0)
  return { months: rows.length, amount: r2(rows.reduce((s, r) => s + r.amount - r.paid, 0)), oldest: rows[0]?.period ?? null, maxLate: Math.max(0, ...rows.map((r) => r.late)) }
}

/** Revision allowed by art. 33-34 when nothing else was agreed. */
export function revisionStatus(l: Pick<Lease, 'start_date' | 'rent' | 'charges' | 'revisions' | 'usage'>, today: Date = new Date()) {
  const revs = [...(l.revisions ?? [])].sort((a, b) => a.from.localeCompare(b.from))
  const last = revs.length ? `${revs[revs.length - 1].from}-01` : l.start_date.slice(0, 10)
  const [y, m, d] = last.split('-').map(Number)
  const next = `${y + 3}-${pad(m)}-${pad(d || 1)}`
  const todayStr = `${today.getFullYear()}-${pad(today.getMonth() + 1)}-${pad(today.getDate())}`
  const cap = l.usage === 'professional' ? 10 : 8
  const current = rentFor(l, periodOf(today)).rent
  return { last, next, eligible: todayStr >= next, cap, current, suggested: Math.round(current * (1 + cap / 100)) }
}

/** Art. 20: the deposit may not exceed two months of rent. */
export const depositMax = (rent: number) => r2(rent * 2)

/** Art. 20: deposit to give back within a month of getting the keys back (yyyy-mm-dd). */
export function depositReturnBy(l: Pick<Lease, 'ended_at' | 'deposit' | 'deposit_returned_at'>): string | null {
  if (!l.ended_at || !l.deposit || l.deposit_returned_at) return null
  const [y, m, d] = l.ended_at.slice(0, 10).split('-').map(Number)
  const t = new Date(y, m, d) // one month later (JS months are 0-based, so m is next month)
  return `${t.getFullYear()}-${pad(t.getMonth() + 1)}-${pad(t.getDate())}`
}

/** The agency's fee on a rent it collected (on the rent, not the charges). */
export const managementFee = (p: Pick<RentPayment, 'rent'>, rate: number) => r2((p.rent * (rate || 0)) / 100)

/** What goes to the owner from a rent the agency collected. */
export const ownerShare = (p: Pick<RentPayment, 'rent' | 'charges'>, rate: number) => r2(p.rent + p.charges - managementFee(p, rate))

/** Fees earned on managed leases, by date (agency revenue). */
export function managementFees(leases: Pick<Lease, 'id' | 'managed' | 'management_rate'>[], payments: RentPayment[]): { date: string; amount: number }[] {
  const rate = new Map(leases.filter((l) => l.managed && l.management_rate > 0).map((l) => [l.id, l.management_rate]))
  return payments.filter((p) => p.status === 'valid' && rate.has(p.lease_id)).map((p) => ({ date: p.paid_at, amount: managementFee(p, rate.get(p.lease_id)!) }))
}

/** Rents collected for an owner between two dates, with the agency fee and his net. */
export function ownerStatement(leases: Lease[], payments: RentPayment[], ownerId: string, from: string, to: string) {
  const mine = new Map(leases.filter((l) => l.owner_client_id === ownerId && l.managed).map((l) => [l.id, l]))
  const rows = payments
    .filter((p) => p.status === 'valid' && mine.has(p.lease_id) && p.paid_at >= from && p.paid_at <= to)
    .sort((a, b) => a.paid_at.localeCompare(b.paid_at))
    .map((p) => {
      const l = mine.get(p.lease_id)!
      const fee = managementFee(p, l.management_rate)
      return { lease: l, payment: p, fee, net: r2(p.rent + p.charges - fee) }
    })
  const total = rows.reduce((s, r) => ({ collected: r2(s.collected + r.payment.rent + r.payment.charges), fees: r2(s.fees + r.fee), net: r2(s.net + r.net), remitted: r2(s.remitted + (r.payment.remitted_at ? r.net : 0)) }), { collected: 0, fees: 0, net: 0, remitted: 0 })
  return { rows, total: { ...total, toRemit: r2(total.net - total.remitted) } }
}

/* ------------------------------------------------------------------ */
/* WhatsApp reminders to the tenant, in his language                    */
/* ------------------------------------------------------------------ */
const MSG: Record<Lang, { due: string; late: string }> = {
  ar: {
    due: 'السلام عليكم {name}، نذكّركم بأن واجب كراء شهر {month} ({amount}) للمحل {ref} يحل يوم {date}. شكراً لكم.\n{agency}',
    late: 'السلام عليكم {name}، لم نتوصل بعد بواجب كراء شهر {month} ({amount}) للمحل {ref}، الذي حل أجله يوم {date}. نرجو تسويته في أقرب وقت. شكراً لكم.\n{agency}',
  },
  fr: {
    due: 'Bonjour {name}, nous vous rappelons que le loyer de {month} ({amount}) pour le bien {ref} est dû le {date}. Merci.\n{agency}',
    late: 'Bonjour {name}, nous n’avons pas encore reçu le loyer de {month} ({amount}) pour le bien {ref}, échu le {date}. Merci de le régler dès que possible.\n{agency}',
  },
  es: {
    due: 'Hola {name}, le recordamos que el alquiler de {month} ({amount}) del inmueble {ref} vence el {date}. Gracias.\n{agency}',
    late: 'Hola {name}, aún no hemos recibido el alquiler de {month} ({amount}) del inmueble {ref}, vencido el {date}. Le rogamos que lo abone lo antes posible. Gracias.\n{agency}',
  },
}
const LOCALE: Record<Lang, string> = { ar: 'ar-MA-u-nu-latn', fr: 'fr-FR', es: 'es-ES' }

export function monthName(period: string, lang: Lang): string {
  const [y, m] = period.split('-').map(Number)
  return new Intl.DateTimeFormat(LOCALE[lang] ?? LOCALE.ar, { month: 'long', year: 'numeric' }).format(new Date(y, m - 1, 1))
}

export function rentReminder(kind: 'due' | 'late', lang: Lang, v: { name: string; period: string; amount: string; ref: string; due: string; agency: string }): string {
  const t = (MSG[lang] ?? MSG.ar)[kind]
  const [y, m, d] = v.due.split('-').map(Number)
  const date = new Intl.DateTimeFormat(LOCALE[lang] ?? LOCALE.ar, { day: 'numeric', month: 'long' }).format(new Date(y, m - 1, d))
  const vars: Record<string, string> = { name: v.name.split(' ')[0], month: monthName(v.period, lang), amount: v.amount, ref: v.ref, date, agency: v.agency }
  return t.replace(/\{(\w+)\}/g, (_, k: string) => vars[k] ?? '')
}
