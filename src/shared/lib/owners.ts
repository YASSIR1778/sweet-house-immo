import type { Lang, Mandate, OwnerReport, Purpose } from './types'

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

const T: Record<Lang, { hello: string; line: string; planned: string; link: string; bye: string; none: string }> = {
  ar: {
    hello: 'السلام عليكم {name}، هذا تقرير عقاركم لدى {agency}:',
    line: '• {ref} {title}: المشاهدات على الموقع {views}، الطلبات {leads}، الزيارات المنجزة {done}{planned}. الثمن الحالي {price}.',
    planned: '، والزيارات المبرمجة {n}',
    link: 'تابعوا كل جديد مباشرة من هنا: {link}',
    bye: 'مع تحيات فريق {agency}',
    none: 'لا يوجد عقار مسجل باسمكم حالياً.',
  },
  fr: {
    hello: 'Bonjour {name}, voici le point sur votre bien avec {agency} :',
    line: '• {ref} {title} : vues sur le site {views}, demandes {leads}, visites effectuées {done}{planned}. Prix actuel : {price}.',
    planned: ', visites prévues {n}',
    link: 'Suivez tout en direct ici : {link}',
    bye: 'Cordialement, l’équipe {agency}',
    none: 'Aucun bien n’est enregistré à votre nom pour le moment.',
  },
  es: {
    hello: 'Hola {name}, este es el informe de su inmueble con {agency}:',
    line: '• {ref} {title}: visitas en la web {views}, solicitudes {leads}, visitas realizadas {done}{planned}. Precio actual: {price}.',
    planned: ', visitas previstas {n}',
    link: 'Siga todo en directo aquí: {link}',
    bye: 'Saludos, el equipo de {agency}',
    none: 'No hay ningún inmueble a su nombre por ahora.',
  },
}

const fill = (s: string, v: Record<string, string | number>) => s.replace(/\{(\w+)\}/g, (_, k: string) => String(v[k] ?? ''))

/** WhatsApp message to the owner, in his language. */
export function ownerReportText(r: OwnerReport, agency: string, link: string | null, price: (n: number) => string): string {
  const t = T[r.lang] ?? T.ar
  const lines = r.properties.map((p) =>
    fill(t.line, {
      ref: p.ref,
      title: p.title,
      views: p.views,
      leads: p.leads,
      done: p.visits_done,
      planned: p.visits_planned ? fill(t.planned, { n: p.visits_planned }) : '',
      price: price(p.price),
    }),
  )
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
        const done = visits.filter((a) => a.status === 'done')
        const m = currentMandate(mandates, p.id)
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
        }
      }),
  }
}
