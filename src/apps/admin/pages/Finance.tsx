import { AlertTriangle, Download, FileText, Hourglass, Landmark, Plus, Receipt, TrendingUp, Wallet } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router'
import { Bar, CartesianGrid, ComposedChart, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { invoiceRest, isOpenDeal, isOverdue, receivables, vatInvoiced, yearAccounts } from '@/shared/lib/billing'
import { managementFees } from '@/shared/lib/rentals'
import { seasonalFees } from '@/shared/lib/seasonal'
import { useBilling, useTable } from '@/shared/lib/data'
import { download, fmtDate, fmtNumber, localDate, toCsv } from '@/shared/lib/format'
import type { BillingSettings, Booking, Deal, Expense, ExpenseCategory, Invoice, Lease, Payment, RentPayment } from '@/shared/lib/types'
import { Button, EmptyState, Segmented, Select, cn } from '@/shared/ui/base'
import { useQuickAdd } from '../dialogs'
import { useCan, useLookups } from '../hooks'
import { EXPENSE_CAT, INVOICE_STATUS, PAY_METHOD, stageLabel } from '../labels'
import { BarRow, Card, PageHeader, Pill, SearchBox, Stat, Tabs } from '../ui'

type Tab = 'overview' | 'invoices' | 'payments' | 'expenses'
const TABS: Tab[] = ['overview', 'invoices', 'payments', 'expenses']
const MONTH = (y: number, m: number) => new Intl.DateTimeFormat('ar-MA-u-nu-latn', { month: 'short' }).format(new Date(y, m, 1))
const MONTH_LONG = (y: number, m: number) => new Intl.DateTimeFormat('ar-MA-u-nu-latn', { month: 'long' }).format(new Date(y, m, 1))

/** The agency's money: what came in, what went out, what is still owed. */
export function Finance() {
  const can = useCan()
  const quick = useQuickAdd()
  const L = useLookups()
  const [params, setParams] = useSearchParams()
  const tab = (TABS.includes(params.get('tab') as Tab) ? params.get('tab') : 'overview') as Tab
  const setTab = (t: Tab) => setParams(t === 'overview' ? {} : { tab: t }, { replace: true })
  const { data: billing } = useBilling()
  const b = billing as BillingSettings
  const { data: deals = [] } = useTable<Deal>('deals')
  const { data: invoices = [] } = useTable<Invoice>('invoices')
  const { data: payments = [] } = useTable<Payment>('payments')
  const { data: expenses = [] } = useTable<Expense>('expenses')
  const { data: leases = [] } = useTable<Lease>('leases')
  const { data: rents = [] } = useTable<RentPayment>('rent_payments')
  const { data: bookings = [] } = useTable<Booking>('bookings')
  const now = new Date()
  const today = localDate(now)
  const years = useMemo(() => {
    const ys = new Set<number>([now.getFullYear()])
    for (const d of deals) ys.add(new Date(d.closed_at).getFullYear())
    for (const e of expenses) ys.add(Number(e.spent_at.slice(0, 4)))
    for (const i of invoices) ys.add(Number(i.issued_at.slice(0, 4)))
    return [...ys].sort((a, z) => z - a)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deals, expenses, invoices])
  const [year, setYear] = useState(now.getFullYear())

  // the agency's cut on managed rents and on summer stays (earned once the guests have arrived)
  const fees = useMemo(() => [...managementFees(leases, rents), ...seasonalFees(bookings.filter((x) => x.check_in <= today))], [leases, rents, bookings, today])
  const acc = useMemo(() => yearAccounts(deals, expenses, year, b.vat_rate, fees), [deals, expenses, year, b.vat_rate, fees])
  const owed = useMemo(() => receivables(deals, payments), [deals, payments])
  const owedTotal = owed.reduce((s, x) => s + x.rest, 0)
  const pipeline = deals.filter(isOpenDeal)
  const pipelineTotal = pipeline.reduce((s, d) => s + d.commission, 0)
  const q = Math.floor(now.getMonth() / 3)
  const qFrom = localDate(new Date(now.getFullYear(), q * 3, 1))
  const qTo = localDate(new Date(now.getFullYear(), q * 3 + 3, 0))
  const vatQuarter = vatInvoiced(invoices, qFrom, qTo)
  const overdue = invoices.filter((i) => isOverdue(i, today))

  const chart = acc.months.map((m, i) => ({ label: MONTH(year, i), income: Math.round(m.commission + m.management - m.vat - m.shares), expenses: Math.round(m.expenses), net: Math.round(m.net) }))
  const byCat = useMemo(() => {
    const m = new Map<ExpenseCategory, number>()
    for (const e of expenses) if (Number(e.spent_at.slice(0, 4)) === year) m.set(e.category, (m.get(e.category) ?? 0) + e.amount)
    return [...m.entries()].sort((a, z) => z[1] - a[1])
  }, [expenses, year])

  return (
    <>
      <PageHeader
        title="المالية"
        subtitle="المداخيل والمصاريف والربح الصافي، الفواتير والوصولات، وما بقي عند الزبائن"
        icon={<Landmark className="size-6" />}
        actions={
          <>
            <Select value={year} onChange={(e) => setYear(Number(e.target.value))} className="num h-11 w-auto">
              {years.map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </Select>
            <Button variant="outline" icon={<Wallet className="size-4" />} onClick={() => quick('expense')}>
              مصروف
            </Button>
            <Button variant="gold" icon={<FileText className="size-4" />} onClick={() => quick('invoice')}>
              فاتورة
            </Button>
          </>
        }
      />
      <Tabs
        value={tab}
        onChange={setTab}
        tabs={[
          { value: 'overview', label: 'الملخص' },
          { value: 'invoices', label: 'الفواتير', count: invoices.length },
          { value: 'payments', label: 'الوصولات', count: payments.length },
          { value: 'expenses', label: 'المصاريف', count: expenses.length },
        ]}
        className="mb-6"
      />

      {tab === 'overview' && (
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <Stat label={`عمولات الصفقات المنجزة ${year}`} value={fmtNumber(acc.total.commission)} hint="درهم" icon={<TrendingUp className="size-5" />} accent="#7c3aed" />
            <Stat label={`المصاريف ${year}`} value={fmtNumber(acc.total.expenses)} hint="درهم" icon={<Wallet className="size-5" />} accent="#b91c1c" />
            <Stat label={`الربح الصافي ${year}`} value={fmtNumber(acc.total.net)} hint={b.vat_rate ? 'بعد الضريبة على القيمة المضافة والشركاء والمصاريف' : 'بعد حصص الشركاء والمصاريف'} icon={<Landmark className="size-5" />} accent="#15803d" />
            <Stat label="عمولات لم تُحصَّل" value={fmtNumber(owedTotal)} hint={`${owed.length} صفقة`} icon={<Hourglass className="size-5" />} accent="#b45309" />
          </div>
          <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-3">
            <Stat label="صفقات قيد الإنجاز" value={pipeline.length} hint={`عمولات منتظرة ${fmtNumber(pipelineTotal)} د.م.`} icon={<FileText className="size-5" />} accent="#1d4ed8" to="/admin/deals" />
            <Stat label="فواتير متأخرة الأداء" value={overdue.length} hint={overdue.length ? `${fmtNumber(overdue.reduce((s, i) => s + invoiceRest(i), 0))} د.م.` : 'لا شيء متأخر'} icon={<AlertTriangle className="size-5" />} accent={overdue.length ? '#b91c1c' : '#64748b'} />
            <Stat label={`الضريبة على القيمة المضافة المفوترة — الربع ${q + 1}`} value={fmtNumber(vatQuarter)} hint={b.vat_rate ? 'للتصريح الضريبي' : 'الوكالة غير خاضعة في الإعدادات'} icon={<Receipt className="size-5" />} accent="#0f766e" />
          </div>

          <Card title={`الربح شهراً بشهر — ${year}`} className="mt-6">
            <div dir="ltr" className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={chart} margin={{ top: 8, right: 8, left: 8, bottom: 0 }}>
                  <CartesianGrid vertical={false} stroke="#ece6d8" />
                  <XAxis dataKey="label" reversed tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: '#5b6475' }} />
                  <YAxis orientation="right" tickLine={false} axisLine={false} width={56} tick={{ fontSize: 11, fill: '#5b6475' }} tickFormatter={(v: number) => (Math.abs(v) >= 1000 ? `${Math.round(v / 1000)}K` : String(v))} />
                  <Tooltip
                    cursor={{ fill: 'rgba(201,162,75,0.08)' }}
                    contentStyle={{ borderRadius: 12, border: '1px solid #e6e0d3', direction: 'rtl' }}
                    formatter={(v, name) => [`${fmtNumber(Number(v))} د.م.`, name === 'income' ? 'دخل الوكالة' : name === 'expenses' ? 'المصاريف' : 'الربح الصافي']}
                  />
                  <Bar dataKey="income" fill="#0b1b33" radius={[6, 6, 0, 0]} maxBarSize={30} />
                  <Bar dataKey="expenses" fill="#e5a3a3" radius={[6, 6, 0, 0]} maxBarSize={30} />
                  <Line dataKey="net" stroke="#c9a24b" strokeWidth={2.5} dot={{ r: 3, fill: '#c9a24b' }} type="monotone" />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
            <div className="mt-3 flex flex-wrap gap-4 text-xs text-muted">
              <span className="inline-flex items-center gap-1.5">
                <span className="size-2.5 rounded-sm bg-navy" /> دخل الوكالة (العمولات، التسيير والكراء الموسمي، دون الضريبة وحصص الشركاء)
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="size-2.5 rounded-sm" style={{ background: '#e5a3a3' }} /> المصاريف
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="size-2.5 rounded-full bg-gold" /> الربح الصافي
              </span>
            </div>
          </Card>

          <div className="mt-6 grid grid-cols-1 gap-6 xl:grid-cols-3">
            <Card title="الحساب الشهري" className="xl:col-span-2" bodyClass="p-0 overflow-x-auto">
              <table className="table">
                <thead>
                  <tr>
                    <th>الشهر</th>
                    <th>العمولات</th>
                    {acc.total.management > 0 && <th>الكراء والتسيير</th>}
                    {b.vat_rate > 0 && <th>الضريبة</th>}
                    <th>الشركاء</th>
                    <th>المصاريف</th>
                    <th>الربح الصافي</th>
                  </tr>
                </thead>
                <tbody>
                  {acc.months.map((m, i) =>
                    m.commission || m.expenses || m.management ? (
                      <tr key={i}>
                        <td className="text-sm font-semibold text-navy">{MONTH_LONG(year, i)}</td>
                        <td className="num">{fmtNumber(m.commission)}</td>
                        {acc.total.management > 0 && <td className="num">{fmtNumber(m.management)}</td>}
                        {b.vat_rate > 0 && <td className="num text-muted">{fmtNumber(m.vat)}</td>}
                        <td className="num text-muted">{fmtNumber(m.shares)}</td>
                        <td className="num text-danger">{fmtNumber(m.expenses)}</td>
                        <td className={cn('num font-bold', m.net < 0 ? 'text-danger' : 'text-success')}>{fmtNumber(m.net)}</td>
                      </tr>
                    ) : null,
                  )}
                </tbody>
                <tfoot>
                  <tr>
                    <td className="font-bold text-navy">المجموع</td>
                    <td className="num font-extrabold">{fmtNumber(acc.total.commission)}</td>
                    {acc.total.management > 0 && <td className="num font-bold">{fmtNumber(acc.total.management)}</td>}
                    {b.vat_rate > 0 && <td className="num font-bold text-muted">{fmtNumber(acc.total.vat)}</td>}
                    <td className="num font-bold text-muted">{fmtNumber(acc.total.shares)}</td>
                    <td className="num font-bold text-danger">{fmtNumber(acc.total.expenses)}</td>
                    <td className={cn('num font-extrabold', acc.total.net < 0 ? 'text-danger' : 'text-success')}>{fmtNumber(acc.total.net)}</td>
                  </tr>
                </tfoot>
              </table>
            </Card>
            <div className="space-y-6">
              <Card title="ما بقي عند الزبائن" bodyClass="p-0">
                {owed.length === 0 ? (
                  <p className="p-4 text-sm text-muted">حُصّلت كل عمولات الصفقات المنجزة.</p>
                ) : (
                  <ul className="divide-y divide-line">
                    {owed.slice(0, 8).map(({ deal, rest }) => {
                      const p = L.property(deal.property_id)
                      return (
                        <li key={deal.id}>
                          <Link to={`/admin/deals/${deal.id}`} className="flex items-center gap-3 px-5 py-2.5 text-sm hover:bg-ivory">
                            <span className="min-w-0 flex-1 truncate">
                              <span className="num font-bold text-gold-700">{p?.ref ?? (deal.kind === 'rent' ? 'كراء' : 'بيع')}</span> {L.client(deal.client_id)?.full_name ?? ''}
                              <span className="block text-xs text-subtle">{fmtDate(deal.closed_at)}</span>
                            </span>
                            <span className="num font-bold text-warning">{fmtNumber(rest)}</span>
                          </Link>
                        </li>
                      )
                    })}
                  </ul>
                )}
              </Card>
              <Card title={`المصاريف حسب النوع — ${year}`}>
                {byCat.length === 0 ? (
                  <p className="text-sm text-muted">لا مصاريف مسجلة في {year}.</p>
                ) : (
                  <div className="space-y-3">
                    {byCat.map(([k, v]) => (
                      <BarRow key={k} label={EXPENSE_CAT[k].label} value={Math.round(v)} max={byCat[0][1]} color={EXPENSE_CAT[k].color} format={fmtNumber} />
                    ))}
                  </div>
                )}
              </Card>
            </div>
          </div>
          {pipeline.length > 0 && (
            <Card title="صفقات قيد الإنجاز" className="mt-6" bodyClass="p-0">
              <ul className="divide-y divide-line">
                {pipeline.map((d) => {
                  const p = L.property(d.property_id)
                  return (
                    <li key={d.id}>
                      <Link to={`/admin/deals/${d.id}`} className="flex flex-wrap items-center gap-3 px-5 py-3 text-sm hover:bg-ivory">
                        <span className="num font-bold text-gold-700">{p?.ref ?? '—'}</span>
                        <span className="min-w-0 flex-1 truncate">{L.client(d.client_id)?.full_name ?? p?.title ?? ''}</span>
                        <Pill color="#1d4ed8">{stageLabel(d.stage!, d.kind)}</Pill>
                        <span className="text-xs text-muted">التوقيع {fmtDate(d.closed_at)}</span>
                        <span className="num font-bold text-navy">{fmtNumber(d.commission)}</span>
                      </Link>
                    </li>
                  )
                })}
              </ul>
            </Card>
          )}
        </>
      )}

      {tab === 'invoices' && <InvoicesTab year={year} invoices={invoices} canExport={can('export')} />}
      {tab === 'payments' && <PaymentsTab year={year} payments={payments} invoices={invoices} canExport={can('export')} />}
      {tab === 'expenses' && <ExpensesTab year={year} expenses={expenses} canExport={can('export')} />}
    </>
  )
}

/* ------------------------------------------------------------------ */
type InvFilter = 'all' | 'unpaid' | 'overdue' | 'paid' | 'cancelled'

function InvoicesTab({ year, invoices, canExport }: { year: number; invoices: Invoice[]; canExport: boolean }) {
  const quick = useQuickAdd()
  const L = useLookups()
  const { data: deals = [] } = useTable<Deal>('deals')
  const [filter, setFilter] = useState<InvFilter>('all')
  const [q, setQ] = useState('')
  const today = localDate(new Date())
  const inYear = invoices.filter((i) => Number(i.issued_at.slice(0, 4)) === year)
  const list = inYear
    .filter((i) =>
      filter === 'all' ? true : filter === 'unpaid' ? i.kind === 'invoice' && i.status === 'issued' : filter === 'overdue' ? isOverdue(i, today) : filter === 'paid' ? i.status === 'paid' : i.status === 'cancelled' || i.kind === 'credit',
    )
    .filter((i) => !q.trim() || `${i.no} ${i.bill_name} ${i.bill_ice ?? ''}`.toLowerCase().includes(q.trim().toLowerCase()))
    .sort((a, z) => z.no.localeCompare(a.no))
  const totals = inYear.reduce((s, i) => ({ ht: s.ht + i.total_ht, vat: s.vat + i.total_vat, ttc: s.ttc + i.total_ttc }), { ht: 0, vat: 0, ttc: 0 })

  const exportCsv = () =>
    download(
      `factures-${year}.csv`,
      toCsv(
        [...inYear]
          .sort((a, z) => a.no.localeCompare(z.no))
          .map((i) => ({
            'N°': i.no,
            Type: i.kind === 'credit' ? 'Avoir' : 'Facture',
            Date: i.issued_at,
            Client: i.bill_name,
            'ICE client': i.bill_ice ?? '',
            'Total HT': i.total_ht,
            'TVA %': i.vat_rate,
            TVA: i.total_vat,
            'Total TTC': i.total_ttc,
            Payé: i.paid,
            Statut: i.status === 'paid' ? 'Payée' : i.status === 'cancelled' ? 'Annulée' : 'Émise',
            Échéance: i.due_at ?? '',
          })),
      ),
      'text/csv;charset=utf-8',
    )

  return (
    <div className="card overflow-hidden">
      <div className="flex flex-col gap-3 border-b border-line p-4 lg:flex-row lg:items-center">
        <SearchBox value={q} onChange={setQ} placeholder="الرقم، الزبون أو ICE…" className="lg:max-w-xs" />
        <Segmented
          value={filter}
          onChange={setFilter}
          options={[
            { value: 'all' as InvFilter, label: 'الكل' },
            { value: 'unpaid' as InvFilter, label: 'غير مؤداة' },
            { value: 'overdue' as InvFilter, label: 'متأخرة' },
            { value: 'paid' as InvFilter, label: 'مؤداة' },
            { value: 'cancelled' as InvFilter, label: 'ملغاة ومضادة' },
          ]}
          className="overflow-x-auto"
        />
        <div className="flex gap-2 lg:ms-auto">
          {canExport && (
            <Button variant="outline" size="sm" icon={<Download className="size-4" />} onClick={exportCsv}>
              تصدير للمحاسب
            </Button>
          )}
          <Button size="sm" icon={<Plus className="size-4" />} onClick={() => quick('invoice')}>
            فاتورة
          </Button>
        </div>
      </div>
      {list.length === 0 ? (
        <EmptyState icon={<FileText className="size-7" />} title="لا توجد فواتير هنا" text="تُصدر الفاتورة من ملف الصفقة بضغطة، فتأخذ رقمها المتسلسل تلقائياً." />
      ) : (
        <div className="overflow-x-auto">
          <table className="table">
            <thead>
              <tr>
                <th>الرقم</th>
                <th>التاريخ</th>
                <th>الزبون</th>
                <th>الصفقة</th>
                <th>المجموع</th>
                <th>الباقي</th>
                <th>الحالة</th>
              </tr>
            </thead>
            <tbody>
              {list.map((i) => {
                const deal = deals.find((d) => d.id === i.deal_id)
                const p = L.property(deal?.property_id)
                const late = isOverdue(i, today)
                const st = i.kind === 'credit' ? { label: 'فاتورة مضادة', color: '#7c3aed' } : late ? { label: 'متأخرة', color: '#b91c1c' } : INVOICE_STATUS[i.status]
                return (
                  <tr key={i.id} className="cursor-pointer" onClick={() => quick('invoice', i)}>
                    <td className="num font-bold whitespace-nowrap text-gold-700">{i.no}</td>
                    <td className="text-sm whitespace-nowrap text-muted">{fmtDate(i.issued_at)}</td>
                    <td className="text-sm">{i.bill_name}</td>
                    <td className="num text-sm text-muted">{p?.ref ?? '—'}</td>
                    <td className="num font-bold whitespace-nowrap text-navy">{fmtNumber(i.total_ttc)}</td>
                    <td className={cn('num whitespace-nowrap', invoiceRest(i) > 0 ? 'font-bold text-warning' : 'text-subtle')}>{fmtNumber(invoiceRest(i))}</td>
                    <td>
                      <Pill color={st.color}>{st.label}</Pill>
                    </td>
                  </tr>
                )
              })}
            </tbody>
            <tfoot>
              <tr>
                <td colSpan={4} className="text-sm font-bold text-navy">
                  مجموع {year}: دون الضريبة {fmtNumber(Math.round(totals.ht))} · الضريبة {fmtNumber(Math.round(totals.vat))}
                </td>
                <td className="num font-extrabold">{fmtNumber(Math.round(totals.ttc))}</td>
                <td colSpan={2} />
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </div>
  )
}

/* ------------------------------------------------------------------ */
function PaymentsTab({ year, payments, invoices, canExport }: { year: number; payments: Payment[]; invoices: Invoice[]; canExport: boolean }) {
  const quick = useQuickAdd()
  const [q, setQ] = useState('')
  const inYear = payments.filter((p) => Number(p.received_at.slice(0, 4)) === year)
  const list = inYear.filter((p) => !q.trim() || `${p.no} ${p.payer_name} ${p.reference ?? ''}`.toLowerCase().includes(q.trim().toLowerCase())).sort((a, z) => z.no.localeCompare(a.no))
  const total = inYear.filter((p) => p.status === 'valid').reduce((s, p) => s + p.amount, 0)
  const exportCsv = () =>
    download(
      `recus-${year}.csv`,
      toCsv(
        [...inYear]
          .sort((a, z) => a.no.localeCompare(z.no))
          .map((p) => ({
            'N°': p.no,
            Date: p.received_at,
            Payeur: p.payer_name,
            Montant: p.amount,
            Mode: PAY_METHOD[p.method],
            Référence: p.reference ?? '',
            Facture: invoices.find((i) => i.id === p.invoice_id)?.no ?? '',
            Statut: p.status === 'valid' ? 'Valide' : 'Annulé',
          })),
      ),
      'text/csv;charset=utf-8',
    )
  return (
    <div className="card overflow-hidden">
      <div className="flex flex-col gap-3 border-b border-line p-4 sm:flex-row sm:items-center">
        <SearchBox value={q} onChange={setQ} placeholder="الرقم، الاسم أو المرجع…" className="sm:max-w-xs" />
        <span className="text-sm text-muted">
          المحصل في {year}: <b className="num text-navy">{fmtNumber(total)} د.م.</b>
        </span>
        <div className="flex gap-2 sm:ms-auto">
          {canExport && (
            <Button variant="outline" size="sm" icon={<Download className="size-4" />} onClick={exportCsv}>
              تصدير
            </Button>
          )}
          <Button size="sm" icon={<Plus className="size-4" />} onClick={() => quick('payment')}>
            وصل
          </Button>
        </div>
      </div>
      {list.length === 0 ? (
        <EmptyState icon={<Receipt className="size-7" />} title="لا توجد وصولات" text="كل مبلغ تستلمه يأخذ وصلاً مرقماً، يُطبع ويُسلَّم للزبون." />
      ) : (
        <div className="overflow-x-auto">
          <table className="table">
            <thead>
              <tr>
                <th>الرقم</th>
                <th>التاريخ</th>
                <th>من</th>
                <th>المبلغ</th>
                <th>الأداء</th>
                <th>الفاتورة</th>
                <th>الحالة</th>
              </tr>
            </thead>
            <tbody>
              {list.map((p) => (
                <tr key={p.id} className="cursor-pointer" onClick={() => quick('payment', p)}>
                  <td className="num font-bold whitespace-nowrap text-gold-700">{p.no}</td>
                  <td className="text-sm whitespace-nowrap text-muted">{fmtDate(p.received_at)}</td>
                  <td className="text-sm">{p.payer_name}</td>
                  <td className={cn('num font-bold whitespace-nowrap', p.status === 'cancelled' ? 'text-subtle line-through' : 'text-navy')}>{fmtNumber(p.amount)}</td>
                  <td className="text-sm text-muted">{PAY_METHOD[p.method]}</td>
                  <td className="num text-sm text-muted">{invoices.find((i) => i.id === p.invoice_id)?.no ?? '—'}</td>
                  <td>
                    <Pill color={p.status === 'valid' ? '#15803d' : '#64748b'}>{p.status === 'valid' ? 'صالح' : 'ملغى'}</Pill>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

/* ------------------------------------------------------------------ */
function ExpensesTab({ year, expenses, canExport }: { year: number; expenses: Expense[]; canExport: boolean }) {
  const quick = useQuickAdd()
  const L = useLookups()
  const [month, setMonth] = useState<number | 'all'>('all')
  const [cat, setCat] = useState<ExpenseCategory | 'all'>('all')
  const [q, setQ] = useState('')
  const list = expenses
    .filter((e) => Number(e.spent_at.slice(0, 4)) === year && (month === 'all' || Number(e.spent_at.slice(5, 7)) - 1 === month) && (cat === 'all' || e.category === cat))
    .filter((e) => !q.trim() || `${e.label} ${e.vendor ?? ''}`.toLowerCase().includes(q.trim().toLowerCase()))
    .sort((a, z) => z.spent_at.localeCompare(a.spent_at))
  const total = list.reduce((s, e) => s + e.amount, 0)
  const exportCsv = () =>
    download(
      `depenses-${year}.csv`,
      toCsv(
        list.map((e) => ({
          Date: e.spent_at,
          Catégorie: EXPENSE_CAT[e.category].label,
          Libellé: e.label,
          Fournisseur: e.vendor ?? '',
          Montant: e.amount,
          Mode: e.method ? PAY_METHOD[e.method] : '',
          Bien: L.property(e.property_id)?.ref ?? '',
        })),
      ),
      'text/csv;charset=utf-8',
    )
  return (
    <div className="card overflow-hidden">
      <div className="flex flex-col gap-3 border-b border-line p-4 lg:flex-row lg:items-center">
        <SearchBox value={q} onChange={setQ} placeholder="الوصف أو المورد…" className="lg:max-w-xs" />
        <Select value={month === 'all' ? '' : String(month)} onChange={(e) => setMonth(e.target.value === '' ? 'all' : Number(e.target.value))} className="h-11 w-auto">
          <option value="">كل الشهور</option>
          {Array.from({ length: 12 }, (_, i) => (
            <option key={i} value={i}>
              {MONTH_LONG(year, i)}
            </option>
          ))}
        </Select>
        <Select value={cat} onChange={(e) => setCat(e.target.value as ExpenseCategory | 'all')} className="h-11 w-auto">
          <option value="all">كل الأنواع</option>
          {(Object.keys(EXPENSE_CAT) as ExpenseCategory[]).map((k) => (
            <option key={k} value={k}>
              {EXPENSE_CAT[k].label}
            </option>
          ))}
        </Select>
        <div className="flex gap-2 lg:ms-auto">
          {canExport && (
            <Button variant="outline" size="sm" icon={<Download className="size-4" />} onClick={exportCsv}>
              تصدير
            </Button>
          )}
          <Button size="sm" icon={<Plus className="size-4" />} onClick={() => quick('expense')}>
            مصروف
          </Button>
        </div>
      </div>
      {list.length === 0 ? (
        <EmptyState icon={<Wallet className="size-7" />} title="لا توجد مصاريف هنا" text="سجّل كراء المكتب، الإشهار، التصوير، التنقل… لتعرف ربحك الحقيقي كل شهر." />
      ) : (
        <div className="overflow-x-auto">
          <table className="table">
            <thead>
              <tr>
                <th>التاريخ</th>
                <th>النوع</th>
                <th>الوصف</th>
                <th>المورد</th>
                <th>العقار</th>
                <th>المبلغ</th>
              </tr>
            </thead>
            <tbody>
              {list.map((e) => (
                <tr key={e.id} className="cursor-pointer" onClick={() => quick('expense', e)}>
                  <td className="text-sm whitespace-nowrap text-muted">{fmtDate(e.spent_at)}</td>
                  <td>
                    <Pill color={EXPENSE_CAT[e.category].color}>{EXPENSE_CAT[e.category].label}</Pill>
                  </td>
                  <td className="max-w-[280px] truncate text-sm text-navy">{e.label}</td>
                  <td className="text-sm text-muted">{e.vendor ?? '—'}</td>
                  <td className="num text-sm text-muted">{L.property(e.property_id)?.ref ?? '—'}</td>
                  <td className="num font-bold whitespace-nowrap">{fmtNumber(e.amount)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <td colSpan={5} className="font-bold text-navy">
                  المجموع
                </td>
                <td className="num font-extrabold text-danger">{fmtNumber(Math.round(total * 100) / 100)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </div>
  )
}
