import { CalendarDays, CalendarRange, ChevronLeft, ChevronRight, List, Plus } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useTable } from '@/shared/lib/data'
import { addDays, fmtDate, fmtTime, sameDay, startOfDay, startOfWeek } from '@/shared/lib/format'
import type { Appointment, AppointmentKind } from '@/shared/lib/types'
import { Button, Segmented, cn } from '@/shared/ui/base'
import { useQuickAdd } from '../dialogs'
import { useLookups, useMe, useNames } from '../hooks'
import { APPT_KIND, APPT_STATUS } from '../labels'
import { MiniEmpty, PageHeader, Pill } from '../ui'

export function Agenda() {
  const me = useMe()
  const quick = useQuickAdd()
  const L = useLookups()
  const { hoodName } = useNames()
  const { data: appts = [] } = useTable<Appointment>('appointments')
  const [week, setWeek] = useState(() => startOfWeek(new Date()))
  const [view, setView] = useState<'week' | 'list'>(() => (typeof window !== 'undefined' && window.innerWidth < 1024 ? 'list' : 'week'))
  const [who, setWho] = useState<'all' | 'me'>('all')
  const [kind, setKind] = useState<'all' | AppointmentKind>('all')

  const days = useMemo(() => Array.from({ length: 7 }, (_, i) => addDays(week, i)), [week])
  const visible = useMemo(() => appts.filter((a) => (who === 'all' || a.assigned_to === me.id) && (kind === 'all' || a.kind === kind)), [appts, who, kind, me.id])
  const byDay = (d: Date) => visible.filter((a) => sameDay(a.starts_at, d)).sort((a, b) => a.starts_at.localeCompare(b.starts_at))
  const weekItems = visible.filter((a) => new Date(a.starts_at) >= week && new Date(a.starts_at) < addDays(week, 7))
  const listDays = useMemo(() => Array.from({ length: 21 }, (_, i) => addDays(week, i)), [week])
  const today = startOfDay(new Date())

  const newAt = (d: Date) => {
    const s = new Date(d)
    s.setHours(10, 0, 0, 0)
    const e = new Date(s.getTime() + 45 * 60000)
    quick('appointment', { starts_at: s.toISOString(), ends_at: e.toISOString(), kind: 'visit' })
  }

  const range = `${fmtDate(week.toISOString(), 'ar', { day: 'numeric', month: 'long' })} – ${fmtDate(addDays(week, 6).toISOString(), 'ar', { day: 'numeric', month: 'long', year: 'numeric' })}`

  const Chip = ({ a }: { a: Appointment }) => {
    const p = L.property(a.property_id)
    const c = L.client(a.client_id)
    const off = a.status === 'cancelled' || a.status === 'noshow'
    return (
      <button
        onClick={() => quick('appointment', a)}
        className={cn('w-full rounded-xl border bg-white p-2.5 text-start shadow-soft transition hover:-translate-y-0.5 hover:shadow-card', off && 'opacity-60', a.status === 'done' && 'bg-success/[0.04]')}
        style={{ borderInlineStartWidth: 4, borderInlineStartColor: APPT_KIND[a.kind].color }}
      >
        <div className="flex items-center justify-between gap-1">
          <span className="num text-xs font-extrabold text-navy">
            {fmtTime(a.starts_at)}–{fmtTime(a.ends_at)}
          </span>
          {a.status !== 'scheduled' && <Pill color={APPT_STATUS[a.status].color}>{APPT_STATUS[a.status].label}</Pill>}
        </div>
        <div className={cn('mt-1 line-clamp-2 text-[13px] leading-snug font-semibold text-navy', off && 'line-through')}>{a.title}</div>
        <div className="mt-1 truncate text-[11px] text-muted">
          {p ? `${p.ref} · ${hoodName(p.neighborhood)}` : APPT_KIND[a.kind].label}
          {c ? ` · ${c.full_name}` : ''}
        </div>
        <div className="mt-1 text-[11px] text-subtle">{L.staffName(a.assigned_to)}</div>
      </button>
    )
  }

  return (
    <>
      <PageHeader
        title="المواعيد"
        subtitle={`${weekItems.filter((a) => a.status !== 'cancelled').length} موعد هذا الأسبوع · ${weekItems.filter((a) => a.kind === 'visit' && a.status !== 'cancelled').length} زيارة`}
        icon={<CalendarDays className="size-6" />}
        actions={
          <Button variant="gold" onClick={() => quick('appointment')} icon={<Plus className="size-4" />}>
            موعد جديد
          </Button>
        }
      />

      <div className="card mb-4 flex flex-wrap items-center gap-2 p-3">
        <div className="flex items-center gap-1">
          <button onClick={() => setWeek((w) => addDays(w, -7))} className="flex size-10 items-center justify-center rounded-xl hover:bg-sand" aria-label="الأسبوع السابق">
            <ChevronRight className="size-5" />
          </button>
          <button onClick={() => setWeek(startOfWeek(new Date()))} className="rounded-xl px-3 py-2 text-sm font-bold text-navy hover:bg-sand">
            اليوم
          </button>
          <button onClick={() => setWeek((w) => addDays(w, 7))} className="flex size-10 items-center justify-center rounded-xl hover:bg-sand" aria-label="الأسبوع التالي">
            <ChevronLeft className="size-5" />
          </button>
          <span className="ms-2 text-sm font-semibold text-navy">{range}</span>
        </div>
        <div className="ms-auto flex flex-wrap items-center gap-2">
          <Segmented
            value={kind}
            onChange={setKind}
            options={[{ value: 'all' as const, label: 'الكل' }, ...(Object.keys(APPT_KIND) as AppointmentKind[]).map((k) => ({ value: k, label: APPT_KIND[k].label }))]}
            className="hidden xl:inline-flex"
          />
          <Segmented
            value={who}
            onChange={setWho}
            options={[
              { value: 'all', label: 'كل الفريق' },
              { value: 'me', label: 'مواعيدي' },
            ]}
          />
          <Segmented
            value={view}
            onChange={setView}
            options={[
              { value: 'week', label: '', icon: <CalendarRange className="size-4" /> },
              { value: 'list', label: '', icon: <List className="size-4" /> },
            ]}
          />
        </div>
      </div>

      {view === 'week' ? (
        <div className="no-scrollbar -mx-4 overflow-x-auto px-4 md:mx-0 md:px-0">
        <div className="grid min-w-[980px] grid-cols-7 gap-3">
          {days.map((d) => {
            const items = byDay(d)
            const isToday = sameDay(d, today)
            const past = d < today
            return (
              <div key={d.toISOString()} className={cn('flex min-h-[420px] flex-col rounded-2xl border p-2', isToday ? 'border-gold bg-gold/[0.06]' : 'border-line bg-white/60', past && 'opacity-80')}>
                <div className="mb-2 flex items-center justify-between px-1">
                  <div>
                    <div className="text-xs font-semibold text-muted">{fmtDate(d.toISOString(), 'ar', { weekday: 'long' })}</div>
                    <div className={cn('num text-xl font-extrabold', isToday ? 'text-gold-700' : 'text-navy')}>{d.getDate()}</div>
                  </div>
                  <button onClick={() => newAt(d)} className="flex size-8 items-center justify-center rounded-full text-muted hover:bg-sand hover:text-navy" aria-label="إضافة موعد" title="إضافة موعد">
                    <Plus className="size-4" />
                  </button>
                </div>
                <div className="flex-1 space-y-2">
                  {items.map((a) => (
                    <Chip key={a.id} a={a} />
                  ))}
                </div>
              </div>
            )
          })}
        </div>
        </div>
      ) : (
        <div className="space-y-4">
          {listDays.map((d) => {
            const items = byDay(d)
            if (!items.length && !sameDay(d, today)) return null
            return (
              <section key={d.toISOString()} className="card overflow-hidden">
                <header className={cn('flex items-center justify-between px-4 py-2.5', sameDay(d, today) ? 'bg-gold/15' : 'bg-ivory')}>
                  <span className="text-sm font-bold text-navy">
                    {sameDay(d, today) ? 'اليوم · ' : sameDay(d, addDays(today, 1)) ? 'غداً · ' : ''}
                    {fmtDate(d.toISOString(), 'ar', { weekday: 'long', day: 'numeric', month: 'long' })}
                  </span>
                  <button onClick={() => newAt(d)} className="text-xs font-semibold text-teal hover:underline">
                    + موعد
                  </button>
                </header>
                {items.length === 0 ? (
                  <MiniEmpty text="لا توجد مواعيد." />
                ) : (
                  <div className="grid grid-cols-1 gap-2 p-3 sm:grid-cols-2 xl:grid-cols-3">
                    {items.map((a) => (
                      <Chip key={a.id} a={a} />
                    ))}
                  </div>
                )}
              </section>
            )
          })}
        </div>
      )}
    </>
  )
}
