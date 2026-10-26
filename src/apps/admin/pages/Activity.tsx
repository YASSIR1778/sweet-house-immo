import { History } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Link } from 'react-router'
import { useTable } from '@/shared/lib/data'
import { addDays, fmtDate, fmtTime, localDate, startOfDay } from '@/shared/lib/format'
import type { Activity as ActivityRow } from '@/shared/lib/types'
import { Segmented, Select } from '@/shared/ui/base'
import { useLookups } from '../hooks'
import { ACTION, APPT_STATUS, ENTITY, LEAD_STATUS, PROPERTY_STATUS } from '../labels'
import { Avatar, MiniEmpty, PageHeader } from '../ui'

const ACTION_COLOR: Record<string, string> = { create: '#15803d', update: '#1d4ed8', delete: '#b91c1c', status: '#a8832f', login: '#64748b' }

function link(a: ActivityRow): string | null {
  if (!a.entity_id || a.action === 'delete') return null
  switch (a.entity) {
    case 'property':
      return `/admin/properties/${a.entity_id}`
    case 'lead':
      return `/admin/leads?open=${a.entity_id}`
    case 'client':
      return `/admin/clients?open=${a.entity_id}`
    case 'appointment':
      return '/admin/agenda'
    case 'task':
      return '/admin/tasks'
    case 'call':
      return '/admin/calls'
    case 'deal':
      return '/admin/deals'
    default:
      return null
  }
}

function statusLabel(v: unknown): string | null {
  if (typeof v === 'boolean') return v ? 'منشور' : 'مخفي'
  if (typeof v !== 'string') return null
  return (LEAD_STATUS as Record<string, { label: string }>)[v]?.label ?? (PROPERTY_STATUS as Record<string, { label: string }>)[v]?.label ?? (APPT_STATUS as Record<string, { label: string }>)[v]?.label ?? (v === 'done' ? 'منجزة' : v === 'open' ? 'مفتوحة' : v)
}

export function Activity() {
  const L = useLookups()
  const { data = [] } = useTable<ActivityRow>('activity')
  const [actor, setActor] = useState('')
  const [entity, setEntity] = useState('')
  const [period, setPeriod] = useState<'7' | '30' | 'all'>('7')

  const groups = useMemo(() => {
    const from = period === 'all' ? null : addDays(startOfDay(new Date()), -Number(period))
    const rows = data
      .filter((a) => (!actor || a.actor === actor) && (!entity || a.entity === entity) && (!from || new Date(a.created_at) >= from))
      .sort((a, b) => b.created_at.localeCompare(a.created_at))
    const map = new Map<string, ActivityRow[]>()
    for (const r of rows) {
      const k = localDate(r.created_at)
      map.set(k, [...(map.get(k) ?? []), r])
    }
    return [...map.entries()]
  }, [data, actor, entity, period])

  return (
    <>
      <PageHeader title="سجل النشاط" subtitle="من فعل ماذا ومتى — شفافية كاملة على عمل الفريق" icon={<History className="size-6" />} />
      <div className="card mb-4 flex flex-wrap items-center gap-2 p-3">
        <Select value={actor} onChange={(e) => setActor(e.target.value)} className="h-10 w-auto py-1 text-sm">
          <option value="">كل الفريق</option>
          {L.staff.map((s) => (
            <option key={s.id} value={s.id}>
              {s.full_name}
            </option>
          ))}
        </Select>
        <Select value={entity} onChange={(e) => setEntity(e.target.value)} className="h-10 w-auto py-1 text-sm">
          <option value="">كل الأنواع</option>
          {Object.entries(ENTITY).map(([k, v]) => (
            <option key={k} value={k}>
              {v}
            </option>
          ))}
        </Select>
        <Segmented
          value={period}
          onChange={setPeriod}
          options={[
            { value: '7', label: '7 أيام' },
            { value: '30', label: '30 يوماً' },
            { value: 'all', label: 'الكل' },
          ]}
        />
      </div>
      {groups.length === 0 ? (
        <div className="card">
          <MiniEmpty text="لا يوجد نشاط في هذه الفترة." />
        </div>
      ) : (
        <div className="space-y-5">
          {groups.map(([day, rows]) => (
            <section key={day} className="card overflow-hidden">
              <header className="border-b border-line bg-ivory px-5 py-2.5 text-sm font-bold text-navy">{fmtDate(rows[0].created_at, 'ar', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</header>
              <ul className="divide-y divide-line">
                {rows.map((a) => {
                  const to = link(a)
                  const title = typeof a.meta?.title === 'string' ? a.meta.title : null
                  const st = a.meta && 'status' in a.meta ? statusLabel(a.meta.status) : a.meta && 'published' in a.meta ? statusLabel(a.meta.published) : null
                  const body = (
                    <>
                      <span className="font-semibold text-navy">{(a.actor_name ?? 'النظام').replace(/\(.*?\)/g, '').trim()}</span>{' '}
                      <span style={{ color: ACTION_COLOR[a.action] }} className="font-semibold">
                        {ACTION[a.action] ?? a.action}
                      </span>{' '}
                      {ENTITY[a.entity] ?? a.entity}
                      {title && <span className="text-text"> «{title}»</span>}
                      {st && <span className="text-muted"> ← {st}</span>}
                    </>
                  )
                  return (
                    <li key={a.id} className="flex items-center gap-3 px-5 py-3 text-sm">
                      <Avatar name={a.actor_name ?? '؟'} size="sm" />
                      <div className="min-w-0 flex-1">{to ? <Link to={to} className="hover:underline">{body}</Link> : body}</div>
                      <span className="num shrink-0 text-xs text-subtle">{fmtTime(a.created_at)}</span>
                    </li>
                  )
                })}
              </ul>
            </section>
          ))}
        </div>
      )}
    </>
  )
}
