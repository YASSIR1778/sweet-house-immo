import { useQuery } from '@tanstack/react-query'
import { CalendarCheck, CalendarClock, Eye, Inbox, Lock, ShieldCheck, Timer, TrendingDown, TrendingUp } from 'lucide-react'
import { useEffect, type ReactNode } from 'react'
import { Link, useParams } from 'react-router'
import { fmtDate, fmtNumber, fmtPrice, waLink } from '@/shared/lib/format'
import { daysOnMarket } from '@/shared/lib/owners'
import { repo } from '@/shared/lib/repo'
import type { OwnerReport } from '@/shared/lib/types'
import { EmptyState, Skeleton } from '@/shared/ui/base'
import { WhatsAppIcon } from '@/shared/ui/icons'
import { PageHero } from '../components'
import { usePageMeta, useSite } from '../site'

function Metric({ icon, label, value }: { icon: ReactNode; label: string; value: ReactNode }) {
  return (
    <div className="rounded-2xl bg-ivory p-3.5">
      <div className="flex items-center gap-2 text-xs text-muted">
        {icon}
        {label}
      </div>
      <div className="num mt-1 text-xl font-extrabold text-navy">{value}</div>
    </div>
  )
}

/** Private follow-up page of an owner (link sent by the agency; never indexed). */
export function OwnerReportPage() {
  const { token = '' } = useParams()
  const { s, lang, setLang, t, name } = useSite()
  usePageMeta(`${t('owner.title')} | ${name}`)
  const { data, isLoading, isError } = useQuery({ queryKey: ['owner-report', token], queryFn: () => repo.ownerReport(token), retry: 1, staleTime: 60_000 })

  // a private page: keep it out of search engines, and speak the owner's language
  useEffect(() => {
    let robots = document.head.querySelector<HTMLMetaElement>('meta[name="robots"]')
    if (!robots) {
      robots = document.createElement('meta')
      robots.name = 'robots'
      document.head.appendChild(robots)
    }
    const before = robots.content
    robots.content = 'noindex, nofollow'
    return () => {
      robots!.content = before
    }
  }, [])
  useEffect(() => {
    if (data?.lang && data.lang !== lang) setLang(data.lang)
    // only once, when the report arrives
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data?.lang])

  const report = data as OwnerReport | null | undefined
  const status = (st: string) => (st === 'available' || st === 'draft' ? t(`owner.status.${st}`) : t(`p.status.${st}`))

  return (
    <>
      <PageHero eyebrow={t('owner.private')} title={report ? t('owner.hello', { name: report.name }) : t('owner.title')} text={t('owner.intro', { agency: name })} image={s.site.hero_image} compact />
      <section className="mx-auto max-w-5xl px-4 py-10 md:px-6">
        {isLoading ? (
          <div className="space-y-4">
            <Skeleton className="h-40 w-full rounded-[18px]" />
            <Skeleton className="h-40 w-full rounded-[18px]" />
          </div>
        ) : isError || !report ? (
          <EmptyState icon={<Lock className="size-7" />} title={t('owner.title')} text={t('owner.invalid')} />
        ) : report.properties.length === 0 ? (
          <EmptyState icon={<Lock className="size-7" />} title={t('owner.title')} text={t('owner.none')} />
        ) : (
          <div className="space-y-6">
            <p className="flex items-center gap-2 text-xs text-muted">
              <ShieldCheck className="size-4 text-teal" /> {t('owner.updated', { d: fmtDate(report.generated_at, lang, { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' }) })}
            </p>
            {report.properties.map((p) => {
              const first = p.prices[0]?.price
              const diff = first && first !== p.price ? Math.round(((p.price - first) / first) * 1000) / 10 : null
              const rent = p.purpose === 'rent'
              return (
                <article key={p.ref} className="overflow-hidden rounded-[22px] border border-line bg-white shadow-card">
                  <div className="grid grid-cols-1 md:grid-cols-[260px_1fr]">
                    {p.image ? <img src={p.image} alt="" className="h-52 w-full object-cover md:h-full" loading="lazy" /> : <div className="h-52 bg-sand md:h-full" />}
                    <div className="p-5 md:p-6">
                      <div className="flex flex-wrap items-center gap-2 text-xs">
                        <span className="num rounded-full bg-sand px-2.5 py-1 font-bold text-gold-700">{p.ref}</span>
                        <span className="rounded-full bg-teal/10 px-2.5 py-1 font-semibold text-teal">{status(p.status)}</span>
                        {!p.published && p.status !== 'sold' && p.status !== 'rented' && <span className="rounded-full bg-warning/10 px-2.5 py-1 font-semibold text-warning">{t('owner.hidden')}</span>}
                        {p.mandate && (
                          <span className="rounded-full bg-gold/15 px-2.5 py-1 font-semibold text-gold-700">
                            {t(`owner.mandate.${p.mandate.kind}`)}
                            {p.mandate.end_date ? ` ${t('owner.mandate.until', { d: fmtDate(p.mandate.end_date, lang) })}` : ''}
                          </span>
                        )}
                      </div>
                      <h2 className="mt-2 text-xl font-bold text-navy">{p.title}</h2>
                      <div className="mt-1 flex flex-wrap items-baseline gap-2">
                        <span className="text-sm text-muted">{t('owner.price')}</span>
                        <b className="num text-xl text-navy">{fmtPrice(p.price, lang, rent)}</b>
                        {diff != null && (
                          <span className={`num inline-flex items-center gap-1 text-xs font-bold ${diff < 0 ? 'text-danger' : 'text-success'}`} dir="ltr">
                            {diff < 0 ? <TrendingDown className="size-3.5" /> : <TrendingUp className="size-3.5" />}
                            {diff > 0 ? '+' : ''}
                            {diff}%
                          </span>
                        )}
                      </div>
                      <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3">
                        <Metric icon={<Eye className="size-3.5" />} label={t('owner.views')} value={fmtNumber(p.views)} />
                        <Metric icon={<Inbox className="size-3.5" />} label={t('owner.leads')} value={fmtNumber(p.leads)} />
                        <Metric icon={<CalendarCheck className="size-3.5" />} label={t('owner.visits')} value={fmtNumber(p.visits_done)} />
                        <Metric icon={<CalendarClock className="size-3.5" />} label={t('owner.planned')} value={fmtNumber(p.visits_planned)} />
                        <Metric icon={<Timer className="size-3.5" />} label={t('owner.days')} value={fmtNumber(daysOnMarket(p.created_at))} />
                      </div>
                      {p.last_visit && <p className="mt-3 text-xs text-muted">{t('owner.lastVisit', { d: fmtDate(p.last_visit, lang) })}</p>}
                      {p.prices.length > 1 && (
                        <div className="mt-4">
                          <h3 className="mb-2 text-sm font-bold text-navy">{t('owner.prices')}</h3>
                          <ol className="space-y-1 text-sm">
                            {p.prices.map((h, i) => (
                              <li key={i} className="flex justify-between gap-3 border-b border-line/70 pb-1">
                                <span className="text-muted">{fmtDate(h.at, lang)}</span>
                                <b className="num text-navy">{fmtPrice(h.price, lang, rent)}</b>
                              </li>
                            ))}
                          </ol>
                        </div>
                      )}
                      {p.published && p.status !== 'draft' && (
                        <Link to={`/biens/${p.ref}`} className="mt-4 inline-flex text-sm font-semibold text-teal hover:underline">
                          {t('owner.view')}
                        </Link>
                      )}
                    </div>
                  </div>
                </article>
              )
            })}
            <a href={waLink(s.agency.whatsapp, t('owner.msg', { name: report.name }))} target="_blank" rel="noopener noreferrer" className="inline-flex h-12 items-center gap-2 rounded-2xl bg-[#25D366] px-5 font-bold text-white shadow-soft hover:brightness-105">
              <WhatsAppIcon className="size-5" /> {t('owner.contact')}
            </a>
          </div>
        )}
      </section>
    </>
  )
}
