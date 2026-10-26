import { useQueryClient } from '@tanstack/react-query'
import { Building2, Copy, Download, ExternalLink, FileImage, FileText, FolderLock, Link2, Pencil, Plus, Printer, Trash2, TrendingDown, TrendingUp, Upload, X } from 'lucide-react'
import { useMemo, useRef, useState } from 'react'
import { Link } from 'react-router'
import { toast } from 'sonner'
import { SITE_URL } from '@/shared/lib/config'
import { useSettings, useTable } from '@/shared/lib/data'
import { fmtDate, fmtNumber, fmtPrice, localDate, nowIso, pick, uid, waLink } from '@/shared/lib/format'
import { buildOwnerReport, currentMandate, daysOnMarket, mandateState, ownerReportText } from '@/shared/lib/owners'
import { logActivity, repo } from '@/shared/lib/repo'
import type { Appointment, Client, DocKind, KeysHolder, Lead, Mandate, MandateKind, MandateStatus, PriceChange, Property, PropertyDocument, Settings } from '@/shared/lib/types'
import { Button, Drawer, Field, Input, Modal, Segmented, Select, Switch, Textarea, cn, useConfirm } from '@/shared/ui/base'
import { WhatsAppIcon } from '@/shared/ui/icons'
import { useClientOptions, useQuickAdd } from './dialogs'
import { errorText, useCan, useDeleteRow, useLookups, useMe, useNames, useSave } from './hooks'
import { DOC_KIND, KEYS, LANG_LABEL, MANDATE_KIND, PROPERTY_STATUS, daysAr } from './labels'
import { printMandate, printOwnerReport } from './print'
import { Card, Combo, PhoneLinks, Pill } from './ui'

export const ownerLink = (token: string) => `${SITE_URL}/proprietaire/${token}`

/** A new mandate with the same terms, starting the day after the old one ends (or today). */
export function renewalOf(m: Mandate): Partial<Mandate> {
  const today = localDate(new Date())
  let start = today
  if (m.end_date && m.end_date >= today) {
    const [y, mo, d] = m.end_date.split('-').map(Number)
    start = localDate(new Date(y, mo - 1, d + 1))
  }
  const months = m.end_date ? Math.max(1, Math.round((Date.parse(m.end_date) - Date.parse(m.start_date)) / (30.44 * 86_400_000))) : 6
  const [y, mo, d] = start.split('-').map(Number)
  return {
    owner_client_id: m.owner_client_id,
    kind: m.kind,
    purpose: m.purpose,
    start_date: start,
    end_date: localDate(new Date(y, mo - 1 + months, d)),
    price: m.price,
    net_price: m.net_price,
    min_price: m.min_price,
    commission_rate: m.commission_rate,
    commission_amount: m.commission_amount,
    keys: m.keys,
    keys_notes: m.keys_notes,
    visit_terms: m.visit_terms,
    notes: m.notes,
  }
}
const num = (v: string) => (v.trim() === '' || Number.isNaN(Number(v)) ? null : Number(v))

/* ------------------------------------------------------------------ */
/* Mandate status pill                                                  */
/* ------------------------------------------------------------------ */
export function MandatePill({ m }: { m: Mandate | null | undefined }) {
  if (!m) return <Pill color="#64748b">بدون تفويض</Pill>
  const { state, daysLeft } = mandateState(m)
  if (state === 'expired') return <Pill color="#b91c1c">التفويض انتهى منذ {daysAr(daysLeft ?? 0)}</Pill>
  if (state === 'ended') return <Pill color="#64748b">تفويض منتهٍ</Pill>
  if (state === 'cancelled') return <Pill color="#64748b">تفويض ملغى</Pill>
  if (state === 'expiring') return <Pill color="#b45309">{MANDATE_KIND[m.kind].label}: {daysLeft === 0 ? 'ينتهي اليوم' : `باقي ${daysAr(daysLeft ?? 0)}`}</Pill>
  return <Pill color={MANDATE_KIND[m.kind].color}>{MANDATE_KIND[m.kind].label}{m.end_date ? ` حتى ${fmtDate(m.end_date)}` : ''}</Pill>
}

/* ------------------------------------------------------------------ */
/* Mandate: create / renew / edit                                       */
/* ------------------------------------------------------------------ */
export function MandateDialog({ property, initial = {}, onClose }: { property: Property; initial?: Partial<Mandate>; onClose: () => void }) {
  const me = useMe()
  const can = useCan()
  const L = useLookups()
  const { s, hoodName } = useNames()
  const { data: settings } = useSettings()
  const cs = (settings as Settings).commission
  const { data: mandates = [] } = useTable<Mandate>('mandates')
  const ownerOptions = useClientOptions()
  const isNew = !initial.id
  const plusMonths = (from: string, n: number) => {
    const [y, m, d] = from.split('-').map(Number)
    return localDate(new Date(y, m - 1 + n, d))
  }
  const start = localDate(new Date())
  const [f, setF] = useState<Mandate>(() => {
    const purpose = initial.purpose ?? property.purpose
    return {
      id: uid(),
      property_id: property.id,
      owner_client_id: property.owner_client_id ?? null,
      kind: 'simple',
      purpose,
      start_date: start,
      end_date: plusMonths(start, purpose === 'rent' ? 3 : 6),
      price: property.price || null,
      net_price: null,
      min_price: null,
      commission_rate: purpose === 'rent' ? cs.rent_owner : cs.sale_seller,
      commission_amount: null,
      keys: 'owner',
      keys_notes: null,
      visit_terms: null,
      signed: false,
      status: 'active',
      notes: null,
      created_by: me.id,
      created_at: nowIso(),
      updated_at: nowIso(),
      ...initial,
    } as Mandate
  })
  const [fixed, setFixed] = useState(Boolean(initial.commission_amount))
  const set = <K extends keyof Mandate>(k: K, v: Mandate[K]) => setF((x) => ({ ...x, [k]: v }))
  const { save, pending } = useSave<Mandate>('mandates', 'mandate', (m) => `${property.ref} · ${MANDATE_KIND[m.kind].label}`)
  const del = useDeleteRow('mandates', 'mandate')
  const rent = f.purpose === 'rent'
  const editable = can('properties')

  const submit = async (print: boolean) => {
    if (!f.start_date) return toast.error('اكتب تاريخ بداية التفويض')
    if (f.end_date && f.end_date < f.start_date) return toast.error('تاريخ النهاية قبل تاريخ البداية')
    const row: Mandate = { ...f, commission_rate: fixed ? null : f.commission_rate, commission_amount: fixed ? f.commission_amount : null, updated_at: nowIso() }
    const saved = await save(row, { isNew, message: isNew ? 'تم تسجيل التفويض' : undefined })
    if (!saved) return
    if (isNew && saved.status === 'active') {
      // a renewal replaces the mandate that was in force
      for (const old of mandates.filter((m) => m.property_id === property.id && m.status === 'active' && m.id !== saved.id)) {
        await save({ ...old, status: 'ended', updated_at: nowIso() }, { silent: true, action: 'status', meta: { status: 'ended' } })
      }
    }
    if (print) printMandate(saved, property, L.client(saved.owner_client_id), s, hoodName)
    onClose()
  }

  return (
    <Modal
      open
      onClose={onClose}
      size="lg"
      title={`${isNew ? 'تفويض جديد' : 'تعديل التفويض'} · ${property.ref}`}
      footer={
        <>
          {!isNew && can('delete') && (
            <Button
              variant="ghost"
              className="me-auto text-danger"
              icon={<Trash2 className="size-4" />}
              onClick={async () => {
                if (await del(f.id, `تفويض ${property.ref}`)) onClose()
              }}
            >
              حذف
            </Button>
          )}
          <Button variant="ghost" onClick={onClose}>
            إلغاء
          </Button>
          {editable && (
            <>
              <Button variant="outline" loading={pending} icon={<Printer className="size-4" />} onClick={() => void submit(true)}>
                حفظ وطباعة
              </Button>
              <Button loading={pending} onClick={() => void submit(false)}>
                حفظ
              </Button>
            </>
          )}
        </>
      }
    >
      <div className="space-y-4">
        {!editable && <p className="rounded-xl bg-warning/10 p-3 text-sm text-warning">عرض فقط: تسجيل التفويضات يحتاج صلاحية «إضافة وتعديل العقارات».</p>}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="نوع التفويض">
            <Segmented
              value={f.kind}
              onChange={(v) => set('kind', v)}
              options={(Object.keys(MANDATE_KIND) as MandateKind[]).map((k) => ({ value: k, label: MANDATE_KIND[k].label }))}
              className="flex w-full [&>button]:flex-1"
            />
          </Field>
          <Field label="الغرض">
            <Segmented
              value={f.purpose}
              onChange={(v) => setF((x) => ({ ...x, purpose: v, commission_rate: v === 'rent' ? cs.rent_owner : cs.sale_seller }))}
              options={[
                { value: 'sale', label: 'بيع' },
                { value: 'rent', label: 'كراء' },
              ]}
              className="flex w-full [&>button]:flex-1"
            />
          </Field>
          <Field label="المالك" className="sm:col-span-2">
            <Combo value={f.owner_client_id} onChange={(v) => set('owner_client_id', v)} options={ownerOptions} placeholder="اختر المالك من العملاء" />
          </Field>
          <Field label="من">
            <Input type="date" dir="ltr" className="num" value={f.start_date} onChange={(e) => set('start_date', e.target.value)} />
          </Field>
          <Field
            label="إلى"
            hint={
              <span className="flex gap-2">
                {[3, 6, 12].map((n) => (
                  <button key={n} type="button" className="font-semibold text-teal hover:underline" onClick={() => set('end_date', plusMonths(f.start_date || start, n))}>
                    {n === 12 ? 'سنة' : `${n} أشهر`}
                  </button>
                ))}
              </span>
            }
          >
            <Input type="date" dir="ltr" className="num" value={f.end_date ?? ''} onChange={(e) => set('end_date', e.target.value || null)} />
          </Field>
          <Field label={rent ? 'ثمن الكراء المعروض' : 'الثمن المعروض'}>
            <Input type="number" inputMode="numeric" dir="ltr" className="num" value={f.price ?? ''} onChange={(e) => set('price', num(e.target.value))} />
          </Field>
          <Field label="الصافي للمالك" hint="ما يريد أن يصله بعد عمولتنا">
            <Input type="number" inputMode="numeric" dir="ltr" className="num" value={f.net_price ?? ''} onChange={(e) => set('net_price', num(e.target.value))} />
          </Field>
          <Field label="أقل ثمن يقبله" hint="داخلي، لا يُطبع ولا يظهر في الموقع">
            <Input type="number" inputMode="numeric" dir="ltr" className="num" value={f.min_price ?? ''} onChange={(e) => set('min_price', num(e.target.value))} />
          </Field>
          <Field label="عمولة الوكالة على المالك">
            <div className="flex gap-2">
              <Input
                type="number"
                step="0.1"
                dir="ltr"
                className="num min-w-0"
                value={(fixed ? f.commission_amount : f.commission_rate) ?? ''}
                onChange={(e) => (fixed ? set('commission_amount', num(e.target.value)) : set('commission_rate', num(e.target.value)))}
              />
              <Select value={fixed ? 'fixed' : 'rate'} onChange={(e) => setFixed(e.target.value === 'fixed')} className="w-32 shrink-0">
                <option value="rate">{rent ? 'شهر كراء' : '% من الثمن'}</option>
                <option value="fixed">درهم</option>
              </Select>
            </div>
          </Field>
          <Field label="المفاتيح">
            <Select value={f.keys} onChange={(e) => set('keys', e.target.value as KeysHolder)}>
              {(Object.keys(KEYS) as KeysHolder[]).map((k) => (
                <option key={k} value={k}>
                  {KEYS[k]}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="تفاصيل المفتاح">
            <Input value={f.keys_notes ?? ''} onChange={(e) => set('keys_notes', e.target.value || null)} placeholder="مثلاً: عند حارس العمارة السيد أحمد" />
          </Field>
          <Field label="شروط الزيارة" className="sm:col-span-2">
            <Input value={f.visit_terms ?? ''} onChange={(e) => set('visit_terms', e.target.value || null)} placeholder="مثلاً: بعد الزوال فقط، بإخبار المالك قبل يوم" />
          </Field>
          {!isNew && (
            <Field label="الحالة">
              <Select value={f.status} onChange={(e) => set('status', e.target.value as MandateStatus)}>
                <option value="active">ساري</option>
                <option value="ended">منتهٍ</option>
                <option value="cancelled">ملغى</option>
              </Select>
            </Field>
          )}
          <Field label="ملاحظات" className="sm:col-span-2">
            <Textarea rows={2} value={f.notes ?? ''} onChange={(e) => set('notes', e.target.value || null)} />
          </Field>
        </div>
        <Switch checked={f.signed} onChange={(v) => set('signed', v)} label={f.signed ? 'وقّعه المالك' : 'لم يوقّعه المالك بعد'} />
        {f.signed && <p className="text-xs text-muted">ارفع النسخة الموقعة في «الوثائق» بنوع «التفويض الموقّع» لتبقى محفوظة.</p>}
      </div>
    </Modal>
  )
}

/* ------------------------------------------------------------------ */
/* Private documents                                                    */
/* ------------------------------------------------------------------ */
function guessKind(name: string): DocKind {
  const n = name.toLowerCase()
  if (/cin|carte|identit|بطاقة|passport|passeport/.test(n)) return 'id'
  if (/titre|propri|ملكية|certificat/.test(n)) return 'title'
  if (/plan|cadastr|تصميم/.test(n)) return 'plan'
  if (/mandat|تفويض/.test(n)) return 'mandate'
  if (/contrat|compromis|عقد/.test(n)) return 'contract'
  if (/permis|autoris|رخصة/.test(n)) return 'permit'
  return 'other'
}

const fmtSize = (n: number | null) => (n == null ? '' : n > 1_000_000 ? `${(n / 1_000_000).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1000))} KB`)

export function DocumentsPanel({ clientId = null, propertyId = null, propertyIds = [], title = 'الوثائق' }: { clientId?: string | null; propertyId?: string | null; propertyIds?: string[]; title?: string }) {
  const me = useMe()
  const can = useCan()
  const L = useLookups()
  const confirm = useConfirm()
  const qc = useQueryClient()
  const { data: docs = [] } = useTable<PropertyDocument>('documents')
  const { save } = useSave<PropertyDocument>('documents', 'document', (d) => d.title || d.file_name)
  const input = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)
  const [editing, setEditing] = useState<string | null>(null)

  const list = useMemo(
    () =>
      docs
        .filter((d) => (clientId && d.client_id === clientId) || (propertyId && d.property_id === propertyId) || (d.property_id && propertyIds.includes(d.property_id)))
        .sort((a, b) => b.created_at.localeCompare(a.created_at)),
    [docs, clientId, propertyId, propertyIds],
  )

  const upload = async (files: FileList | null) => {
    if (!files?.length) return
    setBusy(true)
    let done = 0
    try {
      for (const file of Array.from(files)) {
        if (file.size > 20_000_000) {
          toast.error(`${file.name}: الحجم أكبر من 20 ميغابايت`)
          continue
        }
        const path = await repo.uploadDocument(file, file.name)
        const row: PropertyDocument = {
          id: uid(),
          client_id: clientId,
          property_id: propertyId,
          kind: guessKind(file.name),
          title: file.name.replace(/\.[^.]+$/, ''),
          path,
          file_name: file.name,
          mime: file.type || null,
          size: file.size,
          expires_at: null,
          uploaded_by: me.id,
          created_at: nowIso(),
        }
        if (await save(row, { isNew: true, silent: true })) done++
      }
      if (done) toast.success(done === 1 ? 'تم حفظ الوثيقة في الخزانة' : `تم حفظ ${done} وثائق في الخزانة`)
    } catch (e) {
      toast.error(/demo_file_too_big/.test(String(e)) ? 'في النسخة التجريبية لا يُقبل ملف أكبر من 1.5 ميغابايت.' : errorText(e))
    } finally {
      setBusy(false)
      if (input.current) input.current.value = ''
    }
  }

  const open = async (d: PropertyDocument) => {
    const w = window.open('', '_blank')
    try {
      let url = await repo.documentUrl(d.path)
      if (url.startsWith('data:')) url = URL.createObjectURL(await (await fetch(url)).blob())
      if (w) w.location.href = url
      else window.location.assign(url)
    } catch (e) {
      w?.close()
      toast.error(errorText(e))
    }
  }

  const remove = async (d: PropertyDocument) => {
    if (!(await confirm({ title: `حذف «${d.title || d.file_name}»؟`, text: 'يُحذف الملف نهائياً من الخزانة.', confirmLabel: 'نعم، احذف', danger: true }))) return
    try {
      await repo.remove('documents', d.id)
      await repo.deleteDocumentFile(d.path)
      void qc.invalidateQueries({ queryKey: ['documents'] })
      void logActivity(me, 'delete', 'document', d.id, { title: d.title || d.file_name })
      toast.success('تم الحذف')
    } catch (e) {
      toast.error(errorText(e))
    }
  }

  return (
    <Card
      title={
        <span className="inline-flex items-center gap-2">
          {title} <span className="num text-xs font-normal text-muted">({list.length})</span>
        </span>
      }
      icon={<FolderLock className="size-4" />}
      bodyClass="p-0"
      action={
        <>
          <input ref={input} type="file" multiple hidden accept=".pdf,.jpg,.jpeg,.png,.webp,.heic,.doc,.docx" onChange={(e) => void upload(e.target.files)} />
          <Button size="sm" variant="outline" loading={busy} icon={<Upload className="size-4" />} onClick={() => input.current?.click()}>
            رفع
          </Button>
        </>
      }
    >
      <p className="border-b border-line bg-ivory px-4 py-2 text-xs text-muted">خزانة خاصة بالفريق: لا تظهر أبداً في الموقع، وتُفتح بروابط مؤقتة.</p>
      {list.length === 0 ? (
        <p className="p-4 text-sm text-muted">لا توجد وثائق بعد. ارفع شهادة الملكية، التصاميم، نسخة البطاقة أو التفويض الموقّع.</p>
      ) : (
        <ul className="divide-y divide-line">
          {list.map((d) => {
            const image = (d.mime ?? '').startsWith('image/')
            const canDelete = can('delete') || d.uploaded_by === me.id
            const prop = d.property_id && !propertyId ? L.property(d.property_id) : undefined
            const expired = d.expires_at && d.expires_at < localDate(new Date())
            return (
              <li key={d.id} className="px-4 py-3">
                {editing === d.id ? (
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-[1.4fr_1fr_0.9fr_auto] sm:items-end">
                    <Field label="العنوان">
                      <Input defaultValue={d.title} onBlur={(e) => e.target.value !== d.title && void save({ ...d, title: e.target.value }, { silent: true })} />
                    </Field>
                    <Field label="النوع">
                      <Select value={d.kind} onChange={(e) => void save({ ...d, kind: e.target.value as DocKind }, { silent: true })}>
                        {(Object.keys(DOC_KIND) as DocKind[]).map((k) => (
                          <option key={k} value={k}>
                            {DOC_KIND[k]}
                          </option>
                        ))}
                      </Select>
                    </Field>
                    <Field label="صالحة حتى">
                      <Input type="date" dir="ltr" className="num" value={d.expires_at ?? ''} onChange={(e) => void save({ ...d, expires_at: e.target.value || null }, { silent: true })} />
                    </Field>
                    <button type="button" onClick={() => setEditing(null)} className="mb-1 rounded-full p-2 text-muted hover:bg-sand" aria-label="إغلاق">
                      <X className="size-4" />
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center gap-3">
                    <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-sand text-navy">{image ? <FileImage className="size-4" /> : <FileText className="size-4" />}</span>
                    <button type="button" onClick={() => void open(d)} className="min-w-0 flex-1 text-start">
                      <span className="block truncate text-sm font-semibold text-navy hover:underline">{d.title || d.file_name}</span>
                      <span className="block truncate text-xs text-muted">
                        {DOC_KIND[d.kind]}
                        {prop ? ` · ${prop.ref}` : ''} · {fmtDate(d.created_at)} · <span className="num">{fmtSize(d.size)}</span>
                        {d.expires_at && <span className={expired ? 'font-bold text-danger' : ''}> · {expired ? 'انتهت صلاحيتها' : `صالحة حتى ${fmtDate(d.expires_at)}`}</span>}
                      </span>
                    </button>
                    <button type="button" onClick={() => void open(d)} className="rounded-full p-2 text-muted hover:bg-sand hover:text-navy" title="فتح" aria-label="فتح">
                      <Download className="size-4" />
                    </button>
                    <button type="button" onClick={() => setEditing(d.id)} className="rounded-full p-2 text-muted hover:bg-sand hover:text-navy" title="تعديل" aria-label="تعديل">
                      <Pencil className="size-4" />
                    </button>
                    {canDelete && (
                      <button type="button" onClick={() => void remove(d)} className="rounded-full p-2 text-muted hover:bg-danger/10 hover:text-danger" title="حذف" aria-label="حذف">
                        <Trash2 className="size-4" />
                      </button>
                    )}
                  </div>
                )}
              </li>
            )
          })}
        </ul>
      )}
    </Card>
  )
}

/* ------------------------------------------------------------------ */
/* Price history                                                        */
/* ------------------------------------------------------------------ */
export function PriceHistory({ propertyId, rent }: { propertyId: string; rent?: boolean }) {
  const { data: prices = [] } = useTable<PriceChange>('price_history')
  const list = prices.filter((p) => p.property_id === propertyId).sort((a, b) => b.created_at.localeCompare(a.created_at))
  return (
    <Card title="سجل الثمن" icon={<TrendingDown className="size-4" />} bodyClass="p-0">
      {list.length === 0 ? (
        <p className="p-4 text-sm text-muted">يُسجَّل كل تغيير في الثمن هنا تلقائياً.</p>
      ) : (
        <ul className="divide-y divide-line">
          {list.map((h) => {
            const diff = h.old_price ? Math.round(((h.new_price - h.old_price) / h.old_price) * 1000) / 10 : null
            return (
              <li key={h.id} className="flex items-center justify-between gap-3 px-4 py-2.5 text-sm">
                <span className="text-muted">{fmtDate(h.created_at)}</span>
                <span className="flex items-center gap-2">
                  {diff != null && diff !== 0 && (
                    <span className={cn('num inline-flex items-center gap-1 text-xs font-bold', diff < 0 ? 'text-danger' : 'text-success')} dir="ltr">
                      {diff < 0 ? <TrendingDown className="size-3.5" /> : <TrendingUp className="size-3.5" />}
                      {diff > 0 ? '+' : ''}
                      {diff}%
                    </span>
                  )}
                  <b className="num text-navy">{fmtPrice(h.new_price, 'ar', rent)}</b>
                  {h.old_price == null && <span className="text-xs text-subtle">الثمن الأول</span>}
                </span>
              </li>
            )
          })}
        </ul>
      )}
    </Card>
  )
}

/* ------------------------------------------------------------------ */
/* The owner's file                                                     */
/* ------------------------------------------------------------------ */
export function OwnerFile({ client, onClose }: { client: Client; onClose: () => void }) {
  const me = useMe()
  const quick = useQuickAdd()
  const confirm = useConfirm()
  const L = useLookups()
  const { s, hoodName } = useNames()
  const { data: mandates = [] } = useTable<Mandate>('mandates')
  const { data: prices = [] } = useTable<PriceChange>('price_history')
  const { data: leads = [] } = useTable<Lead>('leads')
  const { data: appts = [] } = useTable<Appointment>('appointments')
  const saveClient = useSave<Client>('clients', 'client', (c) => c.full_name)
  const [mandateFor, setMandateFor] = useState<{ property: Property; initial?: Partial<Mandate> } | null>(null)

  const owned = L.properties.filter((p) => p.owner_client_id === client.id)
  const report = useMemo(() => buildOwnerReport(client, L.properties, leads, appts, prices, mandates), [client, L.properties, leads, appts, prices, mandates])
  const history = mandates.filter((m) => owned.some((p) => p.id === m.property_id) || m.owner_client_id === client.id).sort((a, b) => b.start_date.localeCompare(a.start_date))
  const link = client.share_token ? ownerLink(client.share_token) : null
  const phone = client.whatsapp || client.phone
  const agencyName = pick(s.agency.name, client.lang)

  const sendReport = async () => {
    window.open(waLink(phone, ownerReportText(report, agencyName, link, (n) => fmtPrice(n, client.lang))), '_blank', 'noopener')
    await saveClient.save({ ...client, last_report_at: nowIso() }, { silent: true, action: 'update', meta: { report: true } })
    void logActivity(me, 'create', 'owner_report', client.id, { title: client.full_name })
  }
  const createLink = () => saveClient.save({ ...client, share_token: crypto.randomUUID() }, { message: 'تم إنشاء رابط المتابعة. أرسله للمالك مع التقرير.' })
  const revokeLink = async () => {
    if (!(await confirm({ title: 'إلغاء رابط المتابعة؟', text: 'لن يعمل الرابط القديم بعد الآن. يمكنك إنشاء رابط جديد في أي وقت.', confirmLabel: 'نعم، ألغِ الرابط', danger: true }))) return
    await saveClient.save({ ...client, share_token: null }, { message: 'أُلغي رابط المتابعة' })
  }
  const copyLink = () =>
    link &&
    navigator.clipboard.writeText(link).then(
      () => toast.success('تم نسخ الرابط'),
      () => toast.error('تعذر النسخ'),
    )

  return (
    <>
      <Drawer
        open
        onClose={onClose}
        width="max-w-3xl"
        title={
          <span className="flex items-center gap-2">
            <FolderLock className="size-5 text-gold-600" /> ملف المالك: {client.full_name}
          </span>
        }
        footer={
          <>
            <Button variant="outline" icon={<Pencil className="size-4" />} onClick={() => quick('client', client)}>
              تعديل بيانات المالك
            </Button>
            <Button variant="ghost" onClick={onClose}>
              إغلاق
            </Button>
          </>
        }
      >
        <div className="space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-ivory p-4">
            <PhoneLinks phone={phone} />
            <span className="text-xs text-muted">
              لغة التواصل: <b className="text-navy">{LANG_LABEL[client.lang]}</b> · آخر تقرير: <b className="text-navy">{client.last_report_at ? fmtDate(client.last_report_at) : 'لم يُرسل بعد'}</b>
            </span>
          </div>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[
              ['عقارات', owned.length],
              ['تفويضات سارية', owned.filter((p) => currentMandate(mandates, p.id)).length],
              ['مشاهدات', report.properties.reduce((a, p) => a + p.views, 0)],
              ['زيارات منجزة', report.properties.reduce((a, p) => a + p.visits_done, 0)],
            ].map(([k, v]) => (
              <div key={k} className="rounded-xl border border-line p-3 text-center">
                <div className="num text-xl font-extrabold text-navy">{fmtNumber(Number(v))}</div>
                <div className="text-xs text-muted">{k}</div>
              </div>
            ))}
          </div>

          <Card title="تقرير المالك ورابط المتابعة" icon={<Link2 className="size-4" />}>
            <p className="text-sm text-muted">يرى المالك عبر رابطه الخاص عقاراته ومشاهداتها وزياراتها وتطور ثمنها، دون أسماء الزوار ولا ملاحظاتكم الداخلية.</p>
            {link ? (
              <div className="mt-3 flex flex-wrap items-center gap-2 rounded-xl border border-line bg-white p-2.5">
                <span className="min-w-0 flex-1 truncate text-xs text-navy" dir="ltr">
                  {link}
                </span>
                <Button size="sm" variant="ghost" icon={<Copy className="size-4" />} onClick={() => void copyLink()}>
                  نسخ
                </Button>
                <a href={link} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-xs font-semibold text-teal hover:underline">
                  <ExternalLink className="size-3.5" /> فتح
                </a>
                <Button size="sm" variant="ghost" className="text-danger" onClick={() => void revokeLink()}>
                  إلغاء الرابط
                </Button>
              </div>
            ) : (
              <Button className="mt-3" variant="outline" icon={<Link2 className="size-4" />} loading={saveClient.pending} onClick={() => void createLink()}>
                إنشاء رابط متابعة خاص
              </Button>
            )}
            <div className="mt-3 flex flex-wrap gap-2">
              <Button variant="whatsapp" icon={<WhatsAppIcon className="size-4" />} onClick={() => void sendReport()}>
                إرسال التقرير بالواتساب
              </Button>
              <Button variant="outline" icon={<Printer className="size-4" />} onClick={() => void printOwnerReport(report, client.full_name, link, s)}>
                طباعة التقرير
              </Button>
            </div>
          </Card>

          <Card title={`عقاراته (${owned.length})`} icon={<Building2 className="size-4" />} bodyClass="p-0">
            {owned.length === 0 ? (
              <p className="p-4 text-sm text-muted">لا يوجد عقار مسجل باسمه. اختر المالك في صفحة العقار، في «المالك ومعلومات داخلية».</p>
            ) : (
              <ul className="divide-y divide-line">
                {owned.map((p) => {
                  const m = currentMandate(mandates, p.id)
                  const r = report.properties.find((x) => x.ref === p.ref)
                  return (
                    <li key={p.id} className="flex flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center">
                      <Link to={`/admin/properties/${p.id}`} className="flex min-w-0 flex-1 items-center gap-3">
                        {p.images[0] ? <img src={p.images[0]} alt="" className="size-12 shrink-0 rounded-lg bg-sand object-cover" loading="lazy" /> : <span className="size-12 shrink-0 rounded-lg bg-sand" />}
                        <span className="min-w-0">
                          <span className="block truncate text-sm font-semibold text-navy">
                            <span className="num text-gold-700">{p.ref}</span> {p.title}
                          </span>
                          <span className="mt-0.5 flex flex-wrap items-center gap-1.5 text-xs text-muted">
                            <Pill color={PROPERTY_STATUS[p.status].color}>{PROPERTY_STATUS[p.status].label}</Pill>
                            <MandatePill m={m} />
                            <span className="num">{fmtPrice(p.price, 'ar', p.purpose === 'rent')}</span>
                          </span>
                          {r && (
                            <span className="mt-1 block text-xs text-subtle">
                              معروض منذ {daysAr(daysOnMarket(p.created_at))} · مشاهدات {r.views} · طلبات {r.leads} · زيارات {r.visits_done}
                              {r.visits_planned ? ` + ${r.visits_planned} مبرمجة` : ''}
                            </span>
                          )}
                        </span>
                      </Link>
                      <span className="flex shrink-0 flex-wrap gap-1.5">
                        {m && (
                          <Button size="sm" variant="ghost" icon={<Printer className="size-4" />} onClick={() => printMandate(m, p, client, s, hoodName)}>
                            طباعة
                          </Button>
                        )}
                        {m && mandateState(m).state !== 'active' && (
                          <Button size="sm" variant="ghost" icon={<Plus className="size-4" />} onClick={() => setMandateFor({ property: p, initial: renewalOf(m) })}>
                            تجديد
                          </Button>
                        )}
                        <Button size="sm" variant="outline" icon={m ? <Pencil className="size-4" /> : <Plus className="size-4" />} onClick={() => setMandateFor({ property: p, initial: m })}>
                          {m ? 'التفويض' : 'تفويض جديد'}
                        </Button>
                      </span>
                    </li>
                  )
                })}
              </ul>
            )}
          </Card>

          {history.length > 0 && (
            <Card title="كل التفويضات" icon={<FileText className="size-4" />} bodyClass="p-0 overflow-x-auto">
              <table className="table">
                <thead>
                  <tr>
                    <th>العقار</th>
                    <th>النوع</th>
                    <th>المدة</th>
                    <th>الحالة</th>
                    <th>موقّع</th>
                  </tr>
                </thead>
                <tbody>
                  {history.map((m) => {
                    const p = L.property(m.property_id)
                    return (
                      <tr key={m.id} className="cursor-pointer" onClick={() => p && setMandateFor({ property: p, initial: m })}>
                        <td className="num text-sm font-semibold">{p?.ref ?? '—'}</td>
                        <td className="text-sm">{MANDATE_KIND[m.kind].label}</td>
                        <td className="text-xs whitespace-nowrap text-muted">
                          {fmtDate(m.start_date)} · {m.end_date ? fmtDate(m.end_date) : 'بدون نهاية'}
                        </td>
                        <td>
                          <MandatePill m={m} />
                        </td>
                        <td className="text-sm">{m.signed ? 'نعم' : 'لا'}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </Card>
          )}

          <DocumentsPanel clientId={client.id} propertyIds={owned.map((p) => p.id)} title="خزانة الوثائق" />
        </div>
      </Drawer>
      {mandateFor && <MandateDialog key={mandateFor.initial?.id ?? mandateFor.property.id} property={mandateFor.property} initial={mandateFor.initial} onClose={() => setMandateFor(null)} />}
    </>
  )
}
