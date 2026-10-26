import { Gauge, MapPin, Ruler, Sparkles } from 'lucide-react'
import type { ReactNode } from 'react'
import { Link } from 'react-router'
import { FEATURES, PROPERTY_TYPES } from '@/shared/lib/config'
import { useSettings } from '@/shared/lib/data'
import { fmtNumber, fmtPrice, pick } from '@/shared/lib/format'
import { useI18n } from '@/shared/lib/i18n'
import type { Property, PropertyType, Settings } from '@/shared/lib/types'
import { estimate, toEur, type Condition, type Estimate, type ValuationInput } from '@/shared/lib/valuation'
import { Field, Input, Select, cn } from './base'

/** Features that move the estimate. */
export const ESTIMATE_FEATURES = ['sea_view', 'terrace', 'parking', 'pool', 'garden', 'elevator'] as const
const CONDITIONS: Condition[] = ['new', 'good', 'renovate']

export const DEFAULT_VALUATION: ValuationInput = { purpose: 'sale', type: 'apartment', neighborhood: 'centre', area: 0, condition: 'good', features: [] }

export function useEstimate(input: ValuationInput, listings: Property[]): Estimate | null {
  const { data } = useSettings()
  const s = data as Settings
  return estimate(input, listings, s.catalog.neighborhoods)
}

function Toggle({ on, onClick, children }: { on: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button type="button" onClick={onClick} className={cn('rounded-xl border px-3 py-2 text-sm font-semibold transition', on ? 'border-navy bg-navy text-white' : 'border-line bg-white text-navy hover:border-navy/40')}>
      {children}
    </button>
  )
}

/** What the visitor (or the agent) knows about the property. */
export function EstimatorForm({ value, onChange }: { value: ValuationInput; onChange: (v: ValuationInput) => void }) {
  const { t, lang } = useI18n()
  const { data } = useSettings()
  const s = data as Settings
  const set = <K extends keyof ValuationInput>(k: K, v: ValuationInput[K]) => onChange({ ...value, [k]: v })
  const types = PROPERTY_TYPES.filter((x) => x !== 'garage' && x !== 'building') as PropertyType[]
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-2">
        {(['sale', 'rent'] as const).map((p) => (
          <Toggle key={p} on={value.purpose === p} onClick={() => set('purpose', p)}>
            {t(`est.${p}`)}
          </Toggle>
        ))}
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Field label={t('est.type')}>
          <Select value={value.type} onChange={(e) => set('type', e.target.value as PropertyType)}>
            {types.map((ty) => (
              <option key={ty} value={ty}>
                {t(`type.${ty}`)}
              </option>
            ))}
          </Select>
        </Field>
        <Field label={t('est.hood')}>
          <Select value={value.neighborhood} onChange={(e) => set('neighborhood', e.target.value)}>
            {s.catalog.neighborhoods.map((n) => (
              <option key={n.id} value={n.id}>
                {pick(n.name, lang)}
              </option>
            ))}
          </Select>
        </Field>
        <Field label={t('est.area')}>
          <Input type="number" inputMode="numeric" min={10} dir="ltr" className="num" value={value.area || ''} placeholder="90" onChange={(e) => set('area', Number(e.target.value) || 0)} />
        </Field>
      </div>
      <Field label={t('est.condition')}>
        <div className="grid grid-cols-3 gap-2">
          {CONDITIONS.map((c) => (
            <Toggle key={c} on={value.condition === c} onClick={() => set('condition', c)}>
              {t(`est.cond.${c}`)}
            </Toggle>
          ))}
        </div>
      </Field>
      <Field label={t('est.features')}>
        <div className="flex flex-wrap gap-2">
          {ESTIMATE_FEATURES.map((f) => {
            const on = value.features.includes(f)
            return (
              <Toggle key={f} on={on} onClick={() => set('features', on ? value.features.filter((x) => x !== f) : [...value.features, f])}>
                {FEATURES[f]?.[lang] ?? f}
              </Toggle>
            )
          })}
          {value.purpose === 'rent' && (
            <Toggle on={Boolean(value.furnished)} onClick={() => set('furnished', !value.furnished)}>
              {t('est.furnished')}
            </Toggle>
          )}
        </div>
      </Field>
    </div>
  )
}

/** The estimate: range, price per m², what it is based on and the comparable listings. */
export function EstimateResult({ input, est, compHref, footer }: { input: ValuationInput; est: Estimate | null; compHref?: (ref: string) => string; footer?: ReactNode }) {
  const { t, lang } = useI18n()
  const { data } = useSettings()
  const s = data as Settings
  const rent = input.purpose === 'rent'
  const hood = pick(s.catalog.neighborhoods.find((n) => n.id === input.neighborhood)?.name, lang)
  const rate = s.site.eur_rate ?? 0
  if (!(input.area > 0)) return <p className="rounded-2xl bg-sand p-5 text-sm text-muted">{t('est.fill')}</p>
  if (!est) return <p className="rounded-2xl bg-sand p-5 text-sm text-muted">{t('est.none')}</p>
  const eur = toEur(est.mid, rate)
  return (
    <div className="space-y-4">
      <div className="rounded-[22px] bg-navy p-6 text-center text-white shadow-card">
        <div className="text-xs tracking-[0.18em] text-gold-300 uppercase">{t('est.result')}</div>
        <div className="num mt-2 text-3xl font-extrabold md:text-4xl" dir="ltr">
          {fmtNumber(est.low, lang)} – {fmtNumber(est.high, lang)}
        </div>
        <div className="mt-1 text-sm text-white/70">{rent ? t('est.perMonth') : lang === 'ar' ? 'درهم' : lang === 'en' ? 'MAD' : 'DH'}</div>
        <div className="mt-3 text-sm">
          {t('est.mid')} <b className="num text-gold-300">{fmtPrice(est.mid, lang, rent)}</b>
          {eur ? <span className="num ms-2 text-white/60">≈ {fmtNumber(eur, lang)} €</span> : null}
        </div>
      </div>
      <div className="grid grid-cols-1 gap-2 text-sm sm:grid-cols-3">
        <div className="flex items-center gap-2 rounded-xl bg-ivory p-3">
          <Ruler className="size-4 text-gold-600" />
          <span>
            <b className="num">{fmtNumber(est.perM2, lang)}</b> {rent ? t('est.rentM2') : t('est.saleM2')}
          </span>
        </div>
        <div className="flex items-center gap-2 rounded-xl bg-ivory p-3">
          <Gauge className="size-4 text-gold-600" />
          <span>{t(`est.conf.${est.confidence}`)}</span>
        </div>
        <div className="flex items-center gap-2 rounded-xl bg-ivory p-3">
          <MapPin className="size-4 text-gold-600" />
          <span className="truncate">{hood}</span>
        </div>
      </div>
      <p className="flex items-start gap-2 text-sm text-muted">
        <Sparkles className="mt-0.5 size-4 shrink-0 text-gold-600" />
        {est.basis === 'neighborhood' ? t('est.basis.neighborhood', { n: est.comps.length, hood }) : est.basis === 'reference' ? t('est.basis.reference', { hood }) : t('est.basis.city', { n: est.comps.length })}
      </p>
      {est.comps.length > 0 && (
        <div>
          <h3 className="mb-2 text-sm font-bold text-navy">{t('est.comps')}</h3>
          <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {est.comps.map((c) => {
              const body = (
                <>
                  <span className="num text-xs font-bold text-gold-700">{c.ref}</span>
                  <span className="flex-1 text-xs text-muted">
                    {t(`type.${c.type}`)} · <span className="num">{fmtNumber(c.area, lang)} m²</span>
                  </span>
                  <span className="num text-sm font-bold text-navy">{fmtPrice(c.price, lang, rent)}</span>
                </>
              )
              return (
                <li key={c.id}>
                  {compHref ? (
                    <Link to={compHref(c.ref)} className="flex items-center gap-2 rounded-xl border border-line bg-white px-3 py-2 hover:border-navy/30">
                      {body}
                    </Link>
                  ) : (
                    <div className="flex items-center gap-2 rounded-xl border border-line bg-white px-3 py-2">{body}</div>
                  )}
                </li>
              )
            })}
          </ul>
        </div>
      )}
      <p className="text-xs text-subtle">{t('est.disclaimer')}</p>
      {footer}
    </div>
  )
}
