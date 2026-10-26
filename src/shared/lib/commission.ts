import type { Broker, CommissionSettings, DealShare, NetworkSettings, Purpose, ShareSide } from './types'

/*
 * Commission of a deal and how it is shared with partners. Pure functions (tests: npm run test:fees).
 *
 * Customary rules used as defaults (all editable):
 *  - the commission is split between the side that brought the property (listing side) and the
 *    side that brought the client (client side), half each;
 *  - several brokers on the same side share that side equally;
 *  - a broker with his own agreement (% of the commission or a fixed amount) gets exactly that;
 *  - a referrer who only passed a contact gets a small % of the commission;
 *  - the agency keeps everything that is not shared.
 */

const round = (n: number) => Math.round(n)
const newId = () => (globalThis.crypto?.randomUUID ? globalThis.crypto.randomUUID() : `s-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`)

/** Default commission of each party for a deal, from the agency's settings. */
export function defaultCommission(kind: Purpose, amount: number, c: CommissionSettings): { seller: number; buyer: number } {
  const vat = 1 + (c.vat || 0) / 100
  const side = (v: number) => (v > 0 ? round(Math.max(v, c.min_amount || 0) * vat) : 0)
  if (kind === 'rent') return { seller: side(amount * c.rent_owner), buyer: side(amount * c.rent_tenant) }
  return { seller: side((amount * c.sale_seller) / 100), buyer: side((amount * c.sale_buyer) / 100) }
}

export function shareAmount(s: Pick<DealShare, 'mode' | 'value'>, total: number): number {
  return round(s.mode === 'percent' ? (total * (s.value || 0)) / 100 : s.value || 0)
}

export function sharesTotal(shares: DealShare[], total: number): number {
  return shares.reduce((sum, s) => sum + shareAmount(s, total), 0)
}

/** What the agency keeps after paying every partner. */
export function agencyNet(total: number, shares: DealShare[]): number {
  return total - sharesTotal(shares, total)
}

export function shareFromBroker(b: Broker, side: ShareSide, pool: number, partners: number, n: NetworkSettings): DealShare {
  const base = { id: newId(), ref_id: b.id, name: b.full_name, side, paid: 0, paid_at: null }
  if (b.agreement_mode === 'percent') return { ...base, party: b.kind === 'referrer' ? 'referrer' : 'broker', mode: 'percent', value: b.agreement_value }
  if (b.agreement_mode === 'fixed') return { ...base, party: b.kind === 'referrer' ? 'referrer' : 'broker', mode: 'fixed', value: b.agreement_value }
  if (b.kind === 'referrer') return { ...base, party: 'referrer', side: 'other', mode: 'percent', value: n.referrer_share }
  return { ...base, party: 'broker', mode: 'percent', value: Math.round((pool / Math.max(1, partners)) * 100) / 100 }
}

/**
 * Suggested shares for a deal: brokers of the listing side, of the client side, referrers, and
 * the bonus of the employee who closed it.
 */
export function suggestShares(
  parts: { listing: Broker[]; client: Broker[]; referrers?: Broker[]; staff?: { id: string; name: string } | null },
  n: NetworkSettings,
): DealShare[] {
  const out: DealShare[] = []
  const sides: [ShareSide, Broker[], number][] = [
    ['listing', parts.listing, n.listing_share],
    ['client', parts.client, n.client_share],
  ]
  for (const [side, all, pool] of sides) {
    // a developer sells and pays the agency: he never takes a share of the commission
    const brokers = all.filter((b) => b.kind !== 'developer')
    const customary = brokers.filter((b) => b.agreement_mode === 'side' && b.kind !== 'referrer').length
    for (const b of brokers) out.push(shareFromBroker(b, side, pool, customary, n))
  }
  for (const r of parts.referrers ?? []) out.push(shareFromBroker({ ...r, kind: 'referrer' }, 'other', 0, 1, n))
  if (parts.staff && n.staff_bonus > 0) {
    out.push({ id: newId(), party: 'staff', ref_id: parts.staff.id, name: parts.staff.name, side: 'other', mode: 'percent', value: n.staff_bonus, paid: 0, paid_at: null })
  }
  return out
}

/** Money owed to one partner (broker or referrer) across deals. */
export function partnerBalance(deals: { commission: number; shares?: DealShare[] }[], refId: string) {
  let due = 0
  let paid = 0
  let count = 0
  for (const d of deals) {
    for (const s of d.shares ?? []) {
      if (s.ref_id !== refId) continue
      count++
      due += shareAmount(s, d.commission)
      paid += s.paid || 0
    }
  }
  return { due, paid, rest: Math.max(0, due - paid), count }
}
