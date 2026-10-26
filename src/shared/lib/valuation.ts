import type { Neighborhood, Property, PropertyType, Purpose } from './types'

/*
 * Price estimate and market figures from the agency's own listings (and the reference prices
 * its experts set per neighbourhood). Pure functions (tests: npm run test:valuation).
 *
 * The estimate is a first indication: the median price per m² of comparable listings (same
 * purpose, same kind of property, same neighbourhood), adjusted for condition and a few
 * features, with a range that widens when comparables are few.
 */

export type TypeGroup = 'flat' | 'house' | 'land' | 'business' | 'other'
const GROUP: Record<PropertyType, TypeGroup> = {
  apartment: 'flat',
  studio: 'flat',
  duplex: 'flat',
  house: 'house',
  villa: 'house',
  riad: 'house',
  farm: 'house',
  land: 'land',
  commercial: 'business',
  office: 'business',
  building: 'business',
  garage: 'other',
}
export const typeGroup = (t: PropertyType): TypeGroup => GROUP[t] ?? 'other'

export type Condition = 'new' | 'good' | 'renovate'
export const CONDITION_FACTOR: Record<Condition, number> = { new: 1.08, good: 1, renovate: 0.85 }
/** Effect of a feature on the price (multiplier). */
export const FEATURE_FACTOR: Record<string, number> = { sea_view: 1.1, pool: 1.06, garden: 1.04, terrace: 1.03, parking: 1.03, garage: 1.03, elevator: 1.02 }
const FURNISHED_RENT = 1.15

export interface ValuationInput {
  purpose: Purpose
  type: PropertyType
  neighborhood: string
  area: number
  condition: Condition
  features: string[]
  furnished?: boolean
}

export interface Comparable {
  id: string
  ref: string
  price: number
  area: number
  perM2: number
  neighborhood: string
  type: PropertyType
}

export type Confidence = 'high' | 'medium' | 'low'
export interface Estimate {
  low: number
  mid: number
  high: number
  /** price (or monthly rent) per m² used */
  perM2: number
  basis: 'neighborhood' | 'reference' | 'city'
  /** comparables in the same neighbourhood (or the area when there are none) */
  comps: Comparable[]
  confidence: Confidence
}

export function median(xs: number[]): number {
  if (!xs.length) return 0
  const s = [...xs].sort((a, b) => a - b)
  const m = Math.floor(s.length / 2)
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2
}

/** Listings usable as comparables: priced, with an area, on the market. */
export function comparables(listings: Property[], purpose: Purpose, group: TypeGroup): Comparable[] {
  return listings
    .filter((p) => p.purpose === purpose && typeGroup(p.type) === group && p.price > 0 && (p.area ?? 0) >= 10 && p.status !== 'draft')
    .map((p) => ({ id: p.id, ref: p.ref, price: p.price, area: p.area!, perM2: p.price / p.area!, neighborhood: p.neighborhood, type: p.type }))
}

/** Reference price per m² the agency set for a neighbourhood (sale) or monthly rent per m² (rent). */
export function referencePrice(n: Neighborhood | undefined, purpose: Purpose): number | null {
  const v = purpose === 'rent' ? n?.ref_rent_m2 : n?.ref_sale_m2
  return v && v > 0 ? v : null
}

const RANGE: Record<Confidence, number> = { high: 0.08, medium: 0.12, low: 0.18 }
const round = (n: number, step: number) => Math.round(n / step) * step

export function estimate(input: ValuationInput, listings: Property[], neighborhoods: Neighborhood[]): Estimate | null {
  if (!(input.area > 0)) return null
  const group = typeGroup(input.type)
  const all = comparables(listings, input.purpose, group)
  const near = all.filter((c) => c.neighborhood === input.neighborhood)
  const ref = referencePrice(
    neighborhoods.find((n) => n.id === input.neighborhood),
    input.purpose,
  )
  let perM2: number
  let basis: Estimate['basis']
  let confidence: Confidence
  if (near.length >= 3) {
    perM2 = median(near.map((c) => c.perM2))
    basis = 'neighborhood'
    confidence = near.length >= 5 ? 'high' : 'medium'
  } else if (ref) {
    // few listings nearby: the expert's reference, nudged by what is listed
    perM2 = near.length ? (ref * (3 - near.length) + median(near.map((c) => c.perM2)) * near.length) / 3 : ref
    basis = 'reference'
    confidence = near.length ? 'medium' : 'low'
  } else if (all.length >= 3) {
    perM2 = median(all.map((c) => c.perM2))
    basis = 'city'
    confidence = 'low'
  } else return null

  let factor = CONDITION_FACTOR[input.condition] ?? 1
  for (const f of new Set(input.features)) factor *= FEATURE_FACTOR[f] ?? 1
  if (input.purpose === 'rent' && input.furnished) factor *= FURNISHED_RENT
  const mid = perM2 * input.area * factor
  const step = input.purpose === 'rent' ? 50 : 5_000
  const spread = RANGE[confidence]
  return {
    low: round(mid * (1 - spread), step),
    mid: round(mid, step),
    high: round(mid * (1 + spread), step),
    perM2: Math.round(perM2 * (input.purpose === 'rent' ? 10 : 1)) / (input.purpose === 'rent' ? 10 : 1),
    basis,
    comps: (near.length ? near : all).sort((a, b) => Math.abs(a.area - input.area) - Math.abs(b.area - input.area)).slice(0, 6),
    confidence,
  }
}

export interface MarketRow {
  id: string
  /** median price per m² of flats for sale */
  sale: number | null
  saleCount: number
  /** median monthly rent per m² of flats */
  rent: number | null
  rentCount: number
  /** the figure comes from the expert's reference, not from listings */
  saleRef: boolean
  rentRef: boolean
}

/** Price per m² by neighbourhood (flats): from listings when there are at least 2, else the reference. */
export function marketTable(listings: Property[], neighborhoods: Neighborhood[], group: TypeGroup = 'flat'): MarketRow[] {
  const sale = comparables(listings, 'sale', group)
  const rent = comparables(listings, 'rent', group)
  return neighborhoods
    .map((n) => {
      const s = sale.filter((c) => c.neighborhood === n.id)
      const r = rent.filter((c) => c.neighborhood === n.id)
      const sRef = referencePrice(n, 'sale')
      const rRef = referencePrice(n, 'rent')
      return {
        id: n.id,
        sale: s.length >= 2 ? Math.round(median(s.map((c) => c.perM2))) : sRef,
        saleCount: s.length,
        rent: r.length >= 2 ? Math.round(median(r.map((c) => c.perM2)) * 10) / 10 : rRef,
        rentCount: r.length,
        saleRef: s.length < 2 && sRef != null,
        rentRef: r.length < 2 && rRef != null,
      }
    })
    .filter((x) => x.sale != null || x.rent != null)
    .sort((a, b) => (b.sale ?? 0) - (a.sale ?? 0))
}

/** «≈ 98 100 €» from dirhams, at the agency's indicative rate (MAD for 1 €). */
export function toEur(mad: number, rate: number): number | null {
  if (!(rate > 0) || !(mad > 0)) return null
  const eur = mad / rate
  const step = eur >= 10_000 ? 100 : 10
  return Math.round(eur / step) * step
}
