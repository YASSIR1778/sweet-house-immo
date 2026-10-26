import { useCallback, useEffect, useMemo, useState } from 'react'
import { SITE_URL } from '@/shared/lib/config'
import { useSettings } from '@/shared/lib/data'
import { interpolate, pick } from '@/shared/lib/format'
import { useI18n } from '@/shared/lib/i18n'
import type { Lang, Property, PropertyType, Settings, SiteSettings } from '@/shared/lib/types'

export function useSite() {
  const { lang, t, dir, setLang } = useI18n()
  const { data } = useSettings()
  const s = data as Settings
  const hoodName = useCallback((id: string) => pick(s.catalog.neighborhoods.find((n) => n.id === id)?.name, lang) || id, [s, lang])
  const typeName = useCallback((type: PropertyType, plural = false) => t(`type.${type}${plural ? '.pl' : ''}`), [t])
  const name = pick(s.agency.name, lang)
  return useMemo(() => ({ s, lang, t, dir, setLang, hoodName, typeName, name }), [s, lang, t, dir, setLang, hoodName, typeName, name])
}

export function propertyTitle(p: Property, lang: Lang): string {
  if (lang === 'fr' && p.title_fr) return p.title_fr
  if (lang === 'es' && p.title_es) return p.title_es
  if (lang === 'en' && (p.title_en || p.title_fr)) return (p.title_en || p.title_fr) as string
  return p.title
}
export function propertyDesc(p: Property, lang: Lang): string {
  if (lang === 'fr' && p.description_fr) return p.description_fr
  if (lang === 'es' && p.description_es) return p.description_es
  if (lang === 'en' && (p.description_en || p.description_fr)) return (p.description_en || p.description_fr) as string
  return p.description
}
const CITY_TR: Record<string, { fr: string; es: string; en: string }> = {
  تطوان: { fr: 'Tétouan', es: 'Tetuán', en: 'Tetouan' },
  مرتيل: { fr: 'Martil', es: 'Martil', en: 'Martil' },
  المضيق: { fr: 'M’diq', es: 'Rincón (M’diq)', en: 'M’diq' },
  'كابو نيغرو': { fr: 'Cabo Negro', es: 'Cabo Negro', en: 'Cabo Negro' },
  الفنيدق: { fr: 'Fnideq', es: 'Castillejos', en: 'Fnideq' },
  أزلا: { fr: 'Azla', es: 'Azla', en: 'Azla' },
  'واد لو': { fr: 'Oued Laou', es: 'Oued Laou', en: 'Oued Laou' },
}
export function cityName(city: string, lang: Lang): string {
  if (lang === 'ar') return city
  return CITY_TR[city.trim()]?.[lang] ?? (/[؀-ۿ]/.test(city) ? '' : city)
}
/** "Tabola, Tétouan" — the city is left out when it repeats the neighbourhood. */
export function placeLabel(hood: string, city: string, lang: Lang): string {
  const c = cityName(city, lang)
  return c && c !== hood ? `${hood}${lang === 'ar' ? '، ' : ', '}${c}` : hood
}

export function propertyPath(p: Property) {
  return `/biens/${p.ref}`
}
export function propertyUrl(p: Property) {
  return `${SITE_URL}/biens/${p.ref}`
}

export function waPropertyText(s: Settings, p: Property, lang: Lang) {
  return interpolate(pick(s.site.whatsapp_template, lang), { ref: p.ref, title: propertyTitle(p, lang) }) + `\n${propertyUrl(p)}`
}

/** Figures shown on the site: only the ones the owner filled in (the property count falls back to the real one). */
export function statItems(stats: SiteSettings['stats'], published: number): [keyof SiteSettings['stats'], number][] {
  const list: [keyof SiteSettings['stats'], number][] = [
    ['properties', stats.properties || published],
    ['clients', stats.clients],
    ['years', stats.years],
    ['deals', stats.deals],
  ]
  return list.filter(([, v]) => v > 0)
}
export const STAT_COLS: Record<number, string> = { 1: 'md:grid-cols-1', 2: 'md:grid-cols-2', 3: 'md:grid-cols-3', 4: 'md:grid-cols-4' }

/* ------------------------------------------------------------------ */
export function usePageMeta(title: string, description?: string, image?: string) {
  useEffect(() => {
    document.title = title
    const set = (sel: string, attr: string, value: string) => {
      let el = document.head.querySelector<HTMLMetaElement>(sel)
      if (!el) {
        el = document.createElement('meta')
        const [k, v] = sel.replace(/^meta\[/, '').replace(/\]$/, '').split('=')
        el.setAttribute(k, v.replace(/"/g, ''))
        document.head.appendChild(el)
      }
      el.setAttribute(attr, value)
    }
    set('meta[property="og:title"]', 'content', title)
    if (description) {
      set('meta[name="description"]', 'content', description)
      set('meta[property="og:description"]', 'content', description)
    }
    if (image) set('meta[property="og:image"]', 'content', image)
    set('meta[property="og:url"]', 'content', location.href)
  }, [title, description, image])
}

/* ------------------------------------------------------------------ */
const FAV_KEY = 'shi:favs'
function readFavs(): string[] {
  try {
    return JSON.parse(localStorage.getItem(FAV_KEY) ?? '[]')
  } catch {
    return []
  }
}
export function useFavorites() {
  const [ids, setIds] = useState<string[]>(readFavs)
  useEffect(() => {
    const h = () => setIds(readFavs())
    window.addEventListener('shi:favs', h)
    window.addEventListener('storage', h)
    return () => {
      window.removeEventListener('shi:favs', h)
      window.removeEventListener('storage', h)
    }
  }, [])
  const toggle = useCallback((id: string) => {
    const cur = readFavs()
    const next = cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id]
    localStorage.setItem(FAV_KEY, JSON.stringify(next))
    window.dispatchEvent(new Event('shi:favs'))
  }, [])
  const has = useCallback((id: string) => ids.includes(id), [ids])
  return { ids, has, toggle }
}

/* ------------------------------------------------------------------ */
export function useScrolled(threshold = 40) {
  const [scrolled, setScrolled] = useState(() => (typeof window !== 'undefined' ? window.scrollY > threshold : false))
  useEffect(() => {
    const h = () => setScrolled(window.scrollY > threshold)
    h()
    window.addEventListener('scroll', h, { passive: true })
    return () => window.removeEventListener('scroll', h)
  }, [threshold])
  return scrolled
}

export function jsonLd(id: string, data: object) {
  let el = document.getElementById(id) as HTMLScriptElement | null
  if (!el) {
    el = document.createElement('script')
    el.type = 'application/ld+json'
    el.id = id
    document.head.appendChild(el)
  }
  el.textContent = JSON.stringify(data)
  return () => el?.remove()
}
