import { HandCoins, Hourglass, Percent, Plus, ThumbsUp } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useTable } from '@/shared/lib/data'
import { fmtDate, fmtNumber, fmtPrice } from '@/shared/lib/format'
import type { Offer, OfferStatus } from '@/shared/lib/types'
import { Button, EmptyState, Segmented } from '@/shared/ui/base'
import { useQuickAdd } from '../dialogs'
import { useLookups } from '../hooks'
import { FINANCING, OFFER_STATUS } from '../labels'
import { OPEN_OFFER, pctOf } from '../offers'
import { PageHeader, Pill, SearchBox, Stat } from '../ui'

type Filter = 'open' | 'accepted' | 'closed' | 'all'

export function Offers() {
  const quick = useQuickAdd()
  const L = useLookups()
  const { data: offers = [] } = useTable<Offer>('offers')
  const [filter, setFilter] = useState<Filter>('open')
  const [q, setQ] = useState('')

  const list = useMemo(() => {
    const needle = q.trim().toLowerCase()
    return offers
      .filter((o) =>
        filter === 'open' ? OPEN_OFFER.includes(o.status) : filter === 'accepted' ? o.status === 'accepted' : filter === 'closed' ? o.status === 'rejected' || o.status === 'withdrawn' : true,
      )
      .filter((o) => {
        if (!needle) return true
        const p = L.property(o.property_id)
        const c = L.client(o.client_id)
        return `${p?.ref ?? ''} ${p?.title ?? ''} ${c?.full_name ?? ''} ${c?.phone ?? ''}`.toLowerCase().includes(needle)
      })
      .sort((a, b) => b.updated_at.localeCompare(a.updated_at))
  }, [offers, filter, q, L])

  const stats = useMemo(() => {
    const open = offers.filter((o) => OPEN_OFFER.includes(o.status))
    const month = new Date()
    const accepted = offers.filter((o) => o.status === 'accepted' && new Date(o.updated_at).getMonth() === month.getMonth() && new Date(o.updated_at).getFullYear() === month.getFullYear())
    const ratios = offers
      .map((o) => {
        const p = L.property(o.property_id)
        return p?.price ? o.amount / p.price : null
      })
      .filter((x): x is number => x != null)
    return {
      open: open.length,
      expiring: open.filter((o) => o.valid_until && o.valid_until <= new Date(Date.now() + 3 * 86_400_000).toISOString().slice(0, 10)).length,
      accepted: accepted.length,
      avg: ratios.length ? Math.round((ratios.reduce((a, b) => a + b, 0) / ratios.length) * 1000) / 10 : null,
    }
  }, [offers, L])

  return (
    <>
      <PageHeader
        title="العروض والتفاوض"
        subtitle="كل عرض يصل على عقار: مبلغه، شروطه، رد المالك، حتى القبول والصفقة"
        icon={<HandCoins className="size-6" />}
        actions={
          <Button variant="gold" icon={<Plus className="size-4" />} onClick={() => quick('offer')}>
            عرض جديد
          </Button>
        }
      />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="عروض قيد التفاوض" value={stats.open} icon={<HandCoins className="size-5" />} accent="#1d4ed8" />
        <Stat label="تنتهي صلاحيتها خلال 3 أيام" value={stats.expiring} icon={<Hourglass className="size-5" />} accent="#b45309" />
        <Stat label="عروض قُبلت هذا الشهر" value={stats.accepted} icon={<ThumbsUp className="size-5" />} accent="#15803d" />
        <Stat label="متوسط العرض من الثمن المعروض" value={stats.avg != null ? `${stats.avg}%` : '—'} icon={<Percent className="size-5" />} accent="#7c3aed" />
      </div>
      <div className="card mt-6 overflow-hidden">
        <div className="flex flex-col gap-3 border-b border-line p-4 lg:flex-row lg:items-center">
          <SearchBox value={q} onChange={setQ} placeholder="المرجع، العقار أو اسم الزبون…" className="lg:max-w-sm" />
          <Segmented
            value={filter}
            onChange={setFilter}
            options={[
              { value: 'open' as Filter, label: 'قيد التفاوض' },
              { value: 'accepted' as Filter, label: 'مقبولة' },
              { value: 'closed' as Filter, label: 'مرفوضة أو مسحوبة' },
              { value: 'all' as Filter, label: 'الكل' },
            ]}
            className="overflow-x-auto"
          />
        </div>
        {list.length === 0 ? (
          <EmptyState icon={<HandCoins className="size-7" />} title="لا توجد عروض هنا" text="سجّل كل عرض يصلك على عقار، لتتابع التفاوض وتُخبر المالك بضغطة." />
        ) : (
          <div className="overflow-x-auto">
            <table className="table">
              <thead>
                <tr>
                  <th>العقار</th>
                  <th>صاحب العرض</th>
                  <th>المبلغ</th>
                  <th>من الثمن</th>
                  <th>الأداء</th>
                  <th>الحالة</th>
                  <th>صالح حتى</th>
                </tr>
              </thead>
              <tbody>
                {list.map((o) => {
                  const p = L.property(o.property_id)
                  const c = L.client(o.client_id)
                  const st = o.status as OfferStatus
                  return (
                    <tr key={o.id} className="cursor-pointer" onClick={() => quick('offer', o)}>
                      <td>
                        <div className="num text-xs font-bold text-gold-700">{p?.ref ?? '—'}</div>
                        <div className="max-w-[240px] truncate text-sm font-semibold text-navy">{p?.title ?? ''}</div>
                      </td>
                      <td className="text-sm">{c?.full_name ?? '—'}</td>
                      <td className="num font-bold whitespace-nowrap text-navy">
                        {fmtPrice(o.amount, 'ar', p?.purpose === 'rent')}
                        {o.status === 'countered' && o.counter_amount != null && <div className="text-xs font-semibold text-warning">المالك: {fmtNumber(o.counter_amount)}</div>}
                      </td>
                      <td className="num text-sm text-muted">{p ? pctOf(o.amount, p.price) : '—'}</td>
                      <td className="text-sm text-muted">{FINANCING[o.financing]}</td>
                      <td>
                        <Pill color={OFFER_STATUS[st].color}>{OFFER_STATUS[st].label}</Pill>
                      </td>
                      <td className="text-xs whitespace-nowrap text-muted">{o.valid_until ? fmtDate(o.valid_until) : '—'}</td>
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
