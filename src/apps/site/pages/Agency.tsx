import { Handshake, HeartHandshake, MapPin, Phone, Sparkles } from 'lucide-react'
import { WhatsAppIcon } from '@/shared/ui/icons'
import { fmtPhone, pick, telLink, waLink } from '@/shared/lib/format'
import { ButtonLink, Reveal } from '@/shared/ui/base'
import { PropertyMap } from '@/shared/ui/map'
import { usePublicProperties } from '@/shared/lib/data'
import { Counter, PageHero, SectionHead } from '../components'
import { statItems, usePageMeta, useSite } from '../site'

export function Agency() {
  const { s, lang, t, name } = useSite()
  usePageMeta(`${t('agency.title')} | ${name}`, pick(s.agency.about, lang))
  const { data: props } = usePublicProperties()
  const stats = statItems(s.site.stats, props?.length ?? 0)
  const values = [
    { icon: HeartHandshake, k: 1 },
    { icon: Sparkles, k: 2 },
    { icon: Handshake, k: 3 },
  ]
  return (
    <>
      <PageHero eyebrow={t('agency.eyebrow')} title={t('agency.title')} image={s.site.hero_image} />

      <section className="mx-auto max-w-7xl px-4 py-16 md:px-6">
        <div className="grid grid-cols-1 items-center gap-12 lg:grid-cols-2">
          <Reveal>
            <h2 className="font-display text-3xl text-navy md:text-4xl">{name}</h2>
            <p className="font-display mt-2 text-xl text-gold-600">{pick(s.agency.slogan, lang)}</p>
            <p className="mt-6 text-[17px] leading-[1.9] text-text">{pick(s.agency.about, lang)}</p>
            <div className="mt-8 grid grid-cols-2 gap-6 sm:grid-cols-4">
              {stats.map(([k, v]) => (
                <div key={k}>
                  <div className="num text-3xl font-extrabold text-navy">
                    <Counter value={v} suffix={k === 'years' ? '' : '+'} />
                  </div>
                  <div className="text-xs text-muted">{t(`stats.${k}`)}</div>
                </div>
              ))}
            </div>
          </Reveal>
          <Reveal delay={100}>
            <img src={s.site.hero_image} alt="Tétouan" className="arch h-[460px] w-full object-cover shadow-card" loading="lazy" />
          </Reveal>
        </div>
      </section>

      <section className="bg-navy py-20 text-white">
        <div className="mx-auto max-w-7xl px-4 md:px-6">
          <Reveal>
            <SectionHead eyebrow={t('agency.values')} title={t('why.title')} light align="center" />
          </Reveal>
          <div className="grid grid-cols-1 gap-5 md:grid-cols-3">
            {values.map(({ icon: Icon, k }, i) => (
              <Reveal key={k} delay={i * 90}>
                <div className="h-full rounded-[18px] border border-white/10 bg-white/5 p-7 text-center">
                  <span className="mx-auto flex size-14 items-center justify-center rounded-2xl bg-gold text-navy-950 shadow-gold">
                    <Icon className="size-7" />
                  </span>
                  <h3 className="mt-5 text-xl font-bold">{t(`agency.v${k}.t`)}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-white/70">{t(`agency.v${k}.d`)}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-20 md:px-6">
        <div className="grid grid-cols-1 gap-8 lg:grid-cols-[1fr_1.2fr]">
          <Reveal>
            <SectionHead eyebrow={t('agency.visit')} title={t('agency.cta')} />
            <ul className="space-y-4 text-[15px]">
              <li className="flex items-start gap-3">
                <MapPin className="mt-1 size-5 shrink-0 text-gold-600" /> {pick(s.agency.address, lang)}
              </li>
              <li className="flex items-center gap-3">
                <Phone className="size-5 shrink-0 text-gold-600" />
                <a href={telLink(s.agency.phone)} className="num font-semibold text-navy" dir="ltr">
                  {fmtPhone(s.agency.phone)}
                </a>
              </li>
              <li className="num flex items-center gap-3 text-muted">{pick(s.agency.hours, lang)}</li>
            </ul>
            <div className="mt-6 flex flex-wrap gap-2">
              <ButtonLink to={waLink(s.agency.whatsapp)} external variant="whatsapp" icon={<WhatsAppIcon className="size-4" />}>
                {t('cta.whatsapp')}
              </ButtonLink>
              <ButtonLink to="/contact" variant="outline">
                {t('nav.contact')}
              </ButtonLink>
            </div>
          </Reveal>
          <Reveal delay={100}>
            <PropertyMap markers={[{ id: 'agency', lat: s.agency.lat, lng: s.agency.lng, title: name }]} zoom={15} height={380} fit={false} />
          </Reveal>
        </div>
      </section>
    </>
  )
}
