import type { L10n, Lang } from './types'

export function pick(l: L10n | null | undefined, lang: Lang): string {
  if (!l) return ''
  return l[lang] || l.ar || l.fr || l.es || ''
}

const nf = new Intl.NumberFormat('fr-MA', { maximumFractionDigits: 0 })

/** 1250000 → "1 250 000" (always Latin digits, thin-space grouping). */
export function fmtNumber(n: number | null | undefined): string {
  if (n == null || Number.isNaN(n)) return '—'
  return nf.format(n).replace(/ | /g, ' ')
}

export const CURRENCY: L10n = { ar: 'د.م.', fr: 'DH', es: 'DH' }
export const PER_MONTH: L10n = { ar: '/ الشهر', fr: '/ mois', es: '/ mes' }

export function fmtPrice(n: number | null | undefined, lang: Lang, rent = false): string {
  if (n == null) return '—'
  const base = `${fmtNumber(n)} ${CURRENCY[lang]}`
  return rent ? `${base} ${PER_MONTH[lang]}` : base
}

/** 1 250 000 → "1,25 M" style short price for markers/cards. */
export function fmtPriceShort(n: number, lang: Lang): string {
  if (n >= 1_000_000) {
    const m = n / 1_000_000
    const s = (Math.round(m * 100) / 100).toString().replace('.', lang === 'ar' ? '.' : ',')
    return `${s} M ${CURRENCY[lang]}`
  }
  if (n >= 1_000) return `${Math.round(n / 1_000)} K ${CURRENCY[lang]}`
  return `${n} ${CURRENCY[lang]}`
}

export function fmtArea(n: number | null | undefined): string {
  if (n == null) return '—'
  return `${fmtNumber(n)} m²`
}

const LOCALES: Record<Lang, string> = { ar: 'ar-MA', fr: 'fr-MA', es: 'es-ES' }

export function fmtDate(iso: string | null | undefined, lang: Lang = 'ar', opts?: Intl.DateTimeFormatOptions): string {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  return new Intl.DateTimeFormat(`${LOCALES[lang]}-u-nu-latn`, opts ?? { day: 'numeric', month: 'short', year: 'numeric' }).format(d)
}

export function fmtDateTime(iso: string | null | undefined, lang: Lang = 'ar'): string {
  return fmtDate(iso, lang, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
}

export function fmtTime(iso: string | null | undefined, lang: Lang = 'ar'): string {
  return fmtDate(iso, lang, { hour: '2-digit', minute: '2-digit' })
}

export function fmtRelative(iso: string, lang: Lang = 'ar'): string {
  const diff = (new Date(iso).getTime() - Date.now()) / 1000
  const rtf = new Intl.RelativeTimeFormat(`${LOCALES[lang]}-u-nu-latn`, { numeric: 'auto' })
  const abs = Math.abs(diff)
  if (abs < 60) return rtf.format(Math.round(diff), 'second')
  if (abs < 3600) return rtf.format(Math.round(diff / 60), 'minute')
  if (abs < 86400) return rtf.format(Math.round(diff / 3600), 'hour')
  if (abs < 86400 * 30) return rtf.format(Math.round(diff / 86400), 'day')
  return rtf.format(Math.round(diff / (86400 * 30)), 'month')
}

/** "0702873088" → "07 02 87 30 88" ; "+212702873088" → "+212 7 02 87 30 88" */
export function fmtPhone(p: string | null | undefined): string {
  if (!p) return ''
  const digits = p.replace(/\D/g, '')
  if (digits.startsWith('212') && digits.length === 12) {
    const r = digits.slice(3)
    return `+212 ${r[0]} ${r.slice(1, 3)} ${r.slice(3, 5)} ${r.slice(5, 7)} ${r.slice(7, 9)}`
  }
  if (digits.length === 10) return digits.replace(/(\d{2})(?=\d)/g, '$1 ').trim()
  return p
}

/** Normalises a Moroccan number for wa.me links: 06xx → 2126xx */
export function waNumber(p: string): string {
  let d = p.replace(/\D/g, '')
  if (d.startsWith('00')) d = d.slice(2)
  if (d.length === 10 && d.startsWith('0')) d = '212' + d.slice(1)
  if (d.length === 9 && !d.startsWith('212')) d = '212' + d
  return d
}

export function waLink(phone: string, text?: string): string {
  const n = waNumber(phone)
  return text ? `https://wa.me/${n}?text=${encodeURIComponent(text)}` : `https://wa.me/${n}`
}

export function telLink(phone: string): string {
  const d = phone.replace(/[^\d+]/g, '')
  return `tel:${d.startsWith('+') ? d : d.startsWith('212') ? '+' + d : d.startsWith('0') ? '+212' + d.slice(1) : d}`
}

export function interpolate(tpl: string, vars: Record<string, string | number | null | undefined>): string {
  return tpl.replace(/\{(\w+)\}/g, (_, k) => String(vars[k] ?? ''))
}

export function uid(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID()
  return 'id-' + Math.random().toString(36).slice(2) + Date.now().toString(36)
}

export function nowIso(): string {
  return new Date().toISOString()
}

export function toLocalInput(iso: string | null | undefined): string {
  if (!iso) return ''
  const d = new Date(iso)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

export function fromLocalInput(v: string): string | null {
  if (!v) return null
  const d = new Date(v)
  return Number.isNaN(d.getTime()) ? null : d.toISOString()
}

export function startOfDay(d: Date): Date {
  const x = new Date(d)
  x.setHours(0, 0, 0, 0)
  return x
}
export function addDays(d: Date, n: number): Date {
  const x = new Date(d)
  x.setDate(x.getDate() + n)
  return x
}
export function sameDay(a: Date | string, b: Date | string): boolean {
  const x = new Date(a)
  const y = new Date(b)
  return x.getFullYear() === y.getFullYear() && x.getMonth() === y.getMonth() && x.getDate() === y.getDate()
}

export function slugify(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
}

export function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n))
}

export function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0])
    .join('')
}

/** "https://youtu.be/abc…" → "abc…" (11-char id) or null */
export function youtubeId(url: string | null | undefined): string | null {
  if (!url) return null
  const m = url.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/|shorts\/|live\/))([\w-]{11})/)
  return m ? m[1] : null
}

/** Monday 00:00 of the week containing d (weeks start on Monday in Morocco). */
export function startOfWeek(d: Date): Date {
  const x = startOfDay(d)
  x.setDate(x.getDate() - ((x.getDay() + 6) % 7))
  return x
}

const pad2 = (n: number) => String(n).padStart(2, '0')

/** "2026-10-26" in local time */
export function localDate(v: string | Date): string {
  const d = new Date(v)
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`
}

/** "14:30" in local time */
export function localTime(v: string | Date): string {
  const d = new Date(v)
  return `${pad2(d.getHours())}:${pad2(d.getMinutes())}`
}

/** local date + time inputs → ISO string */
export function combineDateTime(date: string, time: string): string {
  return new Date(`${date}T${time || '00:00'}`).toISOString()
}

/** last 9 digits: matches 0612…, +212612…, 00212612… as the same number */
export function phoneKey(p: string | null | undefined): string {
  return (p ?? '').replace(/\D/g, '').slice(-9)
}

export function download(filename: string, content: string, type = 'application/json') {
  const blob = new Blob([content], { type })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 2000)
}

export function toCsv(rows: Record<string, unknown>[]): string {
  if (!rows.length) return ''
  const cols = Array.from(rows.reduce((set, r) => (Object.keys(r).forEach((k) => set.add(k)), set), new Set<string>()))
  const cell = (v: unknown) => {
    if (v == null) return ''
    const s = typeof v === 'object' ? JSON.stringify(v) : String(v)
    return /[",\n;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
  }
  // BOM so Excel opens Arabic text correctly
  return '\ufeff' + [cols.join(','), ...rows.map((r) => cols.map((c) => cell(r[c])).join(','))].join('\n')
}
