import type { Financing, Lang, Mandate, OwnerReport, Purpose, VisitFeedback } from './types'

/*
 * Owners: mandate status, commission agreed with the owner, days on the market and the
 * report sent to the owner. Pure functions (tests: npm run test:owners).
 */

const DAY = 86_400_000

export type MandateState = 'active' | 'expiring' | 'expired' | 'ended' | 'cancelled'

/** End of the given yyyy-mm-dd day, local time. */
function endOfDay(date: string): number {
  const [y, m, d] = date.split('-').map(Number)
  return new Date(y, (m || 1) - 1, d || 1, 23, 59, 59).getTime()
}

/** State of a mandate today: expiring = ends within `soon` days, expired = past its end but still marked active. */
export function mandateState(m: Pick<Mandate, 'status' | 'end_date'>, today: Date = new Date(), soon = 30): { state: MandateState; daysLeft: number | null } {
  if (m.status !== 'active') return { state: m.status, daysLeft: null }
  if (!m.end_date) return { state: 'active', daysLeft: null }
  const left = Math.floor((endOfDay(m.end_date) - today.getTime()) / DAY)
  if (left < 0) return { state: 'expired', daysLeft: left }
  return { state: left <= soon ? 'expiring' : 'active', daysLeft: left }
}

/** The mandate in force for a property: the latest active one. */
export function currentMandate<T extends Pick<Mandate, 'property_id' | 'status' | 'start_date'>>(list: T[], propertyId: string | null | undefined): T | undefined {
  if (!propertyId) return undefined
  return list.filter((m) => m.property_id === propertyId && m.status === 'active').sort((a, b) => b.start_date.localeCompare(a.start_date))[0]
}

/** Commission the owner agreed to pay for a deal of `amount` (price, or monthly rent). */
export function mandateCommission(m: Pick<Mandate, 'commission_rate' | 'commission_amount'>, amount: number, purpose: Purpose): number | null {
  if (m.commission_amount != null && m.commission_amount > 0) return Math.round(m.commission_amount)
  if (m.commission_rate != null && m.commission_rate > 0) return Math.round(purpose === 'rent' ? amount * m.commission_rate : (amount * m.commission_rate) / 100)
  return null
}

export function daysOnMarket(createdAt: string, today: Date = new Date()): number {
  return Math.max(0, Math.floor((today.getTime() - new Date(createdAt).getTime()) / DAY))
}

const T: Record<Lang, { hello: string; line: string; planned: string; offers: string; feedback: string; link: string; bye: string; none: string }> = {
  ar: {
    hello: 'السلام عليكم {name}، هذا تقرير عقاركم لدى {agency}:',
    line: '• {ref} {title}: المشاهدات على الموقع {views}، الطلبات {leads}، الزيارات المنجزة {done}{planned}{offers}. الثمن الحالي {price}.',
    planned: '، والزيارات المبرمجة {n}',
    offers: '، والعروض المتوصل بها {n}',
    feedback: '  رأي الزوار: مهتمون {hot} من {total}، ويرى {high} منهم أن الثمن مرتفع.',
    link: 'تابعوا كل جديد مباشرة من هنا: {link}',
    bye: 'مع تحيات فريق {agency}',
    none: 'لا يوجد عقار مسجل باسمكم حالياً.',
  },
  fr: {
    hello: 'Bonjour {name}, voici le point sur votre bien avec {agency} :',
    line: '• {ref} {title} : vues sur le site {views}, demandes {leads}, visites effectuées {done}{planned}{offers}. Prix actuel : {price}.',
    planned: ', visites prévues {n}',
    offers: ', offres reçues {n}',
    feedback: '  Avis des visiteurs : intéressés {hot} sur {total}, prix jugé élevé par {high}.',
    link: 'Suivez tout en direct ici : {link}',
    bye: 'Cordialement, l’équipe {agency}',
    none: 'Aucun bien n’est enregistré à votre nom pour le moment.',
  },
  es: {
    hello: 'Hola {name}, este es el informe de su inmueble con {agency}:',
    line: '• {ref} {title}: visitas en la web {views}, solicitudes {leads}, visitas realizadas {done}{planned}{offers}. Precio actual: {price}.',
    planned: ', visitas previstas {n}',
    offers: ', ofertas recibidas {n}',
    feedback: '  Opinión de los visitantes: interesados {hot} de {total}, precio alto según {high}.',
    link: 'Siga todo en directo aquí: {link}',
    bye: 'Saludos, el equipo de {agency}',
    none: 'No hay ningún inmueble a su nombre por ahora.',
  },
  en: {
    hello: 'Hello {name}, here is the update on your property with {agency}:',
    line: '• {ref} {title}: website views {views}, requests {leads}, viewings done {done}{planned}{offers}. Current price: {price}.',
    planned: ', viewings planned {n}',
    offers: ', offers received {n}',
    feedback: '  Visitor feedback: {hot} of {total} interested, price felt high by {high}.',
    link: 'Follow everything live here: {link}',
    bye: 'Kind regards, the {agency} team',
    none: 'No property is registered in your name at the moment.',
  },
}

const fill = (s: string, v: Record<string, string | number>) => s.replace(/\{(\w+)\}/g, (_, k: string) => String(v[k] ?? ''))

/** WhatsApp message to the owner, in his language. */
export function ownerReportText(r: OwnerReport, agency: string, link: string | null, price: (n: number) => string): string {
  const t = T[r.lang] ?? T.ar
  const lines = r.properties.flatMap((p) => {
    const line = fill(t.line, {
      ref: p.ref,
      title: p.title,
      views: p.views,
      leads: p.leads,
      done: p.visits_done,
      planned: p.visits_planned ? fill(t.planned, { n: p.visits_planned }) : '',
      offers: p.offers ? fill(t.offers, { n: p.offers }) : '',
      price: price(p.price),
    })
    const f = p.feedback
    const total = f ? f.hot + f.warm + f.cold : 0
    return total ? [line, fill(t.feedback, { hot: f!.hot, total, high: f!.price_high })] : [line]
  })
  return [fill(t.hello, { name: r.name, agency }), ...(lines.length ? lines : [t.none]), ...(link ? [fill(t.link, { link })] : []), fill(t.bye, { agency })].join('\n')
}

interface ReportClient {
  id: string
  full_name: string
  lang: Lang
}
interface ReportProperty {
  id: string
  ref: string
  title: string
  purpose: Purpose
  type: OwnerReport['properties'][number]['type']
  status: OwnerReport['properties'][number]['status']
  published: boolean
  price: number
  images: string[]
  views: number
  created_at: string
  owner_client_id: string | null
}

/** The owner's report from the tables (same content as the database function re_owner_report). */
export function buildOwnerReport(
  client: ReportClient,
  properties: ReportProperty[],
  leads: { property_id: string | null }[],
  appointments: { property_id: string | null; kind: string; status: string; starts_at: string }[],
  prices: { property_id: string; new_price: number; created_at: string }[],
  mandates: Pick<Mandate, 'property_id' | 'status' | 'kind' | 'start_date' | 'end_date'>[],
  now: Date = new Date(),
  offers: { property_id: string; status: string }[] = [],
): OwnerReport {
  const nowIso = now.toISOString()
  return {
    name: client.full_name.split(' ')[0],
    lang: client.lang,
    generated_at: nowIso,
    properties: properties
      .filter((p) => p.owner_client_id === client.id)
      .sort((a, b) => b.created_at.localeCompare(a.created_at))
      .map((p) => {
        const visits = appointments.filter((a) => a.property_id === p.id && a.kind === 'visit')
        const done = visits.filter((a) => a.status === 'done') as (typeof visits[number] & { feedback_interest?: string | null; feedback_price?: string | null })[]
        const m = currentMandate(mandates, p.id)
        const fb: VisitFeedback = { hot: 0, warm: 0, cold: 0, price_high: 0, price_fair: 0, price_low: 0 }
        for (const a of done) {
          if (a.feedback_interest === 'hot' || a.feedback_interest === 'warm' || a.feedback_interest === 'cold') fb[a.feedback_interest]++
          if (a.feedback_price === 'high' || a.feedback_price === 'fair' || a.feedback_price === 'low') fb[`price_${a.feedback_price}`]++
        }
        return {
          ref: p.ref,
          title: p.title,
          purpose: p.purpose,
          type: p.type,
          status: p.status,
          published: p.published,
          price: p.price,
          image: p.images[0] ?? null,
          views: p.views,
          created_at: p.created_at,
          leads: leads.filter((l) => l.property_id === p.id).length,
          visits_done: done.length,
          visits_planned: visits.filter((a) => a.status === 'scheduled' && a.starts_at > nowIso).length,
          last_visit: done.map((a) => a.starts_at).sort().pop() ?? null,
          prices: prices
            .filter((h) => h.property_id === p.id)
            .sort((a, b) => a.created_at.localeCompare(b.created_at))
            .map((h) => ({ price: h.new_price, at: h.created_at })),
          mandate: m ? { kind: m.kind, start_date: m.start_date, end_date: m.end_date } : null,
          offers: offers.filter((o) => o.property_id === p.id && o.status !== 'withdrawn').length,
          feedback: fb,
        }
      }),
  }
}

const FIN: Record<Lang, Record<Financing, string>> = {
  ar: { cash: 'نقداً', loan: 'بقرض بنكي', mixed: 'جزء نقداً وجزء بقرض' },
  fr: { cash: 'comptant', loan: 'par crédit bancaire', mixed: 'en partie comptant, en partie à crédit' },
  es: { cash: 'al contado', loan: 'con préstamo bancario', mixed: 'parte al contado y parte con préstamo' },
  en: { cash: 'in cash', loan: 'with a bank loan', mixed: 'partly in cash, partly with a bank loan' },
}

const OFFER: Record<Lang, string> = {
  ar: 'السلام عليكم {name}، توصلنا بعرض جديد على عقاركم {ref}: {amount}، أي {pct}% من الثمن المعروض {price}. طريقة الأداء: {fin}.{cond} ننتظر رأيكم.\nفريق {agency}',
  fr: 'Bonjour {name}, nous avons reçu une nouvelle offre pour votre bien {ref} : {amount}, soit {pct} % du prix demandé ({price}). Paiement : {fin}.{cond} Qu’en pensez-vous ?\nL’équipe {agency}',
  es: 'Hola {name}, hemos recibido una nueva oferta por su inmueble {ref}: {amount}, es decir el {pct} % del precio pedido ({price}). Pago: {fin}.{cond} ¿Qué le parece?\nEl equipo de {agency}',
  en: 'Hello {name}, we have received a new offer for your property {ref}: {amount}, i.e. {pct}% of the asking price ({price}). Payment: {fin}.{cond} What do you think?\nThe {agency} team',
}

/** WhatsApp message telling the owner about an offer, in his language. */
export function offerMessage(o: { amount: number; financing: Financing; conditions: string | null }, p: { ref: string; price: number }, owner: { full_name: string; lang: Lang }, agency: string, price: (n: number) => string): string {
  const lang = OFFER[owner.lang] ? owner.lang : 'ar'
  const pct = p.price ? Math.round((o.amount / p.price) * 1000) / 10 : 0
  const cond = o.conditions?.trim() ? ` ${o.conditions.trim().replace(/[.。]?$/, '.')}` : ''
  return fill(OFFER[lang], { name: owner.full_name.split(' ')[0], ref: p.ref, amount: price(o.amount), pct, price: price(p.price), fin: FIN[lang][o.financing], cond, agency })
}
