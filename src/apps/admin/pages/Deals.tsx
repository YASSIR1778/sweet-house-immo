import { BadgeDollarSign, Download, FolderOpen, HandCoins, Handshake, Plus, Receipt, TrendingUp, Wallet } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { checklistProgress, isDone, OPEN_STAGES, receivables } from '@/shared/lib/billing'
import { agencyNet, shareAmount, sharesTotal } from '@/shared/lib/commission'
import { useTable } from '@/shared/lib/data'
import { download, fmtDate, fmtNumber, toCsv } from '@/shared/lib/format'
import type { Deal, Payment } from '@/shared/lib/types'
import { Button, Segmented, Select } from '@/shared/ui/base'
import { useQuickAdd } from '../dialogs'
import { useCan, useLookups } from '../hooks'
import { DEAL_STAGE, PURPOSE } from '../labels'
import { Card, PageHeader, Pill, Stat } from '../ui'

/** Column titles that suit sales and rentals alike. */
const COLUMN: Record<string, string> = { agreement: 'الاتفاق والعربون', paperwork: 'الوثائق والتمويل', signing: 'التوقيع' }

export function Deals() {
  const can = useCan()
  const quick = useQuickAdd()
  const nav = useNavigate()
  const L = useLookups()
  const { data: deals = [] } = useTable<Deal>('deals')
  const { data: payments = [] } = useTable<Payment>('payments')
  const [show, setShow] = useState<'done' | 'cancelled'>('done')
  const done = useMemo(() => deals.filter(isDone), [deals])
  const open = useMemo(() => deals.filter((d) => d.stage && OPEN_STAGES.includes(d.stage)), [deals])
  const cancelled = useMemo(() => deals.filter((d) => d.stage === 'cancelled').sort((a, b) => b.closed_at.localeCompare(a.closed_at)), [deals])
  const years = useMemo(() => {
    const ys = new Set(done.map((d) => new Date(d.closed_at).getFullYear()))
    ys.add(new Date().getFullYear())
    return [...ys].sort((a, b) => b - a)
  }, [done])
  const [year, setYear] = useState(new Date().getFullYear())

  const m = useMemo(() => {
    const inYear = done.filter((d) => new Date(d.closed_at).getFullYear() === year).sort((a, b) => b.closed_at.localeCompare(a.closed_at))
    const now = new Date()
    const thisMonth = done.filter((d) => {
      const x = new Date(d.closed_at)
      return x.getFullYear() === now.getFullYear() && x.getMonth() === now.getMonth()
    })
    const total = inYear.reduce((s, d) => s + d.commission, 0)
    const partners = inYear.reduce((s, d) => s + sharesTotal(d.shares ?? [], d.commission), 0)
    const owedPartners = done.reduce((s, d) => s + (d.shares ?? []).reduce((a, x) => a + Math.max(0, shareAmount(x, d.commission) - (x.paid || 0)), 0), 0)
    const toCollect = receivables(done, payments).reduce((s, x) => s + x.rest, 0)
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
      partners,
      net: total - partners,
      owedPartners,
      toCollect,
      month: thisMonth.reduce((s, d) => s + d.commission, 0),
      volume: inYear.filter((d) => d.kind === 'sale').reduce((s, d) => s + d.amount, 0),
      avg: inYear.length ? Math.round(total / inYear.length) : 0,
      sales: inYear.filter((d) => d.kind === 'sale').length,
      rents: inYear.filter((d) => d.kind === 'rent').length,
      chart,
    }
  }, [done, payments, year])

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
          'من البائع': d.commission_seller ?? 0,
          'من المشتري': d.commission_buyer ?? d.commission,
          العمولة: d.commission,
          'حصص الشركاء': sharesTotal(d.shares ?? [], d.commission),
          'صافي الوكالة': agencyNet(d.commission, d.shares ?? []),
          'الشركاء': (d.shares ?? []).map((x) => x.name).join('، '),
          المحصل: d.received ?? d.commission,
          ملاحظات: d.notes,
        })),
      ),
      'text/csv;charset=utf-8',
    )

  const rows = show === 'done' ? m.inYear : cancelled

  return (
    <>
      <PageHeader
        title="الصفقات والعمولات"
        subtitle="ملف كل صفقة من الاتفاق إلى التوقيع، العمولات، حصص الشركاء، وما يبقى للوكالة"
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
            <Button variant="gold" onClick={() => quick('deal', { stage: 'agreement' })} icon={<Plus className="size-4" />}>
              صفقة جديدة
            </Button>
          </>
        }
      />

      {open.length > 0 && (
        <section className="mb-6">
          <h2 className="mb-3 flex items-center gap-2 text-[15px] font-bold text-navy">
            <FolderOpen className="size-4 text-gold-600" /> صفقات قيد الإنجاز
            <span className="num text-xs font-normal text-muted">
              ({open.length}) · عمولات منتظرة {fmtNumber(open.reduce((s, d) => s + d.commission, 0))} د.م.
            </span>
          </h2>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            {OPEN_STAGES.map((st) => {
              const list = open.filter((d) => d.stage === st).sort((a, b) => a.closed_at.localeCompare(b.closed_at))
              return (
                <div key={st} className="rounded-2xl border border-line bg-ivory/60 p-3">
                  <div className="mb-2 flex items-center justify-between px-1">
                    <Pill color={DEAL_STAGE[st].color} dot>
                      {COLUMN[st]}
                    </Pill>
                    <span className="num text-xs text-muted">{list.length}</span>
                  </div>
                  <div className="space-y-2">
                    {list.map((d) => {
                      const p = L.property(d.property_id)
                      const c = L.client(d.client_id)
                      const prog = checklistProgress(d.checklist)
                      const late = new Date(d.closed_at) < new Date()
                      return (
                        <Link key={d.id} to={`/admin/deals/${d.id}`} className="block rounded-xl border border-line bg-white p-3 shadow-soft transition hover:-translate-y-0.5 hover:shadow-card">
                          <div className="flex items-center justify-between gap-2">
                            <span className="num text-xs font-bold text-gold-700">{p?.ref ?? '—'}</span>
                            <Pill color={PURPOSE[d.kind].color}>{PURPOSE[d.kind].label}</Pill>
                          </div>
                          <div className="mt-1 truncate text-sm font-semibold text-navy">{c?.full_name ?? p?.title ?? 'صفقة'}</div>
                          <div className="mt-1 flex items-center justify-between text-xs text-muted">
                            <span className="num">{fmtNumber(d.amount)} د.م.</span>
                            <span className={late ? 'font-semibold text-danger' : ''}>التوقيع {fmtDate(d.closed_at)}</span>
                          </div>
                          {prog.total > 0 && (
                            <div className="mt-2 flex items-center gap-2">
                              <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-sand">
                                <div className="h-full rounded-full bg-success" style={{ width: `${prog.pct}%` }} />
                              </div>
                              <span className="num text-[11px] text-muted">
                                {prog.done}/{prog.total}
                              </span>
                            </div>
                          )}
                          <div className="mt-2 text-xs">
                            العمولة <b className="num text-navy">{fmtNumber(d.commission)}</b>
                          </div>
                        </Link>
                      )
                    })}
                    {list.length === 0 && <p className="px-1 py-3 text-center text-xs text-subtle">لا شيء في هذه المرحلة</p>}
                  </div>
                </div>
              )
            })}
          </div>
        </section>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label={`عمولات ${year}`} value={fmtNumber(m.total)} hint="الصفقات المنجزة · درهم" icon={<HandCoins className="size-5" />} accent="#7c3aed" />
        <Stat label="عمولات هذا الشهر" value={fmtNumber(m.month)} hint="درهم" icon={<TrendingUp className="size-5" />} accent="#15803d" />
        <Stat label="عدد الصفقات المنجزة" value={m.inYear.length} hint={`${m.sales} بيع · ${m.rents} كراء`} icon={<Receipt className="size-5" />} accent="#a8832f" />
        <Stat label="متوسط العمولة" value={fmtNumber(m.avg)} hint={`حجم مبيعات ${fmtNumber(m.volume)} د.م.`} icon={<BadgeDollarSign className="size-5" />} />
      </div>
      <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Stat label={`صافي الوكالة ${year}`} value={fmtNumber(m.net)} hint={`بعد ${fmtNumber(m.partners)} د.م. للشركاء`} icon={<Wallet className="size-5" />} accent="#15803d" to="/admin/finance" />
        <Stat label="مستحقات الشركاء غير المؤداة" value={fmtNumber(m.owedPartners)} hint="كل السنوات" icon={<Handshake className="size-5" />} accent="#b91c1c" to="/admin/brokers" />
        <Stat label="عمولات لم تُحصَّل بعد" value={fmtNumber(m.toCollect)} hint="من البائعين والمشترين" icon={<Receipt className="size-5" />} accent="#b45309" to="/admin/finance" />
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

      <Card
        title={show === 'done' ? `الصفقات المنجزة — ${year}` : 'الصفقات الملغاة'}
        className="mt-6"
        bodyClass="p-0 overflow-x-auto"
        action={
          cancelled.length > 0 ? (
            <Segmented
              value={show}
              onChange={setShow}
              options={[
                { value: 'done' as const, label: 'المنجزة' },
                { value: 'cancelled' as const, label: `الملغاة (${cancelled.length})` },
              ]}
            />
          ) : undefined
        }
      >
        <table className="table">
          <thead>
            <tr>
              <th>التاريخ</th>
              <th>النوع</th>
              <th>العقار</th>
              <th>العميل</th>
              <th>المبلغ</th>
              <th>العمولة</th>
              <th>للشركاء</th>
              <th>صافي الوكالة</th>
              <th>ملاحظات</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((d) => {
              const p = L.property(d.property_id)
              const c = L.client(d.client_id)
              return (
                <tr key={d.id} className="cursor-pointer" onClick={() => nav(`/admin/deals/${d.id}`)}>
                  <td className="text-sm whitespace-nowrap text-muted">{fmtDate(d.closed_at)}</td>
                  <td>
                    <Pill color={PURPOSE[d.kind].color}>{d.kind === 'sale' ? 'بيع' : 'كراء'}</Pill>
                  </td>
                  <td>
                    {p ? (
                      <span className="text-sm font-semibold text-navy">
                        <span className="num text-gold-700">{p.ref}</span> {p.title.slice(0, 40)}
                      </span>
                    ) : (
                      <span className="text-subtle">—</span>
                    )}
                  </td>
                  <td className="text-sm">{c?.full_name ?? '—'}</td>
                  <td className="num whitespace-nowrap">{fmtNumber(d.amount)}</td>
                  <td className="num font-bold whitespace-nowrap text-navy">
                    {fmtNumber(d.commission)}
                    {show === 'done' && (d.received ?? d.commission) < d.commission && <div className="text-[11px] font-semibold text-warning">باقي {fmtNumber(d.commission - (d.received ?? 0))}</div>}
                  </td>
                  <td className="num whitespace-nowrap text-muted" title={(d.shares ?? []).map((x) => x.name).join('، ')}>
                    {fmtNumber(sharesTotal(d.shares ?? [], d.commission))}
                  </td>
                  <td className="num font-bold whitespace-nowrap text-success">{fmtNumber(agencyNet(d.commission, d.shares ?? []))}</td>
                  <td className="max-w-[240px] truncate text-sm text-muted">{d.notes ?? ''}</td>
                </tr>
              )
            })}
            {rows.length === 0 && (
              <tr>
                <td colSpan={9} className="py-10 text-center text-muted">
                  {show === 'done' ? `لا توجد صفقات منجزة في ${year}` : 'لا توجد صفقات ملغاة'}
                </td>
              </tr>
            )}
          </tbody>
          {show === 'done' && m.inYear.length > 0 && (
            <tfoot>
              <tr>
                <td colSpan={5} className="font-bold text-navy">
                  المجموع
                </td>
                <td className="num font-extrabold text-navy">{fmtNumber(m.total)}</td>
                <td className="num font-bold text-muted">{fmtNumber(m.partners)}</td>
                <td className="num font-extrabold text-success">{fmtNumber(m.net)}</td>
                <td />
              </tr>
            </tfoot>
          )}
        </table>
      </Card>
    </>
  )
}
