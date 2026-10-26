import { AlertTriangle, Ban, Plus, Printer, Receipt, Trash2, X } from 'lucide-react'
import { useMemo, useState } from 'react'
import { toast } from 'sonner'
import { amountInWordsFr } from '@/shared/lib/billing'
import { useBilling, useTable } from '@/shared/lib/data'
import { fmtDate, fmtMoney2, fmtNumber, localDate, nowIso, uid } from '@/shared/lib/format'
import { depositMax, leaseSchedule, monthName, periodOf, rentFor } from '@/shared/lib/rentals'
import type { BillingSettings, InventoryItem, InventoryState, Lease, LeaseUsage, PayMethod, Property, RentPayment } from '@/shared/lib/types'
import { Button, Field, Input, Modal, Segmented, Select, Switch, Textarea, cn } from '@/shared/ui/base'
import { useClientOptions, usePropertyOptions } from './dialogs'
import { useCan, useDeleteRow, useLookups, useMe, useNames, useSave } from './hooks'
import { LEASE_USAGE, PAY_METHOD, RENT_STATUS } from './labels'
import { printRentReceipt } from './print'
import { Combo, Pill } from './ui'

const num = (v: string) => (v.trim() === '' || Number.isNaN(Number(v)) ? 0 : Number(v))
const PRO_TYPES = new Set(['office', 'commercial'])

/** «SH-1011 · Imane Ziani» */
export function useLeaseTitle() {
  const L = useLookups()
  return (l: Pick<Lease, 'property_id' | 'tenant_client_id'>) => [L.property(l.property_id)?.ref, L.client(l.tenant_client_id)?.full_name].filter(Boolean).join(' · ') || 'عقد كراء'
}

/* ------------------------------------------------------------------ */
/* Lease: create or edit                                                */
/* ------------------------------------------------------------------ */
export function LeaseDialog({ initial = {}, onClose, onSaved }: { initial?: Partial<Lease>; onClose: () => void; onSaved?: (l: Lease) => void }) {
  const me = useMe()
  const can = useCan()
  const L = useLookups()
  const title = useLeaseTitle()
  const propertyOptions = usePropertyOptions()
  const clientOptions = useClientOptions()
  const isNew = !initial.id
  const [f, setF] = useState<Lease>({
    id: uid(),
    property_id: null,
    owner_client_id: null,
    tenant_client_id: null,
    usage: 'housing',
    start_date: localDate(new Date()),
    end_date: null,
    rent: 0,
    charges: 0,
    charges_note: null,
    pay_day: 5,
    payment_method: 'cash',
    deposit: 0,
    deposit_holder: 'owner',
    deposit_returned_at: null,
    managed: false,
    management_rate: 8,
    revisions: [],
    equipment: null,
    obligations: null,
    inventory: {},
    status: 'active',
    ended_at: null,
    notes: null,
    created_by: me.id,
    created_at: nowIso(),
    updated_at: nowIso(),
    ...initial,
  } as Lease)
  const set = <K extends keyof Lease>(k: K, v: Lease[K]) => setF((x) => ({ ...x, [k]: v }))
  const [markRented, setMarkRented] = useState(true)
  const { save, pending } = useSave<Lease>('leases', 'lease', (l) => title(l))
  const saveProp = useSave<Property>('properties', 'property', (p) => p.ref)
  const del = useDeleteRow('leases', 'lease')
  const { data: rents = [] } = useTable<RentPayment>('rent_payments')
  const p = L.property(f.property_id)
  const max = depositMax(f.rent)

  const pickProperty = (id: string | null) => {
    const x = L.property(id)
    setF((cur) => ({
      ...cur,
      property_id: id,
      rent: cur.rent || (x?.purpose === 'rent' ? x.price : 0),
      owner_client_id: cur.owner_client_id ?? x?.owner_client_id ?? null,
      usage: x && PRO_TYPES.has(x.type) ? 'professional' : cur.usage,
    }))
  }

  const submit = async () => {
    if (!f.rent || f.rent <= 0) return toast.error('اكتب مبلغ الكراء الشهري')
    if (!f.start_date) return toast.error('اختر تاريخ بداية العقد')
    if (f.end_date && f.end_date <= f.start_date) return toast.error('تاريخ النهاية يجب أن يكون بعد البداية')
    if (f.deposit > max) return toast.error(`الضمانة لا يمكن أن تتجاوز كراء شهرين (${fmtNumber(max)} د.م.) — المادة 20 من القانون 67.12`)
    const saved = await save({ ...f, management_rate: f.managed ? f.management_rate : 0, updated_at: nowIso() }, { isNew, message: isNew ? 'سُجل عقد الكراء' : undefined })
    if (!saved) return
    if (isNew && markRented && p && p.status !== 'rented' && can('properties')) {
      await saveProp.save({ ...p, status: 'rented', published: false, featured: false, updated_at: nowIso() }, { silent: true, action: 'status', meta: { status: 'rented' } })
    }
    onSaved?.(saved)
    onClose()
  }

  return (
    <Modal
      open
      onClose={onClose}
      size="xl"
      title={isNew ? 'عقد كراء جديد' : 'تعديل عقد الكراء'}
      footer={
        <>
          {!isNew && can('delete') && (
            <Button
              variant="ghost"
              className="me-auto text-danger"
              icon={<Trash2 className="size-4" />}
              onClick={async () => {
                if (rents.some((r) => r.lease_id === f.id)) return toast.error('لهذا العقد وصولات كراء، فلا يُحذف. يمكنك إنهاؤه من ملف العقد.')
                if (await del(f.id, title(f))) onClose()
              }}
            >
              حذف
            </Button>
          )}
          <Button variant="ghost" onClick={onClose}>
            إلغاء
          </Button>
          <Button loading={pending} onClick={() => void submit()}>
            حفظ العقد
          </Button>
        </>
      }
    >
      <div className="space-y-5">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <Field label="العقار">
            <Combo value={f.property_id} onChange={pickProperty} options={propertyOptions} placeholder="اختر العقار" />
          </Field>
          <Field label="المكري (المالك)">
            <Combo value={f.owner_client_id} onChange={(v) => set('owner_client_id', v)} options={clientOptions} placeholder="اختر من العملاء" />
          </Field>
          <Field label="المكتري">
            <Combo value={f.tenant_client_id} onChange={(v) => set('tenant_client_id', v)} options={clientOptions} placeholder="اختر من العملاء" />
          </Field>
        </div>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <Field label="الغرض" hint={f.usage === 'housing' ? 'المراجعة: 8% كل 3 سنوات' : 'المراجعة: 10% كل 3 سنوات'}>
            <Segmented value={f.usage} onChange={(v) => set('usage', v as LeaseUsage)} options={(Object.keys(LEASE_USAGE) as LeaseUsage[]).map((k) => ({ value: k, label: LEASE_USAGE[k] }))} className="flex w-full [&>button]:flex-1" />
          </Field>
          <Field label="بداية العقد" required>
            <Input type="date" dir="ltr" className="num" value={f.start_date} onChange={(e) => set('start_date', e.target.value)} />
          </Field>
          <Field label="نهاية العقد" hint="فارغ = يتجدد ضمنياً">
            <Input type="date" dir="ltr" className="num" min={f.start_date} value={f.end_date ?? ''} onChange={(e) => set('end_date', e.target.value || null)} />
          </Field>
        </div>
        <section className="grid grid-cols-1 gap-4 rounded-2xl border border-line bg-ivory p-4 md:grid-cols-4">
          <Field label="الكراء الشهري" required>
            <Input type="number" inputMode="numeric" dir="ltr" className="num" value={f.rent || ''} onChange={(e) => set('rent', num(e.target.value))} />
          </Field>
          <Field label="التكاليف الشهرية" hint="السانديك، النظافة…">
            <Input type="number" inputMode="numeric" dir="ltr" className="num" value={f.charges || ''} onChange={(e) => set('charges', num(e.target.value))} />
          </Field>
          <Field label="طبيعة التكاليف" className="md:col-span-2">
            <Input value={f.charges_note ?? ''} onChange={(e) => set('charges_note', e.target.value || null)} placeholder="مثلاً: واجبات السانديك والمصعد" />
          </Field>
          <Field label="يوم الأداء من كل شهر">
            <Input type="number" min={1} max={28} dir="ltr" className="num" value={f.pay_day} onChange={(e) => set('pay_day', Math.min(28, Math.max(1, num(e.target.value) || 1)))} />
          </Field>
          <Field label="طريقة الأداء">
            <Select value={f.payment_method} onChange={(e) => set('payment_method', e.target.value as PayMethod)}>
              {(Object.keys(PAY_METHOD) as PayMethod[]).map((k) => (
                <option key={k} value={k}>
                  {PAY_METHOD[k]}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="الضمانة" hint={f.rent ? `الحد القانوني: شهران = ${fmtNumber(max)} د.م.` : 'لا تتجاوز كراء شهرين'} error={f.deposit > max && f.rent > 0 ? 'تتجاوز الحد القانوني' : null}>
            <Input type="number" inputMode="numeric" dir="ltr" className="num" value={f.deposit || ''} onChange={(e) => set('deposit', num(e.target.value))} />
          </Field>
          <Field label="الضمانة عند">
            <Segmented
              value={f.deposit_holder}
              onChange={(v) => set('deposit_holder', v)}
              options={[
                { value: 'owner', label: 'المالك' },
                { value: 'agency', label: 'الوكالة' },
              ]}
              className="flex w-full [&>button]:flex-1"
            />
          </Field>
        </section>
        <section className="space-y-3 rounded-2xl border border-line p-4">
          <Switch checked={f.managed} onChange={(v) => set('managed', v)} label="الوكالة تحصّل الكراء لحساب المالك (التسيير)" />
          {f.managed && (
            <Field label="عمولة التسيير" hint={f.rent ? `${fmtNumber(Math.round((f.rent * f.management_rate) / 100))} د.م. كل شهر، على الكراء دون التكاليف` : 'نسبة من الكراء المحصل'} className="max-w-xs">
              <div className="relative">
                <Input type="number" min={0} max={30} step="0.5" dir="ltr" className="num pe-10" value={f.management_rate} onChange={(e) => set('management_rate', num(e.target.value))} />
                <span className="pointer-events-none absolute inset-y-0 end-3 flex items-center text-xs text-muted">%</span>
              </div>
            </Field>
          )}
          {!f.managed && <p className="text-xs text-muted">الكراء يُؤدى مباشرة للمالك: تتابع الوكالة العقد والمراجعة والتجديد فقط.</p>}
        </section>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <Field label="التجهيزات المخصصة للمكتري" hint="الأثاث والأجهزة المسلمة معه">
            <Textarea rows={2} value={f.equipment ?? ''} onChange={(e) => set('equipment', e.target.value || null)} />
          </Field>
          <Field label="التزامات خاصة" hint="ما يتحمله كل طرف زيادة على القانون">
            <Textarea rows={2} value={f.obligations ?? ''} onChange={(e) => set('obligations', e.target.value || null)} />
          </Field>
        </div>
        <Field label="ملاحظات داخلية">
          <Textarea rows={2} value={f.notes ?? ''} onChange={(e) => set('notes', e.target.value || null)} />
        </Field>
        {isNew && p && p.status !== 'rented' && <Switch checked={markRented} onChange={setMarkRented} label={`تحويل ${p.ref} إلى «مُكترى» وإخفاؤه من الموقع`} />}
      </div>
    </Modal>
  )
}

/* ------------------------------------------------------------------ */
/* Rent received: record it, print its receipt, cancel or remit it      */
/* ------------------------------------------------------------------ */
export function RentDialog({ initial = {}, onClose, onSaved }: { initial?: Partial<RentPayment>; onClose: () => void; onSaved?: (p: RentPayment) => void }) {
  const { data: rents = [] } = useTable<RentPayment>('rent_payments')
  const [shownId, setShownId] = useState<string | null>(initial.id ?? null)
  const [made, setMade] = useState<RentPayment | null>(null)
  if (shownId) {
    const p = rents.find((x) => x.id === shownId) ?? (made?.id === shownId ? made : (initial as RentPayment))
    return <RentView p={p} onClose={onClose} />
  }
  return (
    <RentForm
      initial={initial}
      onClose={onClose}
      onSaved={(p) => {
        setMade(p)
        setShownId(p.id)
        onSaved?.(p)
      }}
    />
  )
}

function RentForm({ initial, onClose, onSaved }: { initial: Partial<RentPayment>; onClose: () => void; onSaved: (p: RentPayment) => void }) {
  const me = useMe()
  const title = useLeaseTitle()
  const { data: leases = [] } = useTable<Lease>('leases')
  const { data: rents = [] } = useTable<RentPayment>('rent_payments')
  const { save, pending } = useSave<RentPayment>('rent_payments', 'rent', (p) => `${p.period} · ${fmtNumber(p.rent + p.charges)} د.م.`)
  const lease = leases.find((l) => l.id === initial.lease_id)
  const today = localDate(new Date())
  const open = useMemo(() => (lease ? leaseSchedule(lease, rents).filter((r) => r.status !== 'paid') : []), [lease, rents])
  const rest = (period: string) => {
    if (!lease) return { rent: 0, charges: 0 }
    const due = rentFor(lease, period)
    const paid = rents.filter((r) => r.lease_id === lease.id && r.period === period && r.status === 'valid')
    return { rent: Math.max(0, due.rent - paid.reduce((s, r) => s + r.rent, 0)), charges: Math.max(0, due.charges - paid.reduce((s, r) => s + r.charges, 0)) }
  }
  const firstPeriod = initial.period ?? open.find((r) => r.status !== 'upcoming')?.period ?? open[0]?.period ?? periodOf(new Date())
  const [f, setF] = useState(() => ({
    period: firstPeriod,
    ...rest(firstPeriod),
    method: (initial.method ?? lease?.payment_method ?? 'cash') as PayMethod,
    reference: '',
    paid_at: today,
    notes: '',
  }))
  const set = <K extends keyof typeof f>(k: K, v: (typeof f)[K]) => setF((x) => ({ ...x, [k]: v }))
  const periods = [...new Set([...open.map((r) => r.period), f.period])].sort()

  if (!lease) return null

  const submit = async () => {
    if (f.rent + f.charges <= 0) return toast.error('اكتب المبلغ المستلم')
    if (f.paid_at > today) return toast.error('لا يُؤرَّخ الوصل بتاريخ لاحق')
    const row: RentPayment = {
      id: uid(),
      no: '',
      lease_id: lease.id,
      period: f.period,
      rent: Math.round(f.rent * 100) / 100,
      charges: Math.round(f.charges * 100) / 100,
      method: f.method,
      reference: f.method === 'cash' ? null : f.reference.trim() || null,
      paid_at: f.paid_at,
      status: 'valid',
      remitted_at: null,
      notes: f.notes.trim() || null,
      created_by: me.id,
      created_at: nowIso(),
    }
    const saved = await save(row, { isNew: true, silent: true })
    if (!saved) return
    toast.success(`سُجل الأداء — الوصل ${saved.no}`)
    onSaved(saved)
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={`أداء كراء — ${title(lease)}`}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            إلغاء
          </Button>
          <Button loading={pending} onClick={() => void submit()} icon={<Receipt className="size-4" />}>
            تسجيل وإصدار الوصل
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Field label="عن شهر">
          <Select value={f.period} onChange={(e) => setF((x) => ({ ...x, period: e.target.value, ...rest(e.target.value) }))}>
            {periods.map((pr) => {
              const row = open.find((r) => r.period === pr)
              return (
                <option key={pr} value={pr}>
                  {monthName(pr, 'ar')}
                  {row ? ` — ${RENT_STATUS[row.status].label}${row.late ? ` (${row.late} يوماً تأخر)` : ''}` : ''}
                </option>
              )
            })}
          </Select>
        </Field>
        <div className="grid grid-cols-2 gap-4">
          <Field label="الكراء">
            <Input type="number" step="0.01" dir="ltr" className="num" value={f.rent || ''} onChange={(e) => set('rent', num(e.target.value))} />
          </Field>
          <Field label="التكاليف">
            <Input type="number" step="0.01" dir="ltr" className="num" value={f.charges || ''} onChange={(e) => set('charges', num(e.target.value))} />
          </Field>
        </div>
        <p className="rounded-xl bg-navy p-3 text-center text-white">
          المجموع <b className="num text-lg text-gold-300">{fmtMoney2(f.rent + f.charges)} د.م.</b>
          {f.rent + f.charges > 0 && (
            <span dir="ltr" className="block text-xs text-white/70">
              {amountInWordsFr(f.rent + f.charges)}
            </span>
          )}
        </p>
        <Field label="طريقة الأداء">
          <Segmented value={f.method} onChange={(v) => set('method', v)} options={(Object.keys(PAY_METHOD) as PayMethod[]).map((k) => ({ value: k, label: PAY_METHOD[k] }))} className="flex w-full overflow-x-auto [&>button]:flex-1" />
        </Field>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {f.method !== 'cash' && (
            <Field label={f.method === 'cheque' ? 'رقم الشيك والبنك' : 'مرجع العملية'}>
              <Input dir="auto" value={f.reference} onChange={(e) => set('reference', e.target.value)} />
            </Field>
          )}
          <Field label="تاريخ الاستلام">
            <Input type="date" dir="ltr" className="num" max={today} value={f.paid_at} onChange={(e) => set('paid_at', e.target.value)} />
          </Field>
        </div>
        <Field label="ملاحظات" hint="اختياري">
          <Input dir="auto" value={f.notes} onChange={(e) => set('notes', e.target.value)} />
        </Field>
      </div>
    </Modal>
  )
}

function RentView({ p, onClose }: { p: RentPayment; onClose: () => void }) {
  const L = useLookups()
  const { s } = useNames()
  const title = useLeaseTitle()
  const { data: billing } = useBilling()
  const { data: leases = [] } = useTable<Lease>('leases')
  const { save, pending } = useSave<RentPayment>('rent_payments', 'rent', (x) => x.no)
  const [cancelling, setCancelling] = useState(false)
  const [reason, setReason] = useState('')
  const lease = leases.find((l) => l.id === p.lease_id)
  const prop = L.property(lease?.property_id)

  const cancel = async () => {
    if (!reason.trim()) return toast.error('اكتب سبب الإلغاء')
    const ok = await save({ ...p, status: 'cancelled', notes: [p.notes, `ملغى: ${reason.trim()}`].filter(Boolean).join(' — ') }, { action: 'status', meta: { status: 'cancelled' }, message: `أُلغي الوصل ${p.no}` })
    if (ok) setCancelling(false)
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={
        <span className="inline-flex items-center gap-2">
          وصل كراء <span className="num text-gold-700">{p.no}</span>
        </span>
      }
      footer={
        <>
          {p.status === 'valid' && !cancelling && (
            <Button variant="ghost" className="me-auto text-danger" icon={<Ban className="size-4" />} onClick={() => setCancelling(true)}>
              إلغاء الوصل
            </Button>
          )}
          {lease && (
            <Button icon={<Printer className="size-4" />} onClick={() => printRentReceipt(p, lease, prop, L.client(lease.owner_client_id), L.client(lease.tenant_client_id), billing as BillingSettings, s)}>
              طباعة الوصل
            </Button>
          )}
        </>
      }
    >
      <div className="space-y-4">
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <Pill color={p.status === 'valid' ? '#15803d' : '#64748b'}>{p.status === 'valid' ? 'صالح' : 'ملغى'}</Pill>
          {lease && <span className="text-muted">{title(lease)}</span>}
          <span className="text-muted">· {fmtDate(p.paid_at)}</span>
        </div>
        <div className="rounded-2xl bg-navy p-4 text-center text-white">
          <div className="text-xs text-white/60">كراء شهر {monthName(p.period, 'ar')}</div>
          <div className={cn('num mt-1 text-3xl font-extrabold text-gold-300', p.status === 'cancelled' && 'line-through opacity-60')}>{fmtMoney2(p.rent + p.charges)} د.م.</div>
          <div className="mt-1 text-xs text-white/70">
            الكراء {fmtMoney2(p.rent)} · التكاليف {fmtMoney2(p.charges)}
          </div>
        </div>
        <p className="text-sm text-muted">
          {PAY_METHOD[p.method]}
          {p.reference ? ` · ${p.reference}` : ''}
        </p>
        {lease?.managed && p.status === 'valid' && (
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-line p-3 text-sm">
            <span>{p.remitted_at ? `حُوّلت حصة المالك في ${fmtDate(p.remitted_at)}` : 'حصة المالك لم تُحوَّل بعد'}</span>
            <Button size="sm" variant="outline" loading={pending} onClick={() => void save({ ...p, remitted_at: p.remitted_at ? null : localDate(new Date()) }, { message: p.remitted_at ? 'أُلغي تسجيل التحويل' : 'سُجل تحويل حصة المالك' })}>
              {p.remitted_at ? 'إلغاء التحويل' : 'تسجيل التحويل للمالك'}
            </Button>
          </div>
        )}
        {p.notes && <p className="rounded-xl bg-ivory p-3 text-sm text-muted">{p.notes}</p>}
        {cancelling && (
          <div className="space-y-2 rounded-2xl border border-danger/30 bg-danger/5 p-3">
            <Field label="سبب الإلغاء" hint="يبقى الوصل في السجل برقمه، مع علامة «ملغى»">
              <Textarea rows={2} value={reason} onChange={(e) => setReason(e.target.value)} />
            </Field>
            <div className="flex gap-2">
              <Button variant="danger" size="sm" loading={pending} onClick={() => void cancel()}>
                تأكيد الإلغاء
              </Button>
              <Button variant="ghost" size="sm" onClick={() => setCancelling(false)}>
                تراجع
              </Button>
            </div>
          </div>
        )}
      </div>
    </Modal>
  )
}

/* ------------------------------------------------------------------ */
/* State of the premises (art. 7-8): detailed, at entry and at exit     */
/* ------------------------------------------------------------------ */
const VAGUE = /^(حالة )?(جيدة|متوسطة|حسنة|ممتازة)$|^(en )?(bon|mauvais|moyen|excellent) état$/i
const AREAS = ['الصالون', 'غرفة النوم', 'المطبخ', 'الحمام', 'الشرفة', 'المدخل والممر']

export function InventoryDialog({ lease, side, onClose }: { lease: Lease; side: 'in' | 'out'; onClose: () => void }) {
  const title = useLeaseTitle()
  const start: InventoryState = lease.inventory?.[side] ?? { date: localDate(new Date()), items: AREAS.map((area) => ({ area, note: '' })), water: null, electricity: null, keys: null, notes: null }
  const [f, setF] = useState<InventoryState>(start)
  const { save, pending } = useSave<Lease>('leases', 'lease', (l) => title(l))
  const setItem = (i: number, patch: Partial<InventoryItem>) => setF((x) => ({ ...x, items: x.items.map((it, j) => (j === i ? { ...it, ...patch } : it)) }))
  const vague = f.items.filter((it) => VAGUE.test(it.note.trim()))

  const submit = async () => {
    const items = f.items.filter((it) => it.area.trim() && it.note.trim())
    if (!items.length) return toast.error('صف جزءاً واحداً على الأقل من المحل')
    const saved = await save({ ...lease, inventory: { ...lease.inventory, [side]: { ...f, items } }, updated_at: nowIso() }, { message: 'تم حفظ البيان الوصفي' })
    if (saved) onClose()
  }

  return (
    <Modal
      open
      onClose={onClose}
      size="lg"
      title={side === 'in' ? 'البيان الوصفي عند التسليم' : 'البيان الوصفي عند الإرجاع'}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            إلغاء
          </Button>
          <Button loading={pending} onClick={() => void submit()}>
            حفظ
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <p className="rounded-xl bg-sand p-3 text-xs leading-relaxed text-muted">
          تفرض المادة 8 من القانون 67.12 وصف المحل «بكيفية مفصلة ودقيقة» وتجنب عبارات مثل «حالة جيدة» أو «حالة متوسطة». اكتب ما تراه: نوع الأرضية، الكسور، الطلاء، الأجهزة التي تشتغل… ويوقعه الطرفان ويُرفق بالعقد.
        </p>
        <Field label="التاريخ" className="max-w-48">
          <Input type="date" dir="ltr" className="num" value={f.date ?? ''} onChange={(e) => setF((x) => ({ ...x, date: e.target.value || null }))} />
        </Field>
        <div className="space-y-2">
          {f.items.map((it, i) => (
            <div key={i} className="grid grid-cols-[1fr_auto] gap-2 rounded-xl bg-ivory p-2.5 sm:grid-cols-[160px_1fr_auto]">
              <Input value={it.area} onChange={(e) => setItem(i, { area: e.target.value })} placeholder="الجزء" className="col-span-2 sm:col-span-1" />
              <Textarea rows={1} value={it.note} onChange={(e) => setItem(i, { note: e.target.value })} placeholder="الوصف الدقيق" className={cn('min-h-0', VAGUE.test(it.note.trim()) && 'border-warning')} />
              <button type="button" onClick={() => setF((x) => ({ ...x, items: x.items.filter((_, j) => j !== i) }))} className="self-center rounded-full p-2 text-subtle hover:bg-danger/10 hover:text-danger" aria-label="حذف">
                <X className="size-4" />
              </button>
            </div>
          ))}
          <Button size="sm" variant="ghost" icon={<Plus className="size-4" />} onClick={() => setF((x) => ({ ...x, items: [...x.items, { area: '', note: '' }] }))}>
            جزء آخر
          </Button>
        </div>
        {vague.length > 0 && (
          <p className="flex items-start gap-2 rounded-xl bg-warning/10 p-3 text-xs text-warning">
            <AlertTriangle className="mt-0.5 size-4 shrink-0" /> عبارة عامة في: {vague.map((v) => v.area).join('، ')}. صِف الحالة بدقة كما تطلب المادة 8.
          </p>
        )}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <Field label="عداد الماء">
            <Input dir="ltr" className="num" value={f.water ?? ''} onChange={(e) => setF((x) => ({ ...x, water: e.target.value || null }))} />
          </Field>
          <Field label="عداد الكهرباء">
            <Input dir="ltr" className="num" value={f.electricity ?? ''} onChange={(e) => setF((x) => ({ ...x, electricity: e.target.value || null }))} />
          </Field>
          <Field label="المفاتيح المسلمة">
            <Input value={f.keys ?? ''} onChange={(e) => setF((x) => ({ ...x, keys: e.target.value || null }))} />
          </Field>
        </div>
        <Field label="ملاحظات">
          <Textarea rows={2} value={f.notes ?? ''} onChange={(e) => setF((x) => ({ ...x, notes: e.target.value || null }))} />
        </Field>
      </div>
    </Modal>
  )
}
