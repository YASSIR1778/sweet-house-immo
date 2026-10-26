import { AlertTriangle, Ban, FileText, Plus, Printer, Receipt, Trash2, X } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Link } from 'react-router'
import { toast } from 'sonner'
import { amountInWordsFr, billingMissing, htFromTtc, invoicePaid, invoiceRest, invoiceTotals, r2 } from '@/shared/lib/billing'
import { useBilling, useTable } from '@/shared/lib/data'
import { addDays, fmtDate, fmtMoney2, fmtNumber, localDate, nowIso, uid } from '@/shared/lib/format'
import { translate } from '@/shared/lib/i18n'
import { repo } from '@/shared/lib/repo'
import type { BillingSettings, BillParty, Deal, Expense, ExpenseCategory, Invoice, InvoiceLine, Payment, PayMethod, Property } from '@/shared/lib/types'
import { Button, Field, Input, Modal, Segmented, Select, Textarea, cn, useConfirm } from '@/shared/ui/base'
import { usePropertyOptions, useQuickAdd } from './dialogs'
import { useCan, useDeleteRow, useLookups, useMe, useNames, useSave } from './hooks'
import { EXPENSE_CAT, INVOICE_STATUS, PAY_METHOD, partyLabel } from './labels'
import { printInvoice, printReceipt } from './print'
import { Combo, Pill, type ComboOption } from './ui'

const num = (v: string) => (v.trim() === '' || Number.isNaN(Number(v)) ? 0 : Number(v))
const frNum = (n: number) => new Intl.NumberFormat('fr-FR').format(n).replace(/[  ]/g, ' ')
const money = (n: number) => `${fmtMoney2(n)} د.م.`

/** Default wording of the invoice line for a party of a deal (French, as on the printed invoice). */
export function invoiceLabel(d: Pick<Deal, 'kind' | 'amount'>, party: BillParty, p: Pick<Property, 'ref' | 'type'> | undefined): string {
  const bien = p ? `du bien ${p.ref} (${translate(`type.${p.type}`, 'fr').toLowerCase()})` : 'du bien'
  if (d.kind === 'rent') return `Honoraires de location — part du ${party === 'seller' ? 'propriétaire' : 'locataire'}, location ${bien}, loyer mensuel ${frNum(d.amount)} DH`
  return `Honoraires d'intermédiation — ${party === 'seller' ? 'vente' : 'achat'} ${bien}, prix ${frNum(d.amount)} DH`
}

/** What a receipt was paid for, printed on it. */
export function paymentAbout(p: Payment, inv: Invoice | undefined, deal: Deal | undefined, prop: Property | undefined): string {
  if (inv) return `Facture ${inv.no}${inv.lines[0] ? ` — ${inv.lines[0].label}` : ''}`
  if (deal) return `Honoraires — ${deal.kind === 'rent' ? 'location' : 'vente'} ${prop ? `du bien ${prop.ref}` : ''}`.trim()
  return p.notes || 'Honoraires'
}

/** Deals as options: property, client and amount. */
export function useDealOptions(): ComboOption[] {
  const L = useLookups()
  const { data: deals = [] } = useTable<Deal>('deals')
  return useMemo(
    () =>
      deals.map((d) => {
        const p = L.property(d.property_id)
        const c = L.client(d.client_id)
        return {
          value: d.id,
          label: `${p?.ref ?? (d.kind === 'rent' ? 'كراء' : 'بيع')} — ${c?.full_name ?? fmtDate(d.closed_at)}`,
          sub: `${d.kind === 'rent' ? 'كراء' : 'بيع'} · ${fmtNumber(d.amount)} د.م. · عمولة ${fmtNumber(d.commission)}`,
          keywords: `${p?.title ?? ''} ${c?.phone ?? ''}`,
        }
      }),
    [deals, L],
  )
}

/**
 * After a receipt is recorded or cancelled: the invoice it pays and the deal it belongs to
 * follow (amount paid, «paid» status, commission collected).
 */
export function useMoneySync() {
  const inv = useSave<Invoice>('invoices', 'invoice', (i) => i.no)
  const deal = useSave<Deal>('deals', 'deal', (d) => `صفقة ${fmtNumber(d.amount)} د.م.`)
  return async (changed: Payment) => {
    // read the rows again: the screen may not have caught up with a document issued a second ago
    const [payments, invoices, deals] = await Promise.all([repo.list<Payment>('payments'), repo.list<Invoice>('invoices'), repo.list<Deal>('deals')])
    const all = [...payments.filter((p) => p.id !== changed.id), changed]
    const i = invoices.find((x) => x.id === changed.invoice_id)
    if (i && i.status !== 'cancelled') {
      const paid = invoicePaid(i, all)
      const status = paid >= i.total_ttc - 0.009 ? 'paid' : 'issued'
      if (paid !== i.paid || status !== i.status) await inv.save({ ...i, paid, status, updated_at: nowIso() }, { silent: true, action: 'status', meta: { status } })
    }
    const d = deals.find((x) => x.id === changed.deal_id)
    if (d) {
      const received = r2(all.filter((p) => p.deal_id === d.id && p.status === 'valid').reduce((s, p) => s + p.amount, 0))
      if (received !== (d.received ?? d.commission)) await deal.save({ ...d, received }, { silent: true })
    }
  }
}

function BillingWarning({ b }: { b: BillingSettings }) {
  const can = useCan()
  const missing = billingMissing(b)
  if (!missing.length) return null
  return (
    <div className="flex items-start gap-3 rounded-2xl border border-warning/30 bg-warning/5 p-3 text-sm">
      <AlertTriangle className="mt-0.5 size-4 shrink-0 text-warning" />
      <div>
        <b className="text-navy">معلومات الوكالة القانونية ناقصة في الفاتورة:</b> {missing.join('، ')}.{' '}
        {can('settings') ? (
          <Link to="/admin/settings?tab=billing" className="font-semibold text-teal hover:underline">
            أكملها في الإعدادات ← الفوترة
          </Link>
        ) : (
          'اطلب من المدير إكمالها في الإعدادات.'
        )}
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Invoice: issue a new one, or see / pay / cancel an issued one        */
/* ------------------------------------------------------------------ */
export function InvoiceDialog({ initial = {}, onClose, onSaved }: { initial?: Partial<Invoice>; onClose: () => void; onSaved?: (i: Invoice) => void }) {
  const { data: invoices = [] } = useTable<Invoice>('invoices')
  const [shownId, setShownId] = useState<string | null>(initial.id ?? null)
  const [issued, setIssued] = useState<Invoice | null>(null)
  if (shownId) {
    const inv = invoices.find((i) => i.id === shownId) ?? (issued?.id === shownId ? issued : (initial as Invoice))
    return <InvoiceView inv={inv} onClose={onClose} />
  }
  return (
    <InvoiceForm
      initial={initial}
      onClose={onClose}
      onIssued={(i) => {
        setIssued(i)
        setShownId(i.id)
        onSaved?.(i)
      }}
    />
  )
}

function InvoiceForm({ initial, onClose, onIssued }: { initial: Partial<Invoice>; onClose: () => void; onIssued: (i: Invoice) => void }) {
  const me = useMe()
  const confirm = useConfirm()
  const L = useLookups()
  const { data: billing } = useBilling()
  const b = billing as BillingSettings
  const { data: invoices = [] } = useTable<Invoice>('invoices')
  const { data: deals = [] } = useTable<Deal>('deals')
  const deal = deals.find((d) => d.id === initial.deal_id)
  const clientOptions = useMemo<ComboOption[]>(() => L.clients.map((c) => ({ value: c.id, label: c.full_name, sub: c.phone, keywords: c.phone })), [L.clients])
  const { save, pending } = useSave<Invoice>('invoices', 'invoice', (i) => `${i.bill_name} · ${fmtNumber(i.total_ttc)} د.م.`)
  const today = localDate(new Date())
  const [f, setF] = useState(() => ({
    party: (initial.party ?? 'buyer') as BillParty,
    client_id: initial.client_id ?? null,
    bill_name: initial.bill_name ?? '',
    bill_ice: initial.bill_ice ?? '',
    bill_address: initial.bill_address ?? '',
    lines: (initial.lines?.length ? initial.lines : [{ label: '', qty: 1, unit: 0 }]) as InvoiceLine[],
    vat_rate: initial.vat_rate ?? b.vat_rate,
    issued_at: today,
    due_at: initial.due_at ?? (b.payment_days > 0 ? localDate(addDays(new Date(), b.payment_days)) : ''),
    notes: initial.notes ?? '',
  }))
  const set = <K extends keyof typeof f>(k: K, v: (typeof f)[K]) => setF((x) => ({ ...x, [k]: v }))
  const setLine = (i: number, patch: Partial<InvoiceLine>) => setF((x) => ({ ...x, lines: x.lines.map((l, j) => (j === i ? { ...l, ...patch } : l)) }))
  const t = invoiceTotals(f.lines, f.vat_rate)
  // numbers must follow the dates: a new invoice is never dated before the last one of its year
  const last = invoices
    .filter((i) => i.kind === 'invoice' && i.issued_at.slice(0, 4) === f.issued_at.slice(0, 4))
    .sort((a, c) => a.issued_at.localeCompare(c.issued_at))
    .pop()

  const submit = async () => {
    const lines = f.lines.filter((l) => l.label.trim() && l.unit)
    if (!f.bill_name.trim()) return toast.error('اكتب اسم الزبون كما سيظهر في الفاتورة')
    if (!lines.length) return toast.error('أضف سطراً واحداً على الأقل، بوصفه ومبلغه')
    if (t.ttc <= 0) return toast.error('مبلغ الفاتورة يجب أن يكون أكبر من صفر')
    if (f.issued_at > today) return toast.error('لا تُؤرَّخ الفاتورة بتاريخ لاحق')
    if (last && f.issued_at < last.issued_at) return toast.error(`تاريخ الفاتورة لا يسبق آخر فاتورة ${last.no} (${fmtDate(last.issued_at)}) حفاظاً على تسلسل الأرقام`)
    const ok = await confirm({
      title: `إصدار فاتورة بمبلغ ${money(t.ttc)}؟`,
      text: 'تأخذ الفاتورة رقماً متسلسلاً ولا تُعدَّل بعد الإصدار. لتصحيحها تُلغى بفاتورة مضادة ثم تُصدر فاتورة جديدة.',
      confirmLabel: 'نعم، أصدر الفاتورة',
    })
    if (!ok) return
    const row: Invoice = {
      id: uid(),
      no: '',
      kind: 'invoice',
      deal_id: initial.deal_id ?? null,
      client_id: f.client_id,
      party: f.party,
      bill_name: f.bill_name.trim(),
      bill_ice: f.bill_ice.trim() || null,
      bill_address: f.bill_address.trim() || null,
      lines: lines.map((l) => ({ label: l.label.trim(), qty: l.qty || 1, unit: r2(l.unit) })),
      vat_rate: f.vat_rate,
      total_ht: t.ht,
      total_vat: t.vat,
      total_ttc: t.ttc,
      issued_at: f.issued_at,
      due_at: f.due_at || null,
      status: 'issued',
      paid: 0,
      ref_invoice_id: null,
      notes: f.notes.trim() || null,
      created_by: me.id,
      created_at: nowIso(),
      updated_at: nowIso(),
    }
    const saved = await save(row, { isNew: true, silent: true })
    if (!saved) return
    toast.success(`صدرت الفاتورة ${saved.no}`)
    onIssued(saved)
  }

  return (
    <Modal
      open
      onClose={onClose}
      size="lg"
      title="فاتورة جديدة"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            إلغاء
          </Button>
          <Button loading={pending} onClick={() => void submit()} icon={<FileText className="size-4" />}>
            إصدار الفاتورة
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <BillingWarning b={b} />
        {deal && (
          <Field label="الطرف المفوتر">
            <Segmented
              value={f.party}
              onChange={(v) => set('party', v)}
              options={(['seller', 'buyer', 'other'] as BillParty[]).map((k) => ({ value: k, label: partyLabel(k, deal.kind) }))}
              className="flex w-full [&>button]:flex-1"
            />
          </Field>
        )}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="الزبون كما يظهر في الفاتورة" required>
            <Input value={f.bill_name} onChange={(e) => set('bill_name', e.target.value)} placeholder="M. / Mme …" />
          </Field>
          <Field label="من العملاء" hint="اختياري: يربط الفاتورة بملف العميل">
            <Combo
              value={f.client_id}
              onChange={(v) => {
                const c = L.client(v)
                setF((x) => ({ ...x, client_id: v, bill_name: x.bill_name || c?.full_name || '' }))
              }}
              options={clientOptions}
              placeholder="اختر العميل"
            />
          </Field>
          <Field label="العنوان" hint="اختياري">
            <Input dir="auto" value={f.bill_address} onChange={(e) => set('bill_address', e.target.value)} />
          </Field>
          <Field label="ICE الزبون" hint="إلزامي إن كان الزبون شركة">
            <Input dir="ltr" className="num" inputMode="numeric" maxLength={15} value={f.bill_ice} onChange={(e) => set('bill_ice', e.target.value.replace(/\D/g, ''))} />
          </Field>
        </div>

        <section className="space-y-2 rounded-2xl border border-line p-4">
          <div className="flex items-center justify-between gap-2">
            <h3 className="text-sm font-bold text-navy">البيان (يُطبع بالفرنسية كما تكتبه)</h3>
            <Button size="sm" variant="ghost" icon={<Plus className="size-4" />} onClick={() => set('lines', [...f.lines, { label: '', qty: 1, unit: 0 }])}>
              سطر
            </Button>
          </div>
          {f.lines.map((l, i) => (
            <div key={i} className="grid grid-cols-[1fr_auto] gap-2 rounded-xl bg-ivory p-2.5 sm:grid-cols-[1fr_70px_150px_auto] sm:items-end">
              <Field label={i === 0 ? 'الوصف' : undefined} className="col-span-2 sm:col-span-1">
                <Input dir="ltr" value={l.label} onChange={(e) => setLine(i, { label: e.target.value })} placeholder="Honoraires d'intermédiation…" />
              </Field>
              <Field label={i === 0 ? 'الكمية' : undefined}>
                <Input type="number" min={1} dir="ltr" className="num" value={l.qty || ''} onChange={(e) => setLine(i, { qty: num(e.target.value) })} />
              </Field>
              <Field label={i === 0 ? (f.vat_rate ? 'الثمن دون الضريبة' : 'الثمن') : undefined}>
                <Input type="number" step="0.01" dir="ltr" className="num" value={l.unit || ''} onChange={(e) => setLine(i, { unit: num(e.target.value) })} />
              </Field>
              {f.lines.length > 1 ? (
                <button type="button" onClick={() => set('lines', f.lines.filter((_, j) => j !== i))} className="mb-1 rounded-full p-2 text-subtle hover:bg-danger/10 hover:text-danger" aria-label="حذف السطر">
                  <X className="size-4" />
                </button>
              ) : (
                <span />
              )}
            </div>
          ))}
          {f.vat_rate > 0 && f.lines.length === 1 && (
            <label className="flex flex-wrap items-center gap-2 text-xs text-muted">
              أو اكتب المبلغ شاملاً للضريبة:
              <Input type="number" dir="ltr" className="num h-8 w-36 py-1 text-xs" placeholder="TTC" onChange={(e) => setLine(0, { unit: htFromTtc(num(e.target.value), f.vat_rate) })} />
            </label>
          )}
        </section>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <Field label="الضريبة على القيمة المضافة" hint="0 إن كانت الوكالة غير خاضعة">
            <div className="relative">
              <Input type="number" min={0} max={30} dir="ltr" className="num pe-10" value={f.vat_rate} onChange={(e) => set('vat_rate', num(e.target.value))} />
              <span className="pointer-events-none absolute inset-y-0 end-3 flex items-center text-xs text-muted">%</span>
            </div>
          </Field>
          <Field label="تاريخ الفاتورة" hint={last ? `آخر فاتورة: ${last.no}` : undefined}>
            <Input type="date" dir="ltr" className="num" max={today} min={last?.issued_at} value={f.issued_at} onChange={(e) => set('issued_at', e.target.value)} />
          </Field>
          <Field label="تاريخ الاستحقاق" hint="فارغ = عند التوصل">
            <Input type="date" dir="ltr" className="num" min={f.issued_at} value={f.due_at} onChange={(e) => set('due_at', e.target.value)} />
          </Field>
        </div>
        <Field label="ملاحظة على الفاتورة" hint="اختياري، تُطبع أسفل الفاتورة">
          <Input dir="auto" value={f.notes} onChange={(e) => set('notes', e.target.value)} />
        </Field>

        <div className="rounded-2xl bg-navy p-4 text-white">
          <div className="grid grid-cols-3 gap-2 text-center">
            <div>
              <div className="text-[11px] text-white/60">{f.vat_rate ? 'دون الضريبة HT' : 'المبلغ'}</div>
              <div className="num font-bold">{fmtMoney2(t.ht)}</div>
            </div>
            <div>
              <div className="text-[11px] text-white/60">الضريبة {f.vat_rate}%</div>
              <div className="num font-bold">{fmtMoney2(t.vat)}</div>
            </div>
            <div>
              <div className="text-[11px] text-gold-300">المجموع TTC</div>
              <div className="num text-lg font-extrabold text-gold-300">{fmtMoney2(t.ttc)}</div>
            </div>
          </div>
          {t.ttc > 0 && <p dir="ltr" className="mt-2 text-center text-xs text-white/70">{amountInWordsFr(t.ttc)}</p>}
        </div>
      </div>
    </Modal>
  )
}

function InvoiceView({ inv, onClose }: { inv: Invoice; onClose: () => void }) {
  const me = useMe()
  const can = useCan()
  const quick = useQuickAdd()
  const confirm = useConfirm()
  const L = useLookups()
  const { s } = useNames()
  const { data: billing } = useBilling()
  const { data: invoices = [] } = useTable<Invoice>('invoices')
  const { data: payments = [] } = useTable<Payment>('payments')
  const { data: deals = [] } = useTable<Deal>('deals')
  const { save, pending } = useSave<Invoice>('invoices', 'invoice', (i) => i.no)
  const [due, setDue] = useState(inv.due_at ?? '')
  const [notes, setNotes] = useState(inv.notes ?? '')
  const credit = inv.kind === 'credit'
  const pays = payments.filter((p) => p.invoice_id === inv.id)
  const original = inv.ref_invoice_id ? invoices.find((i) => i.id === inv.ref_invoice_id) : undefined
  const creditNote = invoices.find((i) => i.ref_invoice_id === inv.id)
  const deal = deals.find((d) => d.id === inv.deal_id)
  const prop = L.property(deal?.property_id)
  const rest = invoiceRest(inv)
  const st = credit ? { label: 'فاتورة مضادة', color: '#7c3aed' } : INVOICE_STATUS[inv.status]
  const changed = due !== (inv.due_at ?? '') || notes !== (inv.notes ?? '')

  const cancel = async () => {
    if (invoicePaid(inv, payments) > 0) return toast.error('على هذه الفاتورة وصولات أداء. ألغِ الوصولات أولاً ثم ألغِ الفاتورة.')
    const ok = await confirm({
      title: `إلغاء الفاتورة ${inv.no}؟`,
      text: 'تصدر فاتورة مضادة (Avoir) بنفس المبلغ بالسالب، وتبقى الفاتورة الأصلية في السجل بعلامة «ملغاة»، كما يفرض القانون.',
      confirmLabel: 'نعم، ألغِ بفاتورة مضادة',
      danger: true,
    })
    if (!ok) return
    const note: Invoice = {
      ...inv,
      id: uid(),
      no: '',
      kind: 'credit',
      lines: inv.lines.map((l) => ({ ...l, unit: -l.unit })),
      total_ht: -inv.total_ht,
      total_vat: -inv.total_vat,
      total_ttc: -inv.total_ttc,
      issued_at: localDate(new Date()),
      due_at: null,
      status: 'issued',
      paid: 0,
      ref_invoice_id: inv.id,
      notes: `Annulation de la facture ${inv.no}`,
      created_by: me.id,
      created_at: nowIso(),
      updated_at: nowIso(),
    }
    const savedNote = await save(note, { isNew: true, silent: true })
    if (!savedNote) return
    await save({ ...inv, status: 'cancelled', updated_at: nowIso() }, { silent: true, action: 'status', meta: { status: 'cancelled' } })
    toast.success(`أُلغيت الفاتورة ${inv.no} بالفاتورة المضادة ${savedNote.no}`)
  }

  return (
    <Modal
      open
      onClose={onClose}
      size="lg"
      title={
        <span className="inline-flex items-center gap-2">
          {credit ? 'فاتورة مضادة' : 'فاتورة'} <span className="num text-gold-700">{inv.no}</span>
        </span>
      }
      footer={
        <>
          {!credit && inv.status !== 'cancelled' && can('deals') && (
            <Button variant="ghost" className="me-auto text-danger" icon={<Ban className="size-4" />} onClick={() => void cancel()}>
              إلغاء بفاتورة مضادة
            </Button>
          )}
          {!credit && inv.status === 'issued' && rest > 0 && (
            <Button variant="outline" icon={<Receipt className="size-4" />} onClick={() => quick('payment', { invoice_id: inv.id, deal_id: inv.deal_id, client_id: inv.client_id, party: inv.party, payer_name: inv.bill_name, amount: rest })}>
              تسجيل دفعة
            </Button>
          )}
          <Button icon={<Printer className="size-4" />} onClick={() => printInvoice(inv, billing as BillingSettings, s, original)}>
            طباعة
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <Pill color={st.color}>{st.label}</Pill>
          <span className="text-muted">صدرت في {fmtDate(inv.issued_at)}</span>
          {!credit && <span className="text-muted">· الاستحقاق: {inv.due_at ? fmtDate(inv.due_at) : 'عند التوصل'}</span>}
          {deal && (
            <Link to={`/admin/deals/${deal.id}`} onClick={onClose} className="font-semibold text-teal hover:underline">
              · ملف الصفقة {prop?.ref ?? ''}
            </Link>
          )}
        </div>
        {original && (
          <p className="rounded-xl bg-sand p-3 text-sm">
            تلغي الفاتورة{' '}
            <button type="button" className="num font-bold text-teal hover:underline" onClick={() => quick('invoice', original)}>
              {original.no}
            </button>
          </p>
        )}
        {creditNote && (
          <p className="rounded-xl bg-sand p-3 text-sm">
            أُلغيت بالفاتورة المضادة{' '}
            <button type="button" className="num font-bold text-teal hover:underline" onClick={() => quick('invoice', creditNote)}>
              {creditNote.no}
            </button>
          </p>
        )}
        <div className="rounded-2xl bg-ivory p-4 text-sm">
          <div className="text-xs text-muted">الزبون ({partyLabel(inv.party, deal?.kind ?? 'sale')})</div>
          <div className="text-base font-bold text-navy">{inv.bill_name}</div>
          {inv.bill_address && <div className="text-muted">{inv.bill_address}</div>}
          {inv.bill_ice && <div className="num text-muted">ICE {inv.bill_ice}</div>}
        </div>
        <div className="overflow-x-auto">
          <table className="table" dir="ltr">
            <thead>
              <tr>
                <th className="text-left">Désignation</th>
                <th>Qté</th>
                <th>{inv.vat_rate ? 'P.U. HT' : 'P.U.'}</th>
                <th>{inv.vat_rate ? 'Montant HT' : 'Montant'}</th>
              </tr>
            </thead>
            <tbody>
              {inv.lines.map((l, i) => (
                <tr key={i}>
                  <td className="text-left text-sm">{l.label}</td>
                  <td className="num">{l.qty}</td>
                  <td className="num whitespace-nowrap">{fmtMoney2(l.unit)}</td>
                  <td className="num whitespace-nowrap">{fmtMoney2(r2(l.qty * l.unit))}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {[
            { k: inv.vat_rate ? 'دون الضريبة' : 'المبلغ', v: inv.total_ht },
            { k: `الضريبة ${inv.vat_rate}%`, v: inv.total_vat },
            { k: 'المجموع', v: inv.total_ttc, strong: true },
            ...(credit ? [] : [{ k: rest > 0 && inv.status !== 'cancelled' ? 'الباقي' : 'المؤدى', v: rest > 0 && inv.status !== 'cancelled' ? rest : inv.paid, warn: rest > 0 && inv.status !== 'cancelled' }]),
          ].map((x) => (
            <div key={x.k} className={cn('rounded-xl p-3', x.strong ? 'bg-navy text-white' : 'bg-sand')}>
              <div className={cn('text-[11px]', x.strong ? 'text-white/60' : 'text-muted')}>{x.k}</div>
              <div className={cn('num font-extrabold', 'warn' in x && x.warn ? 'text-warning' : '')}>{fmtMoney2(x.v)}</div>
            </div>
          ))}
        </div>
        <p dir="ltr" className="text-xs text-muted">
          {amountInWordsFr(Math.abs(inv.total_ttc))}
          {inv.vat_rate ? ' TTC' : ''}
        </p>
        {pays.length > 0 && (
          <div>
            <h3 className="mb-2 text-sm font-bold text-navy">الوصولات</h3>
            <ul className="divide-y divide-line rounded-xl border border-line">
              {pays.map((p) => (
                <li key={p.id}>
                  <button type="button" onClick={() => quick('payment', p)} className="flex w-full items-center gap-3 px-3 py-2 text-start text-sm hover:bg-ivory">
                    <span className="num font-bold text-gold-700">{p.no}</span>
                    <span className="flex-1 text-muted">
                      {fmtDate(p.received_at)} · {PAY_METHOD[p.method]}
                    </span>
                    <span className={cn('num font-bold', p.status === 'cancelled' ? 'text-subtle line-through' : 'text-navy')}>{fmtMoney2(p.amount)}</span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}
        {inv.status !== 'cancelled' && !credit && can('deals') && (
          <div className="grid grid-cols-1 gap-3 rounded-2xl border border-line p-3 sm:grid-cols-[180px_1fr_auto] sm:items-end">
            <Field label="تاريخ الاستحقاق">
              <Input type="date" dir="ltr" className="num" min={inv.issued_at} value={due} onChange={(e) => setDue(e.target.value)} />
            </Field>
            <Field label="ملاحظة">
              <Input dir="auto" value={notes} onChange={(e) => setNotes(e.target.value)} />
            </Field>
            <Button variant="outline" disabled={!changed} loading={pending} onClick={() => void save({ ...inv, due_at: due || null, notes: notes.trim() || null, updated_at: nowIso() })}>
              حفظ
            </Button>
          </div>
        )}
      </div>
    </Modal>
  )
}

/* ------------------------------------------------------------------ */
/* Receipt: record money received, or see / cancel a receipt            */
/* ------------------------------------------------------------------ */
export function PaymentDialog({ initial = {}, onClose, onSaved }: { initial?: Partial<Payment>; onClose: () => void; onSaved?: (p: Payment) => void }) {
  const { data: payments = [] } = useTable<Payment>('payments')
  const [shownId, setShownId] = useState<string | null>(initial.id ?? null)
  const [made, setMade] = useState<Payment | null>(null)
  if (shownId) {
    const p = payments.find((x) => x.id === shownId) ?? (made?.id === shownId ? made : (initial as Payment))
    return <PaymentView p={p} onClose={onClose} />
  }
  return (
    <PaymentForm
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

function PaymentForm({ initial, onClose, onSaved }: { initial: Partial<Payment>; onClose: () => void; onSaved: (p: Payment) => void }) {
  const me = useMe()
  const sync = useMoneySync()
  const { data: invoices = [] } = useTable<Invoice>('invoices')
  const { data: deals = [] } = useTable<Deal>('deals')
  const { save, pending } = useSave<Payment>('payments', 'payment', (p) => `${p.payer_name} · ${fmtNumber(p.amount)} د.م.`)
  const today = localDate(new Date())
  const [f, setF] = useState(() => ({
    deal_id: initial.deal_id ?? null,
    invoice_id: initial.invoice_id ?? null,
    client_id: initial.client_id ?? null,
    party: (initial.party ?? 'buyer') as BillParty,
    payer_name: initial.payer_name ?? '',
    amount: initial.amount ?? 0,
    method: (initial.method ?? 'cash') as PayMethod,
    reference: initial.reference ?? '',
    received_at: today,
    notes: initial.notes ?? '',
  }))
  const set = <K extends keyof typeof f>(k: K, v: (typeof f)[K]) => setF((x) => ({ ...x, [k]: v }))
  const deal = deals.find((d) => d.id === f.deal_id)
  const open = invoices.filter((i) => i.kind === 'invoice' && i.status === 'issued' && (!f.deal_id || i.deal_id === f.deal_id))
  const inv = invoices.find((i) => i.id === f.invoice_id)

  const pickInvoice = (id: string) => {
    const i = invoices.find((x) => x.id === id)
    if (!i) return set('invoice_id', null)
    setF((x) => ({ ...x, invoice_id: i.id, deal_id: i.deal_id ?? x.deal_id, client_id: i.client_id ?? x.client_id, party: i.party, payer_name: x.payer_name || i.bill_name, amount: invoiceRest(i) }))
  }

  const submit = async () => {
    if (!f.payer_name.trim()) return toast.error('اكتب اسم من أدى المبلغ')
    if (!(f.amount > 0)) return toast.error('اكتب المبلغ المستلم')
    if (f.received_at > today) return toast.error('لا يُؤرَّخ الوصل بتاريخ لاحق')
    if (inv && f.amount > invoiceRest(inv) + 0.009) return toast.error(`المبلغ أكبر من الباقي على الفاتورة ${inv.no} (${money(invoiceRest(inv))})`)
    const row: Payment = {
      id: uid(),
      no: '',
      deal_id: f.deal_id,
      invoice_id: f.invoice_id,
      client_id: f.client_id,
      party: f.party,
      payer_name: f.payer_name.trim(),
      amount: r2(f.amount),
      method: f.method,
      reference: f.method === 'cash' ? null : f.reference.trim() || null,
      received_at: f.received_at,
      status: 'valid',
      notes: f.notes.trim() || null,
      created_by: me.id,
      created_at: nowIso(),
    }
    const saved = await save(row, { isNew: true, silent: true })
    if (!saved) return
    await sync(saved)
    toast.success(`صدر الوصل ${saved.no}`)
    onSaved(saved)
  }

  return (
    <Modal
      open
      onClose={onClose}
      title="تسجيل دفعة وإصدار وصل"
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
        {open.length > 0 && (
          <Field label="عن الفاتورة" hint="اختياري: الدفعة تُخصم من الباقي على الفاتورة">
            <Select value={f.invoice_id ?? ''} onChange={(e) => pickInvoice(e.target.value)}>
              <option value="">— بدون فاتورة —</option>
              {open.map((i) => (
                <option key={i.id} value={i.id}>
                  {i.no} · {i.bill_name} · الباقي {fmtMoney2(invoiceRest(i))}
                </option>
              ))}
            </Select>
          </Field>
        )}
        {deal && (
          <Field label="أدّاها">
            <Segmented
              value={f.party}
              onChange={(v) => set('party', v)}
              options={(['seller', 'buyer', 'other'] as BillParty[]).map((k) => ({ value: k, label: partyLabel(k, deal.kind) }))}
              className="flex w-full [&>button]:flex-1"
            />
          </Field>
        )}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="الاسم كما يظهر في الوصل" required>
            <Input value={f.payer_name} onChange={(e) => set('payer_name', e.target.value)} />
          </Field>
          <Field label="المبلغ المستلم" required hint={f.amount > 0 ? <span dir="ltr">{amountInWordsFr(f.amount)}</span> : undefined}>
            <Input type="number" step="0.01" inputMode="decimal" dir="ltr" className="num" value={f.amount || ''} onChange={(e) => set('amount', num(e.target.value))} />
          </Field>
        </div>
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
            <Input type="date" dir="ltr" className="num" max={today} value={f.received_at} onChange={(e) => set('received_at', e.target.value)} />
          </Field>
        </div>
        <Field label="ملاحظات" hint="اختياري">
          <Input dir="auto" value={f.notes} onChange={(e) => set('notes', e.target.value)} />
        </Field>
        {f.method === 'cash' && f.amount >= 20_000 && (
          <p className="flex items-start gap-2 rounded-xl bg-warning/5 p-3 text-xs text-muted">
            <AlertTriangle className="mt-0.5 size-4 shrink-0 text-warning" /> المبالغ الكبيرة يُستحسن أداؤها بشيك أو تحويل بنكي، لتبقى قابلة للإثبات أمام الإدارة الضريبية.
          </p>
        )}
      </div>
    </Modal>
  )
}

function PaymentView({ p, onClose }: { p: Payment; onClose: () => void }) {
  const can = useCan()
  const quick = useQuickAdd()
  const L = useLookups()
  const { s } = useNames()
  const sync = useMoneySync()
  const { data: billing } = useBilling()
  const { data: invoices = [] } = useTable<Invoice>('invoices')
  const { data: deals = [] } = useTable<Deal>('deals')
  const { save, pending } = useSave<Payment>('payments', 'payment', (x) => x.no)
  const [cancelling, setCancelling] = useState(false)
  const [reason, setReason] = useState('')
  const inv = invoices.find((i) => i.id === p.invoice_id)
  const deal = deals.find((d) => d.id === p.deal_id)
  const prop = L.property(deal?.property_id)

  const cancel = async () => {
    if (!reason.trim()) return toast.error('اكتب سبب الإلغاء (مثلاً: شيك بدون رصيد)')
    const saved = await save({ ...p, status: 'cancelled', notes: [p.notes, `ملغى: ${reason.trim()}`].filter(Boolean).join(' — ') }, { action: 'status', meta: { status: 'cancelled' }, message: `أُلغي الوصل ${p.no}` })
    if (!saved) return
    await sync(saved)
    setCancelling(false)
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={
        <span className="inline-flex items-center gap-2">
          وصل <span className="num text-gold-700">{p.no}</span>
        </span>
      }
      footer={
        <>
          {p.status === 'valid' && can('deals') && !cancelling && (
            <Button variant="ghost" className="me-auto text-danger" icon={<Ban className="size-4" />} onClick={() => setCancelling(true)}>
              إلغاء الوصل
            </Button>
          )}
          <Button icon={<Printer className="size-4" />} onClick={() => printReceipt(p, billing as BillingSettings, s, paymentAbout(p, inv, deal, prop))}>
            طباعة
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <Pill color={p.status === 'valid' ? '#15803d' : '#64748b'}>{p.status === 'valid' ? 'صالح' : 'ملغى'}</Pill>
          <span className="text-muted">{fmtDate(p.received_at)}</span>
          {deal && (
            <Link to={`/admin/deals/${deal.id}`} onClick={onClose} className="font-semibold text-teal hover:underline">
              · ملف الصفقة {prop?.ref ?? ''}
            </Link>
          )}
        </div>
        <div className="rounded-2xl bg-navy p-4 text-center text-white">
          <div className="text-xs text-white/60">استلمنا من {p.payer_name}</div>
          <div className={cn('num mt-1 text-3xl font-extrabold text-gold-300', p.status === 'cancelled' && 'line-through opacity-60')}>{fmtMoney2(p.amount)} د.م.</div>
          <div dir="ltr" className="mt-1 text-xs text-white/70">
            {amountInWordsFr(p.amount)}
          </div>
        </div>
        <dl className="grid grid-cols-1 gap-2 text-sm sm:grid-cols-2">
          <div className="rounded-xl bg-sand p-3">
            <dt className="text-xs text-muted">طريقة الأداء</dt>
            <dd className="font-semibold text-navy">
              {PAY_METHOD[p.method]}
              {p.reference ? ` · ${p.reference}` : ''}
            </dd>
          </div>
          <div className="rounded-xl bg-sand p-3">
            <dt className="text-xs text-muted">مقابل</dt>
            <dd className="font-semibold text-navy">
              {inv ? (
                <button type="button" className="num text-teal hover:underline" onClick={() => quick('invoice', inv)}>
                  الفاتورة {inv.no}
                </button>
              ) : (
                <span dir="ltr">{paymentAbout(p, inv, deal, prop)}</span>
              )}
            </dd>
          </div>
        </dl>
        {p.notes && <p className="rounded-xl bg-ivory p-3 text-sm text-muted">{p.notes}</p>}
        {cancelling && (
          <div className="space-y-2 rounded-2xl border border-danger/30 bg-danger/5 p-3">
            <Field label="سبب الإلغاء" hint="يبقى الوصل في السجل برقمه، مع علامة «ملغى»">
              <Textarea rows={2} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="مثلاً: شيك بدون رصيد، خطأ في المبلغ…" />
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
/* Expense of the agency                                                */
/* ------------------------------------------------------------------ */
export function ExpenseDialog({ initial = {}, onClose, onSaved }: { initial?: Partial<Expense>; onClose: () => void; onSaved?: (e: Expense) => void }) {
  const me = useMe()
  const can = useCan()
  const propertyOptions = usePropertyOptions()
  const dealOptions = useDealOptions()
  const isNew = !initial.id
  const [f, setF] = useState<Expense>({
    id: uid(),
    spent_at: localDate(new Date()),
    category: 'other',
    label: '',
    amount: 0,
    method: 'cash',
    vendor: null,
    property_id: null,
    deal_id: null,
    notes: null,
    created_by: me.id,
    created_at: nowIso(),
    updated_at: nowIso(),
    ...initial,
  } as Expense)
  const set = <K extends keyof Expense>(k: K, v: Expense[K]) => setF((x) => ({ ...x, [k]: v }))
  const { save, pending } = useSave<Expense>('expenses', 'expense', (e) => `${e.label} · ${fmtNumber(e.amount)} د.م.`)
  const del = useDeleteRow('expenses', 'expense')

  const submit = async () => {
    if (!f.label.trim()) return toast.error('اكتب وصف المصروف')
    if (!(f.amount > 0)) return toast.error('اكتب المبلغ')
    const saved = await save({ ...f, label: f.label.trim(), vendor: f.vendor?.trim() || null, notes: f.notes?.trim() || null, updated_at: nowIso() }, { isNew })
    if (!saved) return
    onSaved?.(saved)
    onClose()
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={isNew ? 'مصروف جديد' : 'تعديل المصروف'}
      footer={
        <>
          {!isNew && can('delete') && (
            <Button
              variant="ghost"
              className="me-auto text-danger"
              icon={<Trash2 className="size-4" />}
              onClick={async () => {
                if (await del(f.id, f.label)) onClose()
              }}
            >
              حذف
            </Button>
          )}
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
        <Field label="النوع">
          <Select value={f.category} onChange={(e) => set('category', e.target.value as ExpenseCategory)}>
            {(Object.keys(EXPENSE_CAT) as ExpenseCategory[]).map((k) => (
              <option key={k} value={k}>
                {EXPENSE_CAT[k].label}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="الوصف" required>
          <Input value={f.label} onChange={(e) => set('label', e.target.value)} placeholder="مثلاً: كراء المكتب — شهر نونبر" />
        </Field>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="المبلغ" required>
            <Input type="number" step="0.01" inputMode="decimal" dir="ltr" className="num" value={f.amount || ''} onChange={(e) => set('amount', num(e.target.value))} />
          </Field>
          <Field label="التاريخ">
            <Input type="date" dir="ltr" className="num" value={f.spent_at} onChange={(e) => set('spent_at', e.target.value)} />
          </Field>
          <Field label="طريقة الأداء">
            <Select value={f.method ?? ''} onChange={(e) => set('method', (e.target.value || null) as PayMethod | null)}>
              {(Object.keys(PAY_METHOD) as PayMethod[]).map((k) => (
                <option key={k} value={k}>
                  {PAY_METHOD[k]}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="المورد أو الجهة" hint="اختياري">
            <Input value={f.vendor ?? ''} onChange={(e) => set('vendor', e.target.value || null)} />
          </Field>
          <Field label="خاص بعقار" hint="اختياري: تصوير، إعلان…">
            <Combo value={f.property_id} onChange={(v) => set('property_id', v)} options={propertyOptions} placeholder="—" />
          </Field>
          <Field label="خاص بصفقة" hint="يُخصم من ربح الصفقة">
            <Combo value={f.deal_id} onChange={(v) => set('deal_id', v)} options={dealOptions} placeholder="—" />
          </Field>
        </div>
        <Field label="ملاحظات">
          <Textarea rows={2} value={f.notes ?? ''} onChange={(e) => set('notes', e.target.value || null)} />
        </Field>
      </div>
    </Modal>
  )
}
