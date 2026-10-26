import type { CommissionSettings, FeeBracket, FeeSettings } from './types'

/*
 * Moroccan purchase and sale costs. Pure functions: no imports at run time, so the
 * same code runs in the browser and in the tests (npm run test:fees).
 * All rates in the settings are percentages; all amounts are dirhams.
 */

const pct = (amount: number, rate: number) => (amount * rate) / 100
const money = (n: number) => Math.round(n)

/** Amount owed on `amount` when each slice is taxed at its own rate (like an income tax scale). */
export function bracketAmount(amount: number, brackets: FeeBracket[]): number {
  let rest = Math.max(0, amount)
  let floor = 0
  let total = 0
  for (const b of brackets) {
    const top = b.upTo ?? Number.POSITIVE_INFINITY
    const slice = Math.min(rest, top - floor)
    if (slice <= 0) break
    total += pct(slice, b.rate)
    rest -= slice
    floor = top
  }
  return total
}

/** The agency fee for one side, with the minimum and VAT of the settings. */
export function agencyFee(base: number, rate: number, c: CommissionSettings): number {
  if (base <= 0 || rate <= 0) return 0
  const fee = Math.max(pct(base, rate), c.min_amount || 0)
  return money(fee * (1 + (c.vat || 0) / 100))
}

export interface CostLine {
  key: string
  amount: number
  /** rate shown next to the label, in % */
  rate?: number
  /** the amount depends on a negotiation or on the bank: shown as an estimate */
  estimate?: boolean
}

/* ------------------------------------------------------------------ */
/* Buyer                                                                */
/* ------------------------------------------------------------------ */
export type BuyerKind = 'built' | 'land' | 'social'

export interface BuyerInput {
  price: number
  kind: BuyerKind
  /** part of the price paid in cash (not by bank transfer, crossed cheque or loan) */
  cash: number
  /** bank loan amount, 0 = no loan */
  loan: number
  /** include the agency fee */
  agency: boolean
  /** date of the deed, yyyy-mm-dd (default: today) */
  date?: string
}

export interface BuyerResult {
  lines: CostLine[]
  total: number
  /** costs as a % of the price */
  share: number
  /** price + costs − loan */
  cashNeeded: number
  /** possible direct housing aid (information, conditions apply) */
  aid: number
}

export function buyerCosts(i: BuyerInput, f: FeeSettings, c: CommissionSettings): BuyerResult {
  const price = Math.max(0, i.price || 0)
  const date = i.date ?? new Date().toISOString().slice(0, 10)
  const lines: CostLine[] = []
  const regRate = i.kind === 'land' ? f.registration.land : i.kind === 'social' ? f.registration.social : f.registration.built
  lines.push({ key: 'registration', amount: money(pct(price, regRate)), rate: regRate })

  const cash = Math.min(Math.max(0, i.cash || 0), price)
  if (cash > 0 && price > f.registration.cash_threshold && date >= f.registration.cash_from) {
    lines.push({ key: 'cash_extra', amount: money(pct(cash, f.registration.cash_extra)), rate: f.registration.cash_extra })
  }

  if (price > 0) {
    const conservation = Math.max(f.conservation.min, pct(price, f.conservation.rate) + f.conservation.fixed)
    lines.push({ key: 'conservation', amount: money(conservation), rate: f.conservation.rate })
    const notary = Math.max(f.notary.min, pct(price, f.notary.rate))
    lines.push({ key: 'notary', amount: money(notary), rate: f.notary.rate, estimate: true })
    lines.push({ key: 'notary_vat', amount: money(pct(notary, f.notary.vat)), rate: f.notary.vat, estimate: true })
    if (f.notary.disbursements > 0) lines.push({ key: 'disbursements', amount: money(f.notary.disbursements), estimate: true })
  }

  if (i.agency) {
    const fee = agencyFee(price, c.sale_buyer, c)
    if (fee > 0) lines.push({ key: 'agency', amount: fee, rate: c.sale_buyer })
  }

  const loan = Math.max(0, i.loan || 0)
  if (loan > 0) {
    lines.push({ key: 'loan_conservation', amount: money(bracketAmount(loan, f.loan.brackets) + f.loan.fixed) })
    lines.push({ key: 'loan_registration', amount: money(f.loan.registration) })
    if (f.loan.bank_rate > 0) lines.push({ key: 'loan_bank', amount: money(pct(loan, f.loan.bank_rate)), rate: f.loan.bank_rate, estimate: true })
    if (f.loan.notary_rate > 0) {
      const fee = pct(loan, f.loan.notary_rate)
      lines.push({ key: 'loan_notary', amount: money(fee * (1 + f.notary.vat / 100)), rate: f.loan.notary_rate, estimate: true })
    }
  }

  const total = lines.reduce((s, l) => s + l.amount, 0)
  let aid = 0
  if (f.aid.enabled && i.kind !== 'land' && price > 0) {
    const tier = [...f.aid.tiers].sort((a, b) => a.upTo - b.upTo).find((t) => price <= t.upTo)
    aid = tier?.amount ?? 0
  }
  return { lines, total, share: price ? (total / price) * 100 : 0, cashNeeded: price + total - loan, aid }
}

/* ------------------------------------------------------------------ */
/* Seller                                                               */
/* ------------------------------------------------------------------ */
export type AcquisitionMode = 'purchase' | 'inheritance' | 'donation'

export interface SellerInput {
  price: number
  mode: AcquisitionMode
  /** year of purchase, or of the death / donation */
  year: number
  /** purchase price, or value declared at the death / in the donation */
  acquired: number
  /** proven acquisition costs; null = flat rate for a purchase, nothing otherwise */
  actualCosts: number | null
  /** construction / improvement works with invoices */
  investments: number
  /** interest paid on the purchase loan */
  interest: number
  /** other selling costs paid by the seller (advertising, documents…) */
  otherCosts: number
  /** include the agency fee */
  agency: boolean
  /** main residence for at least the legal years, never rented */
  residence: boolean
  /** first sale of a social home occupied for at least the legal years */
  social: boolean
  /** total sales of the year stay under the small-sales limit */
  small: boolean
  /** a mortgage must be released */
  release: boolean
  /** bank and notary fees for the release (estimate) */
  releaseFees: number
  /** unpaid local taxes (taxe d'habitation, services communaux, terrains non bâtis) */
  localTaxes: number
  /** remaining loan repaid from the price */
  loanBalance: number
}

export type Exemption = 'residence' | 'social' | 'small' | null

export interface SellerResult {
  coef: number
  acquisitionCosts: number
  /** acquisition price + costs + works + interest */
  base: number
  revalued: number
  sellingCosts: number
  profit: number
  /** 20 % of the profit */
  taxProfit: number
  /** 3 % of the price */
  taxMin: number
  tpi: number
  exemption: Exemption
  lines: CostLine[]
  total: number
  net: number
  netAfterLoan: number
}

/** Revaluation coefficient of the acquisition year (1 for recent years, oldest known before that). */
export function coefficient(year: number, f: FeeSettings): number {
  const table = f.tpi.coefficients
  const years = Object.keys(table)
    .map(Number)
    .filter(Number.isFinite)
    .sort((a, b) => a - b)
  if (!years.length) return 1
  if (table[String(year)] != null) return table[String(year)]
  if (year > years[years.length - 1]) return 1
  return table[String(years[0])]
}

export function sellerCosts(i: SellerInput, f: FeeSettings, c: CommissionSettings): SellerResult {
  const price = Math.max(0, i.price || 0)
  const acquired = Math.max(0, i.acquired || 0)
  const coef = coefficient(i.year, f)
  const acquisitionCosts = i.actualCosts != null ? Math.max(0, i.actualCosts) : i.mode === 'purchase' ? pct(acquired, f.tpi.flat_costs) : 0
  const base = acquired + acquisitionCosts + Math.max(0, i.investments || 0) + Math.max(0, i.interest || 0)
  const revalued = base * coef

  const agency = i.agency ? agencyFee(price, c.sale_seller, c) : 0
  const sellingCosts = agency + Math.max(0, i.otherCosts || 0)
  const profit = price - sellingCosts - revalued
  const taxProfit = pct(Math.max(0, profit), f.tpi.rate)
  const taxMin = pct(price, f.tpi.min_rate)

  let exemption: Exemption = null
  let tpi: number
  if (i.residence) {
    exemption = 'residence'
    tpi = price > f.tpi.residence_cap ? pct(price - f.tpi.residence_cap, f.tpi.min_rate) : 0
  } else if (i.social && price <= f.tpi.social_cap) {
    exemption = 'social'
    tpi = 0
  } else if (i.small && price <= f.tpi.small_cap) {
    exemption = 'small'
    tpi = 0
  } else {
    tpi = Math.max(taxProfit, taxMin)
  }

  const lines: CostLine[] = [{ key: 'tpi', amount: money(tpi), rate: f.tpi.rate }]
  if (agency > 0) lines.push({ key: 'agency_seller', amount: agency, rate: c.sale_seller })
  if (i.otherCosts > 0) lines.push({ key: 'other_costs', amount: money(i.otherCosts) })
  if (i.release) {
    lines.push({ key: 'release_conservation', amount: money(f.release.conservation) })
    lines.push({ key: 'release_registration', amount: money(f.release.registration) })
    if (i.releaseFees > 0) lines.push({ key: 'release_fees', amount: money(i.releaseFees), estimate: true })
  }
  if (i.localTaxes > 0) lines.push({ key: 'local_taxes', amount: money(i.localTaxes) })
  if (f.conservation.certificate > 0) lines.push({ key: 'certificate', amount: money(f.conservation.certificate) })

  const total = lines.reduce((s, l) => s + l.amount, 0)
  const net = price - total
  return {
    coef,
    acquisitionCosts: money(acquisitionCosts),
    base: money(base),
    revalued: money(revalued),
    sellingCosts: money(sellingCosts),
    profit: money(profit),
    taxProfit: money(taxProfit),
    taxMin: money(taxMin),
    tpi: money(tpi),
    exemption,
    lines,
    total,
    net,
    netAfterLoan: net - Math.max(0, i.loanBalance || 0),
  }
}
