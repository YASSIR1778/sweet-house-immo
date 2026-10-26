import { Bath, BedDouble, Building, CalendarCheck, CalendarDays, Check, ChevronLeft, ChevronRight, Eye, Layers, MapPin, Maximize2, Phone, Printer, Ruler, Sofa, Star, Calculator, Home, Sun } from 'lucide-react'
import { WhatsAppIcon } from '@/shared/ui/icons'
import { useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router'
import { FEATURES } from '@/shared/lib/config'
import { usePublicProperties, usePublicProperty } from '@/shared/lib/data'
import { fmtNumber, fmtPhone, fmtPrice, telLink, waLink, youtubeId } from '@/shared/lib/format'
import { repo } from '@/shared/lib/repo'
import { fromNight, seasonOf } from '@/shared/lib/seasonal'
import { toEur } from '@/shared/lib/valuation'
import type { Property } from '@/shared/lib/types'
import { Badge, Button, ButtonLink, Field, Modal, Skeleton, cn } from '@/shared/ui/base'
import { Gallery } from '@/shared/ui/gallery'
import { LogoMark } from '@/shared/ui/logo'
import { BuyerCostsBox } from '@/shared/ui/calculators'
import { PropertyMap } from '@/shared/ui/map'
import { FavButton, LeadForm, PropertyCard, SectionHead, ShareButton } from '../components'
import { SeasonalBox } from '../stay'
import { cityName, jsonLd, placeLabel, propertyDesc, propertyTitle, propertyUrl, usePageMeta, useSite, waPropertyText } from '../site'

function Spec({ icon, label, value }: { icon: React.ReactNode; label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-line bg-white p-3.5">
      <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-sand text-navy">{icon}</span>
      <div className="min-w-0">
        <div className="text-[11px] font-semibold uppercase tracking-wide text-subtle">{label}</div>
        <div className="num truncate text-sm font-bold text-navy">{value}</div>
      </div>
    </div>
  )
}

function Mortgage({ price }: { price: number }) {
  const { lang, t } = useSite()
  const [down, setDown] = useState(20)
  const [rate, setRate] = useState(4.5)
  const [years, setYears] = useState(20)
  const principal = price * (1 - down / 100)
  const r = rate / 100 / 12
  const n = years * 12
  const monthly = r === 0 ? principal / n : (principal * r) / (1 - Math.pow(1 + r, -n))
  const interest = monthly * n - principal
  return (
    <div className="rounded-[18px] border border-line bg-white p-6">
      <div className="mb-5 flex items-center gap-3">
        <span className="flex size-10 items-center justify-center rounded-xl bg-gold/15 text-gold-700">
          <Calculator className="size-5" />
        </span>
        <div>
          <h3 className="font-bold text-navy">{t('mortgage.title')}</h3>
          <p className="text-xs text-muted">{t('mortgage.sub')}</p>
        </div>
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Field label={<span className="flex justify-between gap-2"><span>{t('mortgage.down')}</span><b className="num text-navy" dir="ltr">{down}%</b></span>}>
          <input type="range" min={0} max={80} step={5} value={down} onChange={(e) => setDown(Number(e.target.value))} className="w-full accent-[#c9a24b]" />
        </Field>
        <Field label={<span className="flex justify-between gap-2"><span>{t('mortgage.rate')}</span><b className="num text-navy" dir="ltr">{rate.toFixed(1)}%</b></span>}>
          <input type="range" min={2} max={9} step={0.1} value={rate} onChange={(e) => setRate(Number(e.target.value))} className="w-full accent-[#c9a24b]" />
        </Field>
        <Field label={<span className="flex justify-between gap-2"><span>{t('mortgage.years')}</span><b className="num text-navy" dir="ltr">{years}</b></span>}>
          <input type="range" min={5} max={25} step={1} value={years} onChange={(e) => setYears(Number(e.target.value))} className="w-full accent-[#c9a24b]" />
        </Field>
      </div>
      <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="rounded-2xl bg-navy p-4 text-white">
          <div className="text-xs text-white/70">{t('mortgage.monthly')}</div>
          <div className="num mt-1 text-2xl font-extrabold text-gold-300">{fmtPrice(Math.round(monthly), lang)}</div>
        </div>
        <div className="rounded-2xl bg-sand p-4">
          <div className="text-xs text-muted">{t('mortgage.total')}</div>
          <div className="num mt-1 text-2xl font-extrabold text-navy">{fmtPrice(Math.round(interest), lang)}</div>
        </div>
      </div>
    </div>
  )
}

export function PropertyPage() {
  const { ref } = useParams()
  const { s, lang, t, hoodName, typeName, name } = useSite()
  const { data: p, isLoading } = usePublicProperty(ref)
  const { data: all } = usePublicProperties()
  const [visit, setVisit] = useState(false)

  const title = p ? propertyTitle(p, lang) : ''
  // rented by the night in summer: the price of a night and the booking box
  const night = p?.purpose === 'rent' && p.seasonal ? fromNight(seasonOf(p.season)) : 0
  const seasonal = night > 0
  const shownPrice = p ? (seasonal ? `${t('stay.from', { price: fmtPrice(night, lang) })} ${t('stay.perNight')}` : fmtPrice(p.price, lang, p.purpose === 'rent')) : ''
  usePageMeta(p ? `${title} — ${shownPrice} | ${name}` : name, p ? propertyDesc(p, lang).slice(0, 160) : undefined, p?.images[0])

  useEffect(() => {
    if (p?.id) void repo.incrementViews(p.id)
  }, [p?.id])

  useEffect(() => {
    if (!p) return
    return jsonLd('ld-property', {
      '@context': 'https://schema.org',
      '@type': p.purpose === 'rent' ? 'Apartment' : 'Residence',
      name: title,
      description: propertyDesc(p, lang),
      url: propertyUrl(p),
      image: p.images,
      numberOfRooms: p.rooms ?? undefined,
      floorSize: p.area ? { '@type': 'QuantitativeValue', value: p.area, unitCode: 'MTK' } : undefined,
      address: { '@type': 'PostalAddress', addressLocality: cityName(p.city, 'fr') || 'Tétouan', addressCountry: 'MA' },
      geo: p.lat ? { '@type': 'GeoCoordinates', latitude: p.lat, longitude: p.lng } : undefined,
      offers: { '@type': 'Offer', price: p.price, priceCurrency: 'MAD', availability: 'https://schema.org/InStock' },
    })
  }, [p, lang, title])

  const similar = useMemo(() => {
    if (!p || !all) return []
    return all
      .filter((x) => x.id !== p.id && x.purpose === p.purpose && (x.type === p.type || x.neighborhood === p.neighborhood))
      .slice(0, 3)
  }, [p, all])

  if (isLoading)
    return (
      <div className="mx-auto max-w-7xl px-4 pt-28 md:px-6">
        <Skeleton className="h-8 w-2/3" />
        <Skeleton className="mt-6 h-[420px] w-full" />
      </div>
    )
  if (!p)
    return (
      <div className="mx-auto max-w-3xl px-4 pt-40 pb-24 text-center">
        <LogoMark className="mx-auto size-16" />
        <h1 className="font-display mt-6 text-3xl text-navy">{t('p.notFound')}</h1>
        <ButtonLink to="/biens" variant="gold" className="mt-6">
          {t('p.backToList')}
        </ButtonLink>
      </div>
    )

  const rent = p.purpose === 'rent'
  const toBooking = () => document.getElementById('booking')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  const waText = waPropertyText(s, p, lang)
  const Back = lang === 'ar' ? ChevronLeft : ChevronRight

  return (
    <article className="pt-24 md:pt-28">
      <div className="mx-auto max-w-7xl px-4 md:px-6">
        {/* breadcrumb */}
        <nav className="no-print mb-4 flex items-center gap-1.5 text-xs text-muted">
          <Link to="/" className="hover:text-navy">{t('nav.home')}</Link>
          <Back className="size-3.5 rotate-180" />
          <Link to={`/biens?purpose=${p.purpose}`} className="hover:text-navy">{rent ? t('nav.rent') : t('nav.sale')}</Link>
          <Back className="size-3.5 rotate-180" />
          <span className="num text-navy">{p.ref}</span>
        </nav>

        {/* header */}
        <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="mb-3 flex flex-wrap gap-2">
              <Badge tone={rent ? 'teal' : 'gold'}>{rent ? t('p.forRent') : t('p.forSale')}</Badge>
              {seasonal && (
                <Badge tone="gold">
                  <Sun className="size-3" /> {t('stay.badge')}
                </Badge>
              )}
              <Badge tone="neutral">{typeName(p.type)}</Badge>
              {p.featured && (
                <Badge tone="navy">
                  <Star className="size-3 fill-gold text-gold" /> {t('p.featured')}
                </Badge>
              )}
              {p.status !== 'available' && <Badge tone="warning">{t(`p.status.${p.status}`)}</Badge>}
            </div>
            <h1 className="font-display text-3xl leading-tight text-navy md:text-4xl">{title}</h1>
            <p className="mt-2 flex items-center gap-1.5 text-muted">
              <MapPin className="size-4 text-gold-600" /> {placeLabel(hoodName(p.neighborhood), p.city, lang)}
              <span className="num ms-3 inline-flex items-center gap-1 text-xs text-subtle">
                <Eye className="size-3.5" /> {t('p.views', { n: fmtNumber(p.views) })}
              </span>
            </p>
          </div>
          <div className="flex flex-col items-start gap-2 lg:items-end">
            {seasonal ? (
              <>
                <div className="num text-3xl font-extrabold text-navy md:text-4xl">
                  {t('stay.from', { price: fmtPrice(night, lang) })} <span className="text-base font-semibold text-muted">{t('stay.perNight')}</span>
                </div>
                {toEur(night, s.site.eur_rate ?? 0) ? <div className="num text-sm text-muted">{t('p.eur', { n: fmtNumber(toEur(night, s.site.eur_rate ?? 0)!) })}</div> : null}
                <div className="num text-xs text-subtle">{t('stay.monthly', { price: fmtPrice(p.price, lang) })}</div>
              </>
            ) : (
              <>
                <div className="num text-3xl font-extrabold text-navy md:text-4xl">{fmtPrice(p.price, lang, rent)}</div>
                {!rent && p.area ? <div className="num text-sm text-muted">{t('p.pricePerM2', { n: fmtNumber(Math.round(p.price / p.area)) })}</div> : null}
                {toEur(p.price, s.site.eur_rate ?? 0) ? <div className="num text-sm text-muted">{t('p.eur', { n: fmtNumber(toEur(p.price, s.site.eur_rate ?? 0)!) })}</div> : null}
              </>
            )}
            <div className="no-print mt-1 flex items-center gap-2">
              <ShareButton title={title} url={propertyUrl(p)} />
              <Button variant="outline" size="sm" onClick={() => window.print()} icon={<Printer className="size-4" />}>
                {t('p.print')}
              </Button>
              <FavButton id={p.id} />
            </div>
          </div>
        </div>

        <Gallery images={p.images} title={title} photosLabel={t('p.photos', { n: p.images.length })} />

        <div className="mt-10 grid grid-cols-1 gap-10 lg:grid-cols-[1fr_380px]">
          {/* ---------------- main */}
          <div className="space-y-10">
            {seasonal && (
              <div className="no-print">
                <SeasonalBox p={p} />
              </div>
            )}
            <section>
              <h2 className="mb-4 text-xl font-bold text-navy">{t('p.details')}</h2>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                <Spec icon={<Home className="size-5" />} label={t('search.type')} value={typeName(p.type)} />
                {p.area != null && <Spec icon={<Maximize2 className="size-5" />} label={t('p.area')} value={`${fmtNumber(p.area)} m²`} />}
                {p.land_area != null && <Spec icon={<Ruler className="size-5" />} label={t('p.landArea')} value={`${fmtNumber(p.land_area)} m²`} />}
                {p.rooms != null && <Spec icon={<Layers className="size-5" />} label={t('p.rooms')} value={p.rooms} />}
                {p.bedrooms != null && <Spec icon={<BedDouble className="size-5" />} label={t('p.bedrooms')} value={p.bedrooms} />}
                {p.bathrooms != null && <Spec icon={<Bath className="size-5" />} label={t('p.bathrooms')} value={p.bathrooms} />}
                {p.floor != null && <Spec icon={<Building className="size-5" />} label={t('p.floor')} value={p.floor} />}
                {p.floors != null && <Spec icon={<Building className="size-5" />} label={t('p.floors')} value={p.floors} />}
                {p.year_built != null && <Spec icon={<CalendarDays className="size-5" />} label={t('p.year')} value={p.year_built} />}
                <Spec icon={<Sofa className="size-5" />} label={t('p.furnished')} value={p.furnished ? t('p.furnished') : t('p.unfurnished')} />
              </div>
            </section>

            <section>
              <h2 className="mb-4 text-xl font-bold text-navy">{t('p.description')}</h2>
              <div className="whitespace-pre-line text-[15px] leading-[1.9] text-text">{propertyDesc(p, lang)}</div>
            </section>

            {youtubeId(p.video_url) && (
              <section className="no-print">
                <h2 className="mb-4 text-xl font-bold text-navy">{t('p.video')}</h2>
                <div className="aspect-video overflow-hidden rounded-[18px] border border-line bg-navy">
                  <iframe src={`https://www.youtube-nocookie.com/embed/${youtubeId(p.video_url)}`} title={title} className="h-full w-full" loading="lazy" allow="accelerometer; encrypted-media; gyroscope; picture-in-picture; fullscreen" allowFullScreen />
                </div>
              </section>
            )}

            {p.features.length > 0 && (
              <section>
                <h2 className="mb-4 text-xl font-bold text-navy">{t('p.features')}</h2>
                <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
                  {p.features.map((f) => (
                    <li key={f} className="flex items-center gap-2.5 rounded-xl bg-white px-3.5 py-2.5 text-sm text-text border border-line">
                      <span className="flex size-6 items-center justify-center rounded-full bg-teal-50 text-teal">
                        <Check className="size-3.5" strokeWidth={3} />
                      </span>
                      {FEATURES[f] ? FEATURES[f][lang] : f}
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {p.lat != null && p.lng != null && (
              <section className="no-print">
                <h2 className="mb-4 text-xl font-bold text-navy">{t('p.location')}</h2>
                <PropertyMap markers={[{ id: p.id, lat: p.lat, lng: p.lng, title: hoodName(p.neighborhood) }]} zoom={15} height={320} fit={false} />
                <p className="mt-2 text-xs text-subtle">{p.address ?? placeLabel(hoodName(p.neighborhood), p.city, lang)}</p>
              </section>
            )}

            {!rent && p.price > 100_000 && (
              <section className="no-print">
                <Mortgage price={p.price} />
              </section>
            )}

            {!rent && p.price > 0 && (
              <section className="no-print">
                <BuyerCostsBox price={p.price} kind={p.type === 'land' ? 'land' : 'built'} to={`/frais?price=${p.price}&kind=${p.type === 'land' ? 'land' : 'built'}`} />
              </section>
            )}
          </div>

          {/* ---------------- aside */}
          <aside className="no-print">
            <div className="sticky top-24 space-y-4">
              <div className="rounded-[18px] border border-line bg-white p-5 shadow-card">
                <div className="flex items-center gap-3">
                  <LogoMark className="size-12" />
                  <div>
                    <div className="font-bold text-navy">{name}</div>
                    <div className="text-xs text-muted">{t('p.agent')}</div>
                  </div>
                </div>
                <p className="mt-3 text-xs leading-relaxed text-muted">{t('p.agentText')}</p>
                <div className="mt-4 grid gap-2">
                  <a href={waLink(s.agency.whatsapp, waText)} target="_blank" rel="noopener noreferrer" className={cn('inline-flex h-12 items-center justify-center gap-2 rounded-2xl bg-[#25D366] font-bold text-white shadow-soft transition hover:brightness-105')}>
                    <WhatsAppIcon className="size-5" /> {t('p.whatsapp')}
                  </a>
                  <a href={telLink(s.agency.phone)} className="inline-flex h-12 items-center justify-center gap-2 rounded-2xl bg-navy font-bold text-white transition hover:bg-navy-800">
                    <Phone className="size-5" /> <span className="num" dir="ltr">{fmtPhone(s.agency.phone)}</span>
                  </a>
                  {seasonal ? (
                    <Button variant="gold" size="lg" onClick={toBooking} icon={<Sun className="size-5" />}>
                      {t('stay.choose')}
                    </Button>
                  ) : (
                    <Button variant="gold" size="lg" onClick={() => setVisit(true)} icon={<CalendarCheck className="size-5" />}>
                      {t('p.requestVisit')}
                    </Button>
                  )}
                </div>
                <div className="mt-5 border-t border-line pt-5">
                  <h3 className="mb-3 text-sm font-bold text-navy">{t('form.inquiryTitle')}</h3>
                  <LeadForm kind="inquiry" property={p} compact defaultMessage={lang === 'ar' ? `أنا مهتم بالعقار ${p.ref}.` : lang === 'fr' ? `Je suis intéressé(e) par le bien ${p.ref}.` : `Me interesa el inmueble ${p.ref}.`} />
                </div>
              </div>
              <div className="rounded-[18px] bg-sand p-4 text-xs text-muted">
                <span className="font-semibold text-navy">{t('p.ref')}:</span> <span className="num">{p.ref}</span>
              </div>
            </div>
          </aside>
        </div>

        {similar.length > 0 && (
          <section className="no-print mt-20">
            <SectionHead eyebrow={t('nav.properties')} title={t('p.similar')} />
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {similar.map((x: Property) => (
                <PropertyCard key={x.id} p={x} />
              ))}
            </div>
          </section>
        )}
      </div>

      <Modal open={visit} onClose={() => setVisit(false)} title={t('form.visitTitle')}>
        <p className="mb-4 text-sm text-muted">{t('form.visitText')}</p>
        <LeadForm kind="visit" property={p} withPreferredAt compact showMessage={false} submitLabel={t('p.requestVisit')} />
      </Modal>
    </article>
  )
}
