import { Building2, Handshake, Pencil, Plus, Printer, Users, Wallet } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router'
import { partnerBalance, shareAmount } from '@/shared/lib/commission'
import { useNetwork, useSettings, useTable } from '@/shared/lib/data'
import { DEFAULT_NETWORK } from '@/shared/lib/fee-defaults'
import { download, fmtDate, fmtNumber, fmtPrice, toCsv, waLink } from '@/shared/lib/format'
import type { Broker, BrokerKind, Client, Deal, Property, Settings } from '@/shared/lib/types'
import { Button, Drawer, EmptyState, Segmented } from '@/shared/ui/base'
import { WhatsAppIcon } from '@/shared/ui/icons'
import { useQuickAdd } from '../dialogs'
import { useCan, useNames } from '../hooks'
import { BROKER_KIND, CLIENT_KIND, PROPERTY_STATUS, SPECIALTIES } from '../labels'
import { Stars, agreementText } from '../network-dialogs'
import { printPartnerStatement, type StatementRow } from '../print'
import { Card, PageHeader, PhoneLinks, Pill, SearchBox, Stat } from '../ui'

type KindFilter = 'all' | BrokerKind

export function Brokers() {
  const can = useCan()
  const money = can('deals')
  const quick = useQuickAdd()
  const { hoodName } = useNames()
  const { data: network = DEFAULT_NETWORK } = useNetwork()
  const { data: brokers = [], isLoading } = useTable<Broker>('brokers')
  const { data: props = [] } = useTable<Property>('properties')
  const { data: clients = [] } = useTable<Client>('clients')
  const { data: deals = [] } = useTable<Deal>('deals', { enabled: money })
  const [q, setQ] = useState('')
  const [kind, setKind] = useState<KindFilter>('all')
  const [params, setParams] = useSearchParams()
  const [openId, setOpenId] = useState<string | null>(params.get('open'))
  const wanted = params.get('open')
  useEffect(() => {
    if (wanted) {
      setOpenId(wanted)
      setParams({}, { replace: true })
    }
  }, [wanted, setParams])

  const info = useMemo(() => {
    const propBroker = new Map(props.map((p) => [p.id, p.broker_id ?? null]))
    return new Map(
      brokers.map((b) => {
        const bp = props.filter((p) => p.broker_id === b.id)
        const bc = clients.filter((c) => c.broker_id === b.id)
        const units = deals.filter((d) => d.property_id && propBroker.get(d.property_id) === b.id)
        return [b.id, { props: bp, clients: bc, balance: partnerBalance(deals, b.id), units, fromDeveloper: units.reduce((s, d) => s + (d.commission_seller ?? 0), 0) }]
      }),
    )
  }, [brokers, props, clients, deals])

  const list = useMemo(() => {
    const needle = q.trim().toLowerCase()
    return brokers
      .filter((b) => kind === 'all' || b.kind === kind)
      .filter((b) => !needle || `${b.full_name} ${b.company ?? ''} ${b.phone}`.toLowerCase().includes(needle))
      .sort((a, b) => Number(b.active) - Number(a.active) || (b.rating ?? 0) - (a.rating ?? 0) || a.full_name.localeCompare(b.full_name, 'ar'))
  }, [brokers, q, kind])

  const totals = useMemo(() => {
    const due = brokers.reduce((s, b) => s + (info.get(b.id)?.balance.rest ?? 0), 0)
    return {
      active: brokers.filter((b) => b.active).length,
      props: props.filter((p) => p.broker_id).length,
      clients: clients.filter((c) => c.broker_id).length,
      due,
    }
  }, [brokers, props, clients, info])

  const exportCsv = () =>
    download(
      `partners-${new Date().toISOString().slice(0, 10)}.csv`,
      toCsv(
        list.map((b) => ({
          الاسم: b.full_name,
          النوع: BROKER_KIND[b.kind].label,
          الشركة: b.company,
          الهاتف: b.phone,
          الاتفاق: agreementText(b, network),
          العقارات: info.get(b.id)?.props.length ?? 0,
          الزبائن: info.get(b.id)?.clients.length ?? 0,
          ...(money ? { 'الباقي له': info.get(b.id)?.balance.rest ?? 0 } : {}),
          نشط: b.active ? 'نعم' : 'لا',
        })),
      ),
      'text/csv;charset=utf-8',
    )

  const open = brokers.find((b) => b.id === openId) ?? null

  return (
    <>
      <PageHeader
        title="شبكة الوسطاء والشركاء"
        subtitle="الوسطاء، الوكالات الشريكة، المُرشدون والمنعشون، مع عقاراتهم وزبائنهم وعمولاتهم"
        icon={<Handshake className="size-6" />}
        actions={
          <>
            {can('export') && list.length > 0 && (
              <Button variant="outline" onClick={exportCsv}>
                تصدير
              </Button>
            )}
            <Button variant="gold" icon={<Plus className="size-4" />} onClick={() => quick('broker')}>
              شريك جديد
            </Button>
          </>
        }
      />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="شركاء نشطون" value={totals.active} hint={`${brokers.length} في الشبكة`} icon={<Handshake className="size-5" />} accent="#0f766e" />
        <Stat label="عقارات جاءت من الشبكة" value={totals.props} icon={<Building2 className="size-5" />} accent="#a8832f" />
        <Stat label="زبائن جاؤوا من الشبكة" value={totals.clients} icon={<Users className="size-5" />} accent="#1d4ed8" />
        {money && <Stat label="مستحقات الشركاء غير المؤداة" value={fmtNumber(totals.due)} hint="درهم" icon={<Wallet className="size-5" />} accent="#b91c1c" />}
      </div>

      <div className="card mt-6 overflow-hidden">
        <div className="flex flex-col gap-3 border-b border-line p-4 lg:flex-row lg:items-center">
          <SearchBox value={q} onChange={setQ} placeholder="ابحث بالاسم، الشركة أو الهاتف…" className="lg:max-w-sm" />
          <Segmented
            value={kind}
            onChange={setKind}
            options={[{ value: 'all' as KindFilter, label: 'الكل' }, ...(Object.keys(BROKER_KIND) as BrokerKind[]).map((k) => ({ value: k as KindFilter, label: BROKER_KIND[k].label }))]}
            className="overflow-x-auto"
          />
        </div>
        {!isLoading && list.length === 0 ? (
          <EmptyState
            icon={<Handshake className="size-7" />}
            title={brokers.length ? 'لا يوجد شريك بهذا البحث' : 'ابدأ بناء شبكتك'}
            text={brokers.length ? 'جرّب كلمة أخرى أو نوعاً آخر.' : 'أضف الوسطاء والوكالات الشريكة والمنعشين الذين تشتغل معهم، مع الاتفاق على العمولة مع كل واحد.'}
            action={
              <Button variant="gold" icon={<Plus className="size-4" />} onClick={() => quick('broker')}>
                شريك جديد
              </Button>
            }
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="table">
              <thead>
                <tr>
                  <th>الشريك</th>
                  <th>الهاتف</th>
                  <th>الاتفاق</th>
                  <th>المناطق</th>
                  <th>عقارات</th>
                  <th>زبائن</th>
                  {money && <th>الباقي له</th>}
                  <th>التقييم</th>
                </tr>
              </thead>
              <tbody>
                {list.map((b) => {
                  const i = info.get(b.id)
                  return (
                    <tr key={b.id} className={b.active ? 'cursor-pointer' : 'cursor-pointer opacity-60'} onClick={() => setOpenId(b.id)}>
                      <td>
                        <div className="font-semibold text-navy">{b.full_name}</div>
                        <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-xs text-muted">
                          <Pill color={BROKER_KIND[b.kind].color}>{BROKER_KIND[b.kind].label}</Pill>
                          {b.company && <span>{b.company}</span>}
                          {!b.active && <Pill color="#64748b">متوقف</Pill>}
                        </div>
                      </td>
                      <td onClick={(e) => e.stopPropagation()}>
                        <PhoneLinks phone={b.whatsapp || b.phone} />
                      </td>
                      <td className="max-w-[260px] text-xs text-muted">{agreementText(b, network)}</td>
                      <td className="max-w-[200px] text-xs text-muted">{b.zones.map(hoodName).join('، ') || '—'}</td>
                      <td className="num">{i?.props.length ?? 0}</td>
                      <td className="num">{i?.clients.length ?? 0}</td>
                      {money && <td className={i?.balance.rest ? 'num font-bold text-danger' : 'num text-muted'}>{fmtNumber(i?.balance.rest ?? 0)}</td>}
                      <td>
                        <Stars value={b.rating} />
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {open && <PartnerDrawer b={open} info={info.get(open.id)!} deals={deals} money={money} onClose={() => setOpenId(null)} />}
    </>
  )
}

function PartnerDrawer({
  b,
  info,
  deals,
  money,
  onClose,
}: {
  b: Broker
  info: { props: Property[]; clients: Client[]; balance: ReturnType<typeof partnerBalance>; units: Deal[]; fromDeveloper: number }
  deals: Deal[]
  money: boolean
  onClose: () => void
}) {
  const quick = useQuickAdd()
  const { hoodName } = useNames()
  const { data: settings } = useSettings()
  const s = settings as Settings
  const { data: network = DEFAULT_NETWORK } = useNetwork()
  const { data: props = [] } = useTable<Property>('properties')
  const propById = useMemo(() => new Map(props.map((p) => [p.id, p])), [props])
  const developer = b.kind === 'developer'

  const rows: StatementRow[] = useMemo(
    () =>
      deals
        .flatMap((d) =>
          (d.shares ?? [])
            .filter((x) => x.ref_id === b.id)
            .map((x) => ({ date: d.closed_at, ref: propById.get(d.property_id ?? '')?.ref ?? '', kind: d.kind === 'rent' ? 'كراء' : 'بيع', amount: d.amount, commission: d.commission, share: shareAmount(x, d.commission), paid: x.paid || 0, deal: d })),
        )
        .sort((a, z) => z.date.localeCompare(a.date)),
    [deals, b.id, propById],
  )

  const waStatement = () => {
    const lines = [
      `كشف حساب ${b.full_name} مع ${s.agency.name.ar}`,
      ...rows.map((r) => `• ${fmtDate(r.date)} ${r.ref || r.kind}: حصتك ${fmtNumber(r.share)} د.م.، المدفوع ${fmtNumber(r.paid)}، الباقي ${fmtNumber(Math.max(0, r.share - r.paid))}`),
      `المجموع: ${fmtNumber(info.balance.due)} د.م. · المدفوع: ${fmtNumber(info.balance.paid)} · الباقي: ${fmtNumber(info.balance.rest)}`,
    ]
    window.open(waLink(b.whatsapp || b.phone, lines.join('\n')), '_blank', 'noopener')
  }

  return (
    <Drawer
      open
      onClose={onClose}
      width="max-w-2xl"
      title={
        <span className="flex items-center gap-2">
          {b.full_name}
          <Pill color={BROKER_KIND[b.kind].color}>{BROKER_KIND[b.kind].label}</Pill>
        </span>
      }
      footer={
        <>
          <Button variant="outline" icon={<Pencil className="size-4" />} onClick={() => quick('broker', b)}>
            تعديل
          </Button>
          <Button variant="ghost" onClick={onClose}>
            إغلاق
          </Button>
        </>
      }
    >
      <div className="space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            {b.company && <div className="text-sm font-semibold text-navy">{b.company}</div>}
            <Stars value={b.rating} />
          </div>
          <PhoneLinks phone={b.whatsapp || b.phone} />
        </div>
        <div className="rounded-2xl border border-gold/30 bg-gold/5 p-4 text-sm text-navy">
          <div className="mb-1 text-xs font-bold text-gold-700">الاتفاق</div>
          {agreementText(b, network)}
        </div>
        {(b.zones.length > 0 || b.specialties.length > 0) && (
          <div className="flex flex-wrap gap-1.5">
            {b.zones.map((z) => (
              <Pill key={z} color="#0b1b33">
                {hoodName(z)}
              </Pill>
            ))}
            {b.specialties.map((x) => (
              <Pill key={x} color="#0f766e">
                {SPECIALTIES.find((y) => y.value === x)?.label ?? x}
              </Pill>
            ))}
          </div>
        )}
        {b.notes && <p className="rounded-xl bg-ivory p-3 text-sm whitespace-pre-line text-muted">{b.notes}</p>}

        <Card title={`عقارات جاءت عن طريقه (${info.props.length})`} icon={<Building2 className="size-4" />} bodyClass="p-0">
          {info.props.length === 0 ? (
            <p className="p-4 text-sm text-muted">لا توجد. اربط العقار بالشريك من صفحة العقار، في «المالك ومعلومات داخلية».</p>
          ) : (
            <ul className="divide-y divide-line">
              {info.props.map((p) => (
                <li key={p.id}>
                  <Link to={`/admin/properties/${p.id}`} className="flex items-center gap-3 px-4 py-2.5 hover:bg-ivory">
                    <span className="num text-sm font-bold text-gold-700">{p.ref}</span>
                    <span className="min-w-0 flex-1 truncate text-sm text-navy">{p.title}</span>
                    <span className="num text-xs text-muted">{fmtPrice(p.price, 'ar', p.purpose === 'rent')}</span>
                    <Pill color={PROPERTY_STATUS[p.status].color}>{PROPERTY_STATUS[p.status].label}</Pill>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>

        {!developer && (
          <Card title={`زبائن جاؤوا عن طريقه (${info.clients.length})`} icon={<Users className="size-4" />} bodyClass="p-0">
            {info.clients.length === 0 ? (
              <p className="p-4 text-sm text-muted">لا يوجد. اربط الزبون بالشريك من بطاقة الزبون.</p>
            ) : (
              <ul className="divide-y divide-line">
                {info.clients.map((c) => (
                  <li key={c.id}>
                    <Link to={`/admin/clients?open=${c.id}`} className="flex items-center gap-3 px-4 py-2.5 hover:bg-ivory">
                      <span className="min-w-0 flex-1 truncate text-sm font-semibold text-navy">{c.full_name}</span>
                      <Pill color={CLIENT_KIND[c.kind].color}>{CLIENT_KIND[c.kind].label}</Pill>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        )}

        {money && developer && (
          <Card title="مع هذا المنعش" icon={<Wallet className="size-4" />}>
            <p className="text-sm text-navy">
              وحدات بعناها من مشاريعه: <b className="num">{info.units.length}</b> · العمولة التي دفعها لنا: <b className="num">{fmtNumber(info.fromDeveloper)} د.م.</b>
            </p>
          </Card>
        )}

        {money && !developer && (
          <Card
            title="كشف الحساب"
            icon={<Wallet className="size-4" />}
            bodyClass="p-0"
            action={
              rows.length > 0 ? (
                <span className="flex gap-1.5">
                  <Button size="sm" variant="outline" icon={<Printer className="size-4" />} onClick={() => printPartnerStatement(b.full_name, b.company ?? BROKER_KIND[b.kind].label, rows, s)}>
                    طباعة
                  </Button>
                  <Button size="sm" variant="whatsapp" icon={<WhatsAppIcon className="size-4" />} onClick={waStatement}>
                    إرسال
                  </Button>
                </span>
              ) : undefined
            }
          >
            {rows.length === 0 ? (
              <p className="p-4 text-sm text-muted">لا توجد صفقات مشتركة بعد. حين تسجل صفقة، أضفه في «تقسيم العمولة مع الشركاء».</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="table">
                  <thead>
                    <tr>
                      <th>التاريخ</th>
                      <th>العقار</th>
                      <th>حصته</th>
                      <th>المدفوع</th>
                      <th>الباقي</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((r, i) => (
                      <tr key={i} className="cursor-pointer" onClick={() => quick('deal', (r as StatementRow & { deal: Deal }).deal)}>
                        <td className="text-sm whitespace-nowrap text-muted">{fmtDate(r.date)}</td>
                        <td className="num text-sm">{r.ref || r.kind}</td>
                        <td className="num font-bold">{fmtNumber(r.share)}</td>
                        <td className="num">{fmtNumber(r.paid)}</td>
                        <td className={r.share - r.paid > 0 ? 'num font-bold text-danger' : 'num text-success'}>{fmtNumber(Math.max(0, r.share - r.paid))}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr>
                      <td colSpan={2} className="font-bold text-navy">
                        المجموع
                      </td>
                      <td className="num font-extrabold">{fmtNumber(info.balance.due)}</td>
                      <td className="num">{fmtNumber(info.balance.paid)}</td>
                      <td className="num font-extrabold text-danger">{fmtNumber(info.balance.rest)}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
          </Card>
        )}
      </div>
    </Drawer>
  )
}
