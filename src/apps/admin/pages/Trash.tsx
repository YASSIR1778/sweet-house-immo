import { useQueryClient } from '@tanstack/react-query'
import { RotateCcw, Trash2 } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { toast } from 'sonner'
import { useTable } from '@/shared/lib/data'
import { fmtDate } from '@/shared/lib/format'
import { daysLeft, purgeItem, restoreItem, tableOf, type TrashItem } from '@/shared/lib/trash'
import { Button, EmptyState, Segmented, useConfirm } from '@/shared/ui/base'
import { errorText, useLookups } from '../hooks'
import { ENTITY, daysAr } from '../labels'
import { PageHeader, Pill } from '../ui'

const KIND: Record<string, { label: string; color: string }> = {
  properties: { label: ENTITY.property, color: '#a8832f' },
  clients: { label: ENTITY.client, color: '#0f766e' },
  leads: { label: ENTITY.lead, color: '#1d4ed8' },
  appointments: { label: ENTITY.appointment, color: '#7c3aed' },
  tasks: { label: ENTITY.task, color: '#475569' },
  calls: { label: ENTITY.call, color: '#475569' },
  deals: { label: ENTITY.deal, color: '#15803d' },
  brokers: { label: ENTITY.broker, color: '#0f766e' },
  mandates: { label: ENTITY.mandate, color: '#a8832f' },
  documents: { label: ENTITY.document, color: '#b45309' },
}

export function Trash() {
  const qc = useQueryClient()
  const confirm = useConfirm()
  const L = useLookups()
  const { data: items = [], isLoading } = useTable<TrashItem>('trash')
  const [kind, setKind] = useState('all')
  const [busy, setBusy] = useState<string | null>(null)
  const purged = useRef(false)

  // items older than 30 days leave for good
  useEffect(() => {
    if (purged.current || isLoading) return
    purged.current = true
    const old = items.filter((x) => daysLeft(x) === 0)
    if (!old.length) return
    void Promise.all(old.map((x) => purgeItem(x).catch(() => undefined))).then(() => qc.invalidateQueries({ queryKey: ['trash'] }))
  }, [items, isLoading, qc])

  const list = useMemo(() => items.filter((x) => daysLeft(x) > 0 && (kind === 'all' || tableOf(x.table_name) === kind)).sort((a, b) => b.created_at.localeCompare(a.created_at)), [items, kind])
  const kinds = useMemo(() => [...new Set(items.map((x) => tableOf(x.table_name)).filter((k): k is NonNullable<typeof k> => Boolean(k)))], [items])

  const restore = async (x: TrashItem) => {
    setBusy(x.id)
    try {
      const touched = await restoreItem(x, items)
      for (const t of [...touched, 'trash']) void qc.invalidateQueries({ queryKey: [t] })
      toast.success(`استُرجع «${x.label || KIND[tableOf(x.table_name) ?? '']?.label || ''}»`)
    } catch (e) {
      toast.error(errorText(e))
    } finally {
      setBusy(null)
    }
  }
  const purge = async (x: TrashItem) => {
    if (!(await confirm({ title: 'حذف نهائي؟', text: 'لن يمكن استرجاع هذا السجل بعد الآن.', confirmLabel: 'نعم، احذف نهائياً', danger: true }))) return
    setBusy(x.id)
    try {
      await purgeItem(x)
      void qc.invalidateQueries({ queryKey: ['trash'] })
      toast.success('حُذف نهائياً')
    } catch (e) {
      toast.error(errorText(e))
    } finally {
      setBusy(null)
    }
  }
  const empty = async () => {
    if (!(await confirm({ title: 'إفراغ السلة؟', text: `يُحذف نهائياً كل ما في السلة: ${list.length}. لا يمكن التراجع.`, confirmLabel: 'نعم، أفرغ السلة', danger: true }))) return
    setBusy('all')
    try {
      for (const x of list) await purgeItem(x)
      void qc.invalidateQueries({ queryKey: ['trash'] })
      toast.success('أُفرغت السلة')
    } catch (e) {
      toast.error(errorText(e))
    } finally {
      setBusy(null)
    }
  }

  return (
    <>
      <PageHeader
        title="سلة المحذوفات"
        subtitle="كل ما يُحذف يبقى هنا 30 يوماً، ويمكن استرجاعه بضغطة"
        icon={<Trash2 className="size-6" />}
        actions={
          list.length > 0 ? (
            <Button variant="ghost" className="text-danger" loading={busy === 'all'} icon={<Trash2 className="size-4" />} onClick={() => void empty()}>
              إفراغ السلة
            </Button>
          ) : undefined
        }
      />
      <div className="card overflow-hidden">
        {kinds.length > 1 && (
          <div className="border-b border-line p-4">
            <Segmented value={kind} onChange={setKind} options={[{ value: 'all', label: 'الكل' }, ...kinds.map((k) => ({ value: k as string, label: KIND[k]?.label ?? k }))]} className="overflow-x-auto" />
          </div>
        )}
        {!isLoading && list.length === 0 ? (
          <EmptyState icon={<Trash2 className="size-7" />} title="السلة فارغة" text="حين تحذف عقاراً أو عميلاً أو أي سجل آخر، يبقى هنا 30 يوماً قبل حذفه نهائياً." />
        ) : (
          <div className="overflow-x-auto">
            <table className="table">
              <thead>
                <tr>
                  <th>النوع</th>
                  <th>السجل</th>
                  <th>حذفه</th>
                  <th>تاريخ الحذف</th>
                  <th>يُحذف نهائياً بعد</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {list.map((x) => {
                  const k = KIND[tableOf(x.table_name) ?? ''] ?? { label: x.table_name, color: '#64748b' }
                  const left = daysLeft(x)
                  return (
                    <tr key={x.id}>
                      <td>
                        <Pill color={k.color}>{k.label}</Pill>
                      </td>
                      <td className="max-w-[280px] truncate text-sm font-semibold text-navy">{x.label || '—'}</td>
                      <td className="text-sm text-muted">{x.deleted_by ? L.staffName(x.deleted_by) : '—'}</td>
                      <td className="text-xs whitespace-nowrap text-muted">{fmtDate(x.created_at)}</td>
                      <td className={left <= 3 ? 'text-xs font-bold whitespace-nowrap text-danger' : 'text-xs whitespace-nowrap text-muted'}>{daysAr(left)}</td>
                      <td>
                        <span className="flex justify-end gap-1.5">
                          <Button size="sm" variant="outline" loading={busy === x.id} icon={<RotateCcw className="size-4" />} onClick={() => void restore(x)}>
                            استرجاع
                          </Button>
                          <button type="button" onClick={() => void purge(x)} className="rounded-full p-2 text-muted hover:bg-danger/10 hover:text-danger" title="حذف نهائي" aria-label="حذف نهائي">
                            <Trash2 className="size-4" />
                          </button>
                        </span>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  )
}
