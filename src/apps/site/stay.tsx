import { ChevronLeft, ChevronRight, IdCard, Minus, Plus, Sun, X } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useSearchParams } from 'react-router'
import { useSeasonalBusy } from '@/shared/lib/data'
import { fmtPrice, localDate, waLink } from '@/shared/lib/format'
import { clashes, dayLabel, guestsText, nightsBetween, nightsOf, nightsText, quote, seasonOf, takenNights } from '@/shared/lib/seasonal'
import type { Lang, Property } from '@/shared/lib/types'
import { cn } from '@/shared/ui/base'
import { WhatsAppIcon } from '@/shared/ui/icons'
import { LeadForm } from './components'
import { useSite } from './site'

/*
 * Summer rentals on the website: the calendar of free nights, the price of a stay and the
 * booking request (a lead of kind «booking» that the team turns into a booking).
 */

const LOCALE: Record<Lang, string> = { ar: 'ar-MA-u-nu-latn', fr: 'fr-FR', es: 'es-ES' }
const utc = (m: string, day = 1) => new Date(Date.UTC(Number(m.slice(0, 4)), Number(m.slice(5, 7)) - 1, day))
const shiftMonth = (m: string, n: number) => {
  const d = utc(m)
  d.setUTCMonth(d.getUTCMonth() + n)
  return d.toISOString().slice(0, 7)
}
/** 01/07 from «07-01» */
export const dayMonth = (md: string) => md.split('-').reverse().join('/')
/** «2 août», «2 غشت» */
export const shortDay = (d: string, lang: Lang) => new Intl.DateTimeFormat(LOCALE[lang], { day: 'numeric', month: 'short', timeZone: 'UTC' }).format(utc(d.slice(0, 7), Number(d.slice(8, 10))))

/* ------------------------------------------------------------------ */
/* Two months of nights: taken ones crossed out, the stay highlighted   */
/* ------------------------------------------------------------------ */
export function StayCalendar({ taken, checkIn, checkOut, onChange }: { taken: Set<string>; checkIn: string; checkOut: string; onChange: (checkIn: string, checkOut: string) => void }) {
  const { lang, dir, t } = useSite()
  const today = localDate(new Date())
  const [month, setMonth] = useState(() => (checkIn || today).slice(0, 7))
  const weekdays = useMemo(() => Array.from({ length: 7 }, (_, i) => new Intl.DateTimeFormat(LOCALE[lang], { weekday: 'narrow', timeZone: 'UTC' }).format(new Date(Date.UTC(2024, 0, 1 + i)))), [lang])
  const title = (m: string) => new Intl.DateTimeFormat(LOCALE[lang], { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(utc(m))
  const choosingOut = Boolean(checkIn && !checkOut)
  // the departure may fall on a taken night (they leave in the morning), not the nights in between
  const canEnd = (d: string) => choosingOut && d > checkIn && nightsOf(checkIn, d).every((n) => !taken.has(n))
  const pick = (d: string) => {
    if (d < today) return
    if (canEnd(d)) return onChange(checkIn, d)
    if (taken.has(d)) return
    onChange(d, '')
  }
  const Prev = dir === 'rtl' ? ChevronRight : ChevronLeft
  const Next = dir === 'rtl' ? ChevronLeft : ChevronRight

  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <button type="button" onClick={() => setMonth(shiftMonth(month, -1))} disabled={month <= today.slice(0, 7)} className="inline-flex size-9 items-center justify-center rounded-full text-navy hover:bg-sand disabled:opacity-30" aria-label={t('stay.prev')}>
          <Prev className="size-5" />
        </button>
        <span className="text-sm font-semibold text-muted">{choosingOut ? t('stay.pickOut') : ''}</span>
        <button type="button" onClick={() => setMonth(shiftMonth(month, 1))} disabled={month >= shiftMonth(today.slice(0, 7), 16)} className="inline-flex size-9 items-center justify-center rounded-full text-navy hover:bg-sand disabled:opacity-30" aria-label={t('stay.next')}>
          <Next className="size-5" />
        </button>
      </div>
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
        {[month, shiftMonth(month, 1)].map((m, k) => {
          const offset = (utc(m).getUTCDay() + 6) % 7
          const days = new Date(Date.UTC(Number(m.slice(0, 4)), Number(m.slice(5, 7)), 0)).getUTCDate()
          return (
            <div key={m} className={cn(k === 1 && 'max-sm:hidden')}>
              <div className="mb-2 text-center text-sm font-bold text-navy capitalize">{title(m)}</div>
              <div className="grid grid-cols-7 text-center text-[11px] font-semibold text-subtle">
                {weekdays.map((w, i) => (
                  <span key={i} className="py-1">
                    {w}
                  </span>
                ))}
              </div>
              <div className="grid grid-cols-7">
                {Array.from({ length: offset }, (_, i) => (
                  <span key={`x${i}`} />
                ))}
                {Array.from({ length: days }, (_, i) => {
                  const d = `${m}-${String(i + 1).padStart(2, '0')}`
                  const past = d < today
                  const end = canEnd(d)
                  const busy = taken.has(d) && !end
                  const edge = d === checkIn || d === checkOut
                  const inside = Boolean(checkIn && checkOut && d > checkIn && d < checkOut)
                  return (
                    <button
                      key={d}
                      type="button"
                      disabled={past || (busy && !edge)}
                      onClick={() => pick(d)}
                      title={busy ? t('stay.taken') : undefined}
                      className={cn(
                        'num relative my-0.5 flex h-10 items-center justify-center text-sm transition',
                        past && 'text-subtle/40',
                        busy && !past && 'cursor-not-allowed text-danger/50 line-through',
                        !past && !busy && !edge && !inside && 'rounded-xl font-semibold text-navy hover:bg-sand',
                        inside && 'bg-gold/20 font-semibold text-navy',
                        edge && 'rounded-xl bg-navy font-bold text-white',
                        choosingOut && end && 'ring-1 ring-gold/40 ring-inset',
                        d === today && !edge && 'underline decoration-gold decoration-2 underline-offset-4',
                      )}
                    >
                      {i + 1}
                    </button>
                  )
                })}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* The booking box of a property rented by the night                    */
/* ------------------------------------------------------------------ */
export function SeasonalBox({ p }: { p: Property }) {
  const { s, lang, t } = useSite()
  const [sp] = useSearchParams()
  const r = seasonOf(p.season)
  const { data: busy = [] } = useSeasonalBusy()
  const mine = useMemo(() => busy.filter((b) => b.property_id === p.id), [busy, p.id])
  const taken = useMemo(() => takenNights(mine), [mine])
  const today = localDate(new Date())
  // dates chosen on the summer page come along in the link
  const [stay, setStay] = useState(() => {
    const a = sp.get('in') ?? ''
    const b = sp.get('out') ?? ''
    return a >= today && b > a ? { in: a, out: b } : { in: '', out: '' }
  })
  const [guests, setGuests] = useState(() => Math.min(r.guests, Math.max(1, Number(sp.get('g')) || 2)))
  const dated = Boolean(stay.in && stay.out)
  const q = dated ? quote(r, stay.in, stay.out, guests) : null
  const clash = dated && clashes(mine, stay.in, stay.out)
  const blocking = q ? q.issues.filter((i) => i !== 'no_rate') : []
  const ok = dated && !clash && blocking.length === 0
  const priced = q && !q.issues.includes('no_rate')
  const hi = r.high_night ?? r.night
  const nights = q ? nightsText(q.nights, lang) : ''
  const wa = dated
    ? t('stay.waDates', { ref: p.ref, in: dayLabel(stay.in, lang), out: dayLabel(stay.out, lang), guests: guestsText(guests, lang) })
    : t('stay.waNoDates', { ref: p.ref })

  return (
    <section id="booking" className="scroll-mt-28 rounded-[22px] border border-gold/40 bg-white p-5 shadow-card md:p-6">
      <div className="flex items-start gap-3">
        <span className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-gold/15 text-gold-700">
          <Sun className="size-5" />
        </span>
        <div>
          <h2 className="text-xl font-bold text-navy">{t('stay.title')}</h2>
          <p className="mt-0.5 text-sm text-muted">{t('stay.sub')}</p>
        </div>
      </div>

      <div className="mt-5">
        <StayCalendar taken={taken} checkIn={stay.in} checkOut={stay.out} onChange={(a, b) => setStay({ in: a, out: b })} />
      </div>

      <div className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-[1fr_1fr_auto]">
        <div className="rounded-2xl border border-line px-3 py-2">
          <div className="text-[11px] font-semibold text-subtle">{t('stay.checkIn')}</div>
          <div className="num text-sm font-bold text-navy">{stay.in ? shortDay(stay.in, lang) : '—'}</div>
        </div>
        <div className="rounded-2xl border border-line px-3 py-2">
          <div className="text-[11px] font-semibold text-subtle">{t('stay.checkOut')}</div>
          <div className="num text-sm font-bold text-navy">{stay.out ? shortDay(stay.out, lang) : '—'}</div>
        </div>
        <div className="col-span-2 flex items-center justify-between gap-3 rounded-2xl border border-line px-3 py-2 sm:col-span-1">
          <div>
            <div className="text-[11px] font-semibold text-subtle">{t('stay.guests')}</div>
            <div className="num text-sm font-bold text-navy">{guestsText(guests, lang)}</div>
          </div>
          <div className="flex items-center gap-1">
            <button type="button" onClick={() => setGuests((g) => Math.max(1, g - 1))} disabled={guests <= 1} className="inline-flex size-8 items-center justify-center rounded-full border border-line text-navy hover:bg-sand disabled:opacity-30" aria-label="−">
              <Minus className="size-4" />
            </button>
            <button type="button" onClick={() => setGuests((g) => Math.min(r.guests, g + 1))} disabled={guests >= r.guests} className="inline-flex size-8 items-center justify-center rounded-full border border-line text-navy hover:bg-sand disabled:opacity-30" aria-label="+">
              <Plus className="size-4" />
            </button>
          </div>
        </div>
      </div>
      {(stay.in || stay.out) && (
        <button type="button" onClick={() => setStay({ in: '', out: '' })} className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-teal hover:underline">
          <X className="size-3.5" /> {t('stay.clear')}
        </button>
      )}

      {clash && <p className="mt-4 rounded-2xl bg-danger/10 px-4 py-3 text-sm font-semibold text-danger">{t('stay.notFree')}</p>}
      {q && !clash && blocking.includes('min_nights') && <p className="mt-4 rounded-2xl bg-warning/10 px-4 py-3 text-sm font-semibold text-warning">{t('stay.minNights', { nights: nightsText(q.minNights, lang) })}</p>}
      {q && blocking.includes('guests') && <p className="mt-4 rounded-2xl bg-warning/10 px-4 py-3 text-sm font-semibold text-warning">{t('stay.maxGuests', { guests: guestsText(r.guests, lang) })}</p>}

      {q && priced && !clash && (
        <dl className="mt-5 space-y-2 rounded-2xl bg-ivory p-4 text-sm">
          {q.high > 0 && (
            <div className="flex justify-between gap-3">
              <dt className="text-muted">
                <span className="num">{nightsText(q.high, lang)} × {fmtPrice(hi, lang)}</span>
                {q.low > 0 && <span className="text-xs"> ({t('stay.highSeason')})</span>}
              </dt>
              <dd className="num font-semibold text-navy">{fmtPrice(q.high * hi, lang)}</dd>
            </div>
          )}
          {q.low > 0 && (
            <div className="flex justify-between gap-3">
              <dt className="num text-muted">
                {nightsText(q.low, lang)} × {fmtPrice(r.night, lang)}
              </dt>
              <dd className="num font-semibold text-navy">{fmtPrice(q.low * r.night, lang)}</dd>
            </div>
          )}
          {q.discount > 0 && (
            <div className="flex justify-between gap-3 text-success">
              <dt>{t('stay.weekDiscount', { pct: r.week_discount })}</dt>
              <dd className="num font-semibold">− {fmtPrice(q.discount, lang)}</dd>
            </div>
          )}
          {q.cleaning > 0 && (
            <div className="flex justify-between gap-3">
              <dt className="text-muted">{t('stay.cleaning')}</dt>
              <dd className="num font-semibold text-navy">{fmtPrice(q.cleaning, lang)}</dd>
            </div>
          )}
          <div className="flex items-baseline justify-between gap-3 border-t border-line pt-2">
            <dt className="font-bold text-navy">
              {t('stay.total')} <span className="num text-xs font-normal text-muted">({nights})</span>
            </dt>
            <dd className="num text-xl font-extrabold text-navy">{fmtPrice(q.total, lang)}</dd>
          </div>
          {r.deposit_pct > 0 && (
            <div className="flex justify-between gap-3 text-xs text-muted">
              <dt>{t('stay.deposit', { pct: r.deposit_pct })}</dt>
              <dd className="num font-semibold">{fmtPrice(q.deposit, lang)}</dd>
            </div>
          )}
          {r.caution > 0 && (
            <div className="flex justify-between gap-3 text-xs text-muted">
              <dt>{t('stay.caution')}</dt>
              <dd className="num font-semibold">{fmtPrice(r.caution, lang)}</dd>
            </div>
          )}
        </dl>
      )}

      <div className="mt-5">
        {ok ? (
          <>
            <h3 className="mb-3 text-sm font-bold text-navy">{t('stay.formTitle')}</h3>
            <LeadForm
              kind="booking"
              property={p}
              note={t('stay.msg', { in: dayLabel(stay.in, lang), out: dayLabel(stay.out, lang), nights: nightsText(nightsBetween(stay.in, stay.out), lang), guests: guestsText(guests, lang) })}
              buildMeta={() => ({ booking: { check_in: stay.in, check_out: stay.out, guests } })}
              messageLabel={t('stay.note')}
              submitLabel={t('stay.send')}
            />
          </>
        ) : (
          !clash && !blocking.length && <p className="rounded-2xl bg-sand px-4 py-3 text-sm text-muted">{t('stay.pickDates')}</p>
        )}
        <a href={waLink(s.agency.whatsapp, wa)} target="_blank" rel="noopener noreferrer" className="mt-3 inline-flex h-11 w-full items-center justify-center gap-2 rounded-2xl border border-[#25D366]/40 bg-[#25D366]/10 text-sm font-bold text-[#128C7E] hover:bg-[#25D366]/15">
          <WhatsAppIcon className="size-4" /> {t('stay.wa')}
        </a>
        <p className="mt-3 text-xs leading-relaxed text-muted">{t('stay.how')}</p>
      </div>

      <div className="mt-6 border-t border-line pt-5">
        <h3 className="mb-3 text-sm font-bold text-navy">{t('stay.rates')}</h3>
        <dl className="grid grid-cols-1 gap-2 text-sm sm:grid-cols-2">
          {r.night > 0 && <Rate label={t('stay.lowNight')} value={fmtPrice(r.night, lang)} />}
          {r.high_night ? <Rate label={t('stay.highNight', { from: dayMonth(r.high_from), to: dayMonth(r.high_to) })} value={fmtPrice(r.high_night, lang)} /> : null}
          <Rate label={t('stay.minStay')} value={r.high_night && r.high_min_nights && r.high_min_nights > r.min_nights ? t('stay.minStayHigh', { low: nightsText(r.min_nights, lang), high: nightsText(r.high_min_nights, lang) }) : nightsText(r.min_nights, lang)} />
          <Rate label={t('stay.capacity')} value={guestsText(r.guests, lang)} />
          {r.cleaning > 0 && <Rate label={t('stay.cleaning')} value={fmtPrice(r.cleaning, lang)} />}
          {r.caution > 0 && <Rate label={t('stay.caution')} value={fmtPrice(r.caution, lang)} />}
        </dl>
        <ul className="mt-3 space-y-1.5 text-xs text-muted">
          <li className="num">{t('stay.times', { in: r.check_in, out: r.check_out })}</li>
          {r.week_discount > 0 && <li>{t('stay.weekFrom', { pct: r.week_discount })}</li>}
          <li className="flex items-start gap-1.5">
            <IdCard className="mt-px size-3.5 shrink-0 text-gold-600" /> {t('stay.id')}
          </li>
          {r.license && <li className="num">{t('stay.license', { no: r.license })}</li>}
        </ul>
      </div>
    </section>
  )
}

function Rate({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3 rounded-xl bg-sand/60 px-3 py-2">
      <dt className="text-muted">{label}</dt>
      <dd className="num text-end font-semibold text-navy">{value}</dd>
    </div>
  )
}
