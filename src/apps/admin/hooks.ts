import { useCallback, useMemo } from 'react'
import { toast } from 'sonner'
import { useAuth } from '@/shared/lib/auth'
import { useRemove, useSettings, useTable, useUpsert } from '@/shared/lib/data'
import { phoneKey, pick } from '@/shared/lib/format'
import { translate } from '@/shared/lib/i18n'
import { logActivity, type Row, type TableName } from '@/shared/lib/repo'
import type { Client, Property, PropertyType, SessionUser, Settings, Staff } from '@/shared/lib/types'
import { useConfirm } from '@/shared/ui/base'

export function errorText(e: unknown): string {
  const msg = e instanceof Error ? e.message : e && typeof e === 'object' && 'message' in e ? String((e as { message: unknown }).message) : String(e)
  if (/quota/i.test(msg)) return 'مساحة التخزين في الوضع التجريبي ممتلئة. احذف بعض الصور أو استعمل روابط صور.'
  if (/row-level security|permission denied|not allowed/i.test(msg)) return 'ليست لديك صلاحية لهذا الإجراء.'
  if (/duplicate key|unique/i.test(msg)) return 'هذا السجل موجود مسبقاً (مرجع مكرر).'
  if (/Failed to fetch|NetworkError|network/i.test(msg)) return 'تعذر الاتصال بالخادم. تحقق من الإنترنت ثم أعد المحاولة.'
  if (/JWT|session/i.test(msg)) return 'انتهت الجلسة. سجّل الدخول من جديد.'
  return `حدث خطأ: ${msg}`
}

export function useMe(): SessionUser {
  const { user } = useAuth()
  return user!
}

export function useIsAdmin(): boolean {
  const { user } = useAuth()
  return user?.role === 'admin'
}

/** Names for neighbourhoods and property types (Arabic, for the team). */
export function useNames() {
  const { data } = useSettings()
  const s = data as Settings
  return useMemo(
    () => ({
      s,
      hoodName: (id: string | null | undefined) => (id ? pick(s.catalog.neighborhoods.find((n) => n.id === id)?.name, 'ar') || id : '—'),
      typeName: (t: PropertyType) => translate(`type.${t}`, 'ar'),
    }),
    [s],
  )
}

/** Properties, clients and staff with fast lookups by id / phone. */
export function useLookups() {
  const props = useTable<Property>('properties')
  const clients = useTable<Client>('clients')
  const staff = useTable<Staff>('staff')
  return useMemo(() => {
    const p = props.data ?? []
    const c = clients.data ?? []
    const st = staff.data ?? []
    const pMap = new Map(p.map((x) => [x.id, x]))
    const cMap = new Map(c.map((x) => [x.id, x]))
    const sMap = new Map(st.map((x) => [x.id, x]))
    const byPhone = new Map(c.filter((x) => x.phone).map((x) => [phoneKey(x.phone), x]))
    return {
      properties: p,
      clients: c,
      staff: st,
      activeStaff: st.filter((x) => x.active),
      property: (id: string | null | undefined) => (id ? pMap.get(id) : undefined),
      client: (id: string | null | undefined) => (id ? cMap.get(id) : undefined),
      clientByPhone: (phone: string | null | undefined) => (phoneKey(phone).length >= 8 ? byPhone.get(phoneKey(phone)) : undefined),
      staffName: (id: string | null | undefined) => (id ? sMap.get(id)?.full_name ?? '—' : '—'),
      loading: props.isLoading || clients.isLoading,
    }
  }, [props.data, clients.data, staff.data, props.isLoading, clients.isLoading])
}

type SaveOpts = { isNew?: boolean; silent?: boolean; action?: 'create' | 'update' | 'status'; meta?: Record<string, unknown>; message?: string }

/** Upsert + toast + audit log. Resolves to the saved row, or null on error. */
export function useSave<T extends Row>(table: TableName, entity: string, title: (row: T) => string) {
  const { mutateAsync, isPending } = useUpsert<T>(table)
  const { user } = useAuth()
  const save = useCallback(
    async (row: T, opts: SaveOpts = {}): Promise<T | null> => {
      try {
        const saved = await mutateAsync(row)
        void logActivity(user, opts.action ?? (opts.isNew ? 'create' : 'update'), entity, row.id, { title: title(row), ...opts.meta })
        if (!opts.silent) toast.success(opts.message ?? (opts.isNew ? 'تمت الإضافة بنجاح' : 'تم حفظ التغييرات'))
        return saved
      } catch (e) {
        toast.error(errorText(e))
        return null
      }
    },
    [mutateAsync, user, entity, title],
  )
  return { save, pending: isPending }
}

/** Confirm + delete + audit log. Resolves to true when deleted. */
export function useDeleteRow(table: TableName, entity: string) {
  const { mutateAsync } = useRemove(table)
  const { user } = useAuth()
  const confirm = useConfirm()
  return useCallback(
    async (id: string, title: string, opts: { text?: string; skipConfirm?: boolean } = {}) => {
      if (!opts.skipConfirm) {
        const ok = await confirm({ title: `حذف «${title}»؟`, text: opts.text ?? 'لا يمكن التراجع عن هذا الإجراء.', confirmLabel: 'نعم، احذف', danger: true })
        if (!ok) return false
      }
      try {
        await mutateAsync(id)
        void logActivity(user, 'delete', entity, id, { title })
        toast.success('تم الحذف')
        return true
      } catch (e) {
        toast.error(errorText(e))
        return false
      }
    },
    [mutateAsync, user, entity, confirm],
  )
}

export function greeting(): string {
  const h = new Date().getHours()
  if (h < 12) return 'صباح الخير'
  if (h < 18) return 'مساء الخير'
  return 'مساء النور'
}

export function firstName(name: string): string {
  return name.replace(/\(.*?\)/g, '').trim().split(/\s+/)[0] ?? name
}

/** Next reference like SH-1019 from the existing ones. */
export function nextRef(properties: Property[], prefix: string): string {
  const nums = properties.map((p) => Number(p.ref.replace(/\D/g, ''))).filter((n) => Number.isFinite(n) && n > 0)
  const next = nums.length ? Math.max(...nums) + 1 : 1001
  return `${prefix || 'SH'}-${next}`
}
