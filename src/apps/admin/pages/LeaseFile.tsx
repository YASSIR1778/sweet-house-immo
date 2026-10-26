import { ArrowRight, CalendarX2, ClipboardList, FileSignature, Hourglass, Key, Pencil, Printer, Receipt, TrendingUp, Undo2, Wallet } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Link, useParams } from 'react-router'
import { useBilling, useTable } from '@/shared/lib/data'
import { fmtDate, fmtNumber, localDate, nowIso } from '@/shared/lib/format'
import { addMonths, depositMax, depositReturnBy, leaseArrears, leaseSchedule, managementFee, monthName, periodOf, rentFor, revisionStatus } from '@/shared/lib/rentals'
import type { BillingSettings, Lease, Property, RentPayment } from '@/shared/lib/types'
import { Button, FullSpinner, cn, useConfirm } from '@/shared/ui/base'
import { WhatsAppIcon } from '@/shared/ui/icons'
import { useQuickAdd } from '../dialogs'
import { useCan, useLookups, useNames, useSave } from '../hooks'
import { LEASE_STATUS, LEASE_USAGE, PAY_METHOD, RENT_STATUS } from '../labels'
import { printInventory, printLease } from '../print'
import { InventoryDialog, useLeaseTitle } from '../rentals'
import { Card, PageHeader, PhoneLinks, Pill } from '../ui'
import { useRentReminder } from './Rentals'

/** The file of one lease: what is due month by month, receipts, revision, deposit and state of the premises. */
export function LeaseFile() {
  const { id } = useParams()
  const can = useCan()
  const quick = useQuickAdd()
  const confirm = useConfirm()
  const L = useLookups()
  const { s, hoodName } = useNames()
  const title = useLeaseTitle()
  const remind = useRentReminder()
  const { data: billing } = useBilling()
  const { data: leases = [], isLoading } = useTable<Lease>('leases')
  const { data: rents = [] } = useTable<RentPayment>('rent_payments')
  const { save, pending } = useSave<Lease>('leases', 'lease', (l) => title(l))
  const saveProp = useSave<Property>('properties', 'property', (p) => p.ref)
  const [inventory, setInventory] = useState<'in' | 'out' | null>(null)
  const l = leases.find((x) => x.id === id)
  const today = new Date()
  const schedule = useMemo(() => (l ? leaseSchedule(l, rents, today).reverse() : []), [l, rents]) // eslint-disable-line react-hooks/exhaustive-deps

  if (isLoading) return <FullSpinner />
  if (!l)
    return (
      <div className="card mx-auto mt-10 max-w-lg p-10 text-center">
        <h1 className="text-xl font-bold text-navy">العقد غير موجود</h1>
        <Link to="/admin/rentals" className="mt-4 inline-block font-semibold text-teal">
          العودة إلى الكراء
        </Link>
      </div>
    )

  const p = L.property(l.property_id)
  const owner = L.client(l.owner_client_id)
  const tenant = L.client(l.tenant_client_id)
  const cur = rentFor(l, periodOf(today))
  const arrears = l.managed && l.status === 'active' ? leaseArrears(l, rents, today) : null
  const rev = revisionStatus(l, today)
  const depositBy = depositReturnBy(l)
  const receipts = rents.filter((r) => r.lease_id === l.id).sort((a, b) => b.paid_at.localeCompare(a.paid_at) || b.no.localeCompare(a.no))
  const todayStr = localDate(today)
  const b = billing as BillingSettings

  const applyRevision = async () => {
    const from = addMonths(periodOf(today), 1)
    const ok = await confirm({
      title: `رفع الكراء إلى ${fmtNumber(rev.suggested)} د.م. ابتداء من ${monthName(from, 'ar')}؟`,
      text: `زيادة ${rev.cap}% بعد ثلاث سنوات (المادتان 33 و34 من القانون 67.12). تتم المراجعة باتفاق مكتوب مع المكتري، أو بإنذار ثم دعوى داخل 3 أشهر إن رفض (المادة 37).`,
      confirmLabel: 'نعم، سجّل المراجعة',
    })
    if (!ok) return
    await save({ ...l, revisions: [...(l.revisions ?? []), { from, rent: rev.suggested, charges: cur.charges, note: `مراجعة ${rev.cap}% (المادة 34)` }], updated_at: nowIso() }, { message: 'سُجلت المراجعة' })
  }

  const endLease = async () => {
    const ok = await confirm({
      title: 'إنهاء عقد الكراء اليوم؟',
      text: `تتوقف الأداءات الشهرية بعد ${monthName(periodOf(today), 'ar')}.${l.deposit ? ` تذكير: تُرد الضمانة (${fmtNumber(l.deposit)} د.م.) في أجل أقصاه شهر من إرجاع المفاتيح (المادة 20).` : ''}${p?.status === 'rented' ? ` ويعود ${p.ref} «متاحاً» (غير منشور).` : ''}`,
      confirmLabel: 'نعم، أنهِ العقد',
      danger: true,
    })
    if (!ok) return
    const saved = await save({ ...l, status: 'ended', ended_at: todayStr, updated_at: nowIso() }, { message: 'انتهى العقد', action: 'status', meta: { status: 'ended' } })
    if (saved && p?.status === 'rented' && can('properties')) await saveProp.save({ ...p, status: 'available', updated_at: nowIso() }, { silent: true, action: 'status', meta: { status: 'available' } })
  }

  return (
    <>
      <Link to="/admin/rentals" className="mb-3 inline-flex items-center gap-1 text-sm font-semibold text-muted hover:text-navy">
        <ArrowRight className="size-4" /> الكراء والتسيير
      </Link>
      <PageHeader
        title={
          <span className="inline-flex flex-wrap items-center gap-2">
            عقد كراء {p && <span className="num text-gold-700">{p.ref}</span>}
          </span>
        }
        subtitle={[LEASE_USAGE[l.usage], tenant?.full_name, l.managed ? `تسيير الوكالة ${l.management_rate}%` : 'الأداء مباشرة للمالك'].filter(Boolean).join(' · ')}
        icon={<Key className="size-6" />}
        actions={
          <>
            <Button variant="outline" icon={<Printer className="size-4" />} onClick={() => printLease(l, p, owner, tenant, s, b)}>
              طباعة العقد
            </Button>
            <Button variant="outline" icon={<Pencil className="size-4" />} onClick={() => quick('lease', l)}>
              تعديل
            </Button>
            {l.status === 'active' && (
              <Button variant="ghost" className="text-danger" icon={<CalendarX2 className="size-4" />} onClick={() => void endLease()}>
                إنهاء العقد
              </Button>
            )}
          </>
        }
      />

      {/* alerts */}
      <div className="mb-6 grid grid-cols-1 gap-3 lg:grid-cols-2">
        {arrears && arrears.amount > 0 && (
          <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-danger/30 bg-danger/5 p-4">
            <Hourglass className="size-5 text-danger" />
            <div className="min-w-0 flex-1 text-sm">
              <b className="text-navy">متأخرات: {fmtNumber(arrears.amount)} د.م.</b>
              <div className="text-xs text-muted">
                {arrears.months} شهر · أقدمها {arrears.oldest ? monthName(arrears.oldest, 'ar') : ''} · {arrears.maxLate} يوماً
              </div>
            </div>
            {(() => {
              const row = schedule.find((r) => r.late > 0)
              const link = row ? remind(l, row.period, row.due, row.amount - row.paid, true) : null
              return link ? (
                <a href={link} target="_blank" rel="noopener noreferrer" className="inline-flex h-9 items-center gap-1.5 rounded-xl bg-[#25D366] px-3 text-sm font-semibold text-white">
                  <WhatsAppIcon className="size-4" /> تذكير المكتري
                </a>
              ) : null
            })()}
          </div>
        )}
        {l.status === 'active' && rev.eligible && (
          <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-[#7c3aed]/30 bg-[#7c3aed]/5 p-4">
            <TrendingUp className="size-5 text-[#7c3aed]" />
            <div className="min-w-0 flex-1 text-sm">
              <b className="text-navy">
                مراجعة ممكنة: {fmtNumber(rev.current)} ← {fmtNumber(rev.suggested)} د.م. (+{rev.cap}%)
              </b>
              <div className="text-xs text-muted">مرت 3 سنوات على {l.revisions?.length ? 'آخر مراجعة' : 'بداية العقد'} ({fmtDate(rev.last)}) — المادتان 33 و34</div>
            </div>
            <Button size="sm" variant="outline" loading={pending} onClick={() => void applyRevision()}>
              تسجيل المراجعة
            </Button>
          </div>
        )}
        {depositBy && (
          <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-warning/30 bg-warning/5 p-4">
            <Undo2 className="size-5 text-warning" />
            <div className="min-w-0 flex-1 text-sm">
              <b className="text-navy">إرجاع الضمانة ({fmtNumber(l.deposit)} د.م.) قبل {fmtDate(depositBy)}</b>
              <div className="text-xs text-muted">المادة 20: شهر على الأكثر من إرجاع المحل، بعد خصم ما ثبت أنه مستحق.</div>
            </div>
            <Button size="sm" variant="outline" loading={pending} onClick={() => void save({ ...l, deposit_returned_at: todayStr, updated_at: nowIso() }, { message: 'سُجل إرجاع الضمانة' })}>
              أُرجعت الضمانة
            </Button>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        <div className="space-y-6 xl:col-span-2">
          {l.managed ? (
            <Card title="الأداءات شهراً بشهر" icon={<Wallet className="size-4" />} bodyClass="p-0">
              <div className="overflow-x-auto">
                <table className="table">
                  <thead>
                    <tr>
                      <th>الشهر</th>
                      <th>الأجل</th>
                      <th>الواجب</th>
                      <th>المؤدى</th>
                      <th>الحالة</th>
                      <th />
                    </tr>
                  </thead>
                  <tbody>
                    {schedule.map((r) => {
                      const link = r.status !== 'paid' ? remind(l, r.period, r.due, r.amount - r.paid, r.late > 0) : null
                      return (
                        <tr key={r.period}>
                          <td className="text-sm font-semibold whitespace-nowrap text-navy">{monthName(r.period, 'ar')}</td>
                          <td className="text-sm whitespace-nowrap text-muted">{fmtDate(r.due)}</td>
                          <td className="num whitespace-nowrap">{fmtNumber(r.amount)}</td>
                          <td className="num whitespace-nowrap text-success">
                            {fmtNumber(r.paid)}
                            {r.payments.map((x) => (
                              <button key={x.id} type="button" onClick={() => quick('rent', x)} className="num ms-1.5 text-[11px] font-semibold text-gold-700 hover:underline">
                                {x.no}
                              </button>
                            ))}
                          </td>
                          <td>
                            <Pill color={RENT_STATUS[r.status].color}>{RENT_STATUS[r.status].label}</Pill>
                            {r.late > 0 && <span className="ms-1 text-xs font-semibold text-danger">{r.late} يوماً</span>}
                          </td>
                          <td>
                            <div className="flex justify-end gap-1.5">
                              {link && (
                                <a href={link} target="_blank" rel="noopener noreferrer" className="inline-flex size-8 items-center justify-center rounded-lg bg-[#25D366]/10 text-[#128C7E] hover:bg-[#25D366]/20" aria-label="تذكير">
                                  <WhatsAppIcon className="size-4" />
                                </a>
                              )}
                              {r.status !== 'paid' && l.status === 'active' && (
                                <Button size="sm" variant="outline" onClick={() => quick('rent', { lease_id: l.id, period: r.period })}>
                                  أداء
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
            </Card>
          ) : (
            <Card title="الأداءات" icon={<Wallet className="size-4" />}>
              <p className="text-sm text-muted">الكراء يُؤدى مباشرة للمالك، والوكالة لا تحصّله. لتتبع الأداءات وإصدار الوصولات، فعّل «الوكالة تحصّل الكراء» في تعديل العقد.</p>
            </Card>
          )}

          <Card title="البيان الوصفي لحالة المحل" icon={<ClipboardList className="size-4" />}>
            <p className="mb-3 text-xs text-muted">المادتان 7 و8: يُعد عند التسليم وعند الإرجاع، مفصلاً ودقيقاً، ويوقعه الطرفان ويُرفق بالعقد.</p>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {(['in', 'out'] as const).map((side) => {
                const st = l.inventory?.[side]
                return (
                  <div key={side} className="rounded-2xl border border-line p-3">
                    <div className="flex items-center justify-between gap-2">
                      <b className="text-sm text-navy">{side === 'in' ? 'عند التسليم' : 'عند الإرجاع'}</b>
                      {st && <span className="text-xs text-muted">{st.date ? fmtDate(st.date) : ''}</span>}
                    </div>
                    <p className="mt-1 text-xs text-muted">{st ? `${st.items.length} أجزاء موصوفة` : 'لم يُعد بعد'}</p>
                    <div className="mt-2 flex gap-1.5">
                      <Button size="sm" variant="outline" onClick={() => setInventory(side)} disabled={side === 'out' && l.status === 'active' && !st}>
                        {st ? 'تعديل' : 'إعداد'}
                      </Button>
                      {st && (
                        <Button size="sm" variant="ghost" icon={<Printer className="size-4" />} onClick={() => printInventory(side, st, p, owner, tenant, s)}>
                          طباعة
                        </Button>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </Card>

          <Card title="الوصولات" icon={<Receipt className="size-4" />} bodyClass="p-0">
            {receipts.length === 0 ? (
              <p className="p-4 text-sm text-muted">لا توجد وصولات بعد.</p>
            ) : (
              <ul className="divide-y divide-line">
                {receipts.map((r) => (
                  <li key={r.id}>
                    <button type="button" onClick={() => quick('rent', r)} className="flex w-full items-center gap-3 px-5 py-2.5 text-start text-sm hover:bg-ivory">
                      <span className="num font-bold text-gold-700">{r.no}</span>
                      <span className="flex-1 text-muted">
                        {monthName(r.period, 'ar')} · {fmtDate(r.paid_at)} · {PAY_METHOD[r.method]}
                      </span>
                      {l.managed && r.status === 'valid' && <span className={cn('text-xs', r.remitted_at ? 'text-success' : 'font-semibold text-warning')}>{r.remitted_at ? 'حُوّل للمالك' : 'لم يُحوَّل'}</span>}
                      <span className={cn('num font-bold', r.status === 'cancelled' ? 'text-subtle line-through' : 'text-navy')}>{fmtNumber(r.rent + r.charges)}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>

        <div className="space-y-6">
          <Card title="الشروط" icon={<FileSignature className="size-4" />}>
            <dl className="space-y-2 text-sm">
              {[
                ['الحالة', <Pill key="s" color={LEASE_STATUS[l.status].color}>{LEASE_STATUS[l.status].label}</Pill>],
                ['الكراء الحالي', `${fmtNumber(cur.rent)} د.م.`],
                ['التكاليف', cur.charges ? `${fmtNumber(cur.charges)} د.م.${l.charges_note ? ` (${l.charges_note})` : ''}` : '—'],
                ['الأداء', `قبل يوم ${l.pay_day} · ${PAY_METHOD[l.payment_method]}`],
                ['المدة', `${fmtDate(l.start_date)} — ${l.ended_at ? fmtDate(l.ended_at) : l.end_date ? fmtDate(l.end_date) : 'يتجدد ضمنياً'}`],
                ['الضمانة', `${fmtNumber(l.deposit)} د.م. عند ${l.deposit_holder === 'agency' ? 'الوكالة' : 'المالك'}${l.deposit > depositMax(l.rent) ? ' ⚠' : ''}${l.deposit_returned_at ? ` · أُرجعت ${fmtDate(l.deposit_returned_at)}` : ''}`],
                ...(l.managed ? [['عمولة التسيير', `${l.management_rate}% · ${fmtNumber(managementFee({ rent: cur.rent }, l.management_rate))} د.م./شهر`] as [string, string]] : []),
                ['المراجعة القادمة', `ابتداء من ${fmtDate(rev.next)} (+${rev.cap}%)`],
              ].map(([k, v]) => (
                <div key={String(k)} className="flex items-start justify-between gap-3">
                  <dt className="text-muted">{k}</dt>
                  <dd className="text-end font-semibold text-navy">{v}</dd>
                </div>
              ))}
            </dl>
            {(l.revisions ?? []).length > 0 && (
              <div className="mt-4 border-t border-line pt-3">
                <h3 className="mb-2 text-xs font-bold text-muted">تاريخ المراجعات</h3>
                <ul className="space-y-1 text-xs">
                  <li className="flex justify-between">
                    <span>{fmtDate(l.start_date)}</span>
                    <span className="num">{fmtNumber(l.rent)}</span>
                  </li>
                  {[...l.revisions].sort((a, z) => a.from.localeCompare(z.from)).map((r) => (
                    <li key={r.from} className="flex justify-between">
                      <span>{monthName(r.from, 'ar')}</span>
                      <span className="num font-bold">{fmtNumber(r.rent)}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </Card>
          <Card title="الأطراف">
            <div className="space-y-4 text-sm">
              {p && (
                <Link to={`/admin/properties/${p.id}`} className="block rounded-xl bg-ivory p-3 hover:bg-sand">
                  <div className="num text-xs font-bold text-gold-700">{p.ref}</div>
                  <div className="font-semibold text-navy">{p.title}</div>
                  <div className="text-xs text-muted">{hoodName(p.neighborhood)}</div>
                </Link>
              )}
              {[
                { k: 'المكري (المالك)', v: owner },
                { k: 'المكتري', v: tenant },
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
          {(l.equipment || l.obligations || l.notes) && (
            <Card title="ملاحظات">
              <div className="space-y-2 text-sm text-muted">
                {l.equipment && <p>التجهيزات: {l.equipment}</p>}
                {l.obligations && <p>التزامات خاصة: {l.obligations}</p>}
                {l.notes && <p className="whitespace-pre-line">{l.notes}</p>}
              </div>
            </Card>
          )}
        </div>
      </div>
      {inventory && <InventoryDialog lease={l} side={inventory} onClose={() => setInventory(null)} />}
      <p className="mt-6 text-xs text-subtle">
        سُجل العقد في {fmtDate(l.created_at)} · {receipts.length} وصل
        {l.managed && receipts.length > 0 && ` · آخر أداء ${fmtDate(receipts[0].paid_at)}`}
      </p>
    </>
  )
}
