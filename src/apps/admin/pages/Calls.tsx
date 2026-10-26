import { Download, PhoneCall, PhoneIncoming, PhoneOutgoing, Plus } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Link } from 'react-router'
import { useTable } from '@/shared/lib/data'
import { addDays, download, fmtDateTime, phoneKey, sameDay, startOfDay, toCsv } from '@/shared/lib/format'
import type { CallLog } from '@/shared/lib/types'
import { Button, Segmented } from '@/shared/ui/base'
import { useQuickAdd } from '../dialogs'
import { useCan, useLookups } from '../hooks'
import { PageHeader, PhoneLinks, SearchBox, Stat } from '../ui'

export function Calls() {
  const quick = useQuickAdd()
  const can = useCan()
  const L = useLookups()
  const { data: calls = [] } = useTable<CallLog>('calls')
  const [period, setPeriod] = useState<'today' | '7' | '30' | 'all'>('7')
  const [dir, setDir] = useState<'all' | 'in' | 'out'>('all')
  const [q, setQ] = useState('')

  const list = useMemo(() => {
    const today = startOfDay(new Date())
    const from = period === 'today' ? today : period === '7' ? addDays(today, -7) : period === '30' ? addDays(today, -30) : null
    const term = q.trim().toLowerCase()
    const digits = phoneKey(term)
    return calls
      .filter(
        (c) =>
          (!from || new Date(c.created_at) >= from) &&
          (dir === 'all' || c.direction === dir) &&
          (!term || `${c.caller_name} ${c.subject} ${c.outcome ?? ''}`.toLowerCase().includes(term) || (digits.length >= 4 && phoneKey(c.phone).includes(digits))),
      )
      .sort((a, b) => b.created_at.localeCompare(a.created_at))
  }, [calls, period, dir, q])

  const todayCalls = calls.filter((c) => sameDay(c.created_at, new Date()))
  const week = calls.filter((c) => new Date(c.created_at) >= addDays(startOfDay(new Date()), -7))

  const exportCsv = () =>
    download(
      `calls-${new Date().toISOString().slice(0, 10)}.csv`,
      toCsv(list.map((c) => ({ التاريخ: fmtDateTime(c.created_at), الاتجاه: c.direction === 'in' ? 'واردة' : 'صادرة', الاسم: c.caller_name, الهاتف: c.phone, الموضوع: c.subject, النتيجة: c.outcome, 'سجّلها': L.staffName(c.logged_by) }))),
      'text/csv;charset=utf-8',
    )

  return (
    <>
      <PageHeader
        title="سجل المكالمات"
        subtitle="كل مكالمة تُسجَّل هنا: من اتصل، لماذا، وما الذي تم الاتفاق عليه"
        icon={<PhoneCall className="size-6" />}
        actions={
          <>
            {can('export') && (
              <Button variant="outline" onClick={exportCsv} icon={<Download className="size-4" />}>
                تصدير
              </Button>
            )}
            <Button variant="gold" onClick={() => quick('call')} icon={<Plus className="size-4" />}>
              تسجيل مكالمة
            </Button>
          </>
        }
      />
      <div className="mb-4 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Stat label="واردة اليوم" value={todayCalls.filter((c) => c.direction === 'in').length} icon={<PhoneIncoming className="size-5" />} accent="#0f766e" />
        <Stat label="صادرة اليوم" value={todayCalls.filter((c) => c.direction === 'out').length} icon={<PhoneOutgoing className="size-5" />} accent="#a8832f" />
        <Stat label="آخر 7 أيام" value={week.length} icon={<PhoneCall className="size-5" />} />
      </div>
      <div className="card overflow-hidden">
        <div className="flex flex-wrap items-center gap-2 border-b border-line p-3">
          <SearchBox value={q} onChange={setQ} placeholder="الاسم، الهاتف، الموضوع…" className="min-w-[200px] flex-1" />
          <Segmented
            value={period}
            onChange={setPeriod}
            options={[
              { value: 'today', label: 'اليوم' },
              { value: '7', label: '7 أيام' },
              { value: '30', label: '30 يوماً' },
              { value: 'all', label: 'الكل' },
            ]}
          />
          <Segmented
            value={dir}
            onChange={setDir}
            options={[
              { value: 'all', label: 'الكل' },
              { value: 'in', label: 'واردة' },
              { value: 'out', label: 'صادرة' },
            ]}
          />
        </div>
        <div className="overflow-x-auto">
          <table className="table">
            <thead>
              <tr>
                <th>الوقت</th>
                <th>المتصل</th>
                <th>الهاتف</th>
                <th>الموضوع</th>
                <th>النتيجة</th>
                <th>سجّلها</th>
              </tr>
            </thead>
            <tbody>
              {list.map((c) => {
                const client = L.client(c.client_id)
                return (
                  <tr key={c.id} className="cursor-pointer" onClick={() => quick('call', c)}>
                    <td className="text-xs whitespace-nowrap text-muted">
                      <span className="flex items-center gap-2">
                        {c.direction === 'in' ? <PhoneIncoming className="size-4 text-teal" /> : <PhoneOutgoing className="size-4 text-gold-600" />}
                        {fmtDateTime(c.created_at)}
                      </span>
                    </td>
                    <td>
                      <div className="font-semibold text-navy">{c.caller_name}</div>
                      {client && (
                        <Link to={`/admin/clients?open=${client.id}`} onClick={(e) => e.stopPropagation()} className="text-xs text-teal hover:underline">
                          ملف العميل
                        </Link>
                      )}
                    </td>
                    <td onClick={(e) => e.stopPropagation()}>
                      <PhoneLinks phone={c.phone} />
                    </td>
                    <td className="max-w-[260px] text-sm text-text">{c.subject}</td>
                    <td className="max-w-[260px] text-sm text-muted">{c.outcome ?? '—'}</td>
                    <td className="text-sm whitespace-nowrap text-muted">{L.staffName(c.logged_by)}</td>
                  </tr>
                )
              })}
              {list.length === 0 && (
                <tr>
                  <td colSpan={6} className="py-10 text-center text-muted">
                    لا توجد مكالمات في هذه الفترة
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </>
  )
}
