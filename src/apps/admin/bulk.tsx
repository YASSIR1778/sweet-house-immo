import { useQueryClient } from '@tanstack/react-query'
import { X } from 'lucide-react'
import { useCallback, useMemo, useState, type ReactNode } from 'react'
import { toast } from 'sonner'
import { useAuth } from '@/shared/lib/auth'
import { logActivity, repo, type Row, type TableName } from '@/shared/lib/repo'
import { findDeleted, restoreItem } from '@/shared/lib/trash'
import { useConfirm } from '@/shared/ui/base'
import { errorText } from './hooks'

/** Checked rows of a list (only the rows still visible count). */
export function useSelection(ids: string[]) {
  const [sel, setSel] = useState<Set<string>>(() => new Set())
  const visible = useMemo(() => new Set(ids), [ids])
  const selected = useMemo(() => [...sel].filter((id) => visible.has(id)), [sel, visible])
  const all = ids.length > 0 && selected.length === ids.length
  return {
    selected,
    count: selected.length,
    all,
    isSelected: (id: string) => sel.has(id) && visible.has(id),
    toggle: (id: string) =>
      setSel((s) => {
        const n = new Set(s)
        if (n.has(id)) n.delete(id)
        else n.add(id)
        return n
      }),
    toggleAll: () => setSel(all ? new Set() : new Set(ids)),
    clear: () => setSel(new Set()),
  }
}

export function CheckCell({ checked, onChange, label = 'تحديد' }: { checked: boolean; onChange: () => void; label?: string }) {
  return (
    <td className="w-10" onClick={(e) => e.stopPropagation()}>
      <input type="checkbox" checked={checked} onChange={onChange} aria-label={label} className="size-4 cursor-pointer accent-[#0b1b33]" />
    </td>
  )
}

export function CheckAll({ checked, onChange }: { checked: boolean; onChange: () => void }) {
  return (
    <th className="w-10">
      <input type="checkbox" checked={checked} onChange={onChange} aria-label="تحديد الكل" className="size-4 cursor-pointer accent-[#0b1b33]" />
    </th>
  )
}

/** Action bar shown while rows are checked. */
export function BulkBar({ count, onClear, children }: { count: number; onClear: () => void; children: ReactNode }) {
  if (!count) return null
  return (
    <div className="anim-up fixed inset-x-3 bottom-20 z-40 mx-auto flex max-w-3xl flex-wrap items-center gap-2 rounded-2xl bg-navy p-3 text-white shadow-pop lg:bottom-6">
      <span className="num px-2 text-sm font-bold">{count} محدد</span>
      <div className="flex flex-1 flex-wrap items-center gap-2">{children}</div>
      <button type="button" onClick={onClear} className="rounded-full p-2 text-white/70 hover:bg-white/10 hover:text-white" aria-label="إلغاء التحديد" title="إلغاء التحديد">
        <X className="size-4" />
      </button>
    </div>
  )
}

export const bulkBtn = 'inline-flex h-9 items-center gap-1.5 rounded-xl bg-white/10 px-3 text-xs font-semibold text-white transition hover:bg-white/20 disabled:opacity-50'

/** Delete several rows at once (to the trash), with one «undo» for all of them. */
export function useBulkDelete<T extends Row>(table: TableName, entity: string, title: (row: T) => string) {
  const confirm = useConfirm()
  const qc = useQueryClient()
  const { user } = useAuth()
  return useCallback(
    async (rows: T[]): Promise<boolean> => {
      if (!rows.length) return false
      if (!(await confirm({ title: `حذف ${rows.length} سجلات؟`, text: 'تُنقل إلى سلة المحذوفات، ويمكن استرجاعها خلال 30 يوماً.', confirmLabel: 'نعم، احذف', danger: true }))) return false
      const done: T[] = []
      try {
        for (const r of rows) {
          await repo.remove(table, r.id)
          done.push(r)
          void logActivity(user, 'delete', entity, r.id, { title: title(r) })
        }
      } catch (e) {
        toast.error(errorText(e))
      }
      void qc.invalidateQueries({ queryKey: [table] })
      void qc.invalidateQueries({ queryKey: ['trash'] })
      if (done.length) {
        toast.success(`حُذف ${done.length}`, {
          duration: 10_000,
          action: {
            label: 'تراجع',
            onClick: async () => {
              let back = 0
              const touched = new Set<string>([table, 'trash'])
              for (const r of done) {
                try {
                  const found = await findDeleted(table, r.id)
                  if (!found) continue
                  for (const t of await restoreItem(found.item, found.all)) touched.add(t)
                  back++
                } catch {
                  /* stays in the trash */
                }
              }
              for (const t of touched) void qc.invalidateQueries({ queryKey: [t] })
              toast.success(`استُرجع ${back}`)
            },
          },
        })
      }
      return done.length > 0
    },
    [confirm, qc, user, table, entity, title],
  )
}

/** Save several rows with one confirmation toast. */
export function useBulkSave<T extends Row>(table: TableName, entity: string) {
  const qc = useQueryClient()
  const { user } = useAuth()
  return useCallback(
    async (rows: T[], message: string) => {
      let ok = 0
      for (const r of rows) {
        try {
          await repo.upsert(table, r)
          ok++
          void logActivity(user, 'update', entity, r.id, {})
        } catch (e) {
          toast.error(errorText(e))
          break
        }
      }
      void qc.invalidateQueries({ queryKey: [table] })
      if (table === 'properties') {
        void qc.invalidateQueries({ queryKey: ['public-properties'] })
        void qc.invalidateQueries({ queryKey: ['price_history'] })
      }
      if (ok) toast.success(`${message}: ${ok}`)
      return ok
    },
    [qc, user, table, entity],
  )
}
