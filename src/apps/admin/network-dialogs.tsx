import { Plus, Sparkles, Star, Trash2, X } from 'lucide-react'
import { useMemo, useState } from 'react'
import { toast } from 'sonner'
import { agencyNet, defaultCommission, shareAmount, shareFromBroker, sharesTotal, suggestShares } from '@/shared/lib/commission'
import { useNetwork, useSettings, useTable } from '@/shared/lib/data'
import { DEFAULT_NETWORK } from '@/shared/lib/fee-defaults'
import { combineDateTime, fmtNumber, localDate, nowIso, uid } from '@/shared/lib/format'
import { currentMandate, mandateCommission } from '@/shared/lib/owners'
import type { AgreementMode, Broker, BrokerKind, Deal, DealShare, Mandate, NetworkSettings, Property, Purpose, Settings, ShareParty, ShareSide } from '@/shared/lib/types'
import { Button, Field, Input, Modal, Segmented, Select, Switch, Textarea, cn } from '@/shared/ui/base'
import { StaffSelect, useClientOptions, usePropertyOptions } from './dialogs'
import { useCan, useDeleteRow, useLookups, useMe, useNames, useSave } from './hooks'
import { AGREEMENT, BROKER_KIND, SHARE_PARTY, SIDE, SPECIALTIES } from './labels'
import { Chips, Combo, Pill, type ComboOption } from './ui'

const num = (v: string) => (v.trim() === '' || Number.isNaN(Number(v)) ? 0 : Number(v))

/** Partners for a Combo (active first). */
export function useBrokerOptions(kinds?: BrokerKind[]): ComboOption[] {
  const { data: brokers = [] } = useTable<Broker>('brokers')
  return useMemo(
    () =>
      brokers
        .filter((b) => !kinds || kinds.includes(b.kind))
        .sort((a, b) => Number(b.active) - Number(a.active) || a.full_name.localeCompare(b.full_name, 'ar'))
        .map((b) => ({
          value: b.id,
          label: b.full_name,
          sub: [BROKER_KIND[b.kind].label, b.company, b.active ? null : 'متوقف'].filter(Boolean).join(' · '),
          keywords: `${b.phone} ${b.company ?? ''}`,
        })),
    [brokers, kinds],
  )
}

/** The agreement with a partner, in words. */
export function agreementText(b: Broker, n: NetworkSettings): string {
  if (b.kind === 'developer') return b.agreement_mode === 'fixed' ? `يدفع للوكالة ${fmtNumber(b.agreement_value)} د.م. عن كل وحدة` : `يدفع للوكالة ${b.agreement_value}% من ثمن كل وحدة`
  if (b.agreement_mode === 'percent') return `${b.agreement_value}% من العمولة الإجمالية`
  if (b.agreement_mode === 'fixed') return `${fmtNumber(b.agreement_value)} د.م. عن كل صفقة`
  if (b.kind === 'referrer') return `${n.referrer_share}% من العمولة`
  return `حصة الجانب الذي يجلبه حسب العرف: ${n.listing_share}% إن جلب العقار، ${n.client_share}% إن جلب الزبون`
}

export function Stars({ value, onChange, size = 'size-4' }: { value: number | null; onChange?: (v: number | null) => void; size?: string }) {
  return (
    <span className="inline-flex items-center" dir="ltr">
      {[1, 2, 3, 4, 5].map((i) => (
        <button
          key={i}
          type="button"
          disabled={!onChange}
          onClick={() => onChange?.(value === i ? null : i)}
          className={cn('p-0.5', onChange ? 'cursor-pointer' : 'cursor-default')}
          aria-label={`${i}`}
        >
          <Star className={cn(size, (value ?? 0) >= i ? 'fill-gold text-gold' : 'text-line-2')} />
        </button>
      ))}
    </span>
  )
}

/* ------------------------------------------------------------------ */
/* Partner (broker, partner agency, referrer, developer)                */
/* ------------------------------------------------------------------ */
export function BrokerDialog({ initial = {}, onClose, onSaved }: { initial?: Partial<Broker>; onClose: () => void; onSaved?: (b: Broker) => void }) {
  const me = useMe()
  const can = useCan()
  const { s } = useNames()
  const { data: network = DEFAULT_NETWORK } = useNetwork()
  const isNew = !initial.id
  const [f, setF] = useState<Broker>({
    id: uid(),
    full_name: '',
    phone: '',
    whatsapp: null,
    email: null,
    kind: 'broker',
    company: null,
    zones: [],
    specialties: [],
    agreement_mode: 'side',
    agreement_value: 0,
    rating: null,
    active: true,
    notes: null,
    created_by: me.id,
    created_at: nowIso(),
    updated_at: nowIso(),
    ...initial,
  } as Broker)
  const set = <K extends keyof Broker>(k: K, v: Broker[K]) => setF((x) => ({ ...x, [k]: v }))
  const { save, pending } = useSave<Broker>('brokers', 'broker', (b) => b.full_name)
  const del = useDeleteRow('brokers', 'broker')

  const setKind = (k: BrokerKind) =>
    setF((x) => {
      if (k === 'developer') return { ...x, kind: k, agreement_mode: x.agreement_mode === 'fixed' ? 'fixed' : 'percent', agreement_value: x.agreement_mode === 'side' ? 2 : x.agreement_value }
      if (k === 'referrer' && x.agreement_mode === 'side') return { ...x, kind: k, agreement_mode: 'percent', agreement_value: network.referrer_share }
      return { ...x, kind: k }
    })

  const submit = async () => {
    if (!f.full_name.trim()) return toast.error('اكتب اسم الشريك')
    if (!f.phone.trim()) return toast.error('اكتب رقم الهاتف')
    if (f.agreement_mode === 'percent' && (f.agreement_value <= 0 || f.agreement_value > 100)) return toast.error('النسبة يجب أن تكون بين 0 و100')
    if (f.agreement_mode === 'fixed' && f.agreement_value <= 0) return toast.error('اكتب المبلغ المتفق عليه')
    const saved = await save({ ...f, full_name: f.full_name.trim(), phone: f.phone.trim(), agreement_value: f.agreement_mode === 'side' ? 0 : f.agreement_value, updated_at: nowIso() }, { isNew })
    if (saved) {
      onSaved?.(saved)
      onClose()
    }
  }

  const developer = f.kind === 'developer'
  const modes: AgreementMode[] = developer ? ['percent', 'fixed'] : ['side', 'percent', 'fixed']

  return (
    <Modal
      open
      onClose={onClose}
      size="lg"
      title={isNew ? 'شريك جديد في الشبكة' : `تعديل: ${initial.full_name ?? ''}`}
      footer={
        <>
          {!isNew && can('delete') && (
            <Button
              variant="ghost"
              className="me-auto text-danger"
              icon={<Trash2 className="size-4" />}
              onClick={async () => {
                if (await del(f.id, f.full_name, { text: 'تبقى العقارات والصفقات المرتبطة به، ويبقى اسمه مكتوباً في حصص الصفقات القديمة.' })) onClose()
              }}
            >
              حذف
            </Button>
          )}
          <Button variant="ghost" onClick={onClose}>
            إلغاء
          </Button>
          <Button loading={pending} onClick={submit}>
            {isNew ? 'إضافة الشريك' : 'حفظ'}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Segmented value={f.kind} onChange={setKind} options={(Object.keys(BROKER_KIND) as BrokerKind[]).map((k) => ({ value: k, label: BROKER_KIND[k].label }))} className="flex w-full [&>button]:flex-1" />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label={f.kind === 'agency' || developer ? 'اسم المسؤول' : 'الاسم الكامل'} required>
            <Input autoFocus value={f.full_name} onChange={(e) => set('full_name', e.target.value)} />
          </Field>
          {(f.kind === 'agency' || developer) && (
            <Field label={developer ? 'اسم الشركة أو المشروع' : 'اسم الوكالة'}>
              <Input value={f.company ?? ''} onChange={(e) => set('company', e.target.value || null)} />
            </Field>
          )}
          <Field label="الهاتف" required>
            <Input dir="ltr" className="num" inputMode="tel" value={f.phone} onChange={(e) => set('phone', e.target.value)} />
          </Field>
          <Field label="واتساب (إن كان مختلفاً)">
            <Input dir="ltr" className="num" inputMode="tel" value={f.whatsapp ?? ''} onChange={(e) => set('whatsapp', e.target.value || null)} />
          </Field>
          <Field label="البريد الإلكتروني">
            <Input dir="ltr" type="email" value={f.email ?? ''} onChange={(e) => set('email', e.target.value || null)} />
          </Field>
          <Field label="التقييم">
            <div className="flex h-11 items-center">
              <Stars value={f.rating} onChange={(v) => set('rating', v)} size="size-5" />
            </div>
          </Field>
        </div>

        <div className="space-y-3 rounded-2xl border border-gold/30 bg-gold/5 p-4">
          <h3 className="text-sm font-bold text-navy">{developer ? 'العمولة التي يدفعها المنعش للوكالة' : 'الاتفاق على العمولة'}</h3>
          <Segmented value={f.agreement_mode} onChange={(v) => set('agreement_mode', v)} options={modes.map((m) => ({ value: m, label: developer && m === 'percent' ? 'نسبة من ثمن الوحدة' : developer && m === 'fixed' ? 'مبلغ عن كل وحدة' : AGREEMENT[m] }))} className="flex w-full [&>button]:flex-1" />
          {f.agreement_mode === 'side' ? (
            <p className="text-xs leading-relaxed text-muted">
              يأخذ حصة الجانب الذي يجلبه: <b className="num">{network.listing_share}%</b> من العمولة إن جلب العقار، و<b className="num">{network.client_share}%</b> إن جلب الزبون. إن اشترك أكثر من وسيط في الجانب نفسه تُقسم الحصة بينهم بالتساوي. تغيّر هذه النسب من الإعدادات، أو تعدّلها في كل صفقة.
            </p>
          ) : (
            <Field label={f.agreement_mode === 'percent' ? (developer ? 'النسبة من ثمن الوحدة %' : 'النسبة من العمولة الإجمالية %') : 'المبلغ بالدرهم'}>
              <Input type="number" step="0.1" dir="ltr" className="num sm:w-48" value={f.agreement_value || ''} onChange={(e) => set('agreement_value', num(e.target.value))} />
            </Field>
          )}
        </div>

        <Field label="المناطق التي يغطيها">
          <Chips options={s.catalog.neighborhoods.map((n) => ({ value: n.id, label: n.name.ar }))} value={f.zones} onChange={(v) => set('zones', v)} />
        </Field>
        <Field label="التخصص">
          <Chips options={SPECIALTIES} value={f.specialties} onChange={(v) => set('specialties', v)} />
        </Field>
        <Field label="ملاحظات">
          <Textarea rows={2} value={f.notes ?? ''} onChange={(e) => set('notes', e.target.value || null)} />
        </Field>
        <Switch checked={f.active} onChange={(v) => set('active', v)} label={f.active ? 'شريك نشط' : 'التعاون متوقف'} />
      </div>
    </Modal>
  )
}

/* ------------------------------------------------------------------ */
/* Deal: commission of each party and its sharing with partners          */
/* ------------------------------------------------------------------ */
export function DealDialog({ initial = {}, onClose, onSaved }: { initial?: Partial<Deal>; onClose: () => void; onSaved?: (d: Deal) => void }) {
  const me = useMe()
  const can = useCan()
  const L = useLookups()
  const { data: settings } = useSettings()
  const cs = (settings as Settings).commission
  const { data: network = DEFAULT_NETWORK } = useNetwork()
  const { data: brokers = [] } = useTable<Broker>('brokers')
  const { data: mandates = [] } = useTable<Mandate>('mandates')
  const brokerById = useMemo(() => new Map(brokers.map((b) => [b.id, b])), [brokers])
  const propertyOptions = usePropertyOptions()
  const clientOptions = useClientOptions()
  const partnerOptions = useBrokerOptions(['broker', 'agency', 'referrer'])
  const saveMandate = useSave<Mandate>('mandates', 'mandate', (m) => L.property(m.property_id)?.ref ?? 'تفويض')
  const isNew = !initial.id
  const legacy = !isNew && initial.commission_seller == null && initial.commission_buyer == null
  const [f, setF] = useState(() => ({
    id: initial.id ?? uid(),
    property_id: initial.property_id ?? null,
    client_id: initial.client_id ?? null,
    kind: (initial.kind ?? 'sale') as Purpose,
    amount: initial.amount ?? 0,
    seller: initial.commission_seller ?? 0,
    buyer: initial.commission_buyer ?? (legacy ? initial.commission ?? 0 : 0),
    closed_at: localDate(initial.closed_at ?? new Date()),
    notes: initial.notes ?? '',
    shares: (initial.shares ?? []) as DealShare[],
    received: initial.received ?? initial.commission ?? 0,
  }))
  const [receivedAll, setReceivedAll] = useState(isNew || (initial.received ?? initial.commission ?? 0) >= (initial.commission ?? 0))
  const [touched, setTouched] = useState(!isNew)
  const [markProperty, setMarkProperty] = useState(isNew)
  const set = <K extends keyof typeof f>(k: K, v: (typeof f)[K]) => setF((x) => ({ ...x, [k]: v }))
  const deal = useSave<Deal>('deals', 'deal', (d) => `${L.property(d.property_id)?.ref ?? 'صفقة'} — ${fmtNumber(d.amount)} د.م.`)
  const prop = useSave<Property>('properties', 'property', (p) => p.ref)
  const del = useDeleteRow('deals', 'deal')
  const p = L.property(f.property_id)
  const total = (f.seller || 0) + (f.buyer || 0)
  const partners = sharesTotal(f.shares, total)
  const net = agencyNet(total, f.shares)

  const defaults = (kind: Purpose, amount: number, propertyId: string | null) => {
    const d = defaultCommission(kind, amount, cs)
    const lb = brokerById.get(L.property(propertyId)?.broker_id ?? '')
    if (kind === 'sale' && lb?.kind === 'developer') d.seller = Math.round(lb.agreement_mode === 'fixed' ? lb.agreement_value : (amount * lb.agreement_value) / 100)
    // what the owner agreed in his mandate wins over the agency's usual rate
    const m = currentMandate(mandates, propertyId)
    const agreed = m && m.purpose === kind ? mandateCommission(m, amount, kind) : null
    if (agreed != null) d.seller = agreed
    return d
  }
  const reprice = (patch: Partial<typeof f>) =>
    setF((x) => {
      const n = { ...x, ...patch }
      if (touched) return n
      const d = defaults(n.kind, n.amount, n.property_id)
      return { ...n, seller: d.seller, buyer: d.buyer }
    })
  const applyDefaults = () => {
    const d = defaults(f.kind, f.amount, f.property_id)
    setF((x) => ({ ...x, seller: d.seller, buyer: d.buyer }))
    setTouched(false)
  }
  const pickProperty = (id: string | null) => {
    const x = L.property(id)
    reprice({ property_id: id, kind: x?.purpose ?? f.kind, amount: x?.price ?? f.amount })
  }

  const updShare = (id: string, patch: Partial<DealShare>) => setF((x) => ({ ...x, shares: x.shares.map((s) => (s.id === id ? { ...s, ...patch } : s)) }))
  const addShare = (party: ShareParty) =>
    setF((x) => ({
      ...x,
      shares: [
        ...x.shares,
        { id: uid(), party, ref_id: null, name: '', side: party === 'broker' ? 'client' : 'other', mode: 'percent', value: party === 'broker' ? network.client_share : party === 'referrer' ? network.referrer_share : network.staff_bonus || 5, paid: 0, paid_at: null },
      ],
    }))
  const pickPartner = (s: DealShare, id: string | null) => {
    const b = brokerById.get(id ?? '')
    if (!b) return updShare(s.id, { ref_id: null, name: '' })
    const sideCount = f.shares.filter((x) => x.side === s.side && x.party === 'broker' && x.id !== s.id).length + 1
    const pool = s.side === 'listing' ? network.listing_share : network.client_share
    const sug = shareFromBroker(b, s.side, pool, sideCount, network)
    updShare(s.id, { ref_id: b.id, name: b.full_name, party: sug.party, mode: sug.mode, value: sug.value, side: sug.party === 'referrer' ? 'other' : s.side })
  }
  const suggest = () => {
    const lb = brokerById.get(p?.broker_id ?? '')
    const cb = brokerById.get(L.client(f.client_id)?.broker_id ?? '')
    const s = suggestShares({ listing: lb ? [lb] : [], client: cb && cb.id !== lb?.id ? [cb] : [] }, network)
    if (!s.length) return toast.info('لا يوجد وسيط مرتبط بهذا العقار أو بهذا الزبون. أضف الشركاء يدوياً.')
    setF((x) => ({ ...x, shares: s }))
    toast.success('اقتُرح التقسيم حسب الوسطاء المرتبطين بالعقار والزبون')
  }

  if (!can('deals')) return null

  const submit = async () => {
    if (!f.amount || f.amount <= 0) return toast.error('أدخل مبلغ الصفقة')
    if (f.shares.some((s) => !s.ref_id)) return toast.error('اختر اسم كل شريك في تقسيم العمولة، أو احذف السطر الفارغ')
    if (net < 0) return toast.error('مجموع حصص الشركاء أكبر من العمولة')
    const shares = f.shares.map((s) => {
      const amount = shareAmount(s, total)
      const paid = Math.max(0, Math.min(s.paid || 0, amount))
      return { ...s, name: s.party === 'staff' ? L.staffName(s.ref_id) : brokerById.get(s.ref_id ?? '')?.full_name ?? s.name, paid, paid_at: paid > 0 ? s.paid_at ?? nowIso() : null }
    })
    const row: Deal = {
      id: f.id,
      property_id: f.property_id,
      client_id: f.client_id,
      kind: f.kind,
      amount: f.amount,
      commission: total,
      commission_seller: f.seller || 0,
      commission_buyer: f.buyer || 0,
      shares,
      received: receivedAll ? total : Math.max(0, Math.min(total, f.received || 0)),
      notes: f.notes.trim() || null,
      closed_at: combineDateTime(f.closed_at, '12:00'),
      created_by: initial.created_by ?? me.id,
      created_at: initial.created_at ?? nowIso(),
    }
    const saved = await deal.save(row, { isNew })
    if (!saved) return
    if (markProperty && p) {
      await prop.save({ ...p, status: f.kind === 'rent' ? 'rented' : 'sold', published: false, featured: false, updated_at: nowIso() }, { action: 'status', silent: true, meta: { status: f.kind === 'rent' ? 'rented' : 'sold' } })
      const m = currentMandate(mandates, p.id)
      if (m && can('properties')) await saveMandate.save({ ...m, status: 'ended', updated_at: nowIso() }, { silent: true, action: 'status', meta: { status: 'ended' } })
    }
    onSaved?.(saved)
    onClose()
  }

  const rent = f.kind === 'rent'
  const hint = (v: number) => (!f.amount || !v ? undefined : rent ? `${Math.round((v / f.amount) * 10) / 10} شهر كراء` : `${Math.round((v / f.amount) * 10000) / 100}% من الثمن`)

  return (
    <Modal
      open
      onClose={onClose}
      size="xl"
      title={isNew ? 'تسجيل صفقة' : 'تعديل الصفقة'}
      footer={
        <>
          {!isNew && can('delete') && (
            <Button
              variant="ghost"
              className="me-auto text-danger"
              icon={<Trash2 className="size-4" />}
              onClick={async () => {
                if (await del(f.id, 'الصفقة')) onClose()
              }}
            >
              حذف
            </Button>
          )}
          <Button variant="ghost" onClick={onClose}>
            إلغاء
          </Button>
          <Button loading={deal.pending} onClick={submit}>
            حفظ الصفقة
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="العقار">
            <Combo value={f.property_id} onChange={pickProperty} options={propertyOptions} placeholder="اختر العقار" />
          </Field>
          <Field label={rent ? 'المكتري' : 'المشتري'}>
            <Combo value={f.client_id} onChange={(v) => set('client_id', v)} options={clientOptions} placeholder="اختياري" />
          </Field>
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <Field label="نوع الصفقة">
            <Segmented
              value={f.kind}
              onChange={(v) => reprice({ kind: v })}
              options={[
                { value: 'sale', label: 'بيع' },
                { value: 'rent', label: 'كراء' },
              ]}
              className="flex w-full [&>button]:flex-1"
            />
          </Field>
          <Field label={rent ? 'ثمن الكراء الشهري' : 'ثمن البيع'}>
            <Input type="number" inputMode="numeric" dir="ltr" className="num" value={f.amount || ''} onChange={(e) => reprice({ amount: num(e.target.value) })} />
          </Field>
          <Field label="تاريخ الإنجاز">
            <Input type="date" dir="ltr" className="num" value={f.closed_at} onChange={(e) => set('closed_at', e.target.value)} />
          </Field>
        </div>

        <section className="space-y-3 rounded-2xl border border-line bg-ivory p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-sm font-bold text-navy">العمولة</h3>
            <button type="button" onClick={applyDefaults} className="text-xs font-semibold text-teal hover:underline">
              حسب نسب الوكالة: {rent ? `${cs.rent_owner} شهر من المالك و${cs.rent_tenant} من المكتري` : `${cs.sale_seller}% من البائع و${cs.sale_buyer}% من المشتري`}
            </button>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <Field label={rent ? 'من المالك' : 'من البائع'} hint={hint(f.seller)}>
              <Input
                type="number"
                inputMode="numeric"
                dir="ltr"
                className="num"
                value={f.seller || ''}
                onChange={(e) => {
                  setTouched(true)
                  set('seller', num(e.target.value))
                }}
              />
            </Field>
            <Field label={rent ? 'من المكتري' : 'من المشتري'} hint={hint(f.buyer)}>
              <Input
                type="number"
                inputMode="numeric"
                dir="ltr"
                className="num"
                value={f.buyer || ''}
                onChange={(e) => {
                  setTouched(true)
                  set('buyer', num(e.target.value))
                }}
              />
            </Field>
            <div className="flex flex-col justify-end">
              <div className="flex h-11 items-center justify-between rounded-xl bg-white px-4">
                <span className="text-sm text-muted">المجموع</span>
                <b className="num text-lg text-navy">{fmtNumber(total)}</b>
              </div>
              <div className="mt-1 text-xs text-subtle">{hint(total) ?? ' '}</div>
            </div>
          </div>
          <Switch checked={receivedAll} onChange={setReceivedAll} label="تم تحصيل العمولة كاملة من الطرفين" />
          {!receivedAll && (
            <Field label="المبلغ المحصل إلى الآن" hint={`الباقي: ${fmtNumber(Math.max(0, total - (f.received || 0)))} د.م.`}>
              <Input type="number" inputMode="numeric" dir="ltr" className="num sm:w-56" value={f.received || ''} onChange={(e) => set('received', num(e.target.value))} />
            </Field>
          )}
        </section>

        <section className="space-y-3 rounded-2xl border border-line p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-sm font-bold text-navy">تقسيم العمولة مع الشركاء</h3>
            <Button size="sm" variant="outline" icon={<Sparkles className="size-4" />} onClick={suggest}>
              اقتراح حسب العقار والزبون
            </Button>
          </div>
          {f.shares.length === 0 && <p className="text-xs text-muted">لا يوجد شركاء في هذه الصفقة: العمولة كلها للوكالة.</p>}
          {f.shares.map((s) => {
            const amount = shareAmount(s, total)
            const status = s.paid >= amount && amount > 0 ? { t: 'مدفوع', c: '#15803d' } : s.paid > 0 ? { t: 'مدفوع جزئياً', c: '#b45309' } : { t: 'غير مدفوع', c: '#b91c1c' }
            return (
              <div key={s.id} className="space-y-2 rounded-xl border border-line bg-white p-3">
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-[1.6fr_1fr_1.1fr_auto] sm:items-end">
                  <Field label={<Pill color={SHARE_PARTY[s.party].color}>{SHARE_PARTY[s.party].label}</Pill>}>
                    {s.party === 'staff' ? (
                      <StaffSelect value={s.ref_id} onChange={(v) => updShare(s.id, { ref_id: v, name: L.staffName(v) })} />
                    ) : (
                      <Combo value={s.ref_id} onChange={(v) => pickPartner(s, v)} options={partnerOptions} placeholder="اختر من الشبكة" />
                    )}
                  </Field>
                  <Field label="الجانب">
                    <Select value={s.side} onChange={(e) => updShare(s.id, { side: e.target.value as ShareSide })}>
                      {(Object.keys(SIDE) as ShareSide[]).map((k) => (
                        <option key={k} value={k}>
                          {SIDE[k]}
                        </option>
                      ))}
                    </Select>
                  </Field>
                  <Field label="الحصة">
                    <div className="flex gap-1.5">
                      <Input type="number" step="0.5" dir="ltr" className="num min-w-0" value={s.value || ''} onChange={(e) => updShare(s.id, { value: num(e.target.value) })} />
                      <Select value={s.mode} onChange={(e) => updShare(s.id, { mode: e.target.value as DealShare['mode'] })} className="w-24 shrink-0">
                        <option value="percent">%</option>
                        <option value="fixed">د.م.</option>
                      </Select>
                    </div>
                  </Field>
                  <button type="button" onClick={() => setF((x) => ({ ...x, shares: x.shares.filter((y) => y.id !== s.id) }))} className="mb-1 rounded-full p-2 text-subtle hover:bg-danger/10 hover:text-danger" aria-label="حذف السطر">
                    <X className="size-4" />
                  </button>
                </div>
                <div className="flex flex-wrap items-center gap-3 text-xs">
                  <span className="text-muted">
                    المبلغ: <b className="num text-sm text-navy">{fmtNumber(amount)} د.م.</b>
                  </span>
                  <label className="flex items-center gap-2 text-muted">
                    المدفوع له
                    <Input type="number" inputMode="numeric" dir="ltr" className="num h-8 w-28 py-1 text-xs" value={s.paid || ''} onChange={(e) => updShare(s.id, { paid: num(e.target.value), paid_at: nowIso() })} />
                  </label>
                  {s.paid < amount && amount > 0 && (
                    <button type="button" onClick={() => updShare(s.id, { paid: amount, paid_at: nowIso() })} className="font-semibold text-teal hover:underline">
                      دُفع كاملاً
                    </button>
                  )}
                  <Pill color={status.c}>{status.t}</Pill>
                </div>
              </div>
            )
          })}
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="ghost" icon={<Plus className="size-4" />} onClick={() => addShare('broker')}>
              وسيط أو وكالة
            </Button>
            <Button size="sm" variant="ghost" icon={<Plus className="size-4" />} onClick={() => addShare('referrer')}>
              مُرشد
            </Button>
            <Button size="sm" variant="ghost" icon={<Plus className="size-4" />} onClick={() => addShare('staff')}>
              مكافأة موظف
            </Button>
          </div>
          <div className="grid grid-cols-3 gap-2 rounded-xl bg-navy p-3 text-center text-white">
            <div>
              <div className="text-[11px] text-white/60">العمولة</div>
              <div className="num font-bold">{fmtNumber(total)}</div>
            </div>
            <div>
              <div className="text-[11px] text-white/60">للشركاء</div>
              <div className="num font-bold">{fmtNumber(partners)}</div>
            </div>
            <div>
              <div className="text-[11px] text-gold-300">صافي الوكالة</div>
              <div className={cn('num text-lg font-extrabold', net < 0 ? 'text-red-300' : 'text-gold-300')}>{fmtNumber(net)}</div>
            </div>
          </div>
          {cs.vat > 0 && <p className="text-xs text-muted">صافي الوكالة بدون الضريبة على القيمة المضافة: {fmtNumber(Math.round(net / (1 + cs.vat / 100)))} د.م.</p>}
        </section>

        <Field label="ملاحظات">
          <Textarea rows={2} value={f.notes} onChange={(e) => set('notes', e.target.value)} />
        </Field>
        {p && isNew && <Switch checked={markProperty} onChange={setMarkProperty} label={`تغيير حالة ${p.ref} إلى «${rent ? 'مُكترى' : 'مُباع'}» وإخفاؤه من الموقع`} />}
      </div>
    </Modal>
  )
}
