import { AlarmClock, AlertTriangle, Building, Key, CalendarPlus, Check, ClipboardPlus, Copy, FolderLock, HandCoins, Inbox, LogIn, LogOut, PhoneIncoming, PhoneOutgoing, Printer, Search, Sun, UserPlus, UserX } from 'lucide-react'
import { useMemo, useState, type ReactNode } from 'react'
import { Link, useNavigate } from 'react-router'
import { toast } from 'sonner'
import { SITE_URL } from '@/shared/lib/config'
import { useTable } from '@/shared/lib/data'
import { addDays, fmtDate, fmtNumber, fmtPrice, fmtRelative, fmtTime, localDate, nowIso, sameDay, waLink } from '@/shared/lib/format'
import { mandateState } from '@/shared/lib/owners'
import { bookingRest, movements, seasonOf } from '@/shared/lib/seasonal'
import type { Appointment, Booking, CallLog, Lead, Lease, Mandate, Offer, Property, RentPayment, Task } from '@/shared/lib/types'
import { cn } from '@/shared/ui/base'
import { WhatsAppIcon } from '@/shared/ui/icons'
import { useQuickAdd } from '../dialogs'
import { firstName, greeting, useLookups, useMe, useNames, useSave } from '../hooks'
import { APPT_KIND, APPT_STATUS, LEAD_KIND, PRIORITY, PROPERTY_STATUS, PURPOSE, daysAr } from '../labels'
import { printVisitVoucher } from '../print'
import { leadReply, propertyMessage, visitReminder } from '../templates'
import { Card, MiniEmpty, PageHeader, PhoneLinks, Pill, SearchBox } from '../ui'
import { useRentReminder } from './Rentals'
import { PushHint } from '../notifications'
import { leaseSchedule } from '@/shared/lib/rentals'

function QuickAction({ icon, label, onClick, tone = 'navy' }: { icon: ReactNode; label: string; onClick: () => void; tone?: 'navy' | 'gold' | 'teal' }) {
  const t = { navy: 'bg-navy text-white', gold: 'bg-gold text-navy-950', teal: 'bg-teal text-white' }[tone]
  return (
    <button onClick={onClick} className="card group flex items-center gap-3 p-3.5 text-start transition hover:-translate-y-0.5 hover:shadow-card">
      <span className={cn('flex size-10 shrink-0 items-center justify-center rounded-xl transition group-hover:scale-105', t)}>{icon}</span>
      <span className="text-sm font-bold text-navy">{label}</span>
    </button>
  )
}

export function Desk() {
  const me = useMe()
  const nav = useNavigate()
  const quick = useQuickAdd()
  const L = useLookups()
  const { s, hoodName } = useNames()
  const { data: appts = [] } = useTable<Appointment>('appointments')
  const { data: leads = [] } = useTable<Lead>('leads', { refetchInterval: 60_000 })
  const { data: tasks = [] } = useTable<Task>('tasks')
  const { data: calls = [] } = useTable<CallLog>('calls')
  const { data: mandates = [] } = useTable<Mandate>('mandates')
  const { data: offers = [] } = useTable<Offer>('offers')
  const { data: leases = [] } = useTable<Lease>('leases')
  const { data: rents = [] } = useTable<RentPayment>('rent_payments')
  const { data: bookings = [] } = useTable<Booking>('bookings')
  const remindRent = useRentReminder()
  const lateRents = leases
    .filter((l) => l.managed && l.status === 'active')
    .map((l) => ({ l, row: leaseSchedule(l, rents).filter((r) => r.late > 0).pop() }))
    .filter((x): x is { l: Lease; row: NonNullable<typeof x.row> } => Boolean(x.row))
    .sort((a, b) => b.row.late - a.row.late)
  const openOffers = offers.filter((o) => o.status === 'pending' || o.status === 'countered').sort((a, b) => a.updated_at.localeCompare(b.updated_at))
  const mandatesDue = mandates
    .map((m) => ({ m, ...mandateState(m) }))
    .filter((x) => x.state === 'expiring' || x.state === 'expired')
    .sort((a, b) => (a.daysLeft ?? 0) - (b.daysLeft ?? 0))
  const saveAppt = useSave<Appointment>('appointments', 'appointment', (a) => a.title)
  const saveLead = useSave<Lead>('leads', 'lead', (l) => l.name)
  const saveTask = useSave<Task>('tasks', 'task', (t) => t.title)
  const [find, setFind] = useState('')

  const now = new Date()
  const today = useMemo(() => appts.filter((a) => sameDay(a.starts_at, now) && a.status !== 'cancelled').sort((a, b) => a.starts_at.localeCompare(b.starts_at)), [appts]) // eslint-disable-line react-hooks/exhaustive-deps
  const tomorrow = useMemo(() => appts.filter((a) => sameDay(a.starts_at, addDays(now, 1)) && a.status === 'scheduled').sort((a, b) => a.starts_at.localeCompare(b.starts_at)), [appts]) // eslint-disable-line react-hooks/exhaustive-deps
  const inbox = useMemo(() => leads.filter((l) => l.status === 'new').sort((a, b) => a.created_at.localeCompare(b.created_at)), [leads])
  const myTasks = useMemo(
    () =>
      tasks
        .filter((t) => t.status === 'open' && t.assigned_to === me.id)
        .sort((a, b) => (a.due_at ?? '9999').localeCompare(b.due_at ?? '9999')),
    [tasks, me.id],
  )
  const todayCalls = useMemo(() => calls.filter((c) => sameDay(c.created_at, now)).sort((a, b) => b.created_at.localeCompare(a.created_at)), [calls]) // eslint-disable-line react-hooks/exhaustive-deps
  const overdue = myTasks.filter((t) => t.due_at && new Date(t.due_at) < now).length
  // summer stays: who arrives and leaves today and tomorrow, and the arrivals still to declare
  const stays = useMemo(() => {
    const d0 = localDate(new Date())
    const d1 = localDate(addDays(new Date(), 1))
    const t = movements(bookings, d0)
    const m = movements(bookings, d1)
    const lines = [
      ...t.arrivals.map((b) => ({ b, out: false, today: true })),
      ...t.departures.map((b) => ({ b, out: true, today: true })),
      ...m.arrivals.map((b) => ({ b, out: false, today: false })),
      ...m.departures.map((b) => ({ b, out: true, today: false })),
    ]
    const toDeclare = bookings.filter((b) => (b.status === 'confirmed' || b.status === 'checked_in') && b.check_in <= d0 && !b.declared_at).length
    return { lines, toDeclare }
  }, [bookings])

  const found = useMemo(() => {
    const q = find.trim().toLowerCase()
    if (!q) return []
    return L.properties.filter((p) => `${p.ref} ${p.title} ${hoodName(p.neighborhood)} ${p.price}`.toLowerCase().includes(q)).slice(0, 5)
  }, [find, L.properties, hoodName])

  const setStatus = (a: Appointment, status: Appointment['status']) => saveAppt.save({ ...a, status }, { action: 'status', meta: { status }, message: `الموعد: ${APPT_STATUS[status].label}` })
  const remind = (a: Appointment) => {
    const c = L.client(a.client_id)
    const p = L.property(a.property_id)
    const phone = c?.whatsapp || c?.phone
    if (!phone) return toast.error('لا يوجد رقم هاتف لهذا العميل')
    window.open(waLink(phone, visitReminder(a, p, s, c?.lang ?? 'ar', c?.full_name, p ? hoodName(p.neighborhood) : '')), '_blank', 'noopener')
  }
  const shareProperty = (p: Property) => window.open(`https://wa.me/?text=${encodeURIComponent(propertyMessage(p, s, 'ar'))}`, '_blank', 'noopener')
  const copyLink = async (p: Property) => {
    try {
      await navigator.clipboard.writeText(`${SITE_URL}/biens/${p.ref}`)
      toast.success('تم نسخ رابط العقار')
    } catch {
      toast.error('تعذر النسخ')
    }
  }

  return (
    <>
      <PageHeader title={`${greeting()}، ${firstName(me.name)} ☕`} subtitle={`${fmtDate(now.toISOString(), 'ar', { weekday: 'long', day: 'numeric', month: 'long' })} — ${today.length} موعد اليوم · ${inbox.length} طلب جديد${overdue ? ` · ${overdue} مهمة متأخرة` : ''}`} />

      <PushHint />

      <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        <QuickAction icon={<PhoneIncoming className="size-5" />} label="تسجيل مكالمة" onClick={() => quick('call')} tone="gold" />
        <QuickAction icon={<CalendarPlus className="size-5" />} label="موعد / زيارة" onClick={() => quick('appointment')} tone="teal" />
        <QuickAction icon={<Inbox className="size-5" />} label="طلب جديد" onClick={() => quick('lead')} />
        <QuickAction icon={<UserPlus className="size-5" />} label="عميل جديد" onClick={() => quick('client')} />
        <QuickAction icon={<ClipboardPlus className="size-5" />} label="مهمة" onClick={() => quick('task')} />
        <QuickAction icon={<Building className="size-5" />} label="عقار جديد" onClick={() => nav('/admin/properties/new')} />
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        <div className="space-y-6 xl:col-span-2">
          <Card title="مواعيد اليوم" icon={<AlarmClock className="size-4" />} action={<Link to="/admin/agenda" className="text-xs font-semibold text-teal hover:underline">الأجندة الكاملة</Link>} bodyClass="p-0">
            {today.length === 0 ? (
              <MiniEmpty text="لا توجد مواعيد اليوم." action={<button onClick={() => quick('appointment')} className="text-sm font-semibold text-teal hover:underline">+ إضافة موعد</button>} />
            ) : (
              <ol className="divide-y divide-line">
                {today.map((a) => {
                  const p = L.property(a.property_id)
                  const c = L.client(a.client_id)
                  const past = new Date(a.ends_at) < now
                  return (
                    <li key={a.id} className={cn('flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center', a.status === 'done' && 'bg-success/[0.03]')}>
                      <div className="flex items-center gap-3 sm:w-28 sm:flex-col sm:items-start sm:gap-1">
                        <span className="num text-xl font-extrabold text-navy">{fmtTime(a.starts_at)}</span>
                        <Pill color={APPT_KIND[a.kind].color}>{APPT_KIND[a.kind].label}</Pill>
                      </div>
                      <button onClick={() => quick('appointment', a)} className="min-w-0 flex-1 text-start">
                        <div className="truncate font-bold text-navy">{a.title}</div>
                        <div className="mt-0.5 truncate text-sm text-muted">
                          {p ? `${p.ref} · ${hoodName(p.neighborhood)}` : 'بدون عقار'} · مع {L.staffName(a.assigned_to)}
                        </div>
                        {a.notes && <div className="mt-1 truncate text-xs text-subtle">📝 {a.notes}</div>}
                      </button>
                      <div className="flex flex-wrap items-center gap-1.5">
                        {c && <PhoneLinks phone={c.whatsapp || c.phone} showNumber={false} waText={visitReminder(a, p, s, c.lang, c.full_name, p ? hoodName(p.neighborhood) : '')} />}
                        {a.kind === 'visit' && (
                          <button onClick={() => printVisitVoucher(a, p, c, s, hoodName, L.staffName(a.assigned_to))} className="inline-flex size-8 items-center justify-center rounded-full bg-navy/5 text-navy hover:bg-navy hover:text-white" title="طباعة ورقة الزيارة">
                            <Printer className="size-3.5" />
                          </button>
                        )}
                        {a.status === 'scheduled' ? (
                          <>
                            <button onClick={() => setStatus(a, 'done')} className="inline-flex h-8 items-center gap-1 rounded-full bg-success/10 px-3 text-xs font-bold text-success hover:bg-success hover:text-white">
                              <Check className="size-3.5" /> تم
                            </button>
                            {past && (
                              <button onClick={() => setStatus(a, 'noshow')} className="inline-flex h-8 items-center gap-1 rounded-full bg-danger/10 px-3 text-xs font-bold text-danger hover:bg-danger hover:text-white">
                                <UserX className="size-3.5" /> لم يحضر
                              </button>
                            )}
                          </>
                        ) : (
                          <Pill color={APPT_STATUS[a.status].color}>{APPT_STATUS[a.status].label}</Pill>
                        )}
                      </div>
                    </li>
                  )
                })}
              </ol>
            )}
          </Card>

          <Card title="طلبات جديدة تنتظر الرد" icon={<Inbox className="size-4" />} action={<Link to="/admin/leads" className="text-xs font-semibold text-teal hover:underline">مسار الطلبات</Link>} bodyClass="p-0">
            {inbox.length === 0 ? (
              <MiniEmpty text="لا توجد طلبات جديدة. أحسنت! 👏" />
            ) : (
              <ul className="divide-y divide-line">
                {inbox.slice(0, 8).map((l) => {
                  const p = L.property(l.property_id)
                  const late = Date.now() - new Date(l.created_at).getTime() > 24 * 36e5
                  return (
                    <li key={l.id} className="flex flex-col gap-2 px-5 py-4 sm:flex-row sm:items-center">
                      <Link to={`/admin/leads?open=${l.id}`} className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-bold text-navy">{l.name}</span>
                          <Pill color={LEAD_KIND[l.kind].color}>{LEAD_KIND[l.kind].label}</Pill>
                          {l.property_ref && <span className="num text-xs font-semibold text-gold-700">{l.property_ref}</span>}
                          <span className={cn('text-xs', late ? 'font-bold text-danger' : 'text-subtle')}>{fmtRelative(l.created_at)}</span>
                        </div>
                        {l.message && <p className="mt-1 line-clamp-1 text-sm text-muted">{l.message}</p>}
                      </Link>
                      <div className="flex items-center gap-1.5">
                        <PhoneLinks phone={l.phone} showNumber={false} waText={leadReply(l, p, s, me.name)} />
                        <button
                          onClick={() => saveLead.save({ ...l, status: 'contacted', assigned_to: l.assigned_to ?? me.id, updated_at: nowIso() }, { action: 'status', meta: { status: 'contacted' }, message: 'تم وضع الطلب في «تم الاتصال»' })}
                          className="inline-flex h-8 items-center gap-1 rounded-full bg-navy/5 px-3 text-xs font-bold text-navy hover:bg-navy hover:text-white"
                        >
                          <Check className="size-3.5" /> تم الاتصال
                        </button>
                      </div>
                    </li>
                  )
                })}
              </ul>
            )}
          </Card>

          {tomorrow.length > 0 && (
            <Card title={`مواعيد الغد (${tomorrow.length}) — أرسل التذكيرات`} icon={<WhatsAppIcon className="size-4" />} bodyClass="p-0">
              <ul className="divide-y divide-line">
                {tomorrow.map((a) => {
                  const c = L.client(a.client_id)
                  return (
                    <li key={a.id} className="flex items-center gap-3 px-5 py-3">
                      <span className="num w-12 text-sm font-bold text-navy">{fmtTime(a.starts_at)}</span>
                      <span className="min-w-0 flex-1 truncate text-sm text-text">{a.title}</span>
                      {c ? (
                        <button onClick={() => remind(a)} className="inline-flex h-8 items-center gap-1.5 rounded-full bg-[#25D366]/10 px-3 text-xs font-bold text-[#128C7E] hover:bg-[#25D366] hover:text-white">
                          <WhatsAppIcon className="size-3.5" /> تذكير
                        </button>
                      ) : (
                        <span className="text-xs text-subtle">بدون عميل</span>
                      )}
                    </li>
                  )
                })}
              </ul>
            </Card>
          )}
        </div>

        <div className="space-y-6">
          <Card title="بحث سريع عن عقار" icon={<Search className="size-4" />}>
            <SearchBox value={find} onChange={setFind} placeholder="المرجع، الحي، الثمن…" />
            <p className="mt-2 text-xs text-subtle">مفيد أثناء المكالمة: ابحث وأرسل الرابط للعميل مباشرة.</p>
            {found.length > 0 && (
              <ul className="mt-3 space-y-2">
                {found.map((p) => (
                  <li key={p.id} className="rounded-xl border border-line p-2.5">
                    <div className="flex items-center gap-2.5">
                      {p.images[0] ? <img src={p.images[0]} alt="" className="size-12 shrink-0 rounded-lg object-cover" /> : <span className="size-12 shrink-0 rounded-lg bg-sand" />}
                      <Link to={`/admin/properties/${p.id}`} className="min-w-0 flex-1">
                        <div className="num truncate text-sm font-bold text-navy">
                          {p.ref} · {fmtPrice(p.price, 'ar', p.purpose === 'rent')}
                        </div>
                        <div className="truncate text-xs text-muted">{p.title}</div>
                        <div className="mt-1 flex gap-1">
                          <Pill color={PURPOSE[p.purpose].color}>{PURPOSE[p.purpose].label}</Pill>
                          <Pill color={PROPERTY_STATUS[p.status].color}>{PROPERTY_STATUS[p.status].label}</Pill>
                        </div>
                      </Link>
                    </div>
                    <div className="mt-2 flex gap-1.5">
                      <button onClick={() => shareProperty(p)} className="inline-flex h-8 flex-1 items-center justify-center gap-1.5 rounded-lg bg-[#25D366]/10 text-xs font-bold text-[#128C7E] hover:bg-[#25D366] hover:text-white">
                        <WhatsAppIcon className="size-3.5" /> إرسال
                      </button>
                      <button onClick={() => void copyLink(p)} className="inline-flex h-8 flex-1 items-center justify-center gap-1.5 rounded-lg bg-navy/5 text-xs font-bold text-navy hover:bg-navy hover:text-white">
                        <Copy className="size-3.5" /> نسخ الرابط
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
            {find && found.length === 0 && <p className="mt-3 text-center text-sm text-muted">لا توجد نتائج</p>}
          </Card>

          {(stays.lines.length > 0 || stays.toDeclare > 0) && (
            <Card title="الكراء الموسمي: اليوم وغداً" icon={<Sun className="size-4" />} action={<Link to="/admin/seasonal" className="text-xs font-semibold text-teal hover:underline">التقويم</Link>} bodyClass="p-0">
              {stays.toDeclare > 0 && (
                <Link to="/admin/seasonal" className="flex items-center gap-2 bg-warning/10 px-5 py-2.5 text-xs font-semibold text-warning hover:bg-warning/15">
                  <AlertTriangle className="size-4 shrink-0" /> {stays.toDeclare} وصول لم يُصرَّح به بعد على منصة stdn.ma
                </Link>
              )}
              <ul className="divide-y divide-line">
                {stays.lines.map(({ b, out, today: now0 }) => {
                  const p = L.property(b.property_id)
                  const r = seasonOf(p?.season)
                  return (
                    <li key={`${b.id}-${out ? 'out' : 'in'}`}>
                      <button type="button" onClick={() => quick('booking', b)} className="flex w-full items-center gap-3 px-5 py-3 text-start hover:bg-ivory">
                        <span className={cn('inline-flex size-9 shrink-0 items-center justify-center rounded-xl', out ? 'bg-navy/5 text-navy' : 'bg-success/10 text-success')}>{out ? <LogOut className="size-4" /> : <LogIn className="size-4" />}</span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-semibold text-navy">
                            <span className="num text-gold-700">{p?.ref ?? '—'}</span> {b.guest_name}
                          </span>
                          <span className="text-xs text-muted">
                            {out ? 'مغادرة' : 'وصول'} {now0 ? 'اليوم' : 'غداً'} · <span className="num">{out ? `قبل ${r.check_out}` : `من ${r.check_in}`}</span>
                            {!out && bookingRest(b) > 0 && (
                              <>
                                {' '}· الباقي <span className="num">{fmtNumber(bookingRest(b))}</span> د.م.
                              </>
                            )}
                            {out && b.caution_status === 'held' && ' · إرجاع الضمانة بعد المعاينة'}
                          </span>
                        </span>
                      </button>
                    </li>
                  )
                })}
              </ul>
            </Card>
          )}

          {lateRents.length > 0 && (
            <Card title={`أكرية متأخرة (${lateRents.length})`} icon={<Key className="size-4" />} action={<Link to="/admin/rentals?tab=dues" className="text-xs font-semibold text-teal hover:underline">المستحقات</Link>} bodyClass="p-0">
              <ul className="divide-y divide-line">
                {lateRents.slice(0, 5).map(({ l, row }) => {
                  const link = remindRent(l, row.period, row.due, row.amount - row.paid, true)
                  return (
                    <li key={l.id} className="flex items-center gap-3 px-5 py-3">
                      <Link to={`/admin/rentals/${l.id}`} className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-semibold text-navy">
                          <span className="num text-gold-700">{L.property(l.property_id)?.ref ?? '—'}</span> {L.client(l.tenant_client_id)?.full_name ?? ''}
                        </span>
                        <span className="text-xs text-muted">
                          <span className="num">{fmtNumber(row.amount - row.paid)}</span> د.م. · {row.late} يوماً
                        </span>
                      </Link>
                      {link && (
                        <a href={link} target="_blank" rel="noopener noreferrer" className="inline-flex size-9 items-center justify-center rounded-xl bg-[#25D366]/10 text-[#128C7E] hover:bg-[#25D366]/20" aria-label="تذكير">
                          <WhatsAppIcon className="size-4" />
                        </a>
                      )}
                    </li>
                  )
                })}
              </ul>
            </Card>
          )}

          {openOffers.length > 0 && (
            <Card title={`عروض تنتظر الرد (${openOffers.length})`} icon={<HandCoins className="size-4" />} action={<Link to="/admin/offers" className="text-xs font-semibold text-teal hover:underline">كل العروض</Link>} bodyClass="p-0">
              <ul className="divide-y divide-line">
                {openOffers.slice(0, 5).map((o) => {
                  const p = L.property(o.property_id)
                  return (
                    <li key={o.id}>
                      <button type="button" onClick={() => quick('offer', o)} className="flex w-full items-center gap-3 px-5 py-3 text-start hover:bg-ivory">
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-semibold text-navy">
                            <span className="num text-gold-700">{p?.ref ?? '—'}</span> {L.client(o.client_id)?.full_name ?? ''}
                          </span>
                          <span className="num text-xs text-muted">{fmtPrice(o.amount, 'ar', p?.purpose === 'rent')}</span>
                        </span>
                        <span className={cn('text-xs font-semibold', o.status === 'countered' ? 'text-warning' : 'text-info')}>{o.status === 'countered' ? 'عرض مضاد' : 'قيد الدراسة'}</span>
                      </button>
                    </li>
                  )
                })}
              </ul>
            </Card>
          )}

          {mandatesDue.length > 0 && (
            <Card title={`تفويضات تحتاج تجديداً (${mandatesDue.length})`} icon={<FolderLock className="size-4" />} action={<Link to="/admin/owners" className="text-xs font-semibold text-teal hover:underline">ملفات الملاك</Link>} bodyClass="p-0">
              <ul className="divide-y divide-line">
                {mandatesDue.slice(0, 6).map(({ m, state, daysLeft }) => {
                  const p = L.property(m.property_id)
                  const c = L.client(m.owner_client_id ?? p?.owner_client_id)
                  return (
                    <li key={m.id}>
                      <Link to={c ? `/admin/owners?open=${c.id}` : `/admin/properties/${m.property_id}`} className="flex items-center gap-3 px-5 py-3 hover:bg-ivory">
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-semibold text-navy">
                            <span className="num text-gold-700">{p?.ref ?? '—'}</span> {c?.full_name ?? ''}
                          </span>
                          <span className={cn('text-xs font-semibold', state === 'expired' ? 'text-danger' : 'text-warning')}>
                            {state === 'expired' ? `انتهى منذ ${daysAr(daysLeft ?? 0)}` : daysLeft === 0 ? 'ينتهي اليوم' : `باقي ${daysAr(daysLeft ?? 0)}`}
                          </span>
                        </span>
                      </Link>
                    </li>
                  )
                })}
              </ul>
            </Card>
          )}

          <Card title="مهامي" icon={<ClipboardPlus className="size-4" />} action={<button onClick={() => quick('task')} className="text-xs font-semibold text-teal hover:underline">+ مهمة</button>} bodyClass="p-0">
            {myTasks.length === 0 ? (
              <MiniEmpty text="لا توجد مهام مفتوحة." />
            ) : (
              <ul className="divide-y divide-line">
                {myTasks.slice(0, 8).map((t) => {
                  const late = t.due_at && new Date(t.due_at) < now
                  return (
                    <li key={t.id} className="flex items-start gap-3 px-5 py-3">
                      <button
                        onClick={() => saveTask.save({ ...t, status: 'done', completed_at: nowIso() }, { action: 'status', meta: { status: 'done' }, message: 'أحسنت! تم إنجاز المهمة ✓' })}
                        className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-md border-2 border-line-2 text-transparent transition hover:border-success hover:text-success"
                        aria-label="إنجاز"
                      >
                        <Check className="size-3.5" strokeWidth={3} />
                      </button>
                      <button onClick={() => quick('task', t)} className="min-w-0 flex-1 text-start">
                        <div className="text-sm font-semibold text-navy">{t.title}</div>
                        <div className="mt-0.5 flex flex-wrap items-center gap-2 text-xs">
                          {t.due_at && <span className={late ? 'font-bold text-danger' : 'text-muted'}>{late ? 'متأخرة · ' : ''}{fmtDate(t.due_at, 'ar', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</span>}
                          {t.priority === 'high' && <Pill color={PRIORITY.high.color}>{PRIORITY.high.label}</Pill>}
                        </div>
                      </button>
                    </li>
                  )
                })}
              </ul>
            )}
          </Card>

          <Card title={`مكالمات اليوم (${todayCalls.length})`} icon={<PhoneIncoming className="size-4" />} action={<button onClick={() => quick('call')} className="text-xs font-semibold text-teal hover:underline">+ مكالمة</button>} bodyClass="p-0">
            {todayCalls.length === 0 ? (
              <MiniEmpty text="لم تُسجَّل مكالمات اليوم." />
            ) : (
              <ul className="divide-y divide-line">
                {todayCalls.slice(0, 6).map((c) => (
                  <li key={c.id}>
                    <button onClick={() => quick('call', c)} className="flex w-full items-center gap-3 px-5 py-3 text-start hover:bg-ivory">
                      {c.direction === 'in' ? <PhoneIncoming className="size-4 shrink-0 text-teal" /> : <PhoneOutgoing className="size-4 shrink-0 text-gold-600" />}
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-semibold text-navy">{c.caller_name}</span>
                        <span className="block truncate text-xs text-muted">{c.subject}</span>
                      </span>
                      <span className="num text-xs text-subtle">{fmtTime(c.created_at)}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      </div>
    </>
  )
}
