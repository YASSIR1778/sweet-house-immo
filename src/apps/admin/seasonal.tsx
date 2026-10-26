import { AlertTriangle, BadgeCheck, CalendarCheck, ExternalLink, IdCard, Printer, Sun, Trash2, Wallet } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'
import { useBilling, useTable } from '@/shared/lib/data'
import { fmtDate, fmtNumber, fmtPrice, localDate, nowIso, pick, uid, waLink } from '@/shared/lib/format'
import { addDays, bookingDue, bookingRest, agencyCut, isFree, nightsText, ownerPayout, quote, seasonOf, stayMessage } from '@/shared/lib/seasonal'
import type { BillingSettings, Booking, BookingSource, BookingStatus, CautionStatus, GuestIdType, Lang, Property, SeasonRates } from '@/shared/lib/types'
import { Button, Field, Input, Modal, Segmented, Select, Switch, Textarea, cn } from '@/shared/ui/base'
import { WhatsAppIcon } from '@/shared/ui/icons'
import { useClientOptions, useQuickAdd } from './dialogs'
import { useCan, useDeleteRow, useLookups, useMe, useNames, useSave } from './hooks'
import { BOOKING_SOURCE, BOOKING_STATUS, CAUTION_STATUS, GUEST_ID, LANG_LABEL } from './labels'
import { printBookingConfirmation, printGuestForm } from './print'
import { Combo, Pill, type ComboOption } from './ui'

const num = (v: string) => (v.trim() === '' || Number.isNaN(Number(v)) ? 0 : Number(v))
const dm = (md: string) => md.split('-').reverse().join('/')
export const STDN_URL = 'https://www.stdn.ma'

/** Seasonal properties first, as options. */
export function useSeasonalOptions(): ComboOption[] {
  const { properties } = useLookups()
  const { hoodName } = useNames()
  return useMemo(
    () =>
      properties
        .filter((p) => p.seasonal)
        .map((p) => ({ value: p.id, label: `${p.ref} — ${p.title}`, sub: `${hoodName(p.neighborhood)} · ${fmtNumber(seasonOf(p.season).night)} د.م. / الليلة`, keywords: p.ref })),
    [properties, hoodName],
  )
}

const MONTHS = ['يناير', 'فبراير', 'مارس', 'أبريل', 'ماي', 'يونيو', 'يوليوز', 'غشت', 'شتنبر', 'أكتوبر', 'نونبر', 'دجنبر']
const pad = (n: number) => String(n).padStart(2, '0')

/** A day of the year («07-01»), whatever the year. */
function MonthDay({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [m, d] = value.split('-')
  return (
    <div className="grid grid-cols-[4.5rem_1fr] gap-2">
      <Select value={d} onChange={(e) => onChange(`${m}-${e.target.value}`)} className="num">
        {Array.from({ length: 31 }, (_, i) => (
          <option key={i} value={pad(i + 1)}>
            {i + 1}
          </option>
        ))}
      </Select>
      <Select value={m} onChange={(e) => onChange(`${e.target.value}-${d}`)}>
        {MONTHS.map((name, i) => (
          <option key={name} value={pad(i + 1)}>
            {name}
          </option>
        ))}
      </Select>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Rates of a property rented by the night (in the property page)       */
/* ------------------------------------------------------------------ */
export function SeasonCard({ property, onChange }: { property: Property; onChange: (patch: Partial<Property>) => void }) {
  const r = seasonOf(property.season)
  const set = <K extends keyof SeasonRates>(k: K, v: SeasonRates[K]) => onChange({ season: { ...r, [k]: v } })
  const year = new Date().getFullYear() + 1
  const sample = quote(r, `${year}-08-01`, `${year}-08-08`, Math.min(r.guests, 4))
  const off = quote(r, `${year}-10-02`, `${year}-10-04`, 2)
  return (
    <div className="space-y-4">
      <Switch checked={Boolean(property.seasonal)} onChange={(v) => onChange({ seasonal: v, season: v && !property.season?.night ? { ...r, night: Math.round(property.price / 20) || 0 } : property.season })} label="يُكرى بالليلة (كراء موسمي)" />
      {property.seasonal && (
        <>
          <div className="grid grid-cols-2 gap-3">
            <Field label="الليلة خارج الموسم">
              <Input type="number" min={0} dir="ltr" className="num" value={r.night || ''} onChange={(e) => set('night', num(e.target.value))} />
            </Field>
            <Field label="الليلة في الموسم" hint="فارغ = نفس الثمن طول السنة">
              <Input type="number" min={0} dir="ltr" className="num" value={r.high_night ?? ''} onChange={(e) => set('high_night', e.target.value ? num(e.target.value) : null)} />
            </Field>
            <Field label="الموسم من">
              <MonthDay value={r.high_from} onChange={(v) => set('high_from', v)} />
            </Field>
            <Field label="إلى">
              <MonthDay value={r.high_to} onChange={(v) => set('high_to', v)} />
            </Field>
            <Field label="أقل مدة (ليالٍ)">
              <Input type="number" min={1} dir="ltr" className="num" value={r.min_nights} onChange={(e) => set('min_nights', Math.max(1, num(e.target.value)))} />
            </Field>
            <Field label="أقل مدة في الموسم">
              <Input type="number" min={1} dir="ltr" className="num" value={r.high_min_nights ?? ''} onChange={(e) => set('high_min_nights', e.target.value ? Math.max(1, num(e.target.value)) : null)} />
            </Field>
            <Field label="تخفيض الأسبوع">
              <div className="relative">
                <Input type="number" min={0} max={50} dir="ltr" className="num pe-8" value={r.week_discount} onChange={(e) => set('week_discount', num(e.target.value))} />
                <span className="pointer-events-none absolute inset-y-0 end-3 flex items-center text-xs text-muted">%</span>
              </div>
            </Field>
            <Field label="أقصى عدد للضيوف">
              <Input type="number" min={1} dir="ltr" className="num" value={r.guests} onChange={(e) => set('guests', Math.max(1, num(e.target.value)))} />
            </Field>
            <Field label="التنظيف (مرة واحدة)">
              <Input type="number" min={0} dir="ltr" className="num" value={r.cleaning || ''} onChange={(e) => set('cleaning', num(e.target.value))} />
            </Field>
            <Field label="الضمانة (كوسيون)">
              <Input type="number" min={0} dir="ltr" className="num" value={r.caution || ''} onChange={(e) => set('caution', num(e.target.value))} />
            </Field>
            <Field label="العربون لتأكيد الحجز">
              <div className="relative">
                <Input type="number" min={0} max={100} dir="ltr" className="num pe-8" value={r.deposit_pct} onChange={(e) => set('deposit_pct', num(e.target.value))} />
                <span className="pointer-events-none absolute inset-y-0 end-3 flex items-center text-xs text-muted">%</span>
              </div>
            </Field>
            <Field label="عمولة الوكالة">
              <div className="relative">
                <Input type="number" min={0} max={100} dir="ltr" className="num pe-8" value={r.commission} onChange={(e) => set('commission', num(e.target.value))} />
                <span className="pointer-events-none absolute inset-y-0 end-3 flex items-center text-xs text-muted">%</span>
              </div>
            </Field>
            <Field label="الدخول من الساعة">
              <Input type="time" dir="ltr" className="num" value={r.check_in} onChange={(e) => set('check_in', e.target.value)} />
            </Field>
            <Field label="الخروج قبل الساعة">
              <Input type="time" dir="ltr" className="num" value={r.check_out} onChange={(e) => set('check_out', e.target.value)} />
            </Field>
          </div>
          <Field label="رقم رخصة الإيواء" hint="القانون 80.14: رخصة من الجماعة. يظهر في وصل الحجز.">
            <Input dir="ltr" value={r.license} onChange={(e) => set('license', e.target.value)} />
          </Field>
          {r.night > 0 && (
            <div className="space-y-1 rounded-xl bg-ivory p-3 text-xs text-muted">
              <div>
                مثال: أسبوع في غشت = <b className="num text-navy">{fmtNumber(sample.total)} د.م.</b> (مع التنظيف)
              </div>
              <div>
                ليلتان في أكتوبر = <b className="num text-navy">{fmtNumber(off.total)} د.م.</b>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* A stay: dates, price, guest, money, messages                         */
/* ------------------------------------------------------------------ */
const NEW_STATUS: BookingStatus[] = ['request', 'confirmed', 'blocked']

export function BookingDialog({ initial = {}, onClose, onSaved }: { initial?: Partial<Booking>; onClose: () => void; onSaved?: (b: Booking) => void }) {
  const me = useMe()
  const can = useCan()
  const quick = useQuickAdd()
  const L = useLookups()
  const { s, hoodName } = useNames()
  const { data: billing } = useBilling()
  const options = useSeasonalOptions()
  const clientOptions = useClientOptions()
  const { data: bookings = [] } = useTable<Booking>('bookings')
  const isNew = !initial.id
  const today = localDate(new Date())
  const [f, setF] = useState<Booking>({
    id: uid(),
    property_id: options[0]?.value ?? '',
    client_id: null,
    lead_id: null,
    status: 'confirmed',
    source: 'phone',
    check_in: today,
    check_out: addDays(today, 3),
    guests: 2,
    guest_name: '',
    guest_phone: null,
    guest_lang: 'ar',
    guest_id_type: null,
    guest_id_no: null,
    guest_nationality: null,
    guest_birth: null,
    guest_address: null,
    declared_at: null,
    rent: 0,
    cleaning: 0,
    deposit: 0,
    caution: 0,
    caution_status: 'none',
    paid: 0,
    commission_rate: 0,
    owner_paid_at: null,
    notes: null,
    created_by: me.id,
    created_at: nowIso(),
    updated_at: nowIso(),
    ...initial,
  } as Booking)
  const [priced, setPriced] = useState(!isNew)
  const [idOpen, setIdOpen] = useState(Boolean(initial.guest_id_no))
  const set = <K extends keyof Booking>(k: K, v: Booking[K]) => setF((x) => ({ ...x, [k]: v }))
  const { save, pending } = useSave<Booking>('bookings', 'booking', (b) => `${L.property(b.property_id)?.ref ?? ''} ${b.check_in} → ${b.check_out}`)
  const del = useDeleteRow('bookings', 'booking')
  const p = L.property(f.property_id)
  const r = seasonOf(p?.season)
  const q = quote(r, f.check_in, f.check_out, f.guests)
  const free = isFree(bookings, f.property_id, f.check_in, f.check_out, f.id)
  const owner = f.status === 'blocked'
  const holdsDates = f.status === 'confirmed' || f.status === 'checked_in' || f.status === 'completed' || owner

  // the price follows the dates until it is typed by hand
  useEffect(() => {
    if (priced || !p) return
    setF((x) => (x.status === 'blocked' ? { ...x, rent: 0, cleaning: 0, deposit: 0, caution: 0, commission_rate: 0 } : { ...x, rent: q.rent, cleaning: q.cleaning, deposit: q.deposit, caution: q.caution, commission_rate: r.commission }))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [p?.id, f.check_in, f.check_out, f.guests, f.status, priced])

  const message = (kind: 'request' | 'confirmed' | 'reminder') => {
    if (!p) return ''
    const lang: Lang = f.guest_lang
    return stayMessage(kind, lang, {
      name: f.guest_name,
      place: pick(s.catalog.neighborhoods.find((n) => n.id === p.neighborhood)?.name, lang) || p.city,
      ref: p.ref,
      checkIn: f.check_in,
      checkOut: f.check_out,
      guests: f.guests,
      total: fmtPrice(bookingDue(f), lang),
      deposit: fmtPrice(f.deposit, lang),
      paid: f.paid > 0 ? fmtPrice(f.paid, lang) : null,
      checkInTime: r.check_in,
      checkOutTime: r.check_out,
      agency: pick(s.agency.name, lang),
    })
  }
  const send = (kind: 'request' | 'confirmed' | 'reminder') => f.guest_phone && window.open(waLink(f.guest_phone, message(kind)), '_blank', 'noopener')

  const submit = async () => {
    if (!f.property_id) return toast.error('اختر العقار')
    if (!(f.check_out > f.check_in)) return toast.error('تاريخ المغادرة يجب أن يكون بعد تاريخ الوصول')
    if (!owner && !f.guest_name.trim()) return toast.error('اكتب اسم الضيف')
    if (holdsDates && !free) return toast.error('هذه الليالي محجوزة مسبقاً في هذا العقار')
    const saved = await save({ ...f, guest_name: f.guest_name.trim() || (owner ? 'المالك' : ''), updated_at: nowIso() }, { isNew, message: isNew ? (owner ? 'سُجلت فترة استعمال المالك' : 'سُجل الحجز') : undefined })
    if (!saved) return
    onSaved?.(saved)
    onClose()
  }

  const pickClient = (id: string | null) => {
    const c = L.client(id)
    setF((x) => ({ ...x, client_id: id, guest_name: c?.full_name ?? x.guest_name, guest_phone: c?.whatsapp || c?.phone || x.guest_phone, guest_lang: c?.lang ?? x.guest_lang }))
  }

  return (
    <Modal
      open
      onClose={onClose}
      size="xl"
      title={isNew ? 'حجز موسمي جديد' : `حجز ${p?.ref ?? ''} — ${f.guest_name}`}
      footer={
        <>
          {!isNew && can('delete') && (
            <Button
              variant="ghost"
              className="me-auto text-danger"
              icon={<Trash2 className="size-4" />}
              onClick={async () => {
                if (f.paid > 0) return toast.error('على هذا الحجز وصولات أداء: ألغِه بدل حذفه.')
                if (await del(f.id, `${p?.ref ?? ''} ${f.guest_name}`)) onClose()
              }}
            >
              حذف
            </Button>
          )}
          <Button variant="ghost" onClick={onClose}>
            إغلاق
          </Button>
          <Button loading={pending} onClick={() => void submit()}>
            {isNew ? 'تسجيل الحجز' : 'حفظ'}
          </Button>
        </>
      }
    >
      <div className="space-y-5">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-[1.4fr_1fr]">
          <Field label="العقار" required>
            <Combo value={f.property_id || null} onChange={(v) => set('property_id', v ?? '')} options={options} placeholder="عقار موسمي" allowClear={false} />
          </Field>
          <Field label="الحالة">
            {isNew ? (
              <Segmented value={f.status} onChange={(v) => set('status', v)} options={NEW_STATUS.map((k) => ({ value: k, label: BOOKING_STATUS[k].label }))} className="flex w-full [&>button]:flex-1 [&>button]:px-2" />
            ) : (
              <Select value={f.status} onChange={(e) => set('status', e.target.value as BookingStatus)}>
                {(Object.keys(BOOKING_STATUS) as BookingStatus[]).map((k) => (
                  <option key={k} value={k}>
                    {BOOKING_STATUS[k].label}
                  </option>
                ))}
              </Select>
            )}
          </Field>
        </div>
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          <Field label="الوصول">
            <Input type="date" dir="ltr" className="num" value={f.check_in} onChange={(e) => setF((x) => ({ ...x, check_in: e.target.value, check_out: x.check_out > e.target.value ? x.check_out : addDays(e.target.value, Math.max(1, r.min_nights)) }))} />
          </Field>
          <Field label="المغادرة">
            <Input type="date" dir="ltr" className="num" min={addDays(f.check_in, 1)} value={f.check_out} onChange={(e) => set('check_out', e.target.value)} />
          </Field>
          <Field label="الضيوف">
            <Input type="number" min={1} max={50} dir="ltr" className="num" value={f.guests} onChange={(e) => set('guests', Math.max(1, num(e.target.value)))} />
          </Field>
          <div className="flex flex-col justify-end">
            <div className={cn('flex h-11 items-center justify-center rounded-xl text-sm font-bold', holdsDates && !free ? 'bg-danger/10 text-danger' : 'bg-success/10 text-success')}>
              {nightsText(q.nights, 'ar')} {holdsDates && !free ? '· محجوز' : '· متاح'}
            </div>
          </div>
        </div>
        {!owner && (q.issues.includes('min_nights') || q.issues.includes('guests')) && (
          <p className="flex items-start gap-2 rounded-xl bg-warning/10 p-3 text-xs text-warning">
            <AlertTriangle className="mt-0.5 size-4 shrink-0" />
            {[q.issues.includes('min_nights') && `أقل مدة لهذه الفترة ${nightsText(q.minNights, 'ar')}`, q.issues.includes('guests') && `العقار يتسع لـ ${r.guests} ضيوف فقط`].filter(Boolean).join(' · ')}
          </p>
        )}

        {!owner && (
          <>
            <section className="grid grid-cols-1 gap-4 rounded-2xl border border-line p-4 md:grid-cols-3">
              <Field label="من العملاء" hint="اختياري">
                <Combo value={f.client_id} onChange={pickClient} options={clientOptions} placeholder="—" />
              </Field>
              <Field label="اسم الضيف" required>
                <Input value={f.guest_name} onChange={(e) => set('guest_name', e.target.value)} />
              </Field>
              <Field label="هاتف / واتساب">
                <Input dir="ltr" className="num" value={f.guest_phone ?? ''} onChange={(e) => set('guest_phone', e.target.value || null)} />
              </Field>
              <Field label="لغة الرسائل">
                <Segmented value={f.guest_lang} onChange={(v) => set('guest_lang', v)} options={(['ar', 'fr', 'es'] as Lang[]).map((l) => ({ value: l, label: LANG_LABEL[l] }))} className="flex w-full [&>button]:flex-1 [&>button]:px-2" />
              </Field>
              <Field label="مصدر الحجز">
                <Select value={f.source} onChange={(e) => set('source', e.target.value as BookingSource)}>
                  {(Object.keys(BOOKING_SOURCE) as BookingSource[]).map((k) => (
                    <option key={k} value={k}>
                      {BOOKING_SOURCE[k]}
                    </option>
                  ))}
                </Select>
              </Field>
            </section>

            <section className="space-y-3 rounded-2xl border border-line bg-ivory p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="text-sm font-bold text-navy">الثمن</h3>
                <span className="text-xs text-muted">
                  {q.high > 0 && `${q.high} في الموسم × ${fmtNumber(r.high_night ?? r.night)}`}
                  {q.high > 0 && q.low > 0 && ' + '}
                  {q.low > 0 && `${q.low} × ${fmtNumber(r.night)}`}
                  {q.discount > 0 && ` − ${fmtNumber(q.discount)} تخفيض الأسبوع`}
                </span>
              </div>
              <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
                {(
                  [
                    ['rent', 'الليالي'],
                    ['cleaning', 'التنظيف'],
                    ['deposit', 'العربون'],
                    ['caution', 'الضمانة'],
                    ['commission_rate', 'عمولة %'],
                  ] as [keyof Booking, string][]
                ).map(([k, label]) => (
                  <Field key={k} label={label}>
                    <Input
                      type="number"
                      min={0}
                      dir="ltr"
                      className="num"
                      value={(f[k] as number) || ''}
                      onChange={(e) => {
                        setPriced(true)
                        set(k, num(e.target.value) as never)
                      }}
                    />
                  </Field>
                ))}
              </div>
              {priced && p && (f.rent !== q.rent || f.cleaning !== q.cleaning) && (
                <button type="button" onClick={() => setPriced(false)} className="text-xs font-semibold text-teal hover:underline">
                  إعادة الحساب حسب أثمنة العقار ({fmtNumber(q.total)} د.م.)
                </button>
              )}
              <div className="grid grid-cols-3 gap-2 rounded-xl bg-navy p-3 text-center text-white">
                <div>
                  <div className="text-[11px] text-white/60">المجموع</div>
                  <div className="num font-bold">{fmtNumber(bookingDue(f))}</div>
                </div>
                <div>
                  <div className="text-[11px] text-white/60">حصة المالك</div>
                  <div className="num font-bold">{fmtNumber(ownerPayout(f))}</div>
                </div>
                <div>
                  <div className="text-[11px] text-gold-300">عمولة الوكالة</div>
                  <div className="num text-lg font-extrabold text-gold-300">{fmtNumber(agencyCut(f))}</div>
                </div>
              </div>
            </section>

            <section className="rounded-2xl border border-line p-4">
              <button type="button" onClick={() => setIdOpen((v) => !v)} className="flex w-full items-center gap-2 text-start text-sm font-bold text-navy">
                <IdCard className="size-4 text-gold-600" /> هوية الضيف (للبطاقة والتصريح بالنزلاء)
                <span className="ms-auto text-xs font-normal text-muted">{f.guest_id_no ? `${GUEST_ID[f.guest_id_type ?? 'other']} ${f.guest_id_no}` : 'تُملأ عند الوصول'}</span>
              </button>
              {idOpen && (
                <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-3">
                  <Field label="الوثيقة">
                    <Select value={f.guest_id_type ?? ''} onChange={(e) => set('guest_id_type', (e.target.value || null) as GuestIdType | null)}>
                      <option value="">—</option>
                      {(Object.keys(GUEST_ID) as GuestIdType[]).map((k) => (
                        <option key={k} value={k}>
                          {GUEST_ID[k]}
                        </option>
                      ))}
                    </Select>
                  </Field>
                  <Field label="رقمها">
                    <Input dir="ltr" className="num" value={f.guest_id_no ?? ''} onChange={(e) => set('guest_id_no', e.target.value.toUpperCase() || null)} />
                  </Field>
                  <Field label="الجنسية">
                    <Input value={f.guest_nationality ?? ''} onChange={(e) => set('guest_nationality', e.target.value || null)} />
                  </Field>
                  <Field label="تاريخ الازدياد">
                    <Input type="date" dir="ltr" className="num" value={f.guest_birth ?? ''} onChange={(e) => set('guest_birth', e.target.value || null)} />
                  </Field>
                  <Field label="العنوان" className="md:col-span-2">
                    <Input value={f.guest_address ?? ''} onChange={(e) => set('guest_address', e.target.value || null)} />
                  </Field>
                  <p className="text-xs text-muted md:col-span-3">
                    القانون 80.14 (المواد 36-38): تُطلب وثيقة الهوية عند الوصول، ويُوقع الضيف بطاقة الإيواء، ويُصرَّح بالوصول على منصة stdn.ma، وتُحفظ البطاقة سنة.
                  </p>
                </div>
              )}
            </section>
          </>
        )}

        <Field label="ملاحظات">
          <Textarea rows={2} value={f.notes ?? ''} onChange={(e) => set('notes', e.target.value || null)} />
        </Field>

        {!isNew && !owner && (
          <section className="space-y-3 rounded-2xl border border-teal/30 bg-teal/5 p-4">
            <div className="grid grid-cols-2 gap-2 text-center text-sm sm:grid-cols-4">
              <div className="rounded-xl bg-white p-2">
                <div className="text-[11px] text-muted">المؤدى</div>
                <b className="num text-success">{fmtNumber(f.paid)}</b>
              </div>
              <div className="rounded-xl bg-white p-2">
                <div className="text-[11px] text-muted">الباقي</div>
                <b className={cn('num', bookingRest(f) > 0 ? 'text-warning' : 'text-subtle')}>{fmtNumber(bookingRest(f))}</b>
              </div>
              <div className="rounded-xl bg-white p-2">
                <div className="text-[11px] text-muted">الضمانة</div>
                <Select value={f.caution_status} onChange={(e) => set('caution_status', e.target.value as CautionStatus)} className="mt-0.5 h-8 py-0 text-xs">
                  {(Object.keys(CAUTION_STATUS) as CautionStatus[]).map((k) => (
                    <option key={k} value={k}>
                      {CAUTION_STATUS[k]}
                    </option>
                  ))}
                </Select>
              </div>
              <div className="rounded-xl bg-white p-2">
                <div className="text-[11px] text-muted">حصة المالك</div>
                <button type="button" onClick={() => set('owner_paid_at', f.owner_paid_at ? null : today)} className={cn('mt-1 text-xs font-bold', f.owner_paid_at ? 'text-success' : 'text-warning')}>
                  {f.owner_paid_at ? `حُوّلت ${fmtDate(f.owner_paid_at)}` : 'لم تُحوَّل'}
                </button>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              {bookingRest(f) > 0 && (
                <Button size="sm" icon={<Wallet className="size-4" />} onClick={() => quick('payment', { booking_id: f.id, client_id: f.client_id, party: 'buyer', payer_name: f.guest_name, amount: f.paid < f.deposit ? f.deposit - f.paid : bookingRest(f) })}>
                  تسجيل دفعة
                </Button>
              )}
              {f.guest_phone && (
                <>
                  <Button size="sm" variant="whatsapp" icon={<WhatsAppIcon className="size-4" />} onClick={() => send(f.status === 'request' ? 'request' : 'confirmed')}>
                    {f.status === 'request' ? 'طلب العربون' : 'تأكيد الحجز'}
                  </Button>
                  {f.check_in >= today && f.status !== 'request' && (
                    <Button size="sm" variant="outline" icon={<WhatsAppIcon className="size-4" />} onClick={() => send('reminder')}>
                      تذكير قبل الوصول
                    </Button>
                  )}
                </>
              )}
              {p && (
                <>
                  <Button size="sm" variant="outline" icon={<Printer className="size-4" />} onClick={() => printBookingConfirmation(f, p, s, billing as BillingSettings, hoodName)}>
                    وصل الحجز
                  </Button>
                  <Button size="sm" variant="outline" icon={<IdCard className="size-4" />} onClick={() => printGuestForm(f, p, s, hoodName)}>
                    بطاقة الإيواء
                  </Button>
                </>
              )}
            </div>
            {(f.status === 'confirmed' || f.status === 'checked_in') && f.check_in <= today && (
              <div className={cn('flex flex-wrap items-center gap-2 rounded-xl p-3 text-sm', f.declared_at ? 'bg-success/10 text-success' : 'bg-warning/10 text-warning')}>
                {f.declared_at ? <BadgeCheck className="size-4" /> : <AlertTriangle className="size-4" />}
                <span className="flex-1">{f.declared_at ? `صُرّح بالنزلاء في ${fmtDate(f.declared_at)}` : 'لم يُصرَّح بعد بهذا الوصول على منصة التصريح بالليالي'}</span>
                <a href={STDN_URL} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-xs font-semibold text-teal hover:underline">
                  stdn.ma <ExternalLink className="size-3" />
                </a>
                <Button size="sm" variant={f.declared_at ? 'ghost' : 'outline'} icon={<CalendarCheck className="size-4" />} onClick={() => set('declared_at', f.declared_at ? null : nowIso())}>
                  {f.declared_at ? 'إلغاء' : 'تم التصريح'}
                </Button>
              </div>
            )}
          </section>
        )}
        {!isNew && <p className="text-xs text-subtle">احفظ بعد تغيير الضمانة أو التحويل أو التصريح.</p>}
        {isNew && p && <SeasonHint p={p} r={r} />}
      </div>
    </Modal>
  )
}

function SeasonHint({ p, r }: { p: Property; r: SeasonRates }) {
  return (
    <p className="flex items-center gap-2 text-xs text-muted">
      <Sun className="size-4 text-gold-600" />
      {p.ref}: {fmtNumber(r.night)} د.م. / الليلة{r.high_night ? ` · ${fmtNumber(r.high_night)} في الموسم (${dm(r.high_from)} → ${dm(r.high_to)})` : ''} · حتى {r.guests} ضيوف · الدخول {r.check_in} · الخروج {r.check_out}
    </p>
  )
}

/** A stay in a list: dates, guest, status. */
export function BookingLine({ b, onClick }: { b: Booking; onClick: () => void }) {
  const L = useLookups()
  return (
    <button type="button" onClick={onClick} className="flex w-full items-center gap-3 px-5 py-2.5 text-start text-sm hover:bg-ivory">
      <span className="num text-xs font-bold text-gold-700">{L.property(b.property_id)?.ref ?? '—'}</span>
      <span className="min-w-0 flex-1 truncate text-navy">{b.guest_name}</span>
      <span className="num text-xs whitespace-nowrap text-muted">
        {fmtDate(b.check_in, 'ar', { day: 'numeric', month: 'short' })} → {fmtDate(b.check_out, 'ar', { day: 'numeric', month: 'short' })}
      </span>
      <Pill color={BOOKING_STATUS[b.status].color}>{BOOKING_STATUS[b.status].label}</Pill>
    </button>
  )
}
