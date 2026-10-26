import { AlertTriangle, Link2, Printer, Trash2, UserPlus } from 'lucide-react'
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { toast } from 'sonner'
import { PROPERTY_TYPES } from '@/shared/lib/config'
import { useTable } from '@/shared/lib/data'
import { addDays, combineDateTime, fmtPrice, localDate, localTime, nowIso, startOfDay, uid, waLink } from '@/shared/lib/format'
import type { Appointment, AppointmentKind, AppointmentStatus, Broker, CallLog, Client, ClientKind, Deal, Expense, Interest, Invoice, Lang, Lead, Lease, LeadKind, LeadSource, Offer, Payment, PriceOpinion, PropertyType, Purpose, RentPayment, Task, TaskPriority } from '@/shared/lib/types'
import { Button, Field, Input, Modal, Segmented, Select, Switch, Textarea } from '@/shared/ui/base'
import { WhatsAppIcon } from '@/shared/ui/icons'
import { useDeleteRow, useLookups, useMe, useNames, useSave } from './hooks'
import { APPT_KIND, APPT_STATUS, CLIENT_KIND, INTEREST, LANG_LABEL, LEAD_KIND, PRICE_OPINION, PRIORITY, PURPOSE, SOURCE } from './labels'
import { ExpenseDialog, InvoiceDialog, PaymentDialog } from './finance'
import { BrokerDialog, DealDialog, useBrokerOptions } from './network-dialogs'
import { OfferDialog } from './offers'
import { LeaseDialog, RentDialog } from './rentals'
import { printVisitVoucher } from './print'
import { visitReminder } from './templates'
import { Chips, Combo, type ComboOption } from './ui'

const numOrNull = (v: string) => (v.trim() === '' || Number.isNaN(Number(v)) ? null : Number(v))

/* ------------------------------------------------------------------ */
/* Option lists                                                         */
/* ------------------------------------------------------------------ */
export function usePropertyOptions(): ComboOption[] {
  const { properties } = useLookups()
  const { hoodName } = useNames()
  return useMemo(
    () =>
      properties.map((p) => ({
        value: p.id,
        label: `${p.ref} — ${p.title}`,
        sub: `${PURPOSE[p.purpose].label} · ${hoodName(p.neighborhood)} · ${fmtPrice(p.price, 'ar', p.purpose === 'rent')}`,
        keywords: `${p.ref} ${p.title_fr ?? ''} ${p.city}`,
      })),
    [properties, hoodName],
  )
}

export function useClientOptions(): ComboOption[] {
  const { clients } = useLookups()
  return useMemo(
    () =>
      clients.map((c) => ({
        value: c.id,
        label: c.full_name,
        sub: `${CLIENT_KIND[c.kind].label} · ${c.phone}`,
        keywords: `${c.phone} ${c.phone.replace(/\D/g, '')} ${c.email ?? ''}`,
      })),
    [clients],
  )
}

export function StaffSelect({ value, onChange, allowEmpty = true }: { value: string | null; onChange: (v: string | null) => void; allowEmpty?: boolean }) {
  const { activeStaff } = useLookups()
  return (
    <Select value={value ?? ''} onChange={(e) => onChange(e.target.value || null)}>
      {allowEmpty && <option value="">— غير محدد —</option>}
      {activeStaff.map((s) => (
        <option key={s.id} value={s.id}>
          {s.full_name}
        </option>
      ))}
    </Select>
  )
}

/* ------------------------------------------------------------------ */
/* Quick-add provider: any page can open any form                       */
/* ------------------------------------------------------------------ */
export type QuickKind = 'appointment' | 'call' | 'client' | 'task' | 'deal' | 'lead' | 'broker' | 'offer' | 'invoice' | 'payment' | 'expense' | 'lease' | 'rent'
interface InitialMap {
  appointment: Partial<Appointment>
  call: Partial<CallLog>
  client: Partial<Client>
  task: Partial<Task>
  deal: Partial<Deal>
  lead: Partial<Lead>
  broker: Partial<Broker>
  offer: Partial<Offer>
  invoice: Partial<Invoice>
  payment: Partial<Payment>
  expense: Partial<Expense>
  lease: Partial<Lease>
  rent: Partial<RentPayment>
}
type Opener = <K extends QuickKind>(kind: K, initial?: InitialMap[K], onSaved?: (row: unknown) => void) => void

const QuickCtx = createContext<Opener | null>(null)

export function QuickAddProvider({ children }: { children: ReactNode }) {
  const [req, setReq] = useState<{ kind: QuickKind; initial?: unknown; onSaved?: (row: unknown) => void; key: number } | null>(null)
  const open = useCallback<Opener>((kind, initial, onSaved) => setReq({ kind, initial, onSaved, key: Date.now() }), [])
  const close = useCallback(() => setReq(null), [])
  const saved = req?.onSaved
  return (
    <QuickCtx.Provider value={open}>
      {children}
      {req?.kind === 'appointment' && <AppointmentDialog key={req.key} initial={req.initial as Partial<Appointment>} onClose={close} onSaved={saved} />}
      {req?.kind === 'call' && <CallDialog key={req.key} initial={req.initial as Partial<CallLog>} onClose={close} onSaved={saved} />}
      {req?.kind === 'client' && <ClientDialog key={req.key} initial={req.initial as Partial<Client>} onClose={close} onSaved={saved} />}
      {req?.kind === 'task' && <TaskDialog key={req.key} initial={req.initial as Partial<Task>} onClose={close} onSaved={saved} />}
      {req?.kind === 'deal' && <DealDialog key={req.key} initial={req.initial as Partial<Deal>} onClose={close} onSaved={saved} />}
      {req?.kind === 'lead' && <LeadDialog key={req.key} initial={req.initial as Partial<Lead>} onClose={close} onSaved={saved} />}
      {req?.kind === 'broker' && <BrokerDialog key={req.key} initial={req.initial as Partial<Broker>} onClose={close} onSaved={saved} />}
      {req?.kind === 'offer' && <OfferDialog key={req.key} initial={req.initial as Partial<Offer>} onClose={close} onSaved={saved} />}
      {req?.kind === 'invoice' && <InvoiceDialog key={req.key} initial={req.initial as Partial<Invoice>} onClose={close} onSaved={saved} />}
      {req?.kind === 'payment' && <PaymentDialog key={req.key} initial={req.initial as Partial<Payment>} onClose={close} onSaved={saved} />}
      {req?.kind === 'expense' && <ExpenseDialog key={req.key} initial={req.initial as Partial<Expense>} onClose={close} onSaved={saved} />}
      {req?.kind === 'lease' && <LeaseDialog key={req.key} initial={req.initial as Partial<Lease>} onClose={close} onSaved={saved} />}
      {req?.kind === 'rent' && <RentDialog key={req.key} initial={req.initial as Partial<RentPayment>} onClose={close} onSaved={saved} />}
    </QuickCtx.Provider>
  )
}

export function useQuickAdd(): Opener {
  const c = useContext(QuickCtx)
  if (!c) throw new Error('useQuickAdd outside provider')
  return c
}

/* ------------------------------------------------------------------ */
/* Appointment                                                          */
/* ------------------------------------------------------------------ */
function defaultStart(): Date {
  const d = new Date()
  d.setMinutes(0, 0, 0)
  d.setHours(d.getHours() + 1)
  if (d.getHours() >= 19 || d.getHours() < 9) {
    const t = addDays(startOfDay(new Date()), new Date().getHours() >= 9 ? 1 : 0)
    t.setHours(10, 0, 0, 0)
    return t
  }
  return d
}

export function AppointmentDialog({ initial = {}, onClose, onSaved }: { initial?: Partial<Appointment>; onClose: () => void; onSaved?: (a: Appointment) => void }) {
  const me = useMe()
  const L = useLookups()
  const { s, hoodName } = useNames()
  const { data: appts = [] } = useTable<Appointment>('appointments')
  const propertyOptions = usePropertyOptions()
  const clientOptions = useClientOptions()
  const isNew = !initial.id
  const start0 = initial.starts_at ? new Date(initial.starts_at) : defaultStart()
  const dur0 = initial.starts_at && initial.ends_at ? Math.max(15, Math.round((+new Date(initial.ends_at) - +new Date(initial.starts_at)) / 60000)) : 45
  const [f, setF] = useState({
    id: initial.id ?? uid(),
    title: initial.title ?? '',
    kind: (initial.kind ?? 'visit') as AppointmentKind,
    date: localDate(start0),
    time: localTime(start0),
    duration: dur0,
    property_id: initial.property_id ?? null,
    client_id: initial.client_id ?? null,
    lead_id: initial.lead_id ?? null,
    assigned_to: (initial.assigned_to ?? me.id) as string | null,
    status: (initial.status ?? 'scheduled') as AppointmentStatus,
    notes: initial.notes ?? '',
    feedback_interest: (initial.feedback_interest ?? null) as Interest | null,
    feedback_price: (initial.feedback_price ?? null) as PriceOpinion | null,
    feedback_note: initial.feedback_note ?? '',
  })
  const [titleTouched, setTitleTouched] = useState(Boolean(initial.title))
  const [newVisitor, setNewVisitor] = useState(false)
  const [visitor, setVisitor] = useState({ name: '', phone: '' })
  const set = <K extends keyof typeof f>(k: K, v: (typeof f)[K]) => setF((x) => ({ ...x, [k]: v }))

  const p = L.property(f.property_id)
  const c = L.client(f.client_id)
  const autoTitle = [APPT_KIND[f.kind].label, p?.ref, c?.full_name ?? (newVisitor ? visitor.name : '')].filter(Boolean).join(' — ')
  const title = titleTouched ? f.title : autoTitle
  const startIso = f.date && f.time ? combineDateTime(f.date, f.time) : nowIso()
  const endIso = new Date(+new Date(startIso) + f.duration * 60000).toISOString()
  const conflicts = appts.filter((a) => a.id !== f.id && a.status === 'scheduled' && f.assigned_to && a.assigned_to === f.assigned_to && a.starts_at < endIso && a.ends_at > startIso)

  const { save, pending } = useSave<Appointment>('appointments', 'appointment', (a) => a.title)
  const saveClient = useSave<Client>('clients', 'client', (x) => x.full_name)
  const del = useDeleteRow('appointments', 'appointment')

  const build = (client_id = f.client_id): Appointment => ({
    id: f.id,
    title: title.trim() || APPT_KIND[f.kind].label,
    kind: f.kind,
    starts_at: startIso,
    ends_at: endIso,
    property_id: f.property_id,
    client_id,
    lead_id: f.lead_id,
    assigned_to: f.assigned_to,
    status: f.status,
    notes: f.notes.trim() || null,
    feedback_interest: f.feedback_interest,
    feedback_price: f.feedback_price,
    feedback_note: f.feedback_note.trim() || null,
    created_by: initial.created_by ?? me.id,
    created_at: initial.created_at ?? nowIso(),
  })

  const submit = async () => {
    if (!f.date || !f.time) return toast.error('حدد التاريخ والساعة')
    let clientId = f.client_id
    if (newVisitor) {
      if (!visitor.name.trim() || !visitor.phone.trim()) return toast.error('أدخل اسم ورقم هاتف الزائر')
      const existing = L.clientByPhone(visitor.phone)
      if (existing) clientId = existing.id
      else {
        const nc: Client = {
          id: uid(),
          full_name: visitor.name.trim(),
          phone: visitor.phone.trim(),
          whatsapp: null,
          email: null,
          kind: p?.purpose === 'rent' ? 'tenant' : 'buyer',
          source: 'phone',
          budget_min: null,
          budget_max: null,
          wants_purpose: p?.purpose ?? null,
          wants_types: p ? [p.type] : [],
          wants_neighborhoods: p ? [p.neighborhood] : [],
          wants_rooms_min: null,
          lang: 'ar',
          notes: null,
          created_by: me.id,
          created_at: nowIso(),
          updated_at: nowIso(),
        }
        const saved = await saveClient.save(nc, { isNew: true, silent: true })
        if (!saved) return
        clientId = nc.id
      }
    }
    const saved = await save(build(clientId), { isNew })
    if (saved) {
      onSaved?.(saved)
      onClose()
    }
  }

  const remind = () => {
    const phone = c?.whatsapp || c?.phone
    if (!phone) return toast.error('اختر عميلاً لديه رقم هاتف')
    window.open(waLink(phone, visitReminder(build(), p, s, c?.lang ?? 'ar', c?.full_name, p ? hoodName(p.neighborhood) : '')), '_blank', 'noopener')
  }

  return (
    <Modal
      open
      onClose={onClose}
      size="lg"
      title={isNew ? 'موعد جديد' : 'تفاصيل الموعد'}
      footer={
        <>
          {!isNew && (
            <Button
              variant="ghost"
              className="me-auto text-danger"
              icon={<Trash2 className="size-4" />}
              onClick={async () => {
                if (await del(f.id, title)) onClose()
              }}
            >
              حذف
            </Button>
          )}
          {f.kind === 'visit' && (
            <Button variant="outline" icon={<Printer className="size-4" />} onClick={() => printVisitVoucher(build(), p, c, s, hoodName, L.staffName(f.assigned_to))}>
              ورقة الزيارة
            </Button>
          )}
          {c && (
            <Button variant="outline" icon={<WhatsAppIcon className="size-4" />} onClick={remind}>
              تذكير واتساب
            </Button>
          )}
          <Button variant="ghost" onClick={onClose}>
            إلغاء
          </Button>
          <Button variant="primary" loading={pending || saveClient.pending} onClick={submit}>
            {isNew ? 'إضافة الموعد' : 'حفظ'}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Segmented value={f.kind} onChange={(v) => set('kind', v)} options={(Object.keys(APPT_KIND) as AppointmentKind[]).map((k) => ({ value: k, label: APPT_KIND[k].label }))} className="flex w-full flex-wrap [&>button]:flex-1" />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="العقار">
            <Combo value={f.property_id} onChange={(v) => set('property_id', v)} options={propertyOptions} placeholder="اختر العقار (اختياري)" />
          </Field>
          <Field
            label={
              <span className="flex items-center justify-between gap-2">
                العميل / الزائر
                <button type="button" className="inline-flex items-center gap-1 text-xs font-semibold text-teal hover:underline" onClick={() => setNewVisitor((v) => !v)}>
                  <UserPlus className="size-3.5" /> {newVisitor ? 'اختيار من العملاء' : 'زائر جديد'}
                </button>
              </span>
            }
          >
            {newVisitor ? (
              <div className="grid grid-cols-2 gap-2">
                <Input placeholder="الاسم" value={visitor.name} onChange={(e) => setVisitor((v) => ({ ...v, name: e.target.value }))} />
                <Input placeholder="الهاتف" dir="ltr" className="num" value={visitor.phone} onChange={(e) => setVisitor((v) => ({ ...v, phone: e.target.value }))} />
              </div>
            ) : (
              <Combo value={f.client_id} onChange={(v) => set('client_id', v)} options={clientOptions} placeholder="اختر العميل" />
            )}
          </Field>
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <Field label="التاريخ" required>
            <Input type="date" dir="ltr" className="num" value={f.date} onChange={(e) => set('date', e.target.value)} />
          </Field>
          <Field label="الساعة" required>
            <Input type="time" dir="ltr" className="num" step={900} value={f.time} onChange={(e) => set('time', e.target.value)} />
          </Field>
          <Field label="المدة">
            <Select value={f.duration} onChange={(e) => set('duration', Number(e.target.value))}>
              {[15, 30, 45, 60, 90, 120, 180].map((m) => (
                <option key={m} value={m}>
                  {m < 60 ? `${m} دقيقة` : m === 60 ? 'ساعة' : m === 90 ? 'ساعة ونصف' : m === 120 ? 'ساعتان' : '3 ساعات'}
                </option>
              ))}
            </Select>
          </Field>
        </div>
        {conflicts.length > 0 && (
          <div className="flex items-start gap-2 rounded-xl bg-warning/10 px-3 py-2.5 text-sm text-warning">
            <AlertTriangle className="mt-0.5 size-4 shrink-0" />
            <div>
              تنبيه: لدى {L.staffName(f.assigned_to)} موعد آخر في نفس الوقت:
              {conflicts.map((a) => (
                <div key={a.id} className="font-semibold">
                  <span className="num">{localTime(a.starts_at)}</span> — {a.title}
                </div>
              ))}
            </div>
          </div>
        )}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="المكلّف بالموعد">
            <StaffSelect value={f.assigned_to} onChange={(v) => set('assigned_to', v)} />
          </Field>
          {!isNew ? (
            <Field label="الحالة">
              <Select value={f.status} onChange={(e) => set('status', e.target.value as AppointmentStatus)}>
                {(Object.keys(APPT_STATUS) as AppointmentStatus[]).map((k) => (
                  <option key={k} value={k}>
                    {APPT_STATUS[k].label}
                  </option>
                ))}
              </Select>
            </Field>
          ) : (
            <Field label="العنوان" hint="يُملأ تلقائياً إن تركته فارغاً">
              <Input
                value={title}
                onChange={(e) => {
                  setTitleTouched(true)
                  set('title', e.target.value)
                }}
              />
            </Field>
          )}
        </div>
        {!isNew && f.kind === 'visit' && (f.status === 'done' || new Date(startIso) < new Date()) && (
          <div className="space-y-3 rounded-2xl border border-teal/30 bg-teal/5 p-4">
            <h3 className="text-sm font-bold text-navy">رأي الزائر بعد الزيارة</h3>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Field label="الاهتمام">
                <Segmented
                  value={f.feedback_interest ?? ('' as Interest)}
                  onChange={(v) => setF((x) => ({ ...x, feedback_interest: v, status: x.status === 'scheduled' ? 'done' : x.status }))}
                  options={(Object.keys(INTEREST) as Interest[]).map((k) => ({ value: k, label: INTEREST[k].label }))}
                  className="flex w-full [&>button]:flex-1"
                />
              </Field>
              <Field label="رأيه في الثمن">
                <Segmented
                  value={f.feedback_price ?? ('' as PriceOpinion)}
                  onChange={(v) => setF((x) => ({ ...x, feedback_price: v, status: x.status === 'scheduled' ? 'done' : x.status }))}
                  options={(['low', 'fair', 'high'] as PriceOpinion[]).map((k) => ({ value: k, label: PRICE_OPINION[k].label }))}
                  className="flex w-full [&>button]:flex-1"
                />
              </Field>
            </div>
            <Field label="ما قاله عن العقار" hint="يصل المالك ملخص الآراء فقط، دون اسم الزائر ولا كلامه.">
              <Textarea rows={2} value={f.feedback_note} onChange={(e) => set('feedback_note', e.target.value)} />
            </Field>
          </div>
        )}
        {!isNew && (
          <Field label="العنوان">
            <Input
              value={title}
              onChange={(e) => {
                setTitleTouched(true)
                set('title', e.target.value)
              }}
            />
          </Field>
        )}
        <Field label="ملاحظات (مكان اللقاء، المفتاح…)">
          <Textarea rows={3} value={f.notes} onChange={(e) => set('notes', e.target.value)} />
        </Field>
      </div>
    </Modal>
  )
}

/* ------------------------------------------------------------------ */
/* Phone call                                                           */
/* ------------------------------------------------------------------ */
export function CallDialog({ initial = {}, onClose, onSaved }: { initial?: Partial<CallLog>; onClose: () => void; onSaved?: (c: CallLog) => void }) {
  const me = useMe()
  const L = useLookups()
  const propertyOptions = usePropertyOptions()
  const clientOptions = useClientOptions()
  const isNew = !initial.id
  const [f, setF] = useState({
    id: initial.id ?? uid(),
    caller_name: initial.caller_name ?? '',
    phone: initial.phone ?? '',
    direction: (initial.direction ?? 'in') as 'in' | 'out',
    subject: initial.subject ?? '',
    outcome: initial.outcome ?? '',
    client_id: initial.client_id ?? null,
    lead_id: initial.lead_id ?? null,
  })
  const set = <K extends keyof typeof f>(k: K, v: (typeof f)[K]) => setF((x) => ({ ...x, [k]: v }))
  const [mkLead, setMkLead] = useState(false)
  const [leadKind, setLeadKind] = useState<LeadKind>('inquiry')
  const [leadProp, setLeadProp] = useState<string | null>(null)
  const [mkTask, setMkTask] = useState(false)
  const [taskDue, setTaskDue] = useState(localDate(addDays(new Date(), 1)))

  const known = L.clientByPhone(f.phone)
  useEffect(() => {
    if (known && !f.client_id) setF((x) => ({ ...x, client_id: known.id, caller_name: x.caller_name || known.full_name }))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [known?.id])

  const call = useSave<CallLog>('calls', 'call', (c) => `${c.caller_name} — ${c.subject}`)
  const lead = useSave<Lead>('leads', 'lead', (l) => l.name)
  const task = useSave<Task>('tasks', 'task', (t) => t.title)
  const del = useDeleteRow('calls', 'call')

  const submit = async () => {
    if (!f.caller_name.trim() && !f.phone.trim()) return toast.error('أدخل الاسم أو رقم الهاتف')
    if (!f.subject.trim()) return toast.error('اكتب موضوع المكالمة')
    let leadId = f.lead_id
    if (mkLead) {
      const lp = L.property(leadProp)
      const l: Lead = {
        id: uid(),
        name: f.caller_name.trim() || f.phone,
        phone: f.phone.trim(),
        email: L.client(f.client_id)?.email ?? null,
        message: [f.subject, f.outcome].filter(Boolean).join(' — '),
        notes: null,
        kind: leadKind,
        property_id: lp?.id ?? null,
        property_ref: lp?.ref ?? null,
        source: 'phone',
        status: 'contacted',
        assigned_to: me.id,
        client_id: f.client_id,
        preferred_at: null,
        lang: L.client(f.client_id)?.lang ?? 'ar',
        meta: null,
        created_at: nowIso(),
        updated_at: nowIso(),
      }
      if (!(await lead.save(l, { isNew: true, silent: true }))) return
      leadId = l.id
    }
    const row: CallLog = {
      id: f.id,
      caller_name: f.caller_name.trim() || '—',
      phone: f.phone.trim(),
      direction: f.direction,
      subject: f.subject.trim(),
      outcome: f.outcome.trim() || null,
      client_id: f.client_id,
      lead_id: leadId,
      logged_by: initial.logged_by ?? me.id,
      created_at: initial.created_at ?? nowIso(),
    }
    const saved = await call.save(row, { isNew, message: isNew ? 'تم تسجيل المكالمة' : undefined })
    if (!saved) return
    if (mkTask) {
      const t: Task = {
        id: uid(),
        title: `معاودة الاتصال بـ ${row.caller_name}`,
        details: row.subject,
        due_at: combineDateTime(taskDue, '10:00'),
        priority: 'normal',
        status: 'open',
        assigned_to: me.id,
        related_type: leadId ? 'lead' : f.client_id ? 'client' : null,
        related_id: leadId ?? f.client_id,
        created_by: me.id,
        created_at: nowIso(),
        completed_at: null,
      }
      await task.save(t, { isNew: true, silent: true })
    }
    onSaved?.(saved)
    onClose()
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={isNew ? 'تسجيل مكالمة' : 'تفاصيل المكالمة'}
      footer={
        <>
          {!isNew && (
            <Button
              variant="ghost"
              className="me-auto text-danger"
              icon={<Trash2 className="size-4" />}
              onClick={async () => {
                if (await del(f.id, f.subject)) onClose()
              }}
            >
              حذف
            </Button>
          )}
          <Button variant="ghost" onClick={onClose}>
            إلغاء
          </Button>
          <Button loading={call.pending || lead.pending} onClick={submit}>
            حفظ المكالمة
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Segmented
          value={f.direction}
          onChange={(v) => set('direction', v)}
          options={[
            { value: 'in', label: 'مكالمة واردة' },
            { value: 'out', label: 'مكالمة صادرة' },
          ]}
          className="flex w-full [&>button]:flex-1"
        />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="رقم الهاتف">
            <Input dir="ltr" className="num" inputMode="tel" autoFocus value={f.phone} onChange={(e) => set('phone', e.target.value)} placeholder="06 00 00 00 00" />
          </Field>
          <Field label="الاسم">
            <Input value={f.caller_name} onChange={(e) => set('caller_name', e.target.value)} />
          </Field>
        </div>
        {known && (
          <div className="flex items-center gap-2 rounded-xl bg-teal-50 px-3 py-2 text-sm text-teal-700">
            <Link2 className="size-4" /> عميل مسجل: <b>{known.full_name}</b> ({CLIENT_KIND[known.kind].label})
          </div>
        )}
        {!known && (
          <Field label="ربط بعميل (اختياري)">
            <Combo value={f.client_id} onChange={(v) => set('client_id', v)} options={clientOptions} placeholder="اختر عميلاً" />
          </Field>
        )}
        <Field label="الموضوع" required>
          <Input value={f.subject} onChange={(e) => set('subject', e.target.value)} placeholder="مثلاً: سؤال عن ثمن SH-1001" />
        </Field>
        <Field label="النتيجة / ما تم الاتفاق عليه">
          <Textarea rows={2} value={f.outcome} onChange={(e) => set('outcome', e.target.value)} />
        </Field>
        {isNew && (
          <div className="space-y-3 rounded-2xl border border-line bg-ivory p-4">
            <Switch checked={mkLead} onChange={setMkLead} label="تسجيلها كطلب جديد في مسار الطلبات" />
            {mkLead && (
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <Field label="نوع الطلب">
                  <Select value={leadKind} onChange={(e) => setLeadKind(e.target.value as LeadKind)}>
                    {(Object.keys(LEAD_KIND) as LeadKind[]).map((k) => (
                      <option key={k} value={k}>
                        {LEAD_KIND[k].label}
                      </option>
                    ))}
                  </Select>
                </Field>
                <Field label="العقار المعني">
                  <Combo value={leadProp} onChange={setLeadProp} options={propertyOptions} placeholder="اختياري" />
                </Field>
              </div>
            )}
            <Switch checked={mkTask} onChange={setMkTask} label="تذكيري بمعاودة الاتصال" />
            {mkTask && (
              <Field label="تاريخ التذكير">
                <Input type="date" dir="ltr" className="num" value={taskDue} onChange={(e) => setTaskDue(e.target.value)} />
              </Field>
            )}
          </div>
        )}
      </div>
    </Modal>
  )
}

/* ------------------------------------------------------------------ */
/* Client                                                               */
/* ------------------------------------------------------------------ */
export function ClientDialog({ initial = {}, onClose, onSaved }: { initial?: Partial<Client>; onClose: () => void; onSaved?: (c: Client) => void }) {
  const me = useMe()
  const L = useLookups()
  const { s, typeName } = useNames()
  const isNew = !initial.id
  const [f, setF] = useState<Client>({
    id: uid(),
    full_name: '',
    phone: '',
    whatsapp: null,
    email: null,
    kind: 'buyer',
    source: 'phone',
    budget_min: null,
    budget_max: null,
    wants_purpose: 'sale',
    wants_types: [],
    wants_neighborhoods: [],
    wants_rooms_min: null,
    lang: 'ar',
    notes: null,
    created_by: me.id,
    created_at: nowIso(),
    updated_at: nowIso(),
    ...initial,
  } as Client)
  const set = <K extends keyof Client>(k: K, v: Client[K]) => setF((x) => ({ ...x, [k]: v }))
  const dup = L.clientByPhone(f.phone)
  const isDup = Boolean(dup && dup.id !== f.id)
  const { save, pending } = useSave<Client>('clients', 'client', (c) => c.full_name)
  const brokerOptions = useBrokerOptions(['broker', 'agency', 'referrer'])

  const setKind = (k: ClientKind) => setF((x) => ({ ...x, kind: k, wants_purpose: k === 'tenant' ? 'rent' : k === 'owner' ? null : 'sale' }))

  const submit = async () => {
    if (!f.full_name.trim()) return toast.error('أدخل اسم العميل')
    if (!f.phone.trim()) return toast.error('أدخل رقم الهاتف')
    const saved = await save({ ...f, full_name: f.full_name.trim(), phone: f.phone.trim(), updated_at: nowIso() }, { isNew })
    if (saved) {
      onSaved?.(saved)
      onClose()
    }
  }
  const searching = f.kind !== 'owner'

  return (
    <Modal
      open
      onClose={onClose}
      size="lg"
      title={isNew ? 'عميل جديد' : `تعديل: ${initial.full_name ?? ''}`}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            إلغاء
          </Button>
          <Button loading={pending} onClick={submit}>
            {isNew ? 'إضافة العميل' : 'حفظ'}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Segmented value={f.kind} onChange={setKind} options={(Object.keys(CLIENT_KIND) as ClientKind[]).map((k) => ({ value: k, label: CLIENT_KIND[k].label }))} className="flex w-full [&>button]:flex-1" />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="الاسم الكامل" required>
            <Input autoFocus value={f.full_name} onChange={(e) => set('full_name', e.target.value)} />
          </Field>
          <Field label="الهاتف" required error={isDup ? `هذا الرقم مسجل باسم ${dup!.full_name}` : null}>
            <Input dir="ltr" className="num" inputMode="tel" value={f.phone} onChange={(e) => set('phone', e.target.value)} />
          </Field>
          <Field label="واتساب (إن كان مختلفاً)">
            <Input dir="ltr" className="num" inputMode="tel" value={f.whatsapp ?? ''} onChange={(e) => set('whatsapp', e.target.value || null)} />
          </Field>
          <Field label="البريد الإلكتروني">
            <Input dir="ltr" type="email" value={f.email ?? ''} onChange={(e) => set('email', e.target.value || null)} />
          </Field>
          <Field label="مصدر العميل">
            <Select value={f.source} onChange={(e) => set('source', e.target.value as LeadSource)}>
              {(Object.keys(SOURCE) as LeadSource[]).map((k) => (
                <option key={k} value={k}>
                  {SOURCE[k].label}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="لغة التواصل (رسائل واتساب)">
            <Select value={f.lang} onChange={(e) => set('lang', e.target.value as Lang)}>
              {(Object.keys(LANG_LABEL) as Lang[]).map((k) => (
                <option key={k} value={k}>
                  {LANG_LABEL[k]}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="جاء عن طريق وسيط أو شريك" hint="تُقترح حصته تلقائياً عند تسجيل الصفقة" className="sm:col-span-2">
            <Combo value={f.broker_id ?? null} onChange={(v) => set('broker_id', v)} options={brokerOptions} placeholder="لا أحد: زبون مباشر" />
          </Field>
        </div>

        {searching && (
          <div className="space-y-4 rounded-2xl border border-line bg-ivory p-4">
            <h3 className="text-sm font-bold text-navy">ماذا يبحث عنه؟</h3>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <Field label="الغرض">
                <Select value={f.wants_purpose ?? ''} onChange={(e) => set('wants_purpose', (e.target.value || null) as Purpose | null)}>
                  <option value="">—</option>
                  <option value="sale">شراء</option>
                  <option value="rent">كراء</option>
                </Select>
              </Field>
              <Field label="الميزانية من (د.م.)">
                <Input type="number" inputMode="numeric" dir="ltr" className="num" value={f.budget_min ?? ''} onChange={(e) => set('budget_min', numOrNull(e.target.value))} />
              </Field>
              <Field label="الميزانية إلى (د.م.)">
                <Input type="number" inputMode="numeric" dir="ltr" className="num" value={f.budget_max ?? ''} onChange={(e) => set('budget_max', numOrNull(e.target.value))} />
              </Field>
            </div>
            <Field label="أنواع العقار">
              <Chips options={PROPERTY_TYPES.map((t) => ({ value: t, label: typeName(t) }))} value={f.wants_types} onChange={(v) => set('wants_types', v as PropertyType[])} />
            </Field>
            <Field label="المناطق المفضلة">
              <Chips options={s.catalog.neighborhoods.map((n) => ({ value: n.id, label: n.name.ar }))} value={f.wants_neighborhoods} onChange={(v) => set('wants_neighborhoods', v)} />
            </Field>
            <Field label="عدد الغرف (على الأقل)">
              <Select value={f.wants_rooms_min ?? ''} onChange={(e) => set('wants_rooms_min', numOrNull(e.target.value))} className="sm:w-48">
                <option value="">—</option>
                {[1, 2, 3, 4, 5, 6].map((n) => (
                  <option key={n} value={n}>
                    {n}+
                  </option>
                ))}
              </Select>
            </Field>
          </div>
        )}
        <Field label="ملاحظات">
          <Textarea rows={3} value={f.notes ?? ''} onChange={(e) => set('notes', e.target.value || null)} />
        </Field>
      </div>
    </Modal>
  )
}

/* ------------------------------------------------------------------ */
/* Task                                                                 */
/* ------------------------------------------------------------------ */
export function TaskDialog({ initial = {}, onClose, onSaved }: { initial?: Partial<Task>; onClose: () => void; onSaved?: (t: Task) => void }) {
  const me = useMe()
  const L = useLookups()
  const isNew = !initial.id
  const due0 = initial.due_at ? new Date(initial.due_at) : null
  const [f, setF] = useState({
    id: initial.id ?? uid(),
    title: initial.title ?? '',
    details: initial.details ?? '',
    date: due0 ? localDate(due0) : localDate(new Date()),
    time: due0 ? localTime(due0) : '12:00',
    noDate: isNew ? false : !initial.due_at,
    priority: (initial.priority ?? 'normal') as TaskPriority,
    assigned_to: (initial.assigned_to ?? me.id) as string | null,
  })
  const set = <K extends keyof typeof f>(k: K, v: (typeof f)[K]) => setF((x) => ({ ...x, [k]: v }))
  const { save, pending } = useSave<Task>('tasks', 'task', (t) => t.title)
  const del = useDeleteRow('tasks', 'task')
  const related =
    initial.related_type === 'property'
      ? `عقار ${L.property(initial.related_id)?.ref ?? ''}`
      : initial.related_type === 'client'
        ? `عميل: ${L.client(initial.related_id)?.full_name ?? ''}`
        : initial.related_type === 'lead'
          ? 'طلب من مسار الطلبات'
          : null

  const submit = async () => {
    if (!f.title.trim()) return toast.error('اكتب عنوان المهمة')
    const row: Task = {
      id: f.id,
      title: f.title.trim(),
      details: f.details.trim() || null,
      due_at: f.noDate ? null : combineDateTime(f.date, f.time),
      priority: f.priority,
      status: initial.status ?? 'open',
      assigned_to: f.assigned_to,
      related_type: initial.related_type ?? null,
      related_id: initial.related_id ?? null,
      created_by: initial.created_by ?? me.id,
      created_at: initial.created_at ?? nowIso(),
      completed_at: initial.completed_at ?? null,
    }
    const saved = await save(row, { isNew })
    if (saved) {
      onSaved?.(saved)
      onClose()
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={isNew ? 'مهمة جديدة' : 'تعديل المهمة'}
      footer={
        <>
          {!isNew && (
            <Button
              variant="ghost"
              className="me-auto text-danger"
              icon={<Trash2 className="size-4" />}
              onClick={async () => {
                if (await del(f.id, f.title)) onClose()
              }}
            >
              حذف
            </Button>
          )}
          <Button variant="ghost" onClick={onClose}>
            إلغاء
          </Button>
          <Button loading={pending} onClick={submit}>
            {isNew ? 'إضافة المهمة' : 'حفظ'}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        {related && <div className="rounded-xl bg-sand px-3 py-2 text-sm text-navy">مرتبطة بـ: {related}</div>}
        <Field label="المهمة" required>
          <Input autoFocus value={f.title} onChange={(e) => set('title', e.target.value)} placeholder="مثلاً: إرسال صور الشقة للعميل" />
        </Field>
        <Field label="تفاصيل">
          <Textarea rows={2} value={f.details} onChange={(e) => set('details', e.target.value)} />
        </Field>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="الأولوية">
            <Segmented value={f.priority} onChange={(v) => set('priority', v)} options={(Object.keys(PRIORITY) as TaskPriority[]).map((k) => ({ value: k, label: PRIORITY[k].label }))} className="flex w-full [&>button]:flex-1" />
          </Field>
          <Field label="مكلفة بها">
            <StaffSelect value={f.assigned_to} onChange={(v) => set('assigned_to', v)} />
          </Field>
        </div>
        <div className="grid grid-cols-1 items-end gap-4 sm:grid-cols-3">
          <Field label="الموعد النهائي">
            <Input type="date" dir="ltr" className="num" disabled={f.noDate} value={f.date} onChange={(e) => set('date', e.target.value)} />
          </Field>
          <Field label="الساعة">
            <Input type="time" dir="ltr" className="num" disabled={f.noDate} value={f.time} onChange={(e) => set('time', e.target.value)} />
          </Field>
          <div className="pb-2.5">
            <Switch checked={f.noDate} onChange={(v) => set('noDate', v)} label="بدون تاريخ" />
          </div>
        </div>
      </div>
    </Modal>
  )
}

/* ------------------------------------------------------------------ */
/* Manual lead (walk-in, Facebook message…)                             */
/* ------------------------------------------------------------------ */
export function LeadDialog({ initial = {}, onClose, onSaved }: { initial?: Partial<Lead>; onClose: () => void; onSaved?: (l: Lead) => void }) {
  const me = useMe()
  const L = useLookups()
  const propertyOptions = usePropertyOptions()
  const [f, setF] = useState({
    name: initial.name ?? '',
    phone: initial.phone ?? '',
    email: initial.email ?? '',
    kind: (initial.kind ?? 'inquiry') as LeadKind,
    source: (initial.source ?? 'walkin') as LeadSource,
    property_id: initial.property_id ?? null,
    message: initial.message ?? '',
    lang: (initial.lang ?? 'ar') as Lang,
  })
  const set = <K extends keyof typeof f>(k: K, v: (typeof f)[K]) => setF((x) => ({ ...x, [k]: v }))
  const { save, pending } = useSave<Lead>('leads', 'lead', (l) => l.name)
  const submit = async () => {
    if (!f.name.trim() || !f.phone.trim()) return toast.error('الاسم ورقم الهاتف مطلوبان')
    const p = L.property(f.property_id)
    const row: Lead = {
      id: uid(),
      name: f.name.trim(),
      phone: f.phone.trim(),
      email: f.email.trim() || null,
      message: f.message.trim() || null,
      notes: null,
      kind: f.kind,
      property_id: p?.id ?? null,
      property_ref: p?.ref ?? null,
      source: f.source,
      status: 'new',
      assigned_to: me.id,
      client_id: L.clientByPhone(f.phone)?.id ?? null,
      preferred_at: null,
      lang: f.lang,
      meta: null,
      created_at: nowIso(),
      updated_at: nowIso(),
    }
    const saved = await save(row, { isNew: true })
    if (saved) {
      onSaved?.(saved)
      onClose()
    }
  }
  return (
    <Modal
      open
      onClose={onClose}
      title="طلب جديد"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            إلغاء
          </Button>
          <Button loading={pending} onClick={submit}>
            إضافة الطلب
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="الاسم" required>
            <Input autoFocus value={f.name} onChange={(e) => set('name', e.target.value)} />
          </Field>
          <Field label="الهاتف" required>
            <Input dir="ltr" className="num" inputMode="tel" value={f.phone} onChange={(e) => set('phone', e.target.value)} />
          </Field>
          <Field label="نوع الطلب">
            <Select value={f.kind} onChange={(e) => set('kind', e.target.value as LeadKind)}>
              {(Object.keys(LEAD_KIND) as LeadKind[]).map((k) => (
                <option key={k} value={k}>
                  {LEAD_KIND[k].label}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="المصدر">
            <Select value={f.source} onChange={(e) => set('source', e.target.value as LeadSource)}>
              {(Object.keys(SOURCE) as LeadSource[]).map((k) => (
                <option key={k} value={k}>
                  {SOURCE[k].label}
                </option>
              ))}
            </Select>
          </Field>
        </div>
        <Field label="العقار المعني">
          <Combo value={f.property_id} onChange={(v) => set('property_id', v)} options={propertyOptions} placeholder="اختياري" />
        </Field>
        <Field label="الطلب / الرسالة">
          <Textarea rows={3} value={f.message} onChange={(e) => set('message', e.target.value)} />
        </Field>
        <Field label="لغة التواصل">
          <Select value={f.lang} onChange={(e) => set('lang', e.target.value as Lang)} className="sm:w-48">
            {(Object.keys(LANG_LABEL) as Lang[]).map((k) => (
              <option key={k} value={k}>
                {LANG_LABEL[k]}
              </option>
            ))}
          </Select>
        </Field>
      </div>
    </Modal>
  )
}
