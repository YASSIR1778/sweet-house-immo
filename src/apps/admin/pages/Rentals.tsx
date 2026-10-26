import { AlarmClock, Banknote, FileSignature, Hourglass, Key, Landmark, Plus, Printer, Receipt, Send, Wallet } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router'
import { toast } from 'sonner'
import { useBilling, useTable } from '@/shared/lib/data'
import { fmtDate, fmtNumber, localDate, nowIso, waLink } from '@/shared/lib/format'
import { addMonths, depositReturnBy, leaseArrears, leaseSchedule, managementFees, monthName, ownerStatement, periodOf, rentFor, rentReminder, revisionStatus } from '@/shared/lib/rentals'
import type { BillingSettings, Lease, RentPayment } from '@/shared/lib/types'
import { Button, EmptyState, Segmented, Select, useConfirm } from '@/shared/ui/base'
import { WhatsAppIcon } from '@/shared/ui/icons'
import { useQuickAdd } from '../dialogs'
import { useLookups, useNames, useSave } from '../hooks'
import { LEASE_STATUS, PAY_METHOD, RENT_STATUS } from '../labels'
import { printOwnerStatement } from '../print'
import { useLeaseTitle } from '../rentals'
import { PageHeader, Pill, SearchBox, Stat, Tabs } from '../ui'

type Tab = 'leases' | 'dues' | 'receipts' | 'owners'
const TABS: Tab[] = ['leases', 'dues', 'receipts', 'owners']

/** A WhatsApp reminder for the rent of a month, in the tenant's language. */
export function useRentReminder() {
  const L = useLookups()
  const { s } = useNames()
  return (l: Lease, period: string, due: string, amount: number, late: boolean) => {
    const t = L.client(l.tenant_client_id)
    if (!t) return null
    const lang = t.lang ?? 'ar'
    const text = rentReminder(late ? 'late' : 'due', lang, { name: t.full_name, period, amount: `${fmtNumber(amount)} ${lang === 'ar' ? 'د.م.' : 'DH'}`, ref: L.property(l.property_id)?.ref ?? '', due, agency: s.agency.name[lang] || s.agency.name.ar })
    return waLink(t.whatsapp || t.phone, text)
  }
}

export function Rentals() {
  const quick = useQuickAdd()
  const nav = useNavigate()
  const title = useLeaseTitle()
  const [params, setParams] = useSearchParams()
  const tab = (TABS.includes(params.get('tab') as Tab) ? params.get('tab') : 'leases') as Tab
  const setTab = (t: Tab) => setParams(t === 'leases' ? {} : { tab: t }, { replace: true })
  const { data: leases = [] } = useTable<Lease>('leases')
  const { data: rents = [] } = useTable<RentPayment>('rent_payments')
  const today = new Date()
  const cur = periodOf(today)

  const info = useMemo(
    () =>
      leases.map((l) => ({
        l,
        arrears: l.managed && l.status === 'active' ? leaseArrears(l, rents, today) : null,
        rev: revisionStatus(l, today),
        current: rentFor(l, cur),
        depositBy: depositReturnBy(l),
      })),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [leases, rents, cur],
  )
  const active = info.filter((x) => x.l.status === 'active')
  const managed = active.filter((x) => x.l.managed)
  const stats = {
    active: active.length,
    due: managed.reduce((s, x) => s + x.current.rent + x.current.charges, 0),
    collected: rents.filter((r) => r.status === 'valid' && r.paid_at.slice(0, 7) === cur).reduce((s, r) => s + r.rent + r.charges, 0),
    arrears: managed.reduce((s, x) => s + (x.arrears?.amount ?? 0), 0),
    late: managed.filter((x) => (x.arrears?.months ?? 0) > 0).length,
    deposits: leases.filter((l) => l.deposit_holder === 'agency' && !l.deposit_returned_at).reduce((s, l) => s + l.deposit, 0),
    fees: managementFees(leases, rents)
      .filter((f) => f.date.slice(0, 7) === cur)
      .reduce((s, f) => s + f.amount, 0),
  }

  return (
    <>
      <PageHeader
        title="الكراء والتسيير"
        subtitle="عقود الكراء، الأداءات الشهرية ووصولاتها، المتأخرات، مراجعة الوجيبة، وحسابات الملاك (القانون 67.12)"
        icon={<Key className="size-6" />}
        actions={
          <Button variant="gold" icon={<Plus className="size-4" />} onClick={() => quick('lease', {}, (row) => nav(`/admin/rentals/${(row as Lease).id}`))}>
            عقد كراء جديد
          </Button>
        }
      />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="عقود سارية" value={stats.active} hint={`${managed.length} تحت تسيير الوكالة`} icon={<FileSignature className="size-5" />} accent="#0f766e" />
        <Stat label={`واجب ${monthName(cur, 'ar')}`} value={fmtNumber(stats.due)} hint={`حُصِّل ${fmtNumber(stats.collected)} د.م.`} icon={<Banknote className="size-5" />} accent="#1d4ed8" />
        <Stat label="متأخرات الكراء" value={fmtNumber(stats.arrears)} hint={stats.late ? `${stats.late} عقد متأخر` : 'لا متأخرات'} icon={<Hourglass className="size-5" />} accent={stats.late ? '#b91c1c' : '#64748b'} />
        <Stat label="عمولة التسيير هذا الشهر" value={fmtNumber(Math.round(stats.fees))} hint={`ضمانات عند الوكالة: ${fmtNumber(stats.deposits)} د.م.`} icon={<Landmark className="size-5" />} accent="#7c3aed" />
      </div>
      <Tabs
        value={tab}
        onChange={setTab}
        tabs={[
          { value: 'leases', label: 'العقود', count: leases.length },
          { value: 'dues', label: 'المستحقات', count: stats.late || undefined },
          { value: 'receipts', label: 'الوصولات', count: rents.length },
          { value: 'owners', label: 'حسابات الملاك' },
        ]}
        className="mt-6 mb-4"
      />
      {tab === 'leases' && <LeasesTab info={info} />}
      {tab === 'dues' && <DuesTab leases={managed.map((x) => x.l)} rents={rents} />}
      {tab === 'receipts' && <ReceiptsTab rents={rents} leases={leases} title={title} />}
      {tab === 'owners' && <OwnersTab leases={leases} rents={rents} />}
    </>
  )
}

/* ------------------------------------------------------------------ */
function LeasesTab({ info }: { info: { l: Lease; arrears: ReturnType<typeof leaseArrears> | null; rev: ReturnType<typeof revisionStatus>; current: { rent: number; charges: number }; depositBy: string | null }[] }) {
  const nav = useNavigate()
  const L = useLookups()
  const [filter, setFilter] = useState<'active' | 'ended' | 'all'>('active')
  const [q, setQ] = useState('')
  const today = localDate(new Date())
  const soon = localDate(new Date(Date.now() + 60 * 86_400_000))
  const list = info
    .filter((x) => (filter === 'all' ? true : filter === 'active' ? x.l.status === 'active' : x.l.status !== 'active'))
    .filter((x) => {
      if (!q.trim()) return true
      const p = L.property(x.l.property_id)
      return `${p?.ref ?? ''} ${p?.title ?? ''} ${L.client(x.l.tenant_client_id)?.full_name ?? ''} ${L.client(x.l.owner_client_id)?.full_name ?? ''}`.toLowerCase().includes(q.trim().toLowerCase())
    })
    .sort((a, b) => (b.arrears?.amount ?? 0) - (a.arrears?.amount ?? 0) || b.l.start_date.localeCompare(a.l.start_date))
  return (
    <div className="card overflow-hidden">
      <div className="flex flex-col gap-3 border-b border-line p-4 sm:flex-row sm:items-center">
        <SearchBox value={q} onChange={setQ} placeholder="العقار، المكتري أو المالك…" className="sm:max-w-xs" />
        <Segmented
          value={filter}
          onChange={setFilter}
          options={[
            { value: 'active' as const, label: 'سارية' },
            { value: 'ended' as const, label: 'منتهية' },
            { value: 'all' as const, label: 'الكل' },
          ]}
        />
      </div>
      {list.length === 0 ? (
        <EmptyState icon={<Key className="size-7" />} title="لا توجد عقود هنا" text="سجّل كل عقد كراء تحرره الوكالة: تتابع الأداءات والوصولات والمراجعة والتجديد من مكان واحد." />
      ) : (
        <div className="overflow-x-auto">
          <table className="table">
            <thead>
              <tr>
                <th>العقار</th>
                <th>المكتري</th>
                <th>المالك</th>
                <th>الكراء الحالي</th>
                <th>الحالة</th>
                <th>تنبيهات</th>
              </tr>
            </thead>
            <tbody>
              {list.map(({ l, arrears, rev, current, depositBy }) => {
                const p = L.property(l.property_id)
                return (
                  <tr key={l.id} className="cursor-pointer" onClick={() => nav(`/admin/rentals/${l.id}`)}>
                    <td>
                      <div className="num text-xs font-bold text-gold-700">{p?.ref ?? '—'}</div>
                      <div className="max-w-[220px] truncate text-sm font-semibold text-navy">{p?.title ?? ''}</div>
                    </td>
                    <td className="text-sm">{L.client(l.tenant_client_id)?.full_name ?? '—'}</td>
                    <td className="text-sm text-muted">{L.client(l.owner_client_id)?.full_name ?? '—'}</td>
                    <td className="num font-bold whitespace-nowrap text-navy">
                      {fmtNumber(current.rent)}
                      {current.charges > 0 && <span className="text-xs font-normal text-muted"> + {fmtNumber(current.charges)}</span>}
                    </td>
                    <td>
                      <Pill color={LEASE_STATUS[l.status].color}>{LEASE_STATUS[l.status].label}</Pill>
                      {l.managed && <span className="ms-1 text-[11px] text-teal">تسيير</span>}
                    </td>
                    <td>
                      <div className="flex flex-wrap gap-1">
                        {arrears && arrears.amount > 0 && <Pill color="#b91c1c">متأخر {fmtNumber(arrears.amount)}</Pill>}
                        {l.status === 'active' && rev.eligible && <Pill color="#7c3aed">مراجعة ممكنة +{rev.cap}%</Pill>}
                        {l.status === 'active' && l.end_date && l.end_date >= today && l.end_date <= soon && <Pill color="#b45309">ينتهي {fmtDate(l.end_date)}</Pill>}
                        {depositBy && <Pill color={depositBy < today ? '#b91c1c' : '#b45309'}>إرجاع الضمانة قبل {fmtDate(depositBy)}</Pill>}
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

/* ------------------------------------------------------------------ */
function DuesTab({ leases, rents }: { leases: Lease[]; rents: RentPayment[] }) {
  const quick = useQuickAdd()
  const title = useLeaseTitle()
  const remind = useRentReminder()
  const today = new Date()
  const months = Array.from({ length: 6 }, (_, i) => addMonths(periodOf(today), 1 - i))
  const [period, setPeriod] = useState(periodOf(today))
  const rows = leases
    .map((l) => ({ l, row: leaseSchedule(l, rents, today).find((r) => r.period === period) }))
    .filter((x): x is { l: Lease; row: NonNullable<typeof x.row> } => Boolean(x.row))
    .sort((a, b) => b.row.late - a.row.late)
  const older = leases.flatMap((l) => leaseSchedule(l, rents, today).filter((r) => r.late > 0 && r.period < period).map((row) => ({ l, row })))
  if (leases.length === 0) return <EmptyState icon={<Banknote className="size-7" />} title="لا توجد عقود تحت التسيير" text="فعّل «الوكالة تحصّل الكراء» في عقد الكراء لتتبع أداءاته الشهرية هنا." />
  const line = (l: Lease, row: (typeof rows)[number]['row']) => {
    const link = row.status !== 'paid' ? remind(l, row.period, row.due, row.amount - row.paid, row.late > 0) : null
    return (
      <tr key={`${l.id}-${row.period}`}>
        <td>
          <Link to={`/admin/rentals/${l.id}`} className="text-sm font-semibold text-navy hover:underline">
            {title(l)}
          </Link>
        </td>
        <td className="text-sm whitespace-nowrap text-muted">{monthName(row.period, 'ar')}</td>
        <td className="text-sm whitespace-nowrap text-muted">{fmtDate(row.due)}</td>
        <td className="num font-bold whitespace-nowrap">{fmtNumber(row.amount)}</td>
        <td className="num whitespace-nowrap text-success">{fmtNumber(row.paid)}</td>
        <td>
          <Pill color={RENT_STATUS[row.status].color}>{RENT_STATUS[row.status].label}</Pill>
          {row.late > 0 && <span className="ms-1 text-xs font-semibold text-danger">{row.late} يوماً</span>}
        </td>
        <td>
          <div className="flex justify-end gap-1.5">
            {link && (
              <a href={link} target="_blank" rel="noopener noreferrer" className="inline-flex size-9 items-center justify-center rounded-xl bg-[#25D366]/10 text-[#128C7E] hover:bg-[#25D366]/20" title={row.late > 0 ? 'تذكير بالتأخر' : 'تذكير بالأجل'}>
                <WhatsAppIcon className="size-4" />
              </a>
            )}
            {row.status !== 'paid' && (
              <Button size="sm" variant="outline" icon={<Wallet className="size-4" />} onClick={() => quick('rent', { lease_id: l.id, period: row.period })}>
                تسجيل الأداء
              </Button>
            )}
          </div>
        </td>
      </tr>
    )
  }
  return (
    <div className="space-y-6">
      <div className="card overflow-hidden">
        <div className="flex flex-wrap items-center gap-3 border-b border-line p-4">
          <Select value={period} onChange={(e) => setPeriod(e.target.value)} className="h-11 w-auto">
            {months.map((m) => (
              <option key={m} value={m}>
                {monthName(m, 'ar')}
              </option>
            ))}
          </Select>
          <span className="text-sm text-muted">
            مؤدى {rows.filter((x) => x.row.status === 'paid').length} من {rows.length}
          </span>
        </div>
        <div className="overflow-x-auto">
          <table className="table">
            <thead>
              <tr>
                <th>العقد</th>
                <th>الشهر</th>
                <th>الأجل</th>
                <th>الواجب</th>
                <th>المؤدى</th>
                <th>الحالة</th>
                <th />
              </tr>
            </thead>
            <tbody>{rows.map((x) => line(x.l, x.row))}</tbody>
          </table>
        </div>
      </div>
      {older.length > 0 && (
        <div className="card overflow-hidden">
          <h2 className="flex items-center gap-2 border-b border-line px-5 py-3.5 text-[15px] font-bold text-navy">
            <AlarmClock className="size-4 text-danger" /> متأخرات الأشهر السابقة
          </h2>
          <div className="overflow-x-auto">
            <table className="table">
              <tbody>{older.map((x) => line(x.l, x.row))}</tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}

/* ------------------------------------------------------------------ */
function ReceiptsTab({ rents, leases, title }: { rents: RentPayment[]; leases: Lease[]; title: (l: Lease) => string }) {
  const quick = useQuickAdd()
  const [q, setQ] = useState('')
  const byId = new Map(leases.map((l) => [l.id, l]))
  const list = rents
    .filter((r) => !q.trim() || `${r.no} ${byId.get(r.lease_id) ? title(byId.get(r.lease_id)!) : ''} ${r.reference ?? ''}`.toLowerCase().includes(q.trim().toLowerCase()))
    .sort((a, b) => b.paid_at.localeCompare(a.paid_at) || b.no.localeCompare(a.no))
  return (
    <div className="card overflow-hidden">
      <div className="border-b border-line p-4">
        <SearchBox value={q} onChange={setQ} placeholder="رقم الوصل، العقار أو المكتري…" className="sm:max-w-xs" />
      </div>
      {list.length === 0 ? (
        <EmptyState icon={<Receipt className="size-7" />} title="لا توجد وصولات كراء" text="كل أداء يُسجل يأخذ وصلاً مرقماً يفصل الكراء عن التكاليف، كما تفرض المادة 11." />
      ) : (
        <div className="overflow-x-auto">
          <table className="table">
            <thead>
              <tr>
                <th>الوصل</th>
                <th>التاريخ</th>
                <th>العقد</th>
                <th>الشهر</th>
                <th>المبلغ</th>
                <th>الأداء</th>
                <th>للمالك</th>
              </tr>
            </thead>
            <tbody>
              {list.map((r) => {
                const l = byId.get(r.lease_id)
                return (
                  <tr key={r.id} className="cursor-pointer" onClick={() => quick('rent', r)}>
                    <td className="num font-bold whitespace-nowrap text-gold-700">{r.no}</td>
                    <td className="text-sm whitespace-nowrap text-muted">{fmtDate(r.paid_at)}</td>
                    <td className="text-sm">{l ? title(l) : '—'}</td>
                    <td className="text-sm whitespace-nowrap text-muted">{monthName(r.period, 'ar')}</td>
                    <td className={r.status === 'cancelled' ? 'num whitespace-nowrap text-subtle line-through' : 'num font-bold whitespace-nowrap text-navy'}>{fmtNumber(r.rent + r.charges)}</td>
                    <td className="text-sm text-muted">{PAY_METHOD[r.method]}</td>
                    <td className="text-xs text-muted">{l?.managed ? (r.remitted_at ? `حُوّل ${fmtDate(r.remitted_at)}` : <span className="font-semibold text-warning">لم يُحوَّل</span>) : '—'}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

/* ------------------------------------------------------------------ */
function OwnersTab({ leases, rents }: { leases: Lease[]; rents: RentPayment[] }) {
  const L = useLookups()
  const { s } = useNames()
  const confirm = useConfirm()
  const { data: billing } = useBilling()
  const { save } = useSave<RentPayment>('rent_payments', 'rent', (r) => r.no)
  const today = new Date()
  const year = today.getFullYear()
  const months = Array.from({ length: 12 }, (_, i) => addMonths(periodOf(today), -i))
  const [range, setRange] = useState(periodOf(today))
  const [from, to] = range.startsWith('year-') ? [`${range.slice(5)}-01-01`, `${range.slice(5)}-12-31`] : [`${range}-01`, `${range}-31`]
  const label = range.startsWith('year-') ? `سنة ${range.slice(5)}` : monthName(range, 'ar')
  const owners = [...new Set(leases.filter((l) => l.managed).map((l) => l.owner_client_id).filter((x): x is string => Boolean(x)))]

  const remitAll = async (ownerId: string) => {
    const st = ownerStatement(leases, rents, ownerId, from, to)
    const todo = st.rows.filter((r) => !r.payment.remitted_at)
    if (!todo.length) return toast.info('لا شيء للتحويل في هذه الفترة')
    if (!(await confirm({ title: `تسجيل تحويل ${fmtNumber(st.total.toRemit)} د.م. للمالك؟`, text: `${todo.length} وصل يُسجل كمحوَّل اليوم.`, confirmLabel: 'نعم، سجّل التحويل' }))) return
    const d = localDate(new Date())
    for (const r of todo) await save({ ...r.payment, remitted_at: d }, { silent: true })
    toast.success('سُجل التحويل للمالك')
  }

  if (owners.length === 0) return <EmptyState icon={<Landmark className="size-7" />} title="لا يوجد ملاك تحت التسيير" text="حين تحصّل الوكالة الكراء لحساب مالك، يظهر هنا ما حُصّل وعمولة الوكالة وما يجب تحويله له." />
  return (
    <div className="space-y-4">
      <Select value={range} onChange={(e) => setRange(e.target.value)} className="h-11 w-auto">
        {months.map((m) => (
          <option key={m} value={m}>
            {monthName(m, 'ar')}
          </option>
        ))}
        <option value={`year-${year}`}>سنة {year} كاملة</option>
        <option value={`year-${year - 1}`}>سنة {year - 1} كاملة</option>
      </Select>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {owners.map((ownerId) => {
          const owner = L.client(ownerId)
          const st = ownerStatement(leases, rents, ownerId, from, to)
          return (
            <div key={ownerId} className="card p-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-base font-bold text-navy">{owner?.full_name ?? '—'}</div>
                  <div className="text-xs text-muted">
                    {leases.filter((l) => l.owner_client_id === ownerId && l.managed).length} عقد تحت التسيير · {label}
                  </div>
                </div>
                <Pill color={st.total.toRemit > 0 ? '#b45309' : '#15803d'}>{st.total.toRemit > 0 ? `للتحويل ${fmtNumber(st.total.toRemit)}` : 'لا شيء للتحويل'}</Pill>
              </div>
              <dl className="mt-4 grid grid-cols-2 gap-2 text-sm sm:grid-cols-4">
                {[
                  { k: 'المحصل', v: st.total.collected },
                  { k: 'عمولة الوكالة', v: st.total.fees },
                  { k: 'الصافي للمالك', v: st.total.net },
                  { k: 'حُوّل', v: st.total.remitted },
                ].map((x) => (
                  <div key={x.k} className="rounded-xl bg-ivory p-2.5">
                    <dt className="text-[11px] text-muted">{x.k}</dt>
                    <dd className="num font-bold text-navy">{fmtNumber(Math.round(x.v))}</dd>
                  </div>
                ))}
              </dl>
              <div className="mt-4 flex flex-wrap gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  icon={<Printer className="size-4" />}
                  onClick={() =>
                    printOwnerStatement(
                      owner?.full_name ?? '',
                      label,
                      st.rows.map((r) => ({ date: r.payment.paid_at, no: r.payment.no, ref: L.property(r.lease.property_id)?.ref ?? '', period: r.payment.period, collected: r.payment.rent + r.payment.charges, fee: r.fee, net: r.net, remitted: r.payment.remitted_at })),
                      st.total,
                      billing as BillingSettings,
                      s,
                    )
                  }
                >
                  كشف الحساب
                </Button>
                {st.total.toRemit > 0 && (
                  <Button size="sm" icon={<Send className="size-4" />} onClick={() => void remitAll(ownerId)}>
                    تسجيل التحويل
                  </Button>
                )}
              </div>
            </div>
          )
        })}
      </div>
      <p className="text-xs text-subtle">آخر تحديث: {fmtDate(nowIso())}</p>
    </div>
  )
}
