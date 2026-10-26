import type { Booking, BookingStatus, Lang, SeasonRates } from './types'

/*
 * Seasonal rentals (summer in Martil, M'diq, Cabo Negro…): price of a stay, availability,
 * occupancy and the agency's share. Pure functions (tests: npm run test:seasonal).
 *
 * Dates are yyyy-mm-dd; a stay runs from check_in (first night) to check_out (departure day,
 * not a night). Law 80-14 asks the operator to declare arrivals and nights online and to keep
 * each guest's form a year: the booking keeps what that form needs.
 */

export const DEFAULT_SEASON: SeasonRates = {
  night: 0,
  high_night: null,
  high_from: '07-01',
  high_to: '08-31',
  week_discount: 10,
  min_nights: 2,
  high_min_nights: 5,
  guests: 4,
  cleaning: 0,
  deposit_pct: 30,
  caution: 0,
  check_in: '15:00',
  check_out: '12:00',
  commission: 15,
  license: '',
}

/** A property's rates over the defaults (a setting added later keeps its default). */
export const seasonOf = (s: Partial<SeasonRates> | null | undefined): SeasonRates => ({ ...DEFAULT_SEASON, ...(s ?? {}) })
/** The cheapest night of the year, for «from … / night». */
export const fromNight = (r: Pick<SeasonRates, 'night' | 'high_night'>) => (r.high_night ? Math.min(r.night, r.high_night) : r.night)

/** Stays that take the dates (a request does not, until it is confirmed). */
export const HOLDING: BookingStatus[] = ['confirmed', 'checked_in', 'completed', 'blocked']
export const holds = (b: Pick<Booking, 'status'>) => HOLDING.includes(b.status)
/** Stays that bring money (an owner's own use does not). */
export const EARNING: BookingStatus[] = ['confirmed', 'checked_in', 'completed']

const DAY = 86_400_000
const toTime = (d: string) => Date.UTC(Number(d.slice(0, 4)), Number(d.slice(5, 7)) - 1, Number(d.slice(8, 10)))
const toDate = (t: number) => new Date(t).toISOString().slice(0, 10)
const round = (n: number, step = 1) => Math.round(n / step) * step

export const addDays = (d: string, n: number) => toDate(toTime(d) + n * DAY)
export const nightsBetween = (a: string, b: string) => Math.max(0, Math.round((toTime(b) - toTime(a)) / DAY))

/** Each night of a stay (yyyy-mm-dd). */
export function nightsOf(checkIn: string, checkOut: string): string[] {
  const out: string[] = []
  for (let t = toTime(checkIn); t < toTime(checkOut) && out.length < 400; t += DAY) out.push(toDate(t))
  return out
}

/** High-season night? The range may wrap the new year (12-20 → 01-05). */
export function isHigh(date: string, r: Pick<SeasonRates, 'high_from' | 'high_to' | 'high_night'>): boolean {
  if (!r.high_night) return false
  const md = date.slice(5)
  return r.high_from <= r.high_to ? md >= r.high_from && md <= r.high_to : md >= r.high_from || md <= r.high_to
}

export type QuoteIssue = 'dates' | 'min_nights' | 'guests' | 'no_rate'
export interface Quote {
  nights: number
  high: number
  low: number
  subtotal: number
  discount: number
  /** the nights, after the weekly discount */
  rent: number
  cleaning: number
  total: number
  /** earnest money to confirm (rounded to 10 DH) */
  deposit: number
  caution: number
  minNights: number
  issues: QuoteIssue[]
}

export function quote(r: SeasonRates, checkIn: string, checkOut: string, guests = 1): Quote {
  const nights = checkIn && checkOut ? nightsOf(checkIn, checkOut) : []
  const high = nights.filter((n) => isHigh(n, r)).length
  const low = nights.length - high
  const subtotal = high * (r.high_night ?? r.night) + low * r.night
  const discount = nights.length >= 7 && r.week_discount > 0 ? round((subtotal * r.week_discount) / 100) : 0
  const rent = subtotal - discount
  const cleaning = nights.length ? r.cleaning : 0
  const total = rent + cleaning
  const minNights = high > 0 && r.high_min_nights ? Math.max(r.min_nights, r.high_min_nights) : r.min_nights
  const issues: QuoteIssue[] = []
  if (!nights.length) issues.push('dates')
  else if (nights.length < minNights) issues.push('min_nights')
  if (guests > r.guests) issues.push('guests')
  if (!(r.night > 0)) issues.push('no_rate')
  return { nights: nights.length, high, low, subtotal, discount, rent, cleaning, total, deposit: round((total * r.deposit_pct) / 100, 10), caution: r.caution, minNights, issues }
}

type Stay = Pick<Booking, 'check_in' | 'check_out'>
export const overlaps = (a: Stay, b: Stay) => a.check_in < b.check_out && b.check_in < a.check_out
/** Do these dates hit one of the taken stays (the website only knows the dates)? */
export const clashes = (stays: Stay[], checkIn: string, checkOut: string) => stays.some((s) => overlaps(s, { check_in: checkIn, check_out: checkOut }))

/** Free for these dates? Only stays that hold dates count; `exceptId` is the stay being edited. */
export function isFree(bookings: Pick<Booking, 'id' | 'property_id' | 'status' | 'check_in' | 'check_out'>[], propertyId: string, checkIn: string, checkOut: string, exceptId?: string): boolean {
  return !bookings.some((b) => b.property_id === propertyId && b.id !== exceptId && holds(b) && overlaps(b, { check_in: checkIn, check_out: checkOut }))
}

/** Nights already taken, for a calendar. */
export function takenNights(stays: Stay[]): Set<string> {
  const out = new Set<string>()
  for (const s of stays) for (const n of nightsOf(s.check_in, s.check_out)) out.add(n)
  return out
}

/** Nights of a stay that fall between two dates (to is excluded). */
function nightsWithin(s: Stay, from: string, to: string): number {
  const a = s.check_in > from ? s.check_in : from
  const b = s.check_out < to ? s.check_out : to
  return nightsBetween(a, b)
}

/** Booked nights over available nights (an owner's own use makes nights unavailable, not booked). */
export function occupancy(bookings: Pick<Booking, 'property_id' | 'status' | 'check_in' | 'check_out'>[], propertyIds: string[], from: string, to: string) {
  const ids = new Set(propertyIds)
  let booked = 0
  let blocked = 0
  for (const b of bookings) {
    if (!ids.has(b.property_id)) continue
    if (b.status === 'blocked') blocked += nightsWithin(b, from, to)
    else if (EARNING.includes(b.status)) booked += nightsWithin(b, from, to)
  }
  const available = Math.max(0, ids.size * nightsBetween(from, to) - blocked)
  return { booked, available, rate: available ? Math.round((booked / available) * 100) : 0 }
}

/** What the guest owes (nights + cleaning), what is left. */
export const bookingDue = (b: Pick<Booking, 'rent' | 'cleaning'>) => b.rent + b.cleaning
export const bookingRest = (b: Pick<Booking, 'rent' | 'cleaning' | 'paid'>) => Math.max(0, bookingDue(b) - (b.paid || 0))
/** The agency's commission (on the nights, not the cleaning) and the owner's share. */
export const agencyCut = (b: Pick<Booking, 'rent' | 'commission_rate'>) => round((b.rent * (b.commission_rate || 0)) / 100)
export const ownerPayout = (b: Pick<Booking, 'rent' | 'commission_rate'>) => b.rent - agencyCut(b)

/** Commissions earned on stays, at the arrival date (agency income). */
export function seasonalFees(bookings: Pick<Booking, 'status' | 'check_in' | 'rent' | 'commission_rate'>[]): { date: string; amount: number }[] {
  return bookings.filter((b) => EARNING.includes(b.status)).map((b) => ({ date: b.check_in, amount: agencyCut(b) }))
}

/** Arrivals and departures of a day (owner's own use left out). */
export function movements<T extends Pick<Booking, 'status' | 'check_in' | 'check_out'>>(bookings: T[], day: string) {
  const live = bookings.filter((b) => EARNING.includes(b.status))
  return { arrivals: live.filter((b) => b.check_in === day), departures: live.filter((b) => b.check_out === day) }
}

/* ------------------------------------------------------------------ */
/* WhatsApp messages to the guest, in his language                      */
/* ------------------------------------------------------------------ */
const LOCALE: Record<Lang, string> = { ar: 'ar-MA-u-nu-latn', fr: 'fr-FR', es: 'es-ES' }

export function dayLabel(d: string, lang: Lang): string {
  return new Intl.DateTimeFormat(LOCALE[lang] ?? LOCALE.ar, { weekday: 'long', day: 'numeric', month: 'long' }).format(new Date(toTime(d) + 12 * 3_600_000))
}

/** «3 ليالٍ», «2 nuits», «1 noche». */
export function nightsText(n: number, lang: Lang): string {
  if (lang === 'fr') return `${n} nuit${n > 1 ? 's' : ''}`
  if (lang === 'es') return `${n} noche${n > 1 ? 's' : ''}`
  if (n === 1) return 'ليلة واحدة'
  if (n === 2) return 'ليلتان'
  return n <= 10 ? `${n} ليالٍ` : `${n} ليلة`
}

export function guestsText(n: number, lang: Lang): string {
  if (lang === 'fr') return `${n} personne${n > 1 ? 's' : ''}`
  if (lang === 'es') return `${n} persona${n > 1 ? 's' : ''}`
  if (n === 1) return 'شخص واحد'
  if (n === 2) return 'شخصان'
  return n <= 10 ? `${n} أشخاص` : `${n} شخصاً`
}

const MSG: Record<Lang, { request: string; confirmed: string; reminder: string; paid: string }> = {
  ar: {
    request: 'السلام عليكم {name}، توصلنا بطلب حجزكم في {place} ({ref}) من {in} إلى {out} ({nights}، {guests}). المجموع {total}. لتأكيد الحجز يرجى أداء العربون: {deposit}.\n{agency}',
    confirmed: 'السلام عليكم {name}، نؤكد حجزكم في {place} ({ref}) من {in} إلى {out} ({nights}، {guests}). المجموع {total}{paid}. الدخول ابتداء من الساعة {checkin} والخروج قبل الساعة {checkout}. مرحباً بكم!\n{agency}',
    reminder: 'السلام عليكم {name}، نذكّركم بوصولكم يوم {in} ابتداء من الساعة {checkin} إلى {place} ({ref}). المرجو إحضار بطاقة التعريف أو جواز السفر لكل نزيل بالغ. رحلة سعيدة!\n{agency}',
    paid: '، أديتم منه {n}',
  },
  fr: {
    request: 'Bonjour {name}, nous avons bien reçu votre demande pour {place} ({ref}) du {in} au {out} ({nights}, {guests}). Total : {total}. Pour confirmer, merci de verser l’acompte de {deposit}.\n{agency}',
    confirmed: 'Bonjour {name}, votre réservation à {place} ({ref}) du {in} au {out} ({nights}, {guests}) est confirmée. Total : {total}{paid}. Arrivée à partir de {checkin}, départ avant {checkout}. Bienvenue !\n{agency}',
    reminder: 'Bonjour {name}, nous vous attendons le {in} à partir de {checkin} à {place} ({ref}). Merci d’apporter une pièce d’identité pour chaque voyageur adulte. Bon voyage !\n{agency}',
    paid: ', dont {n} déjà réglés',
  },
  es: {
    request: 'Hola {name}, hemos recibido su solicitud para {place} ({ref}) del {in} al {out} ({nights}, {guests}). Total: {total}. Para confirmar, abone la señal de {deposit}.\n{agency}',
    confirmed: 'Hola {name}, su reserva en {place} ({ref}) del {in} al {out} ({nights}, {guests}) está confirmada. Total: {total}{paid}. Entrada a partir de las {checkin}, salida antes de las {checkout}. ¡Bienvenidos!\n{agency}',
    reminder: 'Hola {name}, le esperamos el {in} a partir de las {checkin} en {place} ({ref}). Traiga un documento de identidad por cada huésped adulto. ¡Buen viaje!\n{agency}',
    paid: ', de los que ya ha abonado {n}',
  },
}

export function stayMessage(
  kind: 'request' | 'confirmed' | 'reminder',
  lang: Lang,
  v: { name: string; place: string; ref: string; checkIn: string; checkOut: string; guests: number; total: string; deposit: string; paid: string | null; checkInTime: string; checkOutTime: string; agency: string },
): string {
  const t = MSG[lang] ?? MSG.ar
  const vars: Record<string, string> = {
    name: v.name.split(' ')[0],
    place: v.place,
    ref: v.ref,
    in: dayLabel(v.checkIn, lang),
    out: dayLabel(v.checkOut, lang),
    nights: nightsText(nightsBetween(v.checkIn, v.checkOut), lang),
    guests: guestsText(v.guests, lang),
    total: v.total,
    deposit: v.deposit,
    paid: v.paid ? t.paid.replace('{n}', v.paid) : '',
    checkin: v.checkInTime,
    checkout: v.checkOutTime,
    agency: v.agency,
  }
  return t[kind].replace(/\{(\w+)\}/g, (_, k: string) => vars[k] ?? '')
}
