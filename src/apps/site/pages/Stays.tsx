import { BedDouble, CalendarCheck, Home as HomeIcon, MapPin, Send, ShieldCheck, Sun, Users } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { Link, useSearchParams } from 'react-router'
import { usePublicProperties, useSeasonalBusy } from '@/shared/lib/data'
import { fmtPrice, localDate, waLink } from '@/shared/lib/format'
import { addDays, clashes, fromNight, guestsText, nightsText, quote, seasonOf } from '@/shared/lib/seasonal'
import type { Property, SeasonRates } from '@/shared/lib/types'
import { Badge, Button, Field, Input, Select, cn } from '@/shared/ui/base'
import { WhatsAppIcon } from '@/shared/ui/icons'
import { PageHero, PropertyCardSkeleton, SectionHead } from '../components'
import { placeLabel, propertyPath, propertyTitle, usePageMeta, useSite } from '../site'

const STEPS = [CalendarCheck, Send, ShieldCheck]

/** Summer rentals by the night: search by dates and guests, then book on the property page. */
export function Stays() {
  const { s, lang, t, name } = useSite()
  usePageMeta(`${t('stays.title')} | ${name}`, t('stays.text'))
  const [sp, setSp] = useSearchParams()
  const today = localDate(new Date())
  const checkIn = sp.get('in') ?? ''
  const checkOut = sp.get('out') ?? ''
  const guests = Math.max(1, Number(sp.get('g')) || 2)
  const dated = checkIn >= today && checkOut > checkIn
  const [form, setForm] = useState({ in: checkIn, out: checkOut, g: String(guests) })
  const { data: listings = [], isLoading } = usePublicProperties()
  const { data: busy = [] } = useSeasonalBusy()

  const rows = listings
    .filter((p) => p.purpose === 'rent' && p.seasonal && p.status !== 'rented')
    .map((p) => {
      const r = seasonOf(p.season)
      const q = dated ? quote(r, checkIn, checkOut, guests) : null
      const free = dated ? !clashes(busy.filter((b) => b.property_id === p.id), checkIn, checkOut) : true
      const fits = guests <= r.guests
      const long = !q || !q.issues.includes('min_nights')
      return { p, r, q, free, fits, long, ok: free && fits && long }
    })
    .sort((a, b) => Number(b.ok) - Number(a.ok) || fromNight(a.r) - fromNight(b.r))

  const search = (e: FormEvent) => {
    e.preventDefault()
    const next = new URLSearchParams()
    if (form.in && form.out && form.out > form.in) {
      next.set('in', form.in)
      next.set('out', form.out)
    }
    if (form.g) next.set('g', form.g)
    setSp(next, { replace: true })
  }

  return (
    <>
      <PageHero eyebrow={t('nav.stays')} title={t('stays.title')} text={t('stays.text')} image={rows[0]?.p.images[0] ?? s.site.hero_image} compact>
        <form onSubmit={search} className="glass mt-8 grid grid-cols-2 gap-2 rounded-[22px] p-3 text-navy shadow-pop md:grid-cols-[1fr_1fr_160px_auto] md:p-4">
          <Field label={t('stay.checkIn')}>
            <Input type="date" dir="ltr" className="num h-12 bg-white" min={today} value={form.in} onChange={(e) => setForm((f) => ({ ...f, in: e.target.value, out: f.out > e.target.value ? f.out : e.target.value ? addDays(e.target.value, 7) : f.out }))} />
          </Field>
          <Field label={t('stay.checkOut')}>
            <Input type="date" dir="ltr" className="num h-12 bg-white" min={form.in ? addDays(form.in, 1) : today} value={form.out} onChange={(e) => setForm((f) => ({ ...f, out: e.target.value }))} />
          </Field>
          <Field label={t('stay.guests')} className="col-span-2 md:col-span-1">
            <Select className="num h-12 bg-white" value={form.g} onChange={(e) => setForm((f) => ({ ...f, g: e.target.value }))}>
              {Array.from({ length: 12 }, (_, i) => i + 1).map((n) => (
                <option key={n} value={n}>
                  {guestsText(n, lang)}
                </option>
              ))}
            </Select>
          </Field>
          <div className="col-span-2 flex items-end md:col-span-1">
            <Button type="submit" variant="gold" size="lg" className="h-12 w-full md:px-7" icon={<Sun className="size-4" />}>
              {t('stays.search')}
            </Button>
          </div>
        </form>
      </PageHero>

      <section className="mx-auto max-w-7xl px-4 py-10 md:px-6">
        <p className="mb-6 text-sm text-muted">{isLoading ? t('common.loading') : t('stays.count', { n: rows.filter((x) => x.ok).length })}</p>
        {isLoading ? (
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 xl:grid-cols-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <PropertyCardSkeleton key={i} />
            ))}
          </div>
        ) : rows.length === 0 ? (
          <div className="rounded-[22px] border border-dashed border-gold/50 bg-gold/5 p-8 text-center">
            <p className="text-muted">{t('stays.none')}</p>
            <a href={waLink(s.agency.whatsapp, t('stays.waMsg'))} target="_blank" rel="noopener noreferrer" className="mt-4 inline-flex h-11 items-center gap-2 rounded-2xl bg-[#25D366] px-5 text-sm font-bold text-white shadow-soft hover:brightness-105">
              <WhatsAppIcon className="size-4" /> {t('stay.wa')}
            </a>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 xl:grid-cols-3">
            {rows.map((x) => (
              <StayCard key={x.p.id} {...x} link={dated ? `?in=${checkIn}&out=${checkOut}&g=${guests}` : guests !== 2 ? `?g=${guests}` : ''} />
            ))}
          </div>
        )}
      </section>

      <section className="mx-auto max-w-7xl px-4 pb-6 md:px-6">
        <SectionHead title={t('stays.how')} />
        <ol className="grid grid-cols-1 gap-4 md:grid-cols-3">
          {STEPS.map((Icon, i) => (
            <li key={i} className="relative rounded-[22px] border border-line bg-white p-5 shadow-soft">
              <span className="num absolute top-4 end-4 text-3xl font-extrabold text-sand">{i + 1}</span>
              <span className="flex size-11 items-center justify-center rounded-2xl bg-navy text-gold">
                <Icon className="size-5" />
              </span>
              <h3 className="mt-3 text-lg font-bold text-navy">{t(`stays.s${i + 1}.t`)}</h3>
              <p className="mt-1 text-sm leading-relaxed text-muted">{t(`stays.s${i + 1}.d`)}</p>
            </li>
          ))}
        </ol>
        <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-3">
          <div className="rounded-[22px] border border-gold/40 bg-gold/5 p-6 lg:col-span-2">
            <h3 className="flex items-center gap-2 text-lg font-bold text-navy">
              <ShieldCheck className="size-5 text-gold-600" /> {t('stays.legal.t')}
            </h3>
            <p className="mt-2 text-sm leading-relaxed text-text">{t('stays.legal.d')}</p>
          </div>
          <div className="rounded-[22px] bg-navy p-6 text-white">
            <h3 className="flex items-center gap-2 text-lg font-bold">
              <HomeIcon className="size-5 text-gold" /> {t('stays.owner.t')}
            </h3>
            <p className="mt-2 text-sm leading-relaxed text-white/75">{t('stays.owner.d')}</p>
            <Link to="/vendre" className="mt-4 inline-flex h-11 items-center gap-2 rounded-2xl bg-gold px-5 text-sm font-bold text-navy-950 hover:bg-gold-400">
              {t('stays.owner.cta')}
            </Link>
          </div>
        </div>
      </section>
    </>
  )
}

function StayCard({ p, r, q, free, fits, long, ok, link }: { p: Property; r: SeasonRates; q: ReturnType<typeof quote> | null; free: boolean; fits: boolean; long: boolean; ok: boolean; link: string }) {
  const { lang, t, hoodName } = useSite()
  const night = fromNight(r)
  return (
    <Link to={`${propertyPath(p)}${link}`} className={cn('group block overflow-hidden rounded-[18px] border border-line bg-white shadow-soft transition-all duration-300 hover:-translate-y-1 hover:shadow-card', !ok && 'opacity-60')}>
      <div className="zoom-img relative aspect-[4/3] overflow-hidden">
        <img src={p.images[0] ?? 'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&w=1000&q=80'} alt={propertyTitle(p, lang)} className="h-full w-full object-cover" loading="lazy" />
        <div className="absolute inset-0 bg-gradient-to-t from-navy-950/70 via-navy-950/10 to-transparent" />
        <div className="absolute inset-x-3 top-3 flex flex-wrap gap-1.5">
          {q ? (
            <span className={cn('inline-flex items-center gap-1.5 rounded-full bg-white/95 px-2.5 py-1 text-xs leading-none font-semibold', ok ? 'text-success' : 'text-danger')}>
              {!free ? t('stays.unavailable') : !fits ? t('stays.tooSmall') : !long ? t('stays.shortStay', { nights: nightsText(q.minNights, lang) }) : t('stays.available')}
            </span>
          ) : (
            <Badge tone="white">
              <Sun className="size-3 text-gold-600" /> {t('stay.badge')}
            </Badge>
          )}
        </div>
        <div className="absolute inset-x-4 bottom-3 text-white">
          {q && ok ? (
            <>
              <div className="num text-xl leading-none font-extrabold drop-shadow">{t('stays.totalFor', { price: fmtPrice(q.total, lang), nights: nightsText(q.nights, lang) })}</div>
              <div className="num mt-1 text-[11px] text-white/80">
                {t('stay.from', { price: fmtPrice(night, lang) })} {t('stay.perNight')}
              </div>
            </>
          ) : (
            <div className="num text-xl leading-none font-extrabold drop-shadow">
              {t('stay.from', { price: fmtPrice(night, lang) })} <span className="text-xs font-semibold text-white/85">{t('stay.perNight')}</span>
            </div>
          )}
        </div>
      </div>
      <div className="p-4">
        <h3 className="line-clamp-2 min-h-[2.8em] text-[0.98rem] leading-snug font-bold text-navy group-hover:text-gold-700">{propertyTitle(p, lang)}</h3>
        <p className="mt-1.5 flex items-center gap-1 text-sm text-muted">
          <MapPin className="size-3.5 shrink-0 text-gold-600" /> {placeLabel(hoodName(p.neighborhood), p.city, lang)}
        </p>
        <div className="mt-3 flex items-center gap-3 border-t border-line pt-3 text-[13px] text-muted">
          <span className="inline-flex items-center gap-1">
            <Users className="size-4 text-navy/60" /> <span className="num">{t('stays.upTo', { guests: guestsText(r.guests, lang) })}</span>
          </span>
          {p.bedrooms != null && (
            <span className="inline-flex items-center gap-1">
              <BedDouble className="size-4 text-navy/60" /> <span className="num">{p.bedrooms}</span>
            </span>
          )}
          <span className="num ms-auto text-xs text-subtle">{p.ref}</span>
        </div>
      </div>
    </Link>
  )
}
