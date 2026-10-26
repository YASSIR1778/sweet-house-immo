import { Building2, CalendarCheck, Clock, Eye, HandCoins, Inbox, ListTodo, PhoneCall, Sparkles } from 'lucide-react'
import { useMemo } from 'react'
import { Link } from 'react-router'
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { useTable } from '@/shared/lib/data'
import { addDays, fmtDate, fmtNumber, fmtPrice, fmtRelative, fmtTime, sameDay, startOfDay, startOfWeek } from '@/shared/lib/format'
import type { Activity, Appointment, CallLog, Deal, Lead, Property, PropertyType, Task } from '@/shared/lib/types'
import { Button } from '@/shared/ui/base'
import { useQuickAdd } from '../dialogs'
import { firstName, greeting, useCan, useLookups, useMe, useNames } from '../hooks'
import { ACTION, APPT_KIND, ENTITY, LEAD_KIND, LEAD_STATUS, LEAD_STATUS_ORDER, SOURCE } from '../labels'
import { isDone } from '@/shared/lib/billing'
import { Avatar, BarRow, Card, MiniEmpty, PageHeader, Pill, Stat } from '../ui'

const MONTHS = (d: Date) => new Intl.DateTimeFormat('ar-MA-u-nu-latn', { month: 'short' }).format(d)

function pct(cur: number, prev: number): number | null {
  if (!prev) return cur ? 100 : null
  return Math.round(((cur - prev) / prev) * 100)
}

export function Dashboard() {
  const me = useMe()
  const can = useCan()
  const deals$ = can('deals')
  const activity$ = can('activity')
  const quick = useQuickAdd()
  const L = useLookups()
  const { hoodName, typeName } = useNames()
  const { data: properties = [] } = useTable<Property>('properties')
  const { data: leads = [] } = useTable<Lead>('leads', { refetchInterval: 60_000 })
  const { data: appts = [] } = useTable<Appointment>('appointments')
  const { data: deals = [] } = useTable<Deal>('deals')
  const { data: tasks = [] } = useTable<Task>('tasks')
  const { data: calls = [] } = useTable<CallLog>('calls')
  const { data: activity = [] } = useTable<Activity>('activity')

  const m = useMemo(() => {
    const now = new Date()
    const today = startOfDay(now)
    const wk = startOfWeek(now)
    const wkEnd = addDays(wk, 7)
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)
    const prevMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1)
    const yearStart = new Date(now.getFullYear(), 0, 1)
    const d7 = addDays(today, -7)
    const d14 = addDays(today, -14)
    const d30 = addDays(today, -30)
    const d90 = addDays(today, -90)
    const inRange = (iso: string, a: Date, b?: Date) => {
      const t = new Date(iso).getTime()
      return t >= a.getTime() && (!b || t < b.getTime())
    }

    const live = properties.filter((p) => p.published && p.status === 'available')
    const drafts = properties.filter((p) => p.status === 'draft' || (!p.published && p.status === 'available'))
    const leads7 = leads.filter((l) => inRange(l.created_at, d7)).length
    const leadsPrev7 = leads.filter((l) => inRange(l.created_at, d14, d7)).length
    const waiting = leads.filter((l) => l.status === 'new').sort((a, b) => a.created_at.localeCompare(b.created_at))
    const weekVisits = appts.filter((a) => a.kind === 'visit' && a.status !== 'cancelled' && inRange(a.starts_at, wk, wkEnd))
    // only deals that are done count as revenue (not those in progress or cancelled)
    const closedDeals = deals.filter(isDone)
    const monthComm = closedDeals.filter((d) => inRange(d.closed_at, monthStart)).reduce((s, d) => s + d.commission, 0)
    const prevMonthComm = closedDeals.filter((d) => inRange(d.closed_at, prevMonthStart, monthStart)).reduce((s, d) => s + d.commission, 0)
    const yearDeals = closedDeals.filter((d) => inRange(d.closed_at, yearStart))
    const yearComm = yearDeals.reduce((s, d) => s + d.commission, 0)

    // 12 months of commissions, oldest first
    const chart = Array.from({ length: 12 }, (_, i) => {
      const start = new Date(now.getFullYear(), now.getMonth() - 11 + i, 1)
      const end = new Date(now.getFullYear(), now.getMonth() - 10 + i, 1)
      const ds = closedDeals.filter((d) => inRange(d.closed_at, start, end))
      return {
        label: MONTHS(start),
        sale: ds.filter((d) => d.kind === 'sale').reduce((s, d) => s + d.commission, 0),
        rent: ds.filter((d) => d.kind === 'rent').reduce((s, d) => s + d.commission, 0),
      }
    })

    const funnel = LEAD_STATUS_ORDER.map((st) => ({ st, n: leads.filter((l) => l.status === st).length }))
    const closed = leads.filter((l) => l.status === 'won' || l.status === 'lost')
    const conversion = closed.length ? Math.round((leads.filter((l) => l.status === 'won').length / closed.length) * 100) : null

    const srcCounts = new Map<string, number>()
    for (const l of leads.filter((x) => inRange(x.created_at, d90))) srcCounts.set(l.source, (srcCounts.get(l.source) ?? 0) + 1)
    const sources = [...srcCounts.entries()].sort((a, b) => b[1] - a[1])

    const todayAppts = appts.filter((a) => sameDay(a.starts_at, now) && a.status !== 'cancelled').sort((a, b) => a.starts_at.localeCompare(b.starts_at))
    const topViewed = live.slice().sort((a, b) => b.views - a.views).slice(0, 5)

    const types = new Map<PropertyType, { sale: number; rent: number }>()
    for (const p of live) {
      const t = types.get(p.type) ?? { sale: 0, rent: 0 }
      t[p.purpose]++
      types.set(p.type, t)
    }
    const inventory = [...types.entries()].sort((a, b) => b[1].sale + b[1].rent - (a[1].sale + a[1].rent))

    const team = L.activeStaff.map((s) => ({
      s,
      calls: calls.filter((c) => c.logged_by === s.id && inRange(c.created_at, d30)).length,
      visits: appts.filter((a) => a.assigned_to === s.id && a.kind === 'visit' && a.status === 'done' && inRange(a.starts_at, d30)).length,
      leads: leads.filter((l) => l.assigned_to === s.id && inRange(l.updated_at, d30)).length,
      won: leads.filter((l) => l.assigned_to === s.id && l.status === 'won' && inRange(l.updated_at, d30)).length,
      tasks: tasks.filter((t) => t.assigned_to === s.id && t.status === 'done' && t.completed_at && inRange(t.completed_at, d30)).length,
      overdue: tasks.filter((t) => t.assigned_to === s.id && t.status === 'open' && t.due_at && new Date(t.due_at) < now).length,
    }))

    return { live, drafts, leads7, leadsPrev7, waiting, weekVisits, monthComm, prevMonthComm, yearComm, yearDeals, chart, funnel, conversion, sources, todayAppts, topViewed, inventory, team }
  }, [properties, leads, appts, deals, tasks, calls, L.activeStaff])

  const maxFunnel = Math.max(1, ...m.funnel.map((f) => f.n))
  const maxSource = Math.max(1, ...m.sources.map((x) => x[1]))
  const now = new Date()

  return (
    <>
      <PageHeader
        title={`${greeting()}، ${firstName(me.name)}`}
        subtitle={fmtDate(now.toISOString(), 'ar', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
        actions={
          <>
            {deals$ && (
              <Button variant="outline" onClick={() => quick('deal')} icon={<HandCoins className="size-4" />}>
                تسجيل صفقة
              </Button>
            )}
            <Button variant="gold" onClick={() => quick('appointment')} icon={<CalendarCheck className="size-4" />}>
              موعد جديد
            </Button>
          </>
        }
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="عقارات منشورة" value={m.live.length} icon={<Building2 className="size-5" />} hint={`${m.live.filter((p) => p.purpose === 'sale').length} للبيع · ${m.live.filter((p) => p.purpose === 'rent').length} للكراء${m.drafts.length ? ` · ${m.drafts.length} غير منشور` : ''}`} to="/admin/properties" />
        <Stat label="طلبات آخر 7 أيام" value={m.leads7} icon={<Inbox className="size-5" />} accent="#a8832f" trend={pct(m.leads7, m.leadsPrev7) != null ? { value: pct(m.leads7, m.leadsPrev7)! } : null} hint={m.waiting.length ? `${m.waiting.length} تنتظر الرد` : 'كل الطلبات تمت معالجتها'} to="/admin/leads" />
        <Stat label="زيارات هذا الأسبوع" value={m.weekVisits.length} icon={<CalendarCheck className="size-5" />} accent="#0f766e" hint={`${m.weekVisits.filter((a) => a.status === 'done').length} تمت · ${m.todayAppts.length} موعد اليوم`} to="/admin/agenda" />
        {deals$ && <Stat label="عمولات هذا الشهر" value={<span>{fmtNumber(m.monthComm)}</span>} icon={<HandCoins className="size-5" />} accent="#7c3aed" trend={pct(m.monthComm, m.prevMonthComm) != null ? { value: pct(m.monthComm, m.prevMonthComm)! } : null} hint={`${fmtNumber(m.yearComm)} د.م. منذ بداية السنة`} to="/admin/deals" />}
      </div>

      <div className="mt-6 grid grid-cols-1 gap-6 xl:grid-cols-3">
        {deals$ && (
        <Card title="العمولات — آخر 12 شهراً" icon={<HandCoins className="size-4" />} className="xl:col-span-2" action={<Link to="/admin/deals" className="text-xs font-semibold text-teal hover:underline">التفاصيل</Link>}>
          <div dir="ltr" className="h-[260px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={m.chart} margin={{ top: 8, right: 8, left: 8, bottom: 0 }}>
                <CartesianGrid vertical={false} stroke="#ece6d8" />
                <XAxis dataKey="label" reversed tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: '#5b6475' }} />
                <YAxis orientation="right" tickLine={false} axisLine={false} width={56} tick={{ fontSize: 11, fill: '#5b6475' }} tickFormatter={(v: number) => (v >= 1000 ? `${Math.round(v / 1000)}K` : String(v))} />
                <Tooltip
                  cursor={{ fill: 'rgba(201,162,75,0.08)' }}
                  contentStyle={{ borderRadius: 12, border: '1px solid #e6e0d3', direction: 'rtl', fontFamily: 'inherit' }}
                  formatter={(v, name) => [`${fmtNumber(Number(v))} د.م.`, name === 'sale' ? 'بيع' : 'كراء']}
                />
                <Bar dataKey="sale" stackId="a" fill="#0b1b33" radius={[0, 0, 0, 0]} maxBarSize={34} />
                <Bar dataKey="rent" stackId="a" fill="#c9a24b" radius={[6, 6, 0, 0]} maxBarSize={34} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="mt-3 flex items-center gap-4 text-xs text-muted">
            <span className="inline-flex items-center gap-1.5">
              <span className="size-2.5 rounded-sm bg-navy" /> بيع
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="size-2.5 rounded-sm bg-gold" /> كراء
            </span>
            <span className="ms-auto">
              {m.yearDeals.length} صفقة هذه السنة
            </span>
          </div>
        </Card>
        )}

        <Card title="مسار الطلبات" icon={<Sparkles className="size-4" />} className={deals$ ? undefined : 'xl:col-span-3'} action={m.conversion != null ? <Pill color="#15803d">نسبة النجاح {m.conversion}%</Pill> : undefined}>
          <div className="space-y-3.5">
            {m.funnel.map(({ st, n }) => (
              <BarRow key={st} label={LEAD_STATUS[st].label} value={n} max={maxFunnel} color={LEAD_STATUS[st].color} />
            ))}
          </div>
        </Card>
      </div>

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-2 xl:grid-cols-3">
        <Card title="مواعيد اليوم" icon={<Clock className="size-4" />} action={<Link to="/admin/agenda" className="text-xs font-semibold text-teal hover:underline">الأجندة</Link>} bodyClass="p-0">
          {m.todayAppts.length === 0 ? (
            <MiniEmpty text="لا توجد مواعيد اليوم." />
          ) : (
            <ul className="divide-y divide-line">
              {m.todayAppts.map((a) => (
                <li key={a.id}>
                  <button onClick={() => quick('appointment', a)} className="flex w-full items-center gap-3 px-5 py-3 text-start hover:bg-ivory">
                    <span className="num w-12 shrink-0 text-sm font-bold text-navy">{fmtTime(a.starts_at)}</span>
                    <span className="h-9 w-1 shrink-0 rounded-full" style={{ background: APPT_KIND[a.kind].color }} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-semibold text-navy">{a.title}</span>
                      <span className="block truncate text-xs text-muted">
                        {L.staffName(a.assigned_to)}
                        {a.property_id ? ` · ${hoodName(L.property(a.property_id)?.neighborhood)}` : ''}
                      </span>
                    </span>
                    {a.status === 'done' && <Pill color="#15803d">تم</Pill>}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card title="طلبات تنتظر الرد" icon={<Inbox className="size-4" />} action={<Link to="/admin/leads" className="text-xs font-semibold text-teal hover:underline">كل الطلبات</Link>} bodyClass="p-0">
          {m.waiting.length === 0 ? (
            <MiniEmpty text="ممتاز! لا توجد طلبات معلقة." />
          ) : (
            <ul className="divide-y divide-line">
              {m.waiting.slice(0, 6).map((l) => {
                const hours = (Date.now() - new Date(l.created_at).getTime()) / 36e5
                return (
                  <li key={l.id}>
                    <Link to={`/admin/leads?open=${l.id}`} className="flex items-center gap-3 px-5 py-3 hover:bg-ivory">
                      <Avatar name={l.name} size="sm" />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-semibold text-navy">{l.name}</span>
                        <span className="block truncate text-xs text-muted">
                          {LEAD_KIND[l.kind].label}
                          {l.property_ref ? ` · ${l.property_ref}` : ''}
                        </span>
                      </span>
                      <span className={hours > 24 ? 'text-xs font-bold text-danger' : 'text-xs text-muted'}>{fmtRelative(l.created_at)}</span>
                    </Link>
                  </li>
                )
              })}
            </ul>
          )}
        </Card>

        <Card title="مصادر الطلبات (90 يوماً)" icon={<Sparkles className="size-4" />}>
          {m.sources.length === 0 ? (
            <MiniEmpty text="لا توجد بيانات بعد." />
          ) : (
            <div className="space-y-3.5">
              {m.sources.map(([src, n]) => (
                <BarRow key={src} label={SOURCE[src as keyof typeof SOURCE]?.label ?? src} value={n} max={maxSource} color={SOURCE[src as keyof typeof SOURCE]?.color ?? '#94a3b8'} />
              ))}
            </div>
          )}
        </Card>
      </div>

      <div className="mt-6 grid grid-cols-1 gap-6 xl:grid-cols-3">
        <Card title="أداء الفريق — آخر 30 يوماً" icon={<ListTodo className="size-4" />} className={activity$ ? 'xl:col-span-2' : 'xl:col-span-3'} bodyClass="p-0 overflow-x-auto">
          <table className="table">
            <thead>
              <tr>
                <th>العضو</th>
                <th>مكالمات</th>
                <th>زيارات تمت</th>
                <th>طلبات عولجت</th>
                <th>صفقات ناجحة</th>
                <th>مهام أنجزت</th>
                <th>مهام متأخرة</th>
              </tr>
            </thead>
            <tbody>
              {m.team.map((r) => (
                <tr key={r.s.id}>
                  <td>
                    <span className="flex items-center gap-2.5">
                      <Avatar name={r.s.full_name} size="sm" />
                      <span className="font-semibold text-navy">{r.s.full_name}</span>
                    </span>
                  </td>
                  <td className="num">{r.calls}</td>
                  <td className="num">{r.visits}</td>
                  <td className="num">{r.leads}</td>
                  <td className="num font-bold text-success">{r.won}</td>
                  <td className="num">{r.tasks}</td>
                  <td className="num">{r.overdue ? <span className="font-bold text-danger">{r.overdue}</span> : '0'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>

        {activity$ && (
        <Card title="آخر النشاطات" icon={<PhoneCall className="size-4" />} action={<Link to="/admin/activity" className="text-xs font-semibold text-teal hover:underline">السجل الكامل</Link>} bodyClass="p-0">
          {activity.length === 0 ? (
            <MiniEmpty text="لا يوجد نشاط بعد." />
          ) : (
            <ul className="divide-y divide-line">
              {activity
                .slice()
                .sort((a, b) => b.created_at.localeCompare(a.created_at))
                .slice(0, 7)
                .map((a) => (
                  <li key={a.id} className="flex items-start gap-3 px-5 py-3">
                    <Avatar name={a.actor_name ?? '؟'} size="sm" />
                    <div className="min-w-0 flex-1 text-sm">
                      <span className="font-semibold text-navy">{(a.actor_name ?? '').replace(/\(.*?\)/g, '').trim()}</span> {ACTION[a.action] ?? a.action} {ENTITY[a.entity] ?? a.entity}
                      {typeof a.meta?.title === 'string' && <span className="text-muted"> «{a.meta.title}»</span>}
                      <div className="text-xs text-subtle">{fmtRelative(a.created_at)}</div>
                    </div>
                  </li>
                ))}
            </ul>
          )}
        </Card>
        )}
      </div>

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card title="العقارات الأكثر مشاهدة على الموقع" icon={<Eye className="size-4" />} bodyClass="p-0">
          {m.topViewed.length === 0 ? (
            <MiniEmpty text="لا توجد عقارات منشورة." />
          ) : (
            <ul className="divide-y divide-line">
              {m.topViewed.map((p, i) => (
                <li key={p.id}>
                  <Link to={`/admin/properties/${p.id}`} className="flex items-center gap-3 px-5 py-3 hover:bg-ivory">
                    <span className="num w-5 text-center text-sm font-bold text-gold-600">{i + 1}</span>
                    <img src={p.images[0]} alt="" className="size-11 shrink-0 rounded-lg bg-sand object-cover" loading="lazy" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-semibold text-navy">{p.title}</span>
                      <span className="num block text-xs text-muted">
                        {p.ref} · {fmtPrice(p.price, 'ar', p.purpose === 'rent')}
                      </span>
                    </span>
                    <span className="num inline-flex items-center gap-1 text-sm font-bold text-navy">
                      <Eye className="size-4 text-subtle" /> {fmtNumber(p.views)}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>
        <Card title="المحفظة حسب النوع" icon={<Building2 className="size-4" />} bodyClass="p-0 overflow-x-auto">
          <table className="table">
            <thead>
              <tr>
                <th>النوع</th>
                <th>للبيع</th>
                <th>للكراء</th>
                <th>المجموع</th>
              </tr>
            </thead>
            <tbody>
              {m.inventory.map(([type, c]) => (
                <tr key={type}>
                  <td className="font-semibold text-navy">{typeName(type)}</td>
                  <td className="num">{c.sale}</td>
                  <td className="num">{c.rent}</td>
                  <td className="num font-bold">{c.sale + c.rent}</td>
                </tr>
              ))}
              {m.inventory.length === 0 && (
                <tr>
                  <td colSpan={4} className="text-center text-muted">
                    لا توجد عقارات منشورة
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </Card>
      </div>
    </>
  )
}
