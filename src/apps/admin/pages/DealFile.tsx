import { ArrowRight, BadgeDollarSign, Ban, CalendarClock, Check, FileText, FolderOpen, Pencil, Plus, Receipt, RotateCcw, Trash2, Wallet, X } from 'lucide-react'
import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { toast } from 'sonner'
import { checklistProgress, dealCollected, dealResult, invoiceRest, partyDue, STAGE_ORDER } from '@/shared/lib/billing'
import { useBilling, useTable } from '@/shared/lib/data'
import { fmtDate, fmtNumber, nowIso, uid } from '@/shared/lib/format'
import type { BillingSettings, BillParty, ChecklistItem, Deal, DealStage, Expense, Invoice, Payment, Property } from '@/shared/lib/types'
import { Button, Field, FullSpinner, Input, cn, useConfirm } from '@/shared/ui/base'
import { useQuickAdd } from '../dialogs'
import { invoiceLabel } from '../finance'
import { useCan, useDeleteRow, useLookups, useNames, useSave } from '../hooks'
import { DEAL_STAGE, EXPENSE_CAT, INVOICE_STATUS, PAY_METHOD, PURPOSE, SHARE_PARTY, partyLabel, stageLabel } from '../labels'
import { useMarkDealProperty } from '../network-dialogs'
import { Card, PageHeader, PhoneLinks, Pill } from '../ui'

/** The file of one deal: stage, documents and steps, invoices, receipts, expenses and result. */
export function DealFile() {
  const { id } = useParams()
  const nav = useNavigate()
  const can = useCan()
  const quick = useQuickAdd()
  const confirm = useConfirm()
  const L = useLookups()
  const { hoodName } = useNames()
  const { data: billing } = useBilling()
  const b = billing as BillingSettings
  const { data: deals = [], isLoading } = useTable<Deal>('deals')
  const { data: invoices = [] } = useTable<Invoice>('invoices')
  const { data: payments = [] } = useTable<Payment>('payments')
  const { data: expenses = [] } = useTable<Expense>('expenses')
  const { save, pending } = useSave<Deal>('deals', 'deal', (x) => `${L.property(x.property_id)?.ref ?? 'صفقة'} — ${fmtNumber(x.amount)} د.م.`)
  const saveProp = useSave<Property>('properties', 'property', (x) => x.ref)
  const del = useDeleteRow('deals', 'deal')
  const markProperty = useMarkDealProperty()
  const [newItem, setNewItem] = useState('')
  const d = deals.find((x) => x.id === id)
  const [info, setInfo] = useState<{ id: string; deposit: string; notary: string } | null>(null)

  if (isLoading) return <FullSpinner />
  if (!d)
    return (
      <div className="card mx-auto mt-10 max-w-lg p-10 text-center">
        <h1 className="text-xl font-bold text-navy">الصفقة غير موجودة</h1>
        <Link to="/admin/deals" className="mt-4 inline-block font-semibold text-teal">
          العودة إلى الصفقات
        </Link>
      </div>
    )

  const p = L.property(d.property_id)
  const c = L.client(d.client_id)
  const owner = L.client(p?.owner_client_id)
  const stage: DealStage = d.stage ?? 'done'
  const rent = d.kind === 'rent'
  const list = d.checklist ?? []
  const prog = checklistProgress(list)
  const dealInvoices = invoices.filter((i) => i.deal_id === d.id).sort((a, z) => a.no.localeCompare(z.no))
  const dealPayments = payments.filter((x) => x.deal_id === d.id).sort((a, z) => a.no.localeCompare(z.no))
  const dealExpenses = expenses.filter((e) => e.deal_id === d.id)
  const result = dealResult(d, expenses, b.vat_rate)
  const form = info?.id === d.id ? info : { id: d.id, deposit: d.deposit ? String(d.deposit) : '', notary: d.notary ?? '' }

  const update = (patch: Partial<Deal>, opts: { message?: string; silent?: boolean; status?: string } = {}) =>
    save({ ...d, ...patch }, { silent: opts.silent ?? !opts.message, message: opts.message, action: opts.status ? 'status' : 'update', meta: opts.status ? { status: opts.status } : undefined })

  const moveTo = async (next: DealStage) => {
    if (next === stage) return
    if (next === 'done') {
      const ok = await confirm({
        title: 'تمت الصفقة؟',
        text: `تُحسب العمولة (${fmtNumber(d.commission)} د.م.) في مداخيل اليوم${p ? `، ويصبح ${p.ref} «${rent ? 'مُكترى' : 'مُباع'}» ويُخفى من الموقع` : ''}.`,
        confirmLabel: 'نعم، تمت الصفقة',
      })
      if (!ok) return
      const saved = await update({ stage: 'done', closed_at: nowIso() }, { message: 'مبروك! سُجلت الصفقة كمنجزة', status: 'done' })
      if (saved && p) await markProperty(p, true)
      return
    }
    if (stage === 'done' && !(await confirm({ title: 'إرجاع الصفقة إلى «قيد الإنجاز»؟', text: 'تخرج عمولتها من مداخيل الشهر حتى تتم من جديد. حالة العقار لا تتغير تلقائياً.', confirmLabel: 'نعم، أرجعها' }))) return
    await update({ stage: next }, { message: `المرحلة: ${stageLabel(next, d.kind)}`, status: next })
  }

  const cancelDeal = async () => {
    if (dealInvoices.some((i) => i.kind === 'invoice' && i.status !== 'cancelled')) return toast.error('ألغِ فواتير هذه الصفقة أولاً (بفاتورة مضادة)، ثم ألغِ الصفقة.')
    const ok = await confirm({ title: 'إلغاء الصفقة؟', text: `يبقى ملفها في السجل بعلامة «أُلغيت»${p?.status === 'reserved' ? `، ويعود ${p.ref} «متاحاً»` : ''}.`, confirmLabel: 'نعم، ألغِ الصفقة', danger: true })
    if (!ok) return
    const saved = await update({ stage: 'cancelled' }, { message: 'أُلغيت الصفقة', status: 'cancelled' })
    if (saved && p?.status === 'reserved' && can('properties')) await saveProp.save({ ...p, status: 'available', updated_at: nowIso() }, { silent: true, action: 'status', meta: { status: 'available' } })
  }

  const setItems = (items: ChecklistItem[]) => update({ checklist: items }, { silent: true })
  const toggle = (it: ChecklistItem) => void setItems(list.map((x) => (x.id === it.id ? { ...x, done: !x.done, at: !x.done ? nowIso() : null } : x)))
  const addItem = () => {
    const label = newItem.trim()
    if (!label) return
    void setItems([...list, { id: uid(), label, done: false, at: null }])
    setNewItem('')
  }

  const parties: BillParty[] = ['seller', 'buyer']
  const openInvoice = (party: BillParty) => dealInvoices.find((i) => i.party === party && i.kind === 'invoice' && i.status === 'issued' && invoiceRest(i) > 0)
  const invoiced = (party: BillParty) => dealInvoices.filter((i) => i.party === party && i.status !== 'cancelled' && i.kind === 'invoice').reduce((s, i) => s + i.total_ttc, 0)
  const billTo = (party: BillParty) => (party === 'seller' ? owner : c)

  const newInvoice = (party: BillParty) => {
    const due = partyDue(d, party)
    const amount = Math.max(0, Math.round((due - invoiced(party)) * 100) / 100)
    const who = billTo(party)
    const vat = b.vat_rate
    quick('invoice', {
      deal_id: d.id,
      party,
      client_id: who?.id ?? null,
      bill_name: who?.full_name ?? '',
      vat_rate: vat,
      lines: [{ label: invoiceLabel(d, party, p), qty: 1, unit: Math.round((amount / (1 + vat / 100)) * 100) / 100 }],
    })
  }
  const newPayment = (party: BillParty) => {
    const inv = openInvoice(party)
    const who = billTo(party)
    const rest = Math.max(0, partyDue(d, party) - dealCollected(d, payments, party))
    quick('payment', { deal_id: d.id, party, invoice_id: inv?.id ?? null, client_id: inv?.client_id ?? who?.id ?? null, payer_name: inv?.bill_name ?? who?.full_name ?? '', amount: inv ? invoiceRest(inv) : rest })
  }

  const saveInfo = async () => {
    const deposit = form.deposit.trim() === '' ? null : Number(form.deposit)
    if (deposit != null && (Number.isNaN(deposit) || deposit < 0)) return toast.error('مبلغ العربون غير صحيح')
    const saved = await update({ deposit, notary: form.notary.trim() || null }, { message: 'تم الحفظ' })
    if (saved) setInfo(null)
  }

  const stageIndex = STAGE_ORDER.indexOf(stage)

  return (
    <>
      <Link to="/admin/deals" className="mb-3 inline-flex items-center gap-1 text-sm font-semibold text-muted hover:text-navy">
        <ArrowRight className="size-4" /> الصفقات
      </Link>
      <PageHeader
        title={
          <span className="inline-flex flex-wrap items-center gap-2">
            ملف الصفقة {p && <span className="num text-gold-700">{p.ref}</span>}
          </span>
        }
        subtitle={[PURPOSE[d.kind].label, p?.title, c?.full_name].filter(Boolean).join(' · ')}
        icon={<FolderOpen className="size-6" />}
        actions={
          <>
            {stage !== 'done' && stage !== 'cancelled' && (
              <Button variant="outline" icon={<CalendarClock className="size-4" />} onClick={() => quick('appointment', { kind: 'signing', property_id: d.property_id, client_id: d.client_id, title: `توقيع ${rent ? 'عقد الكراء' : 'عقد البيع'}${p ? ` — ${p.ref}` : ''}` })}>
                موعد التوقيع
              </Button>
            )}
            <Button variant="outline" icon={<Pencil className="size-4" />} onClick={() => quick('deal', d)}>
              تعديل الصفقة
            </Button>
          </>
        }
      />

      {/* stage */}
      <Card className="mb-6" bodyClass="p-4">
        {stage === 'cancelled' ? (
          <div className="flex flex-wrap items-center justify-between gap-3">
            <Pill color={DEAL_STAGE.cancelled.color}>{DEAL_STAGE.cancelled.label}</Pill>
            <Button size="sm" variant="outline" icon={<RotateCcw className="size-4" />} onClick={() => void update({ stage: 'agreement' }, { message: 'أُعيد فتح الصفقة', status: 'agreement' })}>
              إعادة فتح الصفقة
            </Button>
          </div>
        ) : (
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
            <ol className="grid flex-1 grid-cols-2 gap-2 sm:grid-cols-4">
              {STAGE_ORDER.map((k, i) => {
                const reached = i <= stageIndex
                const current = i === stageIndex
                return (
                  <li key={k}>
                    <button
                      type="button"
                      disabled={pending}
                      onClick={() => void moveTo(k)}
                      className={cn(
                        'flex w-full items-center gap-2 rounded-xl border px-3 py-2.5 text-start text-sm font-semibold transition',
                        current ? 'border-transparent text-white shadow-soft' : reached ? 'border-line bg-ivory text-navy' : 'border-dashed border-line-2 text-muted hover:border-navy/40 hover:text-navy',
                      )}
                      style={current ? { background: DEAL_STAGE[k].color } : undefined}
                    >
                      <span className={cn('flex size-6 shrink-0 items-center justify-center rounded-full text-xs', current ? 'bg-white/20' : reached ? 'bg-success text-white' : 'bg-sand')}>{reached && !current ? <Check className="size-3.5" /> : i + 1}</span>
                      {stageLabel(k, d.kind)}
                    </button>
                  </li>
                )
              })}
            </ol>
            {stage !== 'done' && can('deals') && (
              <Button size="sm" variant="ghost" className="text-danger" icon={<Ban className="size-4" />} onClick={() => void cancelDeal()}>
                إلغاء الصفقة
              </Button>
            )}
          </div>
        )}
        <p className="mt-3 text-xs text-muted">
          {stage === 'done' ? `تمت في ${fmtDate(d.closed_at)}.` : stage === 'cancelled' ? 'صفقة ملغاة: لا تُحسب في المداخيل.' : `التوقيع المتوقع: ${fmtDate(d.closed_at)}. لا تُحسب العمولة في المداخيل حتى تتم الصفقة.`}
        </p>
      </Card>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        <div className="space-y-6 xl:col-span-2">
          {/* checklist */}
          <Card
            title={
              <span className="inline-flex items-center gap-2">
                الإجراءات والوثائق <span className="num text-xs font-normal text-muted">{prog.done}/{prog.total}</span>
              </span>
            }
            icon={<FileText className="size-4" />}
          >
            {prog.total > 0 && (
              <div className="mb-4 h-2 overflow-hidden rounded-full bg-sand">
                <div className="h-full rounded-full bg-success transition-all duration-500" style={{ width: `${prog.pct}%` }} />
              </div>
            )}
            <ul className="space-y-1.5">
              {list.map((it) => (
                <li key={it.id} className="group flex items-center gap-3 rounded-xl px-2 py-1.5 hover:bg-ivory">
                  <button type="button" onClick={() => toggle(it)} className={cn('flex size-6 shrink-0 items-center justify-center rounded-lg border-2 transition', it.done ? 'border-success bg-success text-white' : 'border-line-2 hover:border-navy')} aria-label={it.done ? 'إلغاء الإنجاز' : 'تم'}>
                    {it.done && <Check className="size-4" />}
                  </button>
                  <span className={cn('flex-1 text-sm', it.done ? 'text-muted line-through' : 'text-navy')}>{it.label}</span>
                  {it.done && it.at && <span className="text-xs text-subtle">{fmtDate(it.at)}</span>}
                  <button type="button" onClick={() => void setItems(list.filter((x) => x.id !== it.id))} className="rounded-full p-1 text-subtle opacity-0 group-hover:opacity-100 hover:bg-danger/10 hover:text-danger focus:opacity-100" aria-label="حذف">
                    <X className="size-4" />
                  </button>
                </li>
              ))}
            </ul>
            <div className="mt-3 flex gap-2">
              <Input value={newItem} onChange={(e) => setNewItem(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && addItem()} placeholder="إجراء أو وثيقة أخرى…" className="h-10" />
              <Button size="sm" variant="outline" icon={<Plus className="size-4" />} onClick={addItem}>
                إضافة
              </Button>
            </div>
          </Card>

          {/* money */}
          <Card title="الفواتير والتحصيل" icon={<Receipt className="size-4" />} bodyClass="p-0">
            <div className="overflow-x-auto">
              <table className="table">
                <thead>
                  <tr>
                    <th>الطرف</th>
                    <th>العمولة</th>
                    <th>فُوتر</th>
                    <th>حُصِّل</th>
                    <th>الباقي</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {parties.map((party) => {
                    const due = partyDue(d, party)
                    const got = dealCollected(d, payments, party)
                    const left = Math.max(0, Math.round((due - got) * 100) / 100)
                    return (
                      <tr key={party}>
                        <td>
                          <div className="text-sm font-semibold text-navy">{partyLabel(party, d.kind)}</div>
                          <div className="text-xs text-muted">{billTo(party)?.full_name ?? '—'}</div>
                        </td>
                        <td className="num font-bold whitespace-nowrap">{fmtNumber(due)}</td>
                        <td className="num whitespace-nowrap text-muted">{fmtNumber(invoiced(party))}</td>
                        <td className="num whitespace-nowrap text-success">{fmtNumber(got)}</td>
                        <td className={cn('num font-bold whitespace-nowrap', left > 0 ? 'text-warning' : 'text-subtle')}>{fmtNumber(left)}</td>
                        <td>
                          <div className="flex justify-end gap-1.5">
                            {due > 0 && invoiced(party) < due - 0.009 && (
                              <Button size="sm" variant="outline" icon={<FileText className="size-4" />} onClick={() => newInvoice(party)}>
                                فاتورة
                              </Button>
                            )}
                            {left > 0 && (
                              <Button size="sm" variant="outline" icon={<Wallet className="size-4" />} onClick={() => newPayment(party)}>
                                دفعة
                              </Button>
                            )}
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
            {(dealInvoices.length > 0 || dealPayments.length > 0) && (
              <div className="grid grid-cols-1 gap-4 border-t border-line p-4 md:grid-cols-2">
                <div>
                  <h3 className="mb-2 text-xs font-bold text-muted">الفواتير</h3>
                  <ul className="space-y-1.5">
                    {dealInvoices.map((i) => (
                      <li key={i.id}>
                        <button type="button" onClick={() => quick('invoice', i)} className="flex w-full items-center gap-2 rounded-xl bg-ivory px-3 py-2 text-start text-sm hover:bg-sand">
                          <span className="num font-bold text-gold-700">{i.no}</span>
                          <span className="min-w-0 flex-1 truncate text-muted">{i.kind === 'credit' ? 'فاتورة مضادة' : partyLabel(i.party, d.kind)}</span>
                          <span className="num font-semibold">{fmtNumber(i.total_ttc)}</span>
                          <Pill color={i.kind === 'credit' ? '#7c3aed' : INVOICE_STATUS[i.status].color}>{i.kind === 'credit' ? 'مضادة' : INVOICE_STATUS[i.status].label}</Pill>
                        </button>
                      </li>
                    ))}
                    {dealInvoices.length === 0 && <li className="text-xs text-subtle">لا توجد فواتير.</li>}
                  </ul>
                </div>
                <div>
                  <h3 className="mb-2 text-xs font-bold text-muted">الوصولات</h3>
                  <ul className="space-y-1.5">
                    {dealPayments.map((x) => (
                      <li key={x.id}>
                        <button type="button" onClick={() => quick('payment', x)} className="flex w-full items-center gap-2 rounded-xl bg-ivory px-3 py-2 text-start text-sm hover:bg-sand">
                          <span className="num font-bold text-gold-700">{x.no}</span>
                          <span className="min-w-0 flex-1 truncate text-muted">
                            {fmtDate(x.received_at)} · {PAY_METHOD[x.method]}
                          </span>
                          <span className={cn('num font-semibold', x.status === 'cancelled' && 'text-subtle line-through')}>{fmtNumber(x.amount)}</span>
                        </button>
                      </li>
                    ))}
                    {dealPayments.length === 0 && <li className="text-xs text-subtle">لا توجد وصولات.</li>}
                  </ul>
                </div>
              </div>
            )}
          </Card>

          {/* expenses */}
          <Card
            title="مصاريف الصفقة"
            icon={<Wallet className="size-4" />}
            bodyClass="p-0"
            action={
              <Button size="sm" variant="outline" icon={<Plus className="size-4" />} onClick={() => quick('expense', { deal_id: d.id, property_id: d.property_id })}>
                مصروف
              </Button>
            }
          >
            {dealExpenses.length === 0 ? (
              <p className="p-4 text-sm text-muted">سجّل هنا ما صرفته على هذه الصفقة (نسخ الوثائق، التنقل، الإعلان…) ليظهر ربحها الحقيقي.</p>
            ) : (
              <ul className="divide-y divide-line">
                {dealExpenses.map((e) => (
                  <li key={e.id}>
                    <button type="button" onClick={() => quick('expense', e)} className="flex w-full items-center gap-3 px-5 py-2.5 text-start text-sm hover:bg-ivory">
                      <Pill color={EXPENSE_CAT[e.category].color}>{EXPENSE_CAT[e.category].label}</Pill>
                      <span className="min-w-0 flex-1 truncate text-navy">{e.label}</span>
                      <span className="text-xs text-muted">{fmtDate(e.spent_at)}</span>
                      <span className="num font-bold">{fmtNumber(e.amount)}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>

        <div className="space-y-6">
          {/* result */}
          <Card title="نتيجة الصفقة" icon={<BadgeDollarSign className="size-4" />}>
            <dl className="space-y-2 text-sm">
              <div className="flex justify-between">
                <dt className="text-muted">العمولة</dt>
                <dd className="num font-bold text-navy">{fmtNumber(result.commission)}</dd>
              </div>
              {b.vat_rate > 0 && (
                <div className="flex justify-between">
                  <dt className="text-muted">منها الضريبة على القيمة المضافة {b.vat_rate}%</dt>
                  <dd className="num text-danger">− {fmtNumber(result.vat)}</dd>
                </div>
              )}
              <div className="flex justify-between">
                <dt className="text-muted">حصص الشركاء</dt>
                <dd className="num text-danger">− {fmtNumber(result.shares)}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted">مصاريف الصفقة</dt>
                <dd className="num text-danger">− {fmtNumber(result.expenses)}</dd>
              </div>
              <div className="flex justify-between rounded-xl bg-navy px-3 py-2.5 text-white">
                <dt>الربح الصافي للوكالة</dt>
                <dd className="num text-lg font-extrabold text-gold-300">{fmtNumber(result.net)}</dd>
              </div>
            </dl>
            {(d.shares ?? []).length > 0 && (
              <ul className="mt-3 space-y-1 text-xs text-muted">
                {(d.shares ?? []).map((x) => (
                  <li key={x.id} className="flex items-center gap-2">
                    <Pill color={SHARE_PARTY[x.party].color}>{SHARE_PARTY[x.party].label}</Pill>
                    {x.name}
                  </li>
                ))}
              </ul>
            )}
          </Card>

          {/* parties */}
          <Card title="الأطراف">
            <div className="space-y-4 text-sm">
              {p && (
                <Link to={`/admin/properties/${p.id}`} className="block rounded-xl bg-ivory p-3 hover:bg-sand">
                  <div className="num text-xs font-bold text-gold-700">{p.ref}</div>
                  <div className="font-semibold text-navy">{p.title}</div>
                  <div className="text-xs text-muted">
                    {hoodName(p.neighborhood)} · {fmtNumber(d.amount)} د.م.{rent ? ' / الشهر' : ''}
                  </div>
                </Link>
              )}
              {[
                { k: rent ? 'المالك' : 'البائع', v: owner },
                { k: rent ? 'المكتري' : 'المشتري', v: c },
              ].map((x) => (
                <div key={x.k}>
                  <div className="text-xs text-muted">{x.k}</div>
                  {x.v ? (
                    <>
                      <div className="font-semibold text-navy">{x.v.full_name}</div>
                      <PhoneLinks phone={x.v.whatsapp || x.v.phone} />
                    </>
                  ) : (
                    <div className="text-subtle">— غير محدد —</div>
                  )}
                </div>
              ))}
            </div>
          </Card>

          {/* deposit, notary */}
          <Card title="العربون والموثق">
            <div className="space-y-3">
              <Field label="العربون (Avance / Arrhes)" hint={d.deposit ? `${Math.round((d.deposit / d.amount) * 1000) / 10}% من الثمن` : rent ? 'مثلاً: الضمانة' : 'عادة 10% من الثمن'}>
                <Input type="number" inputMode="numeric" dir="ltr" className="num" value={form.deposit} onChange={(e) => setInfo({ ...form, deposit: e.target.value })} />
              </Field>
              <Field label={rent ? 'محرر العقد' : 'الموثق أو العدول'}>
                <Input value={form.notary} onChange={(e) => setInfo({ ...form, notary: e.target.value })} />
              </Field>
              {info?.id === d.id && (
                <Button size="sm" loading={pending} onClick={() => void saveInfo()}>
                  حفظ
                </Button>
              )}
            </div>
          </Card>

          {d.notes && (
            <Card title="ملاحظات">
              <p className="text-sm whitespace-pre-line text-muted">{d.notes}</p>
            </Card>
          )}
          {can('delete') && stage === 'cancelled' && dealInvoices.length === 0 && dealPayments.length === 0 && (
            <Button
              variant="ghost"
              className="w-full text-danger"
              icon={<Trash2 className="size-4" />}
              onClick={async () => {
                if (await del(d.id, 'ملف الصفقة')) nav('/admin/deals')
              }}
            >
              حذف الملف
            </Button>
          )}
        </div>
      </div>
      <p className="mt-6 text-xs text-subtle">فُتح الملف في {fmtDate(d.created_at)}</p>
    </>
  )
}
