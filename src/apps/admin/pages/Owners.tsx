import { AlarmClock, FileWarning, FolderLock, Plus, ShieldCheck, Users } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router'
import { useTable } from '@/shared/lib/data'
import { fmtDate } from '@/shared/lib/format'
import { currentMandate, mandateState } from '@/shared/lib/owners'
import type { Client, Mandate, PropertyDocument } from '@/shared/lib/types'
import { Button, EmptyState, Segmented } from '@/shared/ui/base'
import { useQuickAdd } from '../dialogs'
import { useLookups } from '../hooks'
import { MandatePill, OwnerFile } from '../owners'
import { PageHeader, PhoneLinks, SearchBox, Stat } from '../ui'

type Filter = 'all' | 'attention' | 'none' | 'exclusive'

export function Owners() {
  const quick = useQuickAdd()
  const L = useLookups()
  const { data: mandates = [] } = useTable<Mandate>('mandates')
  const { data: docs = [] } = useTable<PropertyDocument>('documents')
  const [q, setQ] = useState('')
  const [filter, setFilter] = useState<Filter>('all')
  const [params, setParams] = useSearchParams()
  const [openId, setOpenId] = useState<string | null>(params.get('open'))
  const wanted = params.get('open')
  useEffect(() => {
    if (wanted) {
      setOpenId(wanted)
      setParams({}, { replace: true })
    }
  }, [wanted, setParams])

  const rows = useMemo(() => {
    const owners = L.clients.filter((c) => c.kind === 'owner' || L.properties.some((p) => p.owner_client_id === c.id))
    return owners.map((c) => {
      const props = L.properties.filter((p) => p.owner_client_id === c.id)
      const current = props.map((p) => currentMandate(mandates, p.id)).filter((m): m is Mandate => Boolean(m))
      const states = current.map((m) => ({ m, ...mandateState(m) }))
      const attention = states.filter((x) => x.state === 'expiring' || x.state === 'expired')
      const worst = attention.sort((a, b) => (a.daysLeft ?? 0) - (b.daysLeft ?? 0))[0]?.m ?? current[0] ?? null
      return {
        c,
        props,
        current,
        attention: attention.length,
        without: props.filter((p) => !current.some((m) => m.property_id === p.id) && p.status !== 'sold' && p.status !== 'rented').length,
        exclusive: current.some((m) => m.kind === 'exclusive'),
        docs: docs.filter((d) => d.client_id === c.id || (d.property_id && props.some((p) => p.id === d.property_id))).length,
        shown: worst,
      }
    })
  }, [L.clients, L.properties, mandates, docs])

  const list = useMemo(() => {
    const needle = q.trim().toLowerCase()
    return rows
      .filter((r) => !needle || `${r.c.full_name} ${r.c.phone} ${r.props.map((p) => p.ref).join(' ')}`.toLowerCase().includes(needle))
      .filter((r) => (filter === 'attention' ? r.attention > 0 : filter === 'none' ? r.without > 0 : filter === 'exclusive' ? r.exclusive : true))
      .sort((a, b) => b.attention - a.attention || b.props.length - a.props.length || a.c.full_name.localeCompare(b.c.full_name, 'ar'))
  }, [rows, q, filter])

  const totals = {
    owners: rows.length,
    active: rows.reduce((s, r) => s + r.current.length, 0),
    attention: rows.reduce((s, r) => s + r.attention, 0),
    without: rows.reduce((s, r) => s + r.without, 0),
  }
  const open: Client | undefined = openId ? L.clients.find((c) => c.id === openId) : undefined

  return (
    <>
      <PageHeader
        title="ملفات الملاك"
        subtitle="كل مالك بعقاراته وتفويضاته ووثائقه، مع تقرير يصله ورابط متابعة خاص به"
        icon={<FolderLock className="size-6" />}
        actions={
          <Button variant="gold" icon={<Plus className="size-4" />} onClick={() => quick('client', { kind: 'owner', wants_purpose: null })}>
            مالك جديد
          </Button>
        }
      />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="الملاك" value={totals.owners} icon={<Users className="size-5" />} accent="#0b1b33" />
        <Stat label="تفويضات سارية" value={totals.active} icon={<ShieldCheck className="size-5" />} accent="#0f766e" />
        <Stat label="تفويضات تحتاج تجديداً" value={totals.attention} hint="تنتهي خلال 30 يوماً أو انتهت" icon={<AlarmClock className="size-5" />} accent="#b45309" />
        <Stat label="عقارات بدون تفويض" value={totals.without} icon={<FileWarning className="size-5" />} accent="#b91c1c" />
      </div>

      <div className="card mt-6 overflow-hidden">
        <div className="flex flex-col gap-3 border-b border-line p-4 lg:flex-row lg:items-center">
          <SearchBox value={q} onChange={setQ} placeholder="ابحث بالاسم، الهاتف أو مرجع العقار…" className="lg:max-w-sm" />
          <Segmented
            value={filter}
            onChange={setFilter}
            options={[
              { value: 'all' as Filter, label: 'الكل' },
              { value: 'attention' as Filter, label: 'تفويض ينتهي' },
              { value: 'none' as Filter, label: 'بدون تفويض' },
              { value: 'exclusive' as Filter, label: 'حصري' },
            ]}
            className="overflow-x-auto"
          />
        </div>
        {list.length === 0 ? (
          <EmptyState
            icon={<FolderLock className="size-7" />}
            title={rows.length ? 'لا يوجد مالك بهذا البحث' : 'لا يوجد ملاك بعد'}
            text={rows.length ? 'جرّب كلمة أخرى أو فلتراً آخر.' : 'أضف المالك كعميل من نوع «مالك»، ثم اختره في صفحة عقاره.'}
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="table">
              <thead>
                <tr>
                  <th>المالك</th>
                  <th>الهاتف</th>
                  <th>العقارات</th>
                  <th>التفويض</th>
                  <th>الوثائق</th>
                  <th>آخر تقرير</th>
                </tr>
              </thead>
              <tbody>
                {list.map((r) => (
                  <tr key={r.c.id} className="cursor-pointer" onClick={() => setOpenId(r.c.id)}>
                    <td className="font-semibold text-navy">{r.c.full_name}</td>
                    <td onClick={(e) => e.stopPropagation()}>
                      <PhoneLinks phone={r.c.whatsapp || r.c.phone} />
                    </td>
                    <td className="text-sm">
                      <span className="num font-bold">{r.props.length}</span>
                      {r.props.length > 0 && <span className="num ms-1.5 text-xs text-muted">{r.props.map((p) => p.ref).join('، ')}</span>}
                    </td>
                    <td>{r.props.length ? <MandatePill m={r.shown} /> : <span className="text-xs text-subtle">—</span>}</td>
                    <td className="num">{r.docs}</td>
                    <td className="text-xs whitespace-nowrap text-muted">{r.c.last_report_at ? fmtDate(r.c.last_report_at) : 'لم يُرسل'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {open && <OwnerFile client={open} onClose={() => setOpenId(null)} />}
    </>
  )
}
