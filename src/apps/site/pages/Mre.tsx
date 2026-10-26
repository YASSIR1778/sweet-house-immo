import { Banknote, Calculator, FileCheck2, KeyRound, Landmark, PenLine, ShieldCheck, Sun, Video } from 'lucide-react'
import { Link } from 'react-router'
import { usePublicProperties } from '@/shared/lib/data'
import { waLink } from '@/shared/lib/format'
import { WhatsAppIcon } from '@/shared/ui/icons'
import { PageHero, PropertyCard, SectionHead } from '../components'
import { usePageMeta, useSite } from '../site'

const STEPS = [Video, FileCheck2, PenLine, Banknote, ShieldCheck, KeyRound]

/** Buying from abroad: the steps, keeping the right to transfer the money back, prices in euros. */
export function Mre() {
  const { s, t, name } = useSite()
  usePageMeta(`${t('mre.title')} | ${name}`, t('mre.subtitle'))
  const { data: listings = [] } = usePublicProperties()
  const picks = listings
    .filter((p) => p.purpose === 'sale' && p.status === 'available')
    .sort((a, b) => Number(b.featured) - Number(a.featured) || Number(b.features.includes('sea_view')) - Number(a.features.includes('sea_view')))
    .slice(0, 6)
  const rate = s.site.eur_rate ?? 0

  return (
    <>
      <PageHero eyebrow={t('mre.eyebrow')} title={t('mre.title')} text={t('mre.subtitle')} image={s.site.hero_image} compact />
      <section className="mx-auto max-w-7xl px-4 py-10 md:px-6">
        <div className="flex flex-wrap gap-3">
          <a href={waLink(s.agency.whatsapp, t('mre.videoMsg'))} target="_blank" rel="noopener noreferrer" className="inline-flex h-12 items-center gap-2 rounded-2xl bg-[#25D366] px-5 font-bold text-white shadow-soft hover:brightness-105">
            <WhatsAppIcon className="size-5" /> {t('mre.video')}
          </a>
          <Link to="/frais" className="inline-flex h-12 items-center gap-2 rounded-2xl border border-line bg-white px-5 font-bold text-navy shadow-soft hover:border-navy/30">
            <Calculator className="size-5 text-gold-600" /> {t('mre.costs')}
          </Link>
          <Link to="/sejours" className="inline-flex h-12 items-center gap-2 rounded-2xl border border-line bg-white px-5 font-bold text-navy shadow-soft hover:border-navy/30">
            <Sun className="size-5 text-gold-600" /> {t('mre.summer')}
          </Link>
        </div>

        <h2 className="font-display mt-12 mb-6 text-3xl text-navy">{t('mre.steps')}</h2>
        <ol className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {STEPS.map((Icon, i) => (
            <li key={i} className="relative rounded-[22px] border border-line bg-white p-5 shadow-soft">
              <span className="num absolute top-4 end-4 text-3xl font-extrabold text-sand">{i + 1}</span>
              <span className="flex size-11 items-center justify-center rounded-2xl bg-navy text-gold">
                <Icon className="size-5" />
              </span>
              <h3 className="mt-3 text-lg font-bold text-navy">{t(`mre.s${i + 1}.t`)}</h3>
              <p className="mt-1 text-sm leading-relaxed text-muted">{t(`mre.s${i + 1}.d`)}</p>
            </li>
          ))}
        </ol>

        <div className="mt-10 grid grid-cols-1 gap-4 lg:grid-cols-3">
          <div className="rounded-[22px] border border-gold/40 bg-gold/5 p-6 lg:col-span-2">
            <h3 className="flex items-center gap-2 text-lg font-bold text-navy">
              <Landmark className="size-5 text-gold-600" /> {t('mre.money.t')}
            </h3>
            <p className="mt-2 text-sm leading-relaxed text-text">{t('mre.money.d')}</p>
            <a href="https://www.oc.gov.ma/fr/mre/transfert-de-revenu-dinvestissement-mre" target="_blank" rel="noopener noreferrer" className="mt-3 inline-block text-xs font-semibold text-teal hover:underline">
              {t('mre.source')}
            </a>
          </div>
          <div className="rounded-[22px] border border-line bg-white p-6">
            <h3 className="flex items-center gap-2 text-lg font-bold text-navy">
              <ShieldCheck className="size-5 text-gold-600" /> {t('mre.notary.t')}
            </h3>
            <p className="mt-2 text-sm leading-relaxed text-muted">{t('mre.notary.d')}</p>
          </div>
        </div>
        {rate > 0 && (
          <p className="mt-4 rounded-2xl bg-sand p-4 text-sm text-muted">
            <b className="text-navy">{t('mre.eur.t')}: </b>
            {t('mre.eur.d', { rate })}
          </p>
        )}
      </section>
      {picks.length > 0 && (
        <section className="mx-auto max-w-7xl px-4 pb-10 md:px-6">
          <SectionHead title={t('mre.picks')} />
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {picks.map((p) => (
              <PropertyCard key={p.id} p={p} eur />
            ))}
          </div>
        </section>
      )}
    </>
  )
}
