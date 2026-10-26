import { BadgeCheck } from 'lucide-react'
import { useState } from 'react'
import { useSearchParams } from 'react-router'
import { usePublicProperties } from '@/shared/lib/data'
import { fmtNumber, pick } from '@/shared/lib/format'
import type { ValuationInput } from '@/shared/lib/valuation'
import { DEFAULT_VALUATION, EstimateResult, EstimatorForm, useEstimate } from '@/shared/ui/estimator'
import { LeadForm, PageHero } from '../components'
import { usePageMeta, useSite } from '../site'

/** Free instant estimate from comparable listings, then a request for an expert's visit. */
export function Estimate() {
  const { s, t, name, lang } = useSite()
  usePageMeta(`${t('nav.estimate')} | ${name}`, t('est.subtitle'))
  const { data: listings = [] } = usePublicProperties()
  const [params] = useSearchParams()
  const [input, setInput] = useState<ValuationInput>({ ...DEFAULT_VALUATION, purpose: params.get('purpose') === 'rent' ? 'rent' : 'sale' })
  const est = useEstimate(input, listings)
  const hood = pick(s.catalog.neighborhoods.find((n) => n.id === input.neighborhood)?.name, lang)
  const summary = input.area > 0 ? `${t(`type.${input.type}`)} ${fmtNumber(input.area)} m² · ${hood}${est ? ` · ${fmtNumber(est.low)} – ${fmtNumber(est.high)} DH` : ''}` : ''

  return (
    <>
      <PageHero eyebrow={t('est.eyebrow')} title={t('est.title')} text={t('est.subtitle')} image={s.site.hero_image} compact />
      <section className="mx-auto grid max-w-7xl grid-cols-1 gap-8 px-4 py-10 md:px-6 lg:grid-cols-2">
        <div className="rounded-[22px] border border-line bg-white p-5 shadow-card md:p-7">
          <EstimatorForm value={input} onChange={setInput} />
        </div>
        <div className="space-y-6">
          <EstimateResult input={input} est={est} compHref={(ref) => `/biens/${ref}`} />
          <div className="rounded-[22px] border border-gold/40 bg-white p-5 shadow-card md:p-7">
            <h2 className="flex items-center gap-2 text-xl font-bold text-navy">
              <BadgeCheck className="size-5 text-gold-600" /> {t('est.cta.title')}
            </h2>
            <p className="mt-1 mb-4 text-sm text-muted">{t('est.cta.text')}</p>
            <LeadForm
              key={summary}
              kind="valuation"
              compact
              submitLabel={t('est.cta.button')}
              defaultMessage={summary}
              buildMeta={() => ({ ...input, estimate: est ? { low: est.low, mid: est.mid, high: est.high, basis: est.basis } : null })}
            />
          </div>
        </div>
      </section>
    </>
  )
}
