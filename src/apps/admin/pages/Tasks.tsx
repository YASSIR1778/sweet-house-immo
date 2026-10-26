import { Check, ListTodo, Plus, RotateCcw } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Link } from 'react-router'
import { useTable } from '@/shared/lib/data'
import { addDays, fmtDate, nowIso, sameDay, startOfDay } from '@/shared/lib/format'
import type { Task } from '@/shared/lib/types'
import { Button, Segmented, Switch, cn } from '@/shared/ui/base'
import { useQuickAdd } from '../dialogs'
import { useIsAdmin, useLookups, useMe, useSave } from '../hooks'
import { PRIORITY } from '../labels'
import { Avatar, PageHeader, Pill } from '../ui'

export function Tasks() {
  const me = useMe()
  const isAdmin = useIsAdmin()
  const quick = useQuickAdd()
  const L = useLookups()
  const { data: tasks = [] } = useTable<Task>('tasks')
  const [scope, setScope] = useState<'mine' | 'all'>(isAdmin ? 'all' : 'mine')
  const [showDone, setShowDone] = useState(false)
  const { save } = useSave<Task>('tasks', 'task', (t) => t.title)

  const groups = useMemo(() => {
    const now = new Date()
    const today = startOfDay(now)
    const mine = tasks.filter((t) => scope === 'all' || t.assigned_to === me.id)
    const open = mine.filter((t) => t.status === 'open').sort((a, b) => (a.due_at ?? '9999').localeCompare(b.due_at ?? '9999') || (b.priority === 'high' ? 1 : 0) - (a.priority === 'high' ? 1 : 0))
    return [
      { key: 'late', title: 'متأخرة', color: '#b91c1c', items: open.filter((t) => t.due_at && new Date(t.due_at) < now) },
      { key: 'today', title: 'اليوم', color: '#a8832f', items: open.filter((t) => t.due_at && new Date(t.due_at) >= now && sameDay(t.due_at, today)) },
      { key: 'week', title: 'خلال 7 أيام', color: '#1d4ed8', items: open.filter((t) => t.due_at && !sameDay(t.due_at, today) && new Date(t.due_at) >= now && new Date(t.due_at) < addDays(today, 8)) },
      { key: 'later', title: 'لاحقاً', color: '#475569', items: open.filter((t) => t.due_at && new Date(t.due_at) >= addDays(today, 8)) },
      { key: 'nodate', title: 'بدون تاريخ', color: '#94a3b8', items: open.filter((t) => !t.due_at) },
      ...(showDone ? [{ key: 'done', title: 'منجزة', color: '#15803d', items: mine.filter((t) => t.status === 'done').sort((a, b) => (b.completed_at ?? '').localeCompare(a.completed_at ?? '')).slice(0, 30) }] : []),
    ]
  }, [tasks, scope, me.id, showDone])

  const openCount = tasks.filter((t) => t.status === 'open' && (scope === 'all' || t.assigned_to === me.id)).length
  const toggle = (t: Task) =>
    save(t.status === 'open' ? { ...t, status: 'done', completed_at: nowIso() } : { ...t, status: 'open', completed_at: null }, { action: 'status', meta: { status: t.status === 'open' ? 'done' : 'open' }, message: t.status === 'open' ? 'تم إنجاز المهمة ✓' : 'أعيد فتح المهمة' })

  const related = (t: Task) => {
    if (t.related_type === 'property') {
      const p = L.property(t.related_id)
      return p ? <Link to={`/admin/properties/${p.id}`} className="num text-xs font-semibold text-gold-700 hover:underline" onClick={(e) => e.stopPropagation()}>{p.ref}</Link> : null
    }
    if (t.related_type === 'client') {
      const c = L.client(t.related_id)
      return c ? <Link to={`/admin/clients?open=${c.id}`} className="text-xs font-semibold text-teal hover:underline" onClick={(e) => e.stopPropagation()}>{c.full_name}</Link> : null
    }
    if (t.related_type === 'lead') return <Link to={`/admin/leads?open=${t.related_id}`} className="text-xs font-semibold text-teal hover:underline" onClick={(e) => e.stopPropagation()}>الطلب</Link>
    return null
  }

  return (
    <>
      <PageHeader
        title="المهام"
        subtitle={`${openCount} مهمة مفتوحة`}
        icon={<ListTodo className="size-6" />}
        actions={
          <Button variant="gold" onClick={() => quick('task')} icon={<Plus className="size-4" />}>
            مهمة جديدة
          </Button>
        }
      />
      <div className="card mb-4 flex flex-wrap items-center gap-3 p-3">
        <Segmented
          value={scope}
          onChange={setScope}
          options={[
            { value: 'mine', label: 'مهامي' },
            { value: 'all', label: 'كل الفريق' },
          ]}
        />
        <Switch checked={showDone} onChange={setShowDone} label="إظهار المنجزة" />
      </div>

      <div className="space-y-5">
        {groups.map((g) =>
          g.items.length === 0 ? null : (
            <section key={g.key} className="card overflow-hidden">
              <header className="flex items-center gap-2 border-b border-line px-5 py-3">
                <span className="size-2.5 rounded-full" style={{ background: g.color }} />
                <h2 className="text-sm font-bold text-navy">{g.title}</h2>
                <span className="num rounded-full bg-sand px-2 py-0.5 text-xs font-bold text-muted">{g.items.length}</span>
              </header>
              <ul className="divide-y divide-line">
                {g.items.map((t) => (
                  <li key={t.id} className="flex items-start gap-3 px-5 py-3.5 hover:bg-ivory">
                    <button
                      onClick={() => void toggle(t)}
                      className={cn('mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-lg border-2 transition', t.status === 'done' ? 'border-success bg-success text-white' : 'border-line-2 text-transparent hover:border-success hover:text-success')}
                      aria-label={t.status === 'done' ? 'إعادة فتح' : 'إنجاز'}
                      title={t.status === 'done' ? 'إعادة فتح' : 'إنجاز'}
                    >
                      {t.status === 'done' ? <RotateCcw className="size-3.5" /> : <Check className="size-4" strokeWidth={3} />}
                    </button>
                    <button onClick={() => quick('task', t)} className="min-w-0 flex-1 text-start">
                      <div className={cn('font-semibold text-navy', t.status === 'done' && 'text-muted line-through')}>{t.title}</div>
                      {t.details && <div className="mt-0.5 line-clamp-1 text-sm text-muted">{t.details}</div>}
                      <div className="mt-1.5 flex flex-wrap items-center gap-2 text-xs">
                        {t.due_at && <span className={cn('num', g.key === 'late' ? 'font-bold text-danger' : 'text-muted')}>{fmtDate(t.due_at, 'ar', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</span>}
                        {t.priority !== 'normal' && <Pill color={PRIORITY[t.priority].color}>{PRIORITY[t.priority].label}</Pill>}
                        {related(t)}
                      </div>
                    </button>
                    {scope === 'all' && t.assigned_to && <Avatar name={L.staffName(t.assigned_to)} size="sm" />}
                  </li>
                ))}
              </ul>
            </section>
          ),
        )}
        {groups.every((g) => g.items.length === 0) && (
          <div className="card p-12 text-center">
            <Check className="mx-auto size-10 text-success" />
            <p className="mt-3 font-bold text-navy">لا توجد مهام مفتوحة</p>
            <p className="text-sm text-muted">كل شيء تحت السيطرة.</p>
          </div>
        )}
      </div>
    </>
  )
}
