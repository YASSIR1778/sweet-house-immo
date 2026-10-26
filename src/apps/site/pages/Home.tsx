import { Building2, Check, ChevronDown, Globe2, Home as HomeIcon, Key, Quote, Scale, ShieldCheck, Star, Sun } from 'lucide-react'
import { WhatsAppIcon } from '@/shared/ui/icons'
import { useEffect, useMemo } from 'react'
import { Link } from 'react-router'
import { SITE_URL } from '@/shared/lib/config'
import { usePublicProperties } from '@/shared/lib/data'
import { pick, waLink } from '@/shared/lib/format'
import { ButtonLink, EmptyState, Reveal } from '@/shared/ui/base'
import { Arrow, Counter, PropertyCard, PropertyCardSkeleton, SearchBar, SectionHead } from '../components'
import { jsonLd, STAT_COLS, statItems, usePageMeta, useSite } from '../site'

export function Home() {
  const { s, lang, t, hoodName } = useSite()
  usePageMeta(t('seo.home'), pick(s.site.hero_subtitle, lang), s.site.hero_image)
  const { data: props, isLoading } = usePublicProperties()
  const stats = statItems(s.site.stats, props?.length ?? 0)

  const featured = useMemo(() => {
    const all = props ?? []
    const f = all.filter((p) => p.featured)
    return (f.length >= 3 ? f : all).slice(0, 6)
  }, [props])
  const latest = useMemo(() => (props ?? []).slice().sort((a, b) => b.created_at.localeCompare(a.created_at)).slice(0, 8), [props])
  const summer = useMemo(() => (props ?? []).find((p) => p.seasonal && p.purpose === 'rent' && p.images.length > 0), [props])
  const hoods = useMemo(() => {
    const counts = new Map<string, number>()
    for (const p of props ?? []) counts.set(p.neighborhood, (counts.get(p.neighborhood) ?? 0) + 1)
    return s.catalog.neighborhoods
      .map((n) => ({ ...n, count: counts.get(n.id) ?? 0 }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10)
  }, [props, s])

  useEffect(
    () =>
      jsonLd('ld-agency', {
        '@context': 'https://schema.org',
        '@type': 'RealEstateAgent',
        name: pick(s.agency.name, 'fr'),
        alternateName: pick(s.agency.name, 'ar'),
        url: SITE_URL,
        telephone: s.agency.phone,
        email: s.agency.email || undefined,
        address: { '@type': 'PostalAddress', addressLocality: 'Tétouan', addressCountry: 'MA', streetAddress: pick(s.agency.address, 'fr') },
        geo: { '@type': 'GeoCoordinates', latitude: s.agency.lat, longitude: s.agency.lng },
        sameAs: [s.agency.facebook, s.agency.instagram].filter(Boolean),
        areaServed: ['Tétouan', 'Martil', 'M’diq', 'Cabo Negro', 'Fnideq'],
      }),
    [s],
  )

  const services = [
    { icon: HomeIcon, k: 'sale' },
    { icon: Key, k: 'buy' },
    { icon: Building2, k: 'rent' },
    { icon: ShieldCheck, k: 'manage' },
    { icon: Scale, k: 'legal' },
    { icon: Globe2, k: 'mre' },
  ]

  return (
    <>
      {/* ------------------------------------------------ HERO */}
      <section className="relative flex min-h-[100svh] items-center overflow-hidden bg-navy">
        <img src={s.site.hero_image} alt="" className="anim-kenburns absolute inset-0 h-full w-full object-cover object-[center_65%]" fetchPriority="high" />
        <div className="absolute inset-0 bg-gradient-to-b from-navy-950/55 via-navy-950/35 to-navy-950/95" />
        <div className="zellige absolute inset-0 opacity-[0.07]" />
        <div className="relative mx-auto w-full max-w-7xl px-4 pt-32 pb-20 md:px-6 md:pt-36">
          <div className="anim-up max-w-3xl">
            <span className="eyebrow text-gold-300">{pick(s.site.hero_eyebrow, lang)}</span>
            <h1 className="font-display mt-5 text-[3.2rem] leading-[1.05] text-white drop-shadow-lg sm:text-6xl md:text-[5.2rem]">{pick(s.site.hero_title, lang)}</h1>
            <p className="mt-6 max-w-2xl text-lg leading-relaxed text-white/85 md:text-xl">{pick(s.site.hero_subtitle, lang)}</p>
            <ul className="mt-6 flex flex-wrap gap-x-6 gap-y-2 text-sm font-semibold text-white/90">
              {['hero.trust1', 'hero.trust2', 'hero.trust3'].map((k) => (
                <li key={k} className="inline-flex items-center gap-2">
                  <span className="flex size-5 items-center justify-center rounded-full bg-gold text-navy-950">
                    <Check className="size-3.5" strokeWidth={3} />
                  </span>
                  {t(k)}
                </li>
              ))}
            </ul>
          </div>
          <div className="anim-up mt-10 max-w-5xl" style={{ animationDelay: '150ms' }}>
            <SearchBar variant="hero" />
          </div>
        </div>
        <a href="#featured" className="absolute bottom-6 left-1/2 hidden -translate-x-1/2 flex-col items-center gap-1 text-xs font-semibold tracking-widest text-white/70 uppercase md:flex">
          {t('hero.scroll')}
          <ChevronDown className="anim-float size-5" />
        </a>
      </section>

      {/* ------------------------------------------------ STATS */}
      {stats.length > 0 && (
      <section className="relative overflow-hidden bg-navy-950 text-white">
        <div className="zellige absolute inset-0 opacity-[0.05]" />
        <div className={`relative mx-auto grid max-w-7xl grid-cols-2 gap-6 px-4 py-12 md:px-6 ${STAT_COLS[stats.length]}`}>
          {stats.map(([k, v], i) => (
            <Reveal key={k} delay={i * 80} className="text-center md:text-start">
              <div className="text-gold-gradient text-4xl font-extrabold md:text-5xl">
                <Counter value={v} suffix={k === 'years' ? '' : '+'} />
              </div>
              <div className="mt-1.5 text-sm text-white/65">{t(`stats.${k}`)}</div>
            </Reveal>
          ))}
        </div>
      </section>
      )}

      {/* ------------------------------------------------ FEATURED */}
      <section id="featured" className="mx-auto max-w-7xl px-4 py-20 md:px-6">
        <Reveal>
          <SectionHead
            eyebrow={t('featured.eyebrow')}
            title={t('featured.title')}
            action={
              <ButtonLink to="/biens" variant="outline" icon={<Arrow className="size-4" />}>
                {t('featured.all')}
              </ButtonLink>
            }
          />
        </Reveal>
        {!isLoading && featured.length === 0 ? (
          <EmptyState
            icon={<Building2 className="size-7" />}
            title={t('home.soonTitle')}
            text={t('home.soonText')}
            action={
              <ButtonLink to={waLink(s.agency.whatsapp)} external variant="whatsapp" icon={<WhatsAppIcon className="size-4" />}>
                {t('cta.whatsapp')}
              </ButtonLink>
            }
          />
        ) : (
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {isLoading
              ? Array.from({ length: 6 }).map((_, i) => <PropertyCardSkeleton key={i} />)
              : featured.map((p, i) => (
                  <Reveal key={p.id} delay={(i % 3) * 90}>
                    <PropertyCard p={p} />
                  </Reveal>
                ))}
          </div>
        )}
      </section>

      {/* ------------------------------------------------ SUMMER RENTALS */}
      {summer && (
        <section className="mx-auto max-w-7xl px-4 pb-20 md:px-6">
          <Reveal>
            <Link to="/sejours" className="group relative flex flex-col overflow-hidden rounded-[22px] bg-navy text-white shadow-card md:flex-row">
              <div className="zoom-img h-52 overflow-hidden md:h-auto md:w-2/5">
                <img src={summer.images[0]} alt="" className="h-full w-full object-cover" loading="lazy" />
              </div>
              <div className="relative flex flex-1 flex-col justify-center gap-3 p-6 md:p-10">
                <div className="zellige absolute inset-0 opacity-[0.06]" />
                <span className="eyebrow relative inline-flex items-center gap-2 text-gold-300">
                  <Sun className="size-4" /> {t('nav.stays')}
                </span>
                <h2 className="font-display relative text-2xl leading-tight md:text-3xl">{t('stays.title')}</h2>
                <p className="relative text-sm leading-relaxed text-white/75 md:text-base">{t('stays.text')}</p>
                <span className="relative inline-flex items-center gap-2 font-bold text-gold-300">
                  {t('stays.search')} <Arrow className="size-4 transition group-hover:translate-x-1 rtl:group-hover:-translate-x-1" />
                </span>
              </div>
            </Link>
          </Reveal>
        </section>
      )}

      {/* ------------------------------------------------ NEIGHBORHOODS */}
      <section className="zellige-soft relative overflow-hidden bg-sand/60 py-20">
        <div className="mx-auto max-w-7xl px-4 md:px-6">
          <Reveal>
            <SectionHead eyebrow={t('hoods.eyebrow')} title={t('hoods.title')} text={t('hoods.subtitle')} />
          </Reveal>
          <div className="no-scrollbar -mx-4 flex snap-x gap-4 overflow-x-auto px-4 pb-4 md:mx-0 md:grid md:grid-cols-5 md:overflow-visible md:px-0">
            {hoods.map((n, i) => (
              <Reveal key={n.id} delay={(i % 5) * 60} className="snap-start">
                <Link to={`/biens?hood=${n.id}`} className="group relative flex h-40 w-44 shrink-0 flex-col justify-end overflow-hidden rounded-[18px] bg-gradient-to-br from-navy-800 to-navy-950 p-4 text-white shadow-soft transition hover:-translate-y-1 hover:shadow-card md:w-auto">
                  <div className="zellige absolute inset-0 opacity-[0.12] transition group-hover:opacity-20" />
                  <div className="absolute -top-6 -end-6 size-24 rounded-full bg-gold/15 blur-2xl transition group-hover:bg-gold/30" />
                  <div className="font-display relative text-xl leading-tight">{hoodName(n.id)}</div>
                  <div className="relative mt-1 flex items-center justify-between text-xs text-white/70">
                    <span>{t('hoods.count', { n: n.count })}</span>
                    <Arrow className="size-4 text-gold transition group-hover:translate-x-1 rtl:group-hover:-translate-x-1" />
                  </div>
                </Link>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ------------------------------------------------ LATEST */}
      {latest.length > 0 && (
        <section className="mx-auto max-w-7xl px-4 py-20 md:px-6">
          <Reveal>
            <SectionHead eyebrow={t('latest.eyebrow')} title={t('latest.title')} />
          </Reveal>
          <div className="no-scrollbar -mx-4 flex snap-x gap-5 overflow-x-auto px-4 pb-4 md:mx-0 md:px-0">
            {latest.map((p) => (
              <div key={p.id} className="w-[82%] shrink-0 snap-start sm:w-[46%] lg:w-[31%] xl:w-[23.5%]">
                <PropertyCard p={p} compact />
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ------------------------------------------------ SERVICES */}
      <section className="relative overflow-hidden bg-navy py-24 text-white">
        <div className="zellige absolute inset-0 opacity-[0.06]" />
        <div className="relative mx-auto max-w-7xl px-4 md:px-6">
          <Reveal>
            <SectionHead eyebrow={t('services.eyebrow')} title={t('services.title')} light align="center" />
          </Reveal>
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {services.map(({ icon: Icon, k }, i) => (
              <Reveal key={k} delay={(i % 3) * 90}>
                <div className="group h-full rounded-[18px] border border-white/10 bg-white/5 p-6 transition hover:-translate-y-1 hover:border-gold/40 hover:bg-white/10">
                  <div className="mb-5 flex size-12 items-center justify-center rounded-2xl bg-gold text-navy-950 shadow-gold transition group-hover:scale-105">
                    <Icon className="size-6" />
                  </div>
                  <h3 className="text-lg font-bold">{t(`services.${k}.t`)}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-white/70">{t(`services.${k}.d`)}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ------------------------------------------------ WHY US */}
      <section className="mx-auto max-w-7xl px-4 py-24 md:px-6">
        <div className="grid grid-cols-1 items-center gap-12 lg:grid-cols-2">
          <Reveal>
            <SectionHead eyebrow={t('why.eyebrow')} title={t('why.title')} />
            <ol className="space-y-6">
              {[1, 2, 3, 4].map((i) => (
                <li key={i} className="flex gap-4">
                  <span className="num flex size-11 shrink-0 items-center justify-center rounded-full border-2 border-gold font-display text-lg text-gold-700">{i}</span>
                  <div>
                    <h3 className="text-lg font-bold text-navy">{t(`why.${i}.t`)}</h3>
                    <p className="mt-1 text-sm leading-relaxed text-muted">{t(`why.${i}.d`)}</p>
                  </div>
                </li>
              ))}
            </ol>
          </Reveal>
          <Reveal delay={120} className="relative">
            <div className="grid grid-cols-2 gap-4">
              <img src={featured[0]?.images[0] ?? s.site.hero_image} alt="" className="arch h-72 w-full object-cover shadow-card" loading="lazy" />
              <img src={featured[1]?.images[0] ?? s.site.hero_image} alt="" className="mt-10 h-72 w-full rounded-[18px] object-cover shadow-card" loading="lazy" />
            </div>
            <div className="anim-float absolute -bottom-6 start-6 flex items-center gap-3 rounded-2xl bg-white p-4 shadow-pop">
              <div className="flex size-11 items-center justify-center rounded-xl bg-gold/15 text-gold-700">
                <ShieldCheck className="size-5" />
              </div>
              <div>
                <div className="text-sm font-extrabold text-navy">{s.site.stats.years > 0 ? t('why.badgeYears', { n: s.site.stats.years }) : t('hero.trust1')}</div>
                <div className="text-xs text-muted">{t('why.badgeSub')}</div>
              </div>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ------------------------------------------------ TESTIMONIALS */}
      {s.site.testimonials.length > 0 && (
      <section className="bg-sand/60 py-24">
        <div className="mx-auto max-w-7xl px-4 md:px-6">
          <Reveal>
            <SectionHead eyebrow={t('testi.eyebrow')} title={t('testi.title')} align="center" />
          </Reveal>
          <div className="no-scrollbar -mx-4 flex snap-x gap-5 overflow-x-auto px-4 pb-4 md:mx-0 md:grid md:grid-cols-3 md:overflow-visible md:px-0">
            {s.site.testimonials.map((tm, i) => (
              <Reveal key={i} delay={i * 90} className="w-[85%] shrink-0 snap-center md:w-auto">
                <figure className="relative h-full rounded-[18px] border border-line bg-white p-7 shadow-soft">
                  <Quote className="absolute top-5 end-5 size-8 text-gold/30" />
                  <div className="mb-4 flex gap-0.5 text-gold">
                    {Array.from({ length: 5 }).map((_, j) => (
                      <Star key={j} className="size-4 fill-current" />
                    ))}
                  </div>
                  <blockquote className="text-[15px] leading-relaxed text-text">“{pick(tm.text, lang)}”</blockquote>
                  <figcaption className="mt-5 flex items-center gap-3 border-t border-line pt-4">
                    <span className="flex size-10 items-center justify-center rounded-full bg-navy font-display text-gold">{tm.name.trim()[0]}</span>
                    <div>
                      <div className="text-sm font-bold text-navy">{tm.name}</div>
                      <div className="text-xs text-muted">{pick(tm.role, lang)}</div>
                    </div>
                  </figcaption>
                </figure>
              </Reveal>
            ))}
          </div>
        </div>
      </section>
      )}

      {/* ------------------------------------------------ SELL CTA */}
      <section className="mx-auto max-w-7xl px-4 py-10 md:px-6">
        <Reveal>
          <div className="relative overflow-hidden rounded-[28px] bg-navy px-6 py-14 text-white md:px-14">
            <div className="zellige absolute inset-0 opacity-[0.08]" />
            <div className="absolute -top-20 -end-20 size-72 rounded-full bg-gold/20 blur-3xl" />
            <div className="relative grid grid-cols-1 items-center gap-8 md:grid-cols-[1.4fr_1fr]">
              <div>
                <span className="eyebrow text-gold-300">{t('cta.sell.eyebrow')}</span>
                <h2 className="font-display mt-3 text-3xl md:text-5xl">{t('cta.sell.title')}</h2>
                <p className="mt-4 max-w-xl text-white/75">{t('cta.sell.text')}</p>
              </div>
              <div className="flex flex-col gap-3 md:items-end">
                <ButtonLink to="/vendre" variant="gold" size="xl" icon={<Arrow className="size-5" />}>
                  {t('cta.sell.button')}
                </ButtonLink>
                <ButtonLink to={waLink(s.agency.whatsapp)} external variant="light" size="lg" icon={<WhatsAppIcon className="size-5" />}>
                  {t('cta.whatsapp')}
                </ButtonLink>
              </div>
            </div>
          </div>
        </Reveal>
      </section>
    </>
  )
}
