import { BadgeDollarSign, Download, HandCoins, Plus, Receipt, TrendingUp } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Link } from 'react-router'
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { useTable } from '@/shared/lib/data'
import { download, fmtDate, fmtNumber, toCsv } from '@/shared/lib/format'
import type { Deal } from '@/shared/lib/types'
import { Button, Select } from '@/shared/ui/base'
import { useQuickAdd } from '../dialogs'
import { useCan, useLookups } from '../hooks'
import { PURPOSE } from '../labels'
import { Card, PageHeader, Pill, Stat } from '../ui'

export function Deals() {
  const can = useCan()
  const quick = useQuickAdd()
  const L = useLookups()
  const { data: deals = [] } = useTable<Deal>('deals')
  const years = useMemo(() => {
    const ys = new Set(deals.map((d) => new Date(d.closed_at).getFullYear()))
    ys.add(new Date().getFullYear())
    return [...ys].sort((a, b) => b - a)
  }, [deals])
  const [year, setYear] = useState(new Date().getFullYear())

  const m = useMemo(() => {
    const inYear = deals.filter((d) => new Date(d.closed_at).getFullYear() === year).sort((a, b) => b.closed_at.localeCompare(a.closed_at))
    const now = new Date()
    const thisMonth = deals.filter((d) => {
      const x = new Date(d.closed_at)
      return x.getFullYear() === now.getFullYear() && x.getMonth() === now.getMonth()
    })
    const total = inYear.reduce((s, d) => s + d.commission, 0)
    const chart = Array.from({ length: 12 }, (_, i) => {
      const ds = inYear.filter((d) => new Date(d.closed_at).getMonth() === i)
      return {
        label: new Intl.DateTimeFormat('ar-MA-u-nu-latn', { month: 'short' }).format(new Date(year, i, 1)),
        sale: ds.filter((d) => d.kind === 'sale').reduce((s, d) => s + d.commission, 0),
        rent: ds.filter((d) => d.kind === 'rent').reduce((s, d) => s + d.commission, 0),
      }
    })
    return {
      inYear,
      total,
      month: thisMonth.reduce((s, d) => s + d.commission, 0),
      volume: inYear.filter((d) => d.kind === 'sale').reduce((s, d) => s + d.amount, 0),
      avg: inYear.length ? Math.round(total / inYear.length) : 0,
      sales: inYear.filter((d) => d.kind === 'sale').length,
      rents: inYear.filter((d) => d.kind === 'rent').length,
      chart,
    }
  }, [deals, year])

  const exportCsv = () =>
    download(
      `deals-${year}.csv`,
      toCsv(
        m.inYear.map((d) => ({
          التاريخ: d.closed_at.slice(0, 10),
          النوع: PURPOSE[d.kind].label,
          العقار: L.property(d.property_id)?.ref ?? '',
          العميل: L.client(d.client_id)?.full_name ?? '',
          المبلغ: d.amount,
          العمولة: d.commission,
          ملاحظات: d.notes,
        })),
      ),
      'text/csv;charset=utf-8',
    )

  return (
    <>
      <PageHeader
        title="الصفقات والعمولات"
        subtitle="خاص بالمدير — لا تراه الكاتبة"
        icon={<HandCoins className="size-6" />}
        actions={
          <>
            <Select value={year} onChange={(e) => setYear(Number(e.target.value))} className="num h-11 w-auto">
              {years.map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </Select>
            {can('export') && (
              <Button variant="outline" onClick={exportCsv} icon={<Download className="size-4" />}>
                تصدير
              </Button>
            )}
            <Button variant="gold" onClick={() => quick('deal')} icon={<Plus className="size-4" />}>
              تسجيل صفقة
            </Button>
          </>
        }
      />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label={`عمولات ${year}`} value={fmtNumber(m.total)} hint="درهم" icon={<HandCoins className="size-5" />} accent="#7c3aed" />
        <Stat label="عمولات هذا الشهر" value={fmtNumber(m.month)} hint="درهم" icon={<TrendingUp className="size-5" />} accent="#15803d" />
        <Stat label="عدد الصفقات" value={m.inYear.length} hint={`${m.sales} بيع · ${m.rents} كراء`} icon={<Receipt className="size-5" />} accent="#a8832f" />
        <Stat label="متوسط العمولة" value={fmtNumber(m.avg)} hint={`حجم مبيعات ${fmtNumber(m.volume)} د.م.`} icon={<BadgeDollarSign className="size-5" />} />
      </div>

      <Card title={`العمولات حسب الشهر — ${year}`} className="mt-6">
        <div dir="ltr" className="h-[280px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={m.chart} margin={{ top: 8, right: 8, left: 8, bottom: 0 }}>
              <CartesianGrid vertical={false} stroke="#ece6d8" />
              <XAxis dataKey="label" reversed tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: '#5b6475' }} />
              <YAxis orientation="right" tickLine={false} axisLine={false} width={56} tick={{ fontSize: 11, fill: '#5b6475' }} tickFormatter={(v: number) => (v >= 1000 ? `${Math.round(v / 1000)}K` : String(v))} />
              <Tooltip cursor={{ fill: 'rgba(201,162,75,0.08)' }} contentStyle={{ borderRadius: 12, border: '1px solid #e6e0d3', direction: 'rtl' }} formatter={(v, name) => [`${fmtNumber(Number(v))} د.م.`, name === 'sale' ? 'بيع' : 'كراء']} />
              <Bar dataKey="sale" stackId="a" fill="#0b1b33" maxBarSize={38} />
              <Bar dataKey="rent" stackId="a" fill="#c9a24b" radius={[6, 6, 0, 0]} maxBarSize={38} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </Card>

      <Card title="الصفقات" className="mt-6" bodyClass="p-0 overflow-x-auto">
        <table className="table">
          <thead>
            <tr>
              <th>التاريخ</th>
              <th>النوع</th>
              <th>العقار</th>
              <th>العميل</th>
              <th>المبلغ</th>
              <th>العمولة</th>
              <th>ملاحظات</th>
            </tr>
          </thead>
          <tbody>
            {m.inYear.map((d) => {
              const p = L.property(d.property_id)
              const c = L.client(d.client_id)
              return (
                <tr key={d.id} className="cursor-pointer" onClick={() => quick('deal', d)}>
                  <td className="text-sm whitespace-nowrap text-muted">{fmtDate(d.closed_at)}</td>
                  <td>
                    <Pill color={PURPOSE[d.kind].color}>{d.kind === 'sale' ? 'بيع' : 'كراء'}</Pill>
                  </td>
                  <td>
                    {p ? (
                      <Link to={`/admin/properties/${p.id}`} onClick={(e) => e.stopPropagation()} className="text-sm font-semibold text-navy hover:underline">
                        <span className="num text-gold-700">{p.ref}</span> {p.title.slice(0, 40)}
                      </Link>
                    ) : (
                      <span className="text-subtle">—</span>
                    )}
                  </td>
                  <td className="text-sm">{c?.full_name ?? '—'}</td>
                  <td className="num whitespace-nowrap">{fmtNumber(d.amount)}</td>
                  <td className="num font-bold whitespace-nowrap text-success">{fmtNumber(d.commission)}</td>
                  <td className="max-w-[240px] truncate text-sm text-muted">{d.notes ?? ''}</td>
                </tr>
              )
            })}
            {m.inYear.length === 0 && (
              <tr>
                <td colSpan={7} className="py-10 text-center text-muted">
                  لا توجد صفقات في {year}
                </td>
              </tr>
            )}
          </tbody>
          {m.inYear.length > 0 && (
            <tfoot>
              <tr>
                <td colSpan={5} className="font-bold text-navy">
                  المجموع
                </td>
                <td className="num font-extrabold text-success">{fmtNumber(m.total)}</td>
                <td />
              </tr>
            </tfoot>
          )}
        </table>
      </Card>
    </>
  )
}
