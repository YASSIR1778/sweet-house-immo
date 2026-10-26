import { AlertTriangle, BedDouble, ChevronLeft, ChevronRight, HandCoins, Inbox, LogIn, LogOut, Percent, Plus, Sun } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Link } from 'react-router'
import { useTable } from '@/shared/lib/data'
import { fmtDate, fmtNumber, localDate } from '@/shared/lib/format'
import { addDays, agencyCut, EARNING, nightsBetween, nightsText, occupancy, ownerPayout, seasonOf } from '@/shared/lib/seasonal'
import type { Booking, Lead } from '@/shared/lib/types'
import { Button, EmptyState, cn } from '@/shared/ui/base'
import { useQuickAdd } from '../dialogs'
import { useLookups } from '../hooks'
import { BOOKING_STATUS } from '../labels'
import { BookingLine } from '../seasonal'
import { Card, PageHeader, Stat } from '../ui'

const monthTitle = (m: string) => new Intl.DateTimeFormat('ar-MA-u-nu-latn', { month: 'long', year: 'numeric' }).format(new Date(Number(m.slice(0, 4)), Number(m.slice(5, 7)) - 1, 1))
const shiftMonth = (m: string, n: number) => {
  const d = new Date(Number(m.slice(0, 4)), Number(m.slice(5, 7)) - 1 + n, 1)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}
const WEEKDAY = ['ح', 'ن', 'ث', 'ر', 'خ', 'ج', 'س']

/** Summer rentals by the night: who is where, when, and what it brings. */
export function Seasonal() {
  const quick = useQuickAdd()
  const L = useLookups()
  const { data: bookings = [] } = useTable<Booking>('bookings')
  const { data: leads = [] } = useTable<Lead>('leads')
  const props = L.properties.filter((p) => p.seasonal)
  const today = localDate(new Date())
  const [month, setMonth] = useState(today.slice(0, 7))
  const first = `${month}-01`
  const next = `${shiftMonth(month, 1)}-01`
  const days = nightsBetween(first, next)
  const dayList = Array.from({ length: days }, (_, i) => addDays(first, i))

  const m = useMemo(() => {
    const ids = props.map((p) => p.id)
    const inMonth = bookings.filter((b) => EARNING.includes(b.status) && b.check_in >= first && b.check_in < next && ids.includes(b.property_id))
    const week = addDays(today, 7)
    return {
      occ: occupancy(bookings, ids, first, next),
      revenue: inMonth.reduce((s, b) => s + b.rent + b.cleaning, 0),
      commission: inMonth.reduce((s, b) => s + agencyCut(b), 0),
      requests: bookings.filter((b) => b.status === 'request').sort((a, b) => a.check_in.localeCompare(b.check_in)),
      webRequests: leads.filter((l) => l.kind === 'booking' && (l.status === 'new' || l.status === 'contacted')),
      arrivals: bookings.filter((b) => EARNING.includes(b.status) && b.check_in >= today && b.check_in <= week).sort((a, b) => a.check_in.localeCompare(b.check_in)),
      departures: bookings.filter((b) => EARNING.includes(b.status) && b.check_out >= today && b.check_out <= week).sort((a, b) => a.check_out.localeCompare(b.check_out)),
      toDeclare: bookings.filter((b) => (b.status === 'confirmed' || b.status === 'checked_in') && b.check_in <= today && !b.declared_at),
      owners: bookings.filter((b) => b.status === 'completed' && !b.owner_paid_at && b.rent > 0),
    }
  }, [bookings, leads, props, first, next, today])

  const open = (b: Booking) => quick('booking', b)

  return (
    <>
      <PageHeader
        title="الكراء الموسمي"
        subtitle="حجوزات الليالي والأسابيع في مرتيل والمضيق وكابو نيغرو: التقويم، الوصول والمغادرة، الضمانات، التصريح بالنزلاء وحصص الملاك"
        icon={<Sun className="size-6" />}
        actions={
          <Button variant="gold" icon={<Plus className="size-4" />} onClick={() => quick('booking', props[0] ? { property_id: props[0].id } : {})}>
            حجز جديد
          </Button>
        }
      />
      {props.length === 0 ? (
        <EmptyState icon={<Sun className="size-7" />} title="لا يوجد عقار موسمي بعد" text="افتح عقاراً للكراء وفعّل «يُكرى بالليلة» في بطاقة الكراء الموسمي، ثم حدّد أثمنة الليلة والموسم." />
      ) : (
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <Stat label={`نسبة الملء — ${monthTitle(month)}`} value={`${m.occ.rate}%`} hint={`${nightsText(m.occ.booked, 'ar')} من ${m.occ.available}`} icon={<Percent className="size-5" />} accent="#0891b2" />
            <Stat label="مداخيل الإقامات" value={fmtNumber(m.revenue)} hint="الإقامات التي تبدأ هذا الشهر" icon={<BedDouble className="size-5" />} accent="#1d4ed8" />
            <Stat label="عمولة الوكالة" value={fmtNumber(m.commission)} hint="درهم" icon={<HandCoins className="size-5" />} accent="#15803d" />
            <Stat label="طلبات تنتظر الرد" value={m.requests.length + m.webRequests.length} hint={`${m.webRequests.length} من الموقع`} icon={<Inbox className="size-5" />} accent={m.requests.length + m.webRequests.length ? '#b45309' : '#64748b'} />
          </div>

          <Card
            title={monthTitle(month)}
            className="mt-6"
            bodyClass="p-0"
            action={
              <div className="flex items-center gap-1">
                <button type="button" onClick={() => setMonth(shiftMonth(month, -1))} className="rounded-full p-2 text-muted hover:bg-sand" aria-label="الشهر السابق">
                  <ChevronRight className="size-4" />
                </button>
                <button type="button" onClick={() => setMonth(today.slice(0, 7))} className="rounded-full px-3 py-1 text-xs font-semibold text-teal hover:bg-sand">
                  اليوم
                </button>
                <button type="button" onClick={() => setMonth(shiftMonth(month, 1))} className="rounded-full p-2 text-muted hover:bg-sand" aria-label="الشهر التالي">
                  <ChevronLeft className="size-4" />
                </button>
              </div>
            }
          >
            <div className="overflow-x-auto">
              <div style={{ minWidth: 190 + days * 30 }}>
                <div className="flex border-b border-line bg-ivory text-[10px] text-muted">
                  <div className="sticky start-0 z-10 w-[190px] shrink-0 bg-ivory px-4 py-2 text-xs font-semibold">العقار</div>
                  <div className="flex flex-1">
                    {dayList.map((d) => {
                      const wd = new Date(`${d}T12:00:00`).getDay()
                      return (
                        <div key={d} className={cn('flex-1 py-1 text-center', (wd === 0 || wd === 6) && 'bg-sand', d === today && 'bg-gold/30 font-bold text-navy')}>
                          <div>{WEEKDAY[wd]}</div>
                          <div className="num text-[11px] font-semibold text-navy">{Number(d.slice(8))}</div>
                        </div>
                      )
                    })}
                  </div>
                </div>
                {props.map((p) => {
                  const r = seasonOf(p.season)
                  const stays = bookings.filter((b) => b.property_id === p.id && b.status !== 'cancelled' && b.check_in < next && b.check_out > first)
                  return (
                    <div key={p.id} className="flex border-b border-line last:border-0">
                      <Link to={`/admin/properties/${p.id}`} className="sticky start-0 z-10 w-[190px] shrink-0 border-e border-line bg-white px-4 py-2 hover:bg-ivory">
                        <div className="num text-xs font-bold text-gold-700">{p.ref}</div>
                        <div className="truncate text-xs text-navy">{p.title}</div>
                      </Link>
                      <div className="relative flex flex-1">
                        {dayList.map((d) => (
                          <button
                            key={d}
                            type="button"
                            title="حجز جديد من هذا اليوم"
                            onClick={() => quick('booking', { property_id: p.id, check_in: d, check_out: addDays(d, Math.max(1, r.min_nights)) })}
                            className={cn('h-14 flex-1 border-s border-line/60 hover:bg-teal/10', d === today && 'bg-gold/10')}
                          />
                        ))}
                        {stays.map((b) => {
                          const start = Math.max(0, nightsBetween(first, b.check_in))
                          const end = Math.min(days, nightsBetween(first, b.check_out))
                          if (end <= start) return null
                          const st = BOOKING_STATUS[b.status]
                          return (
                            <button
                              key={b.id}
                              type="button"
                              onClick={() => open(b)}
                              title={`${b.guest_name} · ${b.check_in} → ${b.check_out}`}
                              className={cn('absolute top-2 h-10 overflow-hidden rounded-lg px-2 text-start text-[11px] leading-tight font-semibold text-white shadow-soft hover:brightness-110', b.status === 'request' && 'border-2 border-dashed border-white/70 opacity-80')}
                              style={{ insetInlineStart: `calc(${(start / days) * 100}% + 2px)`, width: `calc(${((end - start) / days) * 100}% - 4px)`, background: st.color }}
                            >
                              <span className="block truncate">{b.guest_name}</span>
                              <span className="num block truncate font-normal text-white/80">{nightsBetween(b.check_in, b.check_out)} ل · {st.label}</span>
                            </button>
                          )
                        })}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
            <div className="flex flex-wrap gap-3 border-t border-line px-5 py-3 text-xs text-muted">
              {(['request', 'confirmed', 'checked_in', 'completed', 'blocked'] as const).map((k) => (
                <span key={k} className="inline-flex items-center gap-1.5">
                  <span className="size-2.5 rounded-sm" style={{ background: BOOKING_STATUS[k].color }} /> {BOOKING_STATUS[k].label}
                </span>
              ))}
              <span className="ms-auto">اضغط على يوم فارغ لتسجيل حجز يبدأ منه</span>
            </div>
          </Card>

          <div className="mt-6 grid grid-cols-1 gap-6 xl:grid-cols-2">
            {m.toDeclare.length > 0 && (
              <Card title={`للتصريح بالنزلاء (${m.toDeclare.length})`} icon={<AlertTriangle className="size-4 text-warning" />} bodyClass="p-0" className="border-warning/40 xl:col-span-2">
                <p className="px-5 pt-3 text-xs text-muted">القانون 80.14 (المادة 36): يُصرَّح بالوصول والليالي يومياً على منصة stdn.ma. افتح الحجز وسجّل «تم التصريح».</p>
                <ul className="divide-y divide-line">
                  {m.toDeclare.map((b) => (
                    <li key={b.id}>
                      <BookingLine b={b} onClick={() => open(b)} />
                    </li>
                  ))}
                </ul>
              </Card>
            )}
            <Card title="الوصول خلال 7 أيام" icon={<LogIn className="size-4" />} bodyClass="p-0">
              {m.arrivals.length === 0 ? (
                <p className="p-5 text-sm text-muted">لا وصول هذا الأسبوع.</p>
              ) : (
                <ul className="divide-y divide-line">
                  {m.arrivals.map((b) => (
                    <li key={b.id}>
                      <BookingLine b={b} onClick={() => open(b)} />
                    </li>
                  ))}
                </ul>
              )}
            </Card>
            <Card title="المغادرة خلال 7 أيام" icon={<LogOut className="size-4" />} bodyClass="p-0">
              {m.departures.length === 0 ? (
                <p className="p-5 text-sm text-muted">لا مغادرة هذا الأسبوع.</p>
              ) : (
                <ul className="divide-y divide-line">
                  {m.departures.map((b) => (
                    <li key={b.id}>
                      <BookingLine b={b} onClick={() => open(b)} />
                    </li>
                  ))}
                </ul>
              )}
            </Card>
            <Card title="طلبات الحجز" icon={<Inbox className="size-4" />} bodyClass="p-0">
              {m.requests.length + m.webRequests.length === 0 ? (
                <p className="p-5 text-sm text-muted">لا طلبات تنتظر.</p>
              ) : (
                <ul className="divide-y divide-line">
                  {m.webRequests.map((l) => (
                    <li key={l.id}>
                      <Link to={`/admin/leads?open=${l.id}`} className="flex items-center gap-3 px-5 py-2.5 text-sm hover:bg-ivory">
                        <span className="num text-xs font-bold text-gold-700">{l.property_ref ?? '—'}</span>
                        <span className="min-w-0 flex-1 truncate text-navy">{l.name}</span>
                        <span className="text-xs text-teal">من الموقع</span>
                      </Link>
                    </li>
                  ))}
                  {m.requests.map((b) => (
                    <li key={b.id}>
                      <BookingLine b={b} onClick={() => open(b)} />
                    </li>
                  ))}
                </ul>
              )}
            </Card>
            <Card title="حصص الملاك للتحويل" icon={<HandCoins className="size-4" />} bodyClass="p-0">
              {m.owners.length === 0 ? (
                <p className="p-5 text-sm text-muted">كل حصص الملاك محولة.</p>
              ) : (
                <ul className="divide-y divide-line">
                  {m.owners.map((b) => (
                    <li key={b.id}>
                      <button type="button" onClick={() => open(b)} className="flex w-full items-center gap-3 px-5 py-2.5 text-start text-sm hover:bg-ivory">
                        <span className="num text-xs font-bold text-gold-700">{L.property(b.property_id)?.ref}</span>
                        <span className="min-w-0 flex-1 truncate text-navy">
                          {L.client(L.property(b.property_id)?.owner_client_id)?.full_name ?? 'المالك'} · {fmtDate(b.check_in, 'ar', { day: 'numeric', month: 'short' })}
                        </span>
                        <b className="num text-warning">{fmtNumber(ownerPayout(b))}</b>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          </div>
        </>
      )}
    </>
  )
}
