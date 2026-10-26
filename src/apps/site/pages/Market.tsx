import { BarChart3, Calculator } from 'lucide-react'
import { Link } from 'react-router'
import { usePublicProperties } from '@/shared/lib/data'
import { fmtDate, fmtNumber } from '@/shared/lib/format'
import { marketTable } from '@/shared/lib/valuation'
import { EmptyState } from '@/shared/ui/base'
import { PageHero } from '../components'
import { usePageMeta, useSite } from '../site'

const EXAMPLE_AREA = 90

/** Price per m² by neighbourhood, for sale and for rent, from the agency's listings and references. */
export function Market() {
  const { s, t, name, lang, hoodName } = useSite()
  usePageMeta(`${t('mk.title')} | ${name}`, t('mk.subtitle'))
  const { data: listings = [] } = usePublicProperties()
  const rows = marketTable(listings, s.catalog.neighborhoods)
  const maxSale = Math.max(1, ...rows.map((r) => r.sale ?? 0))
  const maxRent = Math.max(1, ...rows.map((r) => r.rent ?? 0))
  const src = (ref: boolean, n: number) => (ref ? t('mk.reference') : t('mk.fromListings', { n }))

  return (
    <>
      <PageHero eyebrow={t('mk.eyebrow')} title={t('mk.title')} text={t('mk.subtitle')} image={s.site.hero_image} compact />
      <section className="mx-auto max-w-6xl px-4 py-10 md:px-6">
        {rows.length === 0 ? (
          <EmptyState icon={<BarChart3 className="size-7" />} title={t('mk.title')} text={t('mk.empty')} />
        ) : (
          <div className="overflow-hidden rounded-[22px] border border-line bg-white shadow-card">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px] text-sm">
                <thead className="bg-navy text-white">
                  <tr>
                    <th className="px-4 py-3 text-start font-semibold">{t('mk.hood')}</th>
                    <th className="px-4 py-3 text-start font-semibold">{t('mk.sale')}</th>
                    <th className="px-4 py-3 text-start font-semibold">{t('mk.rent')}</th>
                    <th className="px-4 py-3 text-start font-semibold">{t('mk.example')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {rows.map((r) => (
                    <tr key={r.id} className="hover:bg-ivory/60">
                      <td className="px-4 py-3 font-semibold text-navy">
                        <Link to={`/biens?purpose=sale&hood=${r.id}`} className="hover:text-gold-700">
                          {hoodName(r.id)}
                        </Link>
                      </td>
                      <td className="px-4 py-3">
                        {r.sale != null ? (
                          <>
                            <div className="flex items-center gap-2">
                              <b className="num w-16 text-navy">{fmtNumber(r.sale)}</b>
                              <span className="h-2 flex-1 overflow-hidden rounded-full bg-sand">
                                <span className="block h-full rounded-full bg-navy" style={{ width: `${Math.round((r.sale / maxSale) * 100)}%` }} />
                              </span>
                            </div>
                            <div className="mt-0.5 text-[11px] text-subtle">{src(r.saleRef, r.saleCount)}</div>
                          </>
                        ) : (
                          <span className="text-subtle">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {r.rent != null ? (
                          <>
                            <div className="flex items-center gap-2">
                              <b className="num w-12 text-navy">{fmtNumber(r.rent)}</b>
                              <span className="h-2 flex-1 overflow-hidden rounded-full bg-sand">
                                <span className="block h-full rounded-full bg-gold" style={{ width: `${Math.round((r.rent / maxRent) * 100)}%` }} />
                              </span>
                            </div>
                            <div className="mt-0.5 text-[11px] text-subtle">{src(r.rentRef, r.rentCount)}</div>
                          </>
                        ) : (
                          <span className="text-subtle">—</span>
                        )}
                      </td>
                      <td className="num px-4 py-3 text-xs text-muted">
                        {r.sale != null && <div>{fmtNumber(Math.round((r.sale * EXAMPLE_AREA) / 5000) * 5000)} DH</div>}
                        {r.rent != null && <div>{fmtNumber(Math.round((r.rent * EXAMPLE_AREA) / 50) * 50)} DH / {lang === 'ar' ? 'الشهر' : lang === 'fr' ? 'mois' : 'mes'}</div>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
        <p className="mt-4 text-sm text-muted">{t('mk.note')}</p>
        <p className="mt-1 text-xs text-subtle">{t('mk.updated', { d: fmtDate(new Date().toISOString(), lang, { day: 'numeric', month: 'long', year: 'numeric' }) })}</p>
        <Link to="/estimation" className="mt-6 inline-flex h-12 items-center gap-2 rounded-2xl bg-gold px-5 font-bold text-navy-950 shadow-gold hover:bg-gold-400">
          <Calculator className="size-5" /> {t('mk.cta')}
        </Link>
      </section>
    </>
  )
}
