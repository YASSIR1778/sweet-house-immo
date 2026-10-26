import { ArrowLeft, ArrowRight, Bath, BedDouble, Check, Heart, MapPin, Maximize2, Search, Share2, Star, Sun } from 'lucide-react'
import { WhatsAppIcon } from '@/shared/ui/icons'
import { useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react'
import { Link, useNavigate } from 'react-router'
import { toast } from 'sonner'
import { PROPERTY_TYPES } from '@/shared/lib/config'
import { fmtNumber, fmtPrice, pick, waLink } from '@/shared/lib/format'
import { fromNight, seasonOf } from '@/shared/lib/seasonal'
import { toEur } from '@/shared/lib/valuation'
import { repo, type LeadInput } from '@/shared/lib/repo'
import { isConfigured } from '@/shared/lib/supabase'
import type { LeadKind, Property, Purpose } from '@/shared/lib/types'
import { Badge, Button, Field, Input, Select, Textarea, cn } from '@/shared/ui/base'
import { placeLabel, propertyPath, propertyTitle, useFavorites, useSite } from './site'

/* ------------------------------------------------------------------ */
export function SectionHead({ eyebrow, title, text, align = 'start', light, action }: { eyebrow?: string; title: string; text?: string; align?: 'start' | 'center'; light?: boolean; action?: ReactNode }) {
  return (
    <div className={cn('mb-10 flex flex-col gap-4 md:flex-row md:items-end md:justify-between', align === 'center' && 'items-center text-center md:flex-col md:items-center')}>
      <div className={cn('max-w-2xl', align === 'center' && 'mx-auto')}>
        {eyebrow && <span className={cn('eyebrow', light && 'text-gold-300')}>{eyebrow}</span>}
        <h2 className={cn('font-display mt-3 text-3xl leading-tight md:text-[2.6rem]', light ? 'text-white' : 'text-navy')}>{title}</h2>
        {text && <p className={cn('mt-3 text-base leading-relaxed md:text-lg', light ? 'text-white/75' : 'text-muted')}>{text}</p>}
      </div>
      {action}
    </div>
  )
}

export function Arrow({ className }: { className?: string }) {
  const { dir } = useSite()
  return dir === 'rtl' ? <ArrowLeft className={className} /> : <ArrowRight className={className} />
}

/* ------------------------------------------------------------------ */
export function Counter({ value, suffix = '+', className }: { value: number; suffix?: string; className?: string }) {
  const ref = useRef<HTMLSpanElement>(null)
  const [n, setN] = useState(0)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    let started = false
    const run = () => {
      if (started) return
      started = true
      const t0 = performance.now()
      const dur = 1600
      const tick = (t: number) => {
        const k = Math.min(1, (t - t0) / dur)
        const e = 1 - Math.pow(1 - k, 3)
        setN(Math.round(value * e))
        if (k < 1) requestAnimationFrame(tick)
      }
      requestAnimationFrame(tick)
    }
    if (!('IntersectionObserver' in window)) return run()
    const io = new IntersectionObserver((es) => es.some((e) => e.isIntersecting) && (run(), io.disconnect()), { threshold: 0.3 })
    io.observe(el)
    return () => io.disconnect()
  }, [value])
  return (
    <span ref={ref} className={cn('num', className)}>
      {fmtNumber(n)}
      {suffix}
    </span>
  )
}

/* ------------------------------------------------------------------ */
export function FavButton({ id, className, size = 'md' }: { id: string; className?: string; size?: 'sm' | 'md' }) {
  const { has, toggle } = useFavorites()
  const { t } = useSite()
  const on = has(id)
  return (
    <button
      type="button"
      aria-label={on ? t('p.unfavorite') : t('p.favorite')}
      title={on ? t('p.unfavorite') : t('p.favorite')}
      onClick={(e) => {
        e.preventDefault()
        e.stopPropagation()
        toggle(id)
      }}
      className={cn('inline-flex items-center justify-center rounded-full bg-white/90 text-navy shadow backdrop-blur transition hover:scale-105 active:scale-95', size === 'sm' ? 'size-9' : 'size-10', className)}
    >
      <Heart className={cn('size-[18px] transition', on && 'fill-danger text-danger')} />
    </button>
  )
}

/* ------------------------------------------------------------------ */
export function PropertyCard({ p, compact, eur: withEur }: { p: Property; compact?: boolean; eur?: boolean }) {
  const { s, lang, t, hoodName, typeName } = useSite()
  const rent = p.purpose === 'rent'
  // a summer rental shows its cheapest night instead of the monthly rent
  const night = rent && p.seasonal ? fromNight(seasonOf(p.season)) : 0
  // French and Spanish visitors (and the page for Moroccans abroad) also see the price in euros
  const eur = withEur || lang !== 'ar' ? toEur(night || p.price, s.site.eur_rate ?? 0) : null
  const isNew = Date.now() - new Date(p.created_at).getTime() < 7 * 86400e3
  return (
    <Link to={propertyPath(p)} className="group block overflow-hidden rounded-[18px] border border-line bg-white shadow-soft transition-all duration-300 hover:-translate-y-1 hover:shadow-card">
      <div className={cn('zoom-img relative overflow-hidden', compact ? 'aspect-[4/3]' : 'aspect-[4/3]')}>
        <img src={p.images[0] ?? 'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&w=1000&q=80'} alt={propertyTitle(p, lang)} className="h-full w-full object-cover" loading="lazy" />
        <div className="absolute inset-0 bg-gradient-to-t from-navy-950/70 via-navy-950/10 to-transparent" />
        <div className="absolute inset-x-3 top-3 flex items-start justify-between gap-2">
          <div className="flex flex-wrap gap-1.5">
            {night > 0 ? (
              <Badge tone="white">
                <Sun className="size-3 text-gold-600" /> {t('stay.badge')}
              </Badge>
            ) : (
              <Badge tone={rent ? 'teal' : 'gold'}>{rent ? t('p.forRent') : t('p.forSale')}</Badge>
            )}
            {p.featured && (
              <Badge tone="navy">
                <Star className="size-3 fill-gold text-gold" /> {t('p.featured')}
              </Badge>
            )}
            {isNew && !p.featured && <Badge tone="white">{t('p.new')}</Badge>}
            {p.status === 'reserved' && <Badge tone="warning">{t('p.status.reserved')}</Badge>}
            {(p.status === 'sold' || p.status === 'rented') && <Badge tone="navy">{t(`p.status.${p.status}`)}</Badge>}
          </div>
          <FavButton id={p.id} size="sm" />
        </div>
        <div className="absolute inset-x-4 bottom-3 flex items-end justify-between text-white">
          <div>
            {night > 0 ? (
              <div className="num text-xl font-extrabold leading-none drop-shadow">
                {t('stay.from', { price: fmtPrice(night, lang) })} <span className="text-xs font-semibold text-white/85">{t('stay.perNight')}</span>
              </div>
            ) : (
              <div className="num text-xl font-extrabold leading-none drop-shadow">{fmtPrice(p.price, lang, rent)}</div>
            )}
            {eur ? (
              <div className="num mt-1 text-[11px] text-white/80">{t('p.eur', { n: fmtNumber(eur) })}</div>
            ) : !rent && p.area ? (
              <div className="num mt-1 text-[11px] text-white/80">{t('p.pricePerM2', { n: fmtNumber(Math.round(p.price / p.area)) })}</div>
            ) : null}
          </div>
          <span className="rounded-full bg-white/15 px-2.5 py-1 text-[11px] font-semibold backdrop-blur">{typeName(p.type)}</span>
        </div>
      </div>
      <div className="p-4">
        <h3 className="line-clamp-2 min-h-[2.8em] text-[0.98rem] font-bold leading-snug text-navy group-hover:text-gold-700">{propertyTitle(p, lang)}</h3>
        <p className="mt-1.5 flex items-center gap-1 text-sm text-muted">
          <MapPin className="size-3.5 shrink-0 text-gold-600" /> {placeLabel(hoodName(p.neighborhood), p.city, lang)}
        </p>
        <div className="mt-3 flex items-center gap-3 border-t border-line pt-3 text-[13px] text-muted">
          {p.bedrooms != null && (
            <span className="inline-flex items-center gap-1">
              <BedDouble className="size-4 text-navy/60" /> <span className="num">{p.bedrooms}</span>
            </span>
          )}
          {p.bathrooms != null && (
            <span className="inline-flex items-center gap-1">
              <Bath className="size-4 text-navy/60" /> <span className="num">{p.bathrooms}</span>
            </span>
          )}
          {(p.area ?? p.land_area) != null && (
            <span className="inline-flex items-center gap-1">
              <Maximize2 className="size-4 text-navy/60" /> <span className="num">{fmtNumber(p.area ?? p.land_area)} m²</span>
            </span>
          )}
          <span className="num ms-auto text-xs text-subtle">{p.ref}</span>
        </div>
      </div>
    </Link>
  )
}

export function PropertyCardSkeleton() {
  return (
    <div className="overflow-hidden rounded-[18px] border border-line bg-white">
      <div className="skeleton aspect-[4/3]" />
      <div className="space-y-2 p-4">
        <div className="skeleton h-4 w-4/5 rounded" />
        <div className="skeleton h-4 w-3/5 rounded" />
        <div className="skeleton mt-3 h-3 w-full rounded" />
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ */
export const SALE_BUDGETS = [300_000, 500_000, 800_000, 1_000_000, 1_500_000, 2_000_000, 3_000_000, 5_000_000]
export const RENT_BUDGETS = [2_000, 3_000, 4_000, 5_000, 7_000, 10_000, 15_000, 25_000]

export function SearchBar({ variant = 'hero', initial }: { variant?: 'hero' | 'bar'; initial?: { purpose?: Purpose; type?: string; hood?: string; max?: string } }) {
  const { s, lang, t, typeName } = useSite()
  const nav = useNavigate()
  const [purpose, setPurpose] = useState<Purpose>(initial?.purpose ?? 'sale')
  const [type, setType] = useState(initial?.type ?? '')
  const [hood, setHood] = useState(initial?.hood ?? '')
  const [max, setMax] = useState(initial?.max ?? '')
  const budgets = purpose === 'rent' ? RENT_BUDGETS : SALE_BUDGETS
  const submit = (e: FormEvent) => {
    e.preventDefault()
    const q = new URLSearchParams()
    q.set('purpose', purpose)
    if (type) q.set('type', type)
    if (hood) q.set('hood', hood)
    if (max) q.set('max', max)
    nav(`/biens?${q.toString()}`)
  }
  const hero = variant === 'hero'
  return (
    <form onSubmit={submit} className={cn(hero ? 'glass rounded-[22px] p-3 shadow-pop md:p-4' : 'rounded-2xl border border-line bg-white p-3 shadow-soft')}>
      <div className="mb-3 flex justify-center md:justify-start">
        <div className={cn('inline-flex rounded-xl p-1', 'bg-navy/5')}>
          {(['sale', 'rent'] as Purpose[]).map((v) => (
            <button key={v} type="button" onClick={() => (setPurpose(v), setMax(''))} className={cn('rounded-lg px-5 py-2 text-sm font-bold transition-all', purpose === v ? 'bg-navy text-white shadow' : 'text-navy/70 hover:text-navy')}>
              {v === 'sale' ? t('hero.search.sale') : t('hero.search.rent')}
            </button>
          ))}
        </div>
      </div>
      <div className="grid grid-cols-1 gap-2 md:grid-cols-[1fr_1fr_1fr_auto]">
        <Select value={type} onChange={(e) => setType(e.target.value)} aria-label={t('search.type')} className="h-12 border-line bg-white">
          <option value="">{t('search.type')}: {t('search.any')}</option>
          {PROPERTY_TYPES.map((v) => (
            <option key={v} value={v}>
              {typeName(v)}
            </option>
          ))}
        </Select>
        <Select value={hood} onChange={(e) => setHood(e.target.value)} aria-label={t('search.neighborhood')} className="h-12 border-line bg-white">
          <option value="">{t('search.anyNeighborhood')}</option>
          {s.catalog.neighborhoods.map((n) => (
            <option key={n.id} value={n.id}>
              {pick(n.name, lang)}
            </option>
          ))}
        </Select>
        <Select value={max} onChange={(e) => setMax(e.target.value)} aria-label={t('search.budget')} className="h-12 border-line bg-white num">
          <option value="">{t('search.budget')}: {t('search.noLimit')}</option>
          {budgets.map((b) => (
            <option key={b} value={b}>
              ≤ {fmtPrice(b, lang, purpose === 'rent')}
            </option>
          ))}
        </Select>
        <Button type="submit" variant="gold" size="lg" className="h-12 md:px-7" icon={<Search className="size-4" />}>
          {t('search.button')}
        </Button>
      </div>
    </form>
  )
}

/* ------------------------------------------------------------------ */
export function ShareButton({ title, url, className }: { title: string; url: string; className?: string }) {
  const { t } = useSite()
  const share = async () => {
    try {
      if (navigator.share) await navigator.share({ title, url })
      else {
        await navigator.clipboard.writeText(url)
        toast.success(t('p.copied'))
      }
    } catch {
      /* cancelled */
    }
  }
  return (
    <Button type="button" variant="outline" size="sm" onClick={share} className={className} icon={<Share2 className="size-4" />}>
      {t('p.share')}
    </Button>
  )
}

/* ------------------------------------------------------------------ */
const PHONE_RE = /^\+?[\d\s().-]{8,18}$/

export function LeadForm({ kind, property, children, buildMeta, showMessage = true, messageLabel, submitLabel, compact, onDone, defaultMessage, withPreferredAt, className, note }: { kind: LeadKind; property?: Property | null; children?: ReactNode; buildMeta?: (fd: FormData) => Record<string, unknown>; showMessage?: boolean; messageLabel?: string; submitLabel?: string; compact?: boolean; onDone?: () => void; defaultMessage?: string; withPreferredAt?: boolean; className?: string; /** a line put before the visitor's message (the dates of a stay…) */ note?: string }) {
  const { s, lang, t } = useSite()
  const [state, setState] = useState<'idle' | 'sending' | 'done' | 'error'>('idle')
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [waText, setWaText] = useState('')

  const submit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const form = e.currentTarget
    const fd = new FormData(form)
    // honeypot: real people never see this field, bots fill it in
    if (String(fd.get('company') ?? '')) {
      setState('done')
      return
    }
    const name = String(fd.get('name') ?? '').trim()
    const phone = String(fd.get('phone') ?? '').trim()
    const errs: Record<string, string> = {}
    if (!name) errs.name = t('form.required')
    if (!phone) errs.phone = t('form.required')
    else if (!PHONE_RE.test(phone)) errs.phone = t('form.phoneInvalid')
    setErrors(errs)
    if (Object.keys(errs).length) return
    setState('sending')
    const preferred = String(fd.get('preferred_at') ?? '')
    const input: LeadInput = {
      name,
      phone,
      email: String(fd.get('email') ?? '').trim() || null,
      message: [note, String(fd.get('message') ?? '').trim()].filter(Boolean).join('\n') || null,
      kind,
      property_id: property?.id ?? null,
      property_ref: property?.ref ?? null,
      source: 'website',
      preferred_at: preferred ? new Date(preferred).toISOString() : null,
      lang,
      meta: buildMeta ? buildMeta(fd) : null,
    }
    setWaText(
      [
        `${t('form.name')}: ${name} · ${phone}`,
        property ? `${t('p.ref')}: ${property.ref}` : '',
        input.preferred_at ? `${t('form.preferredDate')}: ${preferred.replace('T', ' ')}` : '',
        input.message ?? '',
      ]
        .filter(Boolean)
        .join('\n'),
    )
    try {
      await repo.submitLead(input)
      setState('done')
      form.reset()
      onDone?.()
    } catch {
      setState('error')
    }
  }

  if (state === 'done')
    return (
      <div className={cn('anim-pop rounded-2xl border border-success/30 bg-success/5 p-6 text-center', className)}>
        <div className="mx-auto mb-3 flex size-12 items-center justify-center rounded-full bg-success text-white">
          <Check className="size-6" />
        </div>
        <h3 className="text-lg font-bold text-navy">{t('form.sent')}</h3>
        {isConfigured ? (
          <p className="mt-1 text-sm text-muted">{t('form.sentText')}</p>
        ) : (
          <>
            <p className="mt-1 text-sm text-muted">{t('form.demoSent')}</p>
            <a href={waLink(s.agency.whatsapp, waText)} target="_blank" rel="noopener noreferrer" className="mt-4 inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-[#25D366] px-5 text-sm font-bold text-white shadow-soft hover:brightness-105">
              <WhatsAppIcon className="size-4" /> {t('form.demoSend')}
            </a>
          </>
        )}
        <Button variant="ghost" size="sm" className="mt-4" onClick={() => setState('idle')}>
          {t('form.anotherOne')}
        </Button>
      </div>
    )

  return (
    <form onSubmit={submit} className={cn('relative space-y-3', className)} noValidate>
      <input type="text" name="company" tabIndex={-1} autoComplete="off" aria-hidden="true" className="pointer-events-none absolute h-0 w-0 opacity-0" />
      <div className={cn('grid gap-3', !compact && 'sm:grid-cols-2')}>
        <Field label={t('form.name')} error={errors.name} required>
          <Input name="name" autoComplete="name" />
        </Field>
        <Field label={t('form.phone')} error={errors.phone} required>
          <Input name="phone" type="tel" inputMode="tel" autoComplete="tel" dir="ltr" placeholder="06 12 34 56 78" className="num" />
        </Field>
      </div>
      {!compact && (
        <Field label={t('form.email')}>
          <Input name="email" type="email" autoComplete="email" dir="ltr" />
        </Field>
      )}
      {children}
      {withPreferredAt && (
        <Field label={t('form.preferredDate')}>
          <Input name="preferred_at" type="datetime-local" dir="ltr" className="num" />
        </Field>
      )}
      {showMessage && (
        <Field label={messageLabel ?? t('form.message')}>
          <Textarea name="message" defaultValue={defaultMessage} rows={compact ? 3 : 4} />
        </Field>
      )}
      {state === 'error' && <p className="rounded-xl bg-danger/10 px-3 py-2 text-sm text-danger">{t('form.error')}</p>}
      <Button type="submit" variant="gold" size="lg" className="w-full" loading={state === 'sending'}>
        {state === 'sending' ? t('form.sending') : submitLabel ?? t('form.send')}
      </Button>
      <p className="text-center text-[11px] leading-relaxed text-subtle">{t('form.consent')}</p>
    </form>
  )
}

/* ------------------------------------------------------------------ */
export function WhatsAppFab() {
  const { s, lang } = useSite()
  const text = { ar: 'السلام عليكم، أود الاستفسار عن عقار.', fr: 'Bonjour, je souhaite des informations sur un bien.', es: 'Hola, quisiera información sobre un inmueble.' }[lang]
  return (
    <a
      href={waLink(s.agency.whatsapp, text)}
      target="_blank"
      rel="noopener noreferrer"
      aria-label="WhatsApp"
      className={cn('wa-pulse no-print fixed end-5 z-50 flex size-14 items-center justify-center rounded-full bg-[#25D366] text-white shadow-pop transition hover:scale-105', isConfigured ? 'bottom-5' : 'bottom-12')}
    >
      <WhatsAppIcon className="size-7" />
    </a>
  )
}

/* ------------------------------------------------------------------ */
export function PageHero({ eyebrow, title, text, image, children, compact }: { eyebrow?: string; title: string; text?: string; image?: string; children?: ReactNode; compact?: boolean }) {
  return (
    <section className={cn('relative overflow-hidden bg-navy text-white', compact ? 'pt-28 pb-12' : 'pt-32 pb-20')}>
      {image && <img src={image} alt="" className="absolute inset-0 h-full w-full object-cover opacity-30" />}
      <div className="absolute inset-0 bg-gradient-to-b from-navy-950/70 via-navy/80 to-navy" />
      <div className="zellige absolute inset-0 opacity-[0.07]" />
      <div className="relative mx-auto max-w-7xl px-4 md:px-6">
        {eyebrow && <span className="eyebrow text-gold-300">{eyebrow}</span>}
        <h1 className="font-display mt-3 max-w-3xl text-4xl leading-tight md:text-5xl">{title}</h1>
        {text && <p className="mt-4 max-w-2xl text-base leading-relaxed text-white/75 md:text-lg">{text}</p>}
        {children}
      </div>
    </section>
  )
}
