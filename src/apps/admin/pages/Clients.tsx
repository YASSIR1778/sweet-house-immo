import { CalendarPlus, ClipboardPlus, Download, FolderLock, Pencil, Plus, Sparkles, Trash2, Users } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router'
import { matchScore, useTable } from '@/shared/lib/data'
import { download, fmtDate, fmtDateTime, fmtPrice, fmtPriceShort, phoneKey, toCsv, waLink } from '@/shared/lib/format'
import type { Appointment, CallLog, Client, ClientKind, Lead, Property } from '@/shared/lib/types'
import { Button, ButtonLink, Drawer, Segmented, cn } from '@/shared/ui/base'
import { WhatsAppIcon } from '@/shared/ui/icons'
import { useQuickAdd } from '../dialogs'
import { useCan, useDeleteRow, useLookups, useNames } from '../hooks'
import { APPT_KIND, APPT_STATUS, CLIENT_KIND, LEAD_STATUS, PURPOSE, SOURCE } from '../labels'
import { matchesMessage, propertyMessage } from '../templates'
import { Avatar, Card, MiniEmpty, PageHeader, PhoneLinks, Pill, SearchBox } from '../ui'

function useMatches(properties: Property[]) {
  const live = useMemo(() => properties.filter((p) => p.status === 'available' && p.published), [properties])
  return (c: Client) =>
    c.kind === 'owner'
      ? []
      : live
          .map((p) => ({ p, score: matchScore(p, { purpose: c.wants_purpose, types: c.wants_types, neighborhoods: c.wants_neighborhoods, min: c.budget_min, max: c.budget_max, rooms: c.wants_rooms_min }) }))
          .filter((x) => x.score >= 65)
          .sort((a, b) => b.score - a.score)
}

export function Clients() {
  const quick = useQuickAdd()
  const can = useCan()
  const [sp, setSp] = useSearchParams()
  const { data: clients = [], isLoading } = useTable<Client>('clients')
  const { data: properties = [] } = useTable<Property>('properties')
  const { hoodName, typeName } = useNames()
  const [q, setQ] = useState('')
  const [kind, setKind] = useState<'all' | ClientKind>('all')
  const matches = useMatches(properties)

  const openId = sp.get('open')
  const open = clients.find((c) => c.id === openId) ?? null
  const setOpen = (id: string | null) => {
    const n = new URLSearchParams(sp)
    if (id) n.set('open', id)
    else n.delete('open')
    setSp(n, { replace: true })
  }

  const list = useMemo(() => {
    const term = q.trim().toLowerCase()
    const digits = phoneKey(term)
    return clients
      .filter((c) => (kind === 'all' || c.kind === kind) && (!term || `${c.full_name} ${c.email ?? ''} ${c.notes ?? ''}`.toLowerCase().includes(term) || (digits.length >= 4 && phoneKey(c.phone).includes(digits))))
      .sort((a, b) => b.created_at.localeCompare(a.created_at))
  }, [clients, q, kind])

  const exportCsv = () =>
    download(
      `clients-${new Date().toISOString().slice(0, 10)}.csv`,
      toCsv(
        clients.map((c) => ({
          الاسم: c.full_name,
          الهاتف: c.phone,
          البريد: c.email,
          النوع: CLIENT_KIND[c.kind].label,
          المصدر: SOURCE[c.source].label,
          'الميزانية من': c.budget_min,
          'الميزانية إلى': c.budget_max,
          ملاحظات: c.notes,
          'تاريخ الإضافة': c.created_at.slice(0, 10),
        })),
      ),
      'text/csv;charset=utf-8',
    )

  const wishes = (c: Client) => {
    const parts: string[] = []
    if (c.wants_purpose) parts.push(PURPOSE[c.wants_purpose].label)
    if (c.wants_types.length) parts.push(c.wants_types.map((t) => typeName(t)).join('، '))
    if (c.wants_neighborhoods.length) parts.push(c.wants_neighborhoods.slice(0, 3).map(hoodName).join('، ') + (c.wants_neighborhoods.length > 3 ? '…' : ''))
    return parts.join(' · ') || '—'
  }

  return (
    <>
      <PageHeader
        title="العملاء"
        subtitle={`${clients.length} عميل — مشترون، مكترون، ملاك ومستثمرون`}
        icon={<Users className="size-6" />}
        actions={
          <>
            {can('export') && (
              <Button variant="outline" onClick={exportCsv} icon={<Download className="size-4" />}>
                تصدير Excel
              </Button>
            )}
            <Button variant="gold" onClick={() => quick('client')} icon={<Plus className="size-4" />}>
              عميل جديد
            </Button>
          </>
        }
      />

      <div className="card overflow-hidden">
        <div className="flex flex-wrap items-center gap-2 border-b border-line p-3">
          <SearchBox value={q} onChange={setQ} placeholder="الاسم أو رقم الهاتف…" className="min-w-[220px] flex-1" />
          <Segmented
            value={kind}
            onChange={setKind}
            options={[{ value: 'all' as const, label: 'الكل' }, ...(Object.keys(CLIENT_KIND) as ClientKind[]).map((k) => ({ value: k, label: CLIENT_KIND[k].label }))]}
          />
        </div>
        {isLoading ? (
          <div className="skeleton m-4 h-60 rounded-xl" />
        ) : (
          <div className="overflow-x-auto">
            <table className="table">
              <thead>
                <tr>
                  <th>العميل</th>
                  <th>الهاتف</th>
                  <th>يبحث عن</th>
                  <th>الميزانية</th>
                  <th>عقارات مطابقة</th>
                  <th>المصدر</th>
                  <th>أضيف</th>
                </tr>
              </thead>
              <tbody>
                {list.map((c) => {
                  const n = matches(c).length
                  return (
                    <tr key={c.id} className="cursor-pointer" onClick={() => setOpen(c.id)}>
                      <td>
                        <div className="flex items-center gap-3">
                          <Avatar name={c.full_name} />
                          <div>
                            <div className="font-semibold text-navy">{c.full_name}</div>
                            <Pill color={CLIENT_KIND[c.kind].color}>{CLIENT_KIND[c.kind].label}</Pill>
                          </div>
                        </div>
                      </td>
                      <td>
                        <PhoneLinks phone={c.whatsapp || c.phone} />
                      </td>
                      <td className="max-w-[260px] truncate text-sm text-muted">{c.kind === 'owner' ? `${properties.filter((p) => p.owner_client_id === c.id).length} عقار مسجل باسمه` : wishes(c)}</td>
                      <td className="num text-sm whitespace-nowrap">{c.budget_max ? `≤ ${fmtPriceShort(c.budget_max, 'ar')}` : '—'}</td>
                      <td>{c.kind === 'owner' ? <span className="text-subtle">—</span> : n > 0 ? <Pill color="#15803d">✦ {n} عقار</Pill> : <span className="text-xs text-subtle">لا يوجد حالياً</span>}</td>
                      <td className="text-sm" style={{ color: SOURCE[c.source].color }}>
                        {SOURCE[c.source].label}
                      </td>
                      <td className="text-xs whitespace-nowrap text-muted">{fmtDate(c.created_at)}</td>
                    </tr>
                  )
                })}
                {list.length === 0 && (
                  <tr>
                    <td colSpan={7} className="py-10 text-center text-muted">
                      لا يوجد عملاء
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {open && <ClientDrawer client={open} onClose={() => setOpen(null)} matches={matches(open)} />}
    </>
  )
}

function ClientDrawer({ client: c, onClose, matches }: { client: Client; onClose: () => void; matches: { p: Property; score: number }[] }) {
  const quick = useQuickAdd()
  const can = useCan()
  const L = useLookups()
  const { s, hoodName, typeName } = useNames()
  const del = useDeleteRow('clients', 'client')
  const { data: leads = [] } = useTable<Lead>('leads')
  const { data: appts = [] } = useTable<Appointment>('appointments')
  const { data: calls = [] } = useTable<CallLog>('calls')
  const [picked, setPicked] = useState<string[]>([])
  const key = phoneKey(c.phone)
  const myLeads = leads.filter((l) => l.client_id === c.id || phoneKey(l.phone) === key)
  const myAppts = appts.filter((a) => a.client_id === c.id).sort((a, b) => b.starts_at.localeCompare(a.starts_at))
  const myCalls = calls.filter((x) => x.client_id === c.id || phoneKey(x.phone) === key)
  const owned = L.properties.filter((p) => p.owner_client_id === c.id)
  const phone = c.whatsapp || c.phone
  const sendSelected = () => {
    const list = matches.filter((m) => picked.includes(m.p.id)).map((m) => m.p)
    if (!list.length) return
    window.open(waLink(phone, matchesMessage(list, s, c.lang, c.full_name)), '_blank', 'noopener')
  }

  return (
    <Drawer
      open
      onClose={onClose}
      width="max-w-2xl"
      title={
        <span className="flex items-center gap-2">
          {c.full_name} <Pill color={CLIENT_KIND[c.kind].color}>{CLIENT_KIND[c.kind].label}</Pill>
        </span>
      }
      footer={
        <>
          {can('delete') && (
            <Button
              variant="ghost"
              className="me-auto text-danger"
              icon={<Trash2 className="size-4" />}
              onClick={async () => {
                if (await del(c.id, c.full_name)) onClose()
              }}
            >
              حذف
            </Button>
          )}
          {(c.kind === 'owner' || owned.length > 0) && (
            <ButtonLink to={`/admin/owners?open=${c.id}`} variant="gold" icon={<FolderLock className="size-4" />}>
              ملف المالك
            </ButtonLink>
          )}
          <Button variant="outline" icon={<Pencil className="size-4" />} onClick={() => quick('client', c)}>
            تعديل الملف
          </Button>
        </>
      }
    >
      <div className="space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-ivory p-4">
          <PhoneLinks phone={phone} />
          {c.email && (
            <a href={`mailto:${c.email}`} className="text-sm text-teal hover:underline" dir="ltr">
              {c.email}
            </a>
          )}
          <span className="text-xs text-muted">
            المصدر: <b style={{ color: SOURCE[c.source].color }}>{SOURCE[c.source].label}</b> · منذ {fmtDate(c.created_at)}
          </span>
        </div>

        {c.kind !== 'owner' && (
          <div className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
            <div className="rounded-xl border border-line p-3">
              <div className="text-xs text-muted">الغرض</div>
              <div className="font-bold text-navy">{c.wants_purpose ? PURPOSE[c.wants_purpose].label : '—'}</div>
            </div>
            <div className="rounded-xl border border-line p-3">
              <div className="text-xs text-muted">الميزانية</div>
              <div className="num font-bold text-navy">{c.budget_max ? `${c.budget_min ? fmtPriceShort(c.budget_min, 'ar') + ' – ' : '≤ '}${fmtPriceShort(c.budget_max, 'ar')}` : '—'}</div>
            </div>
            <div className="rounded-xl border border-line p-3">
              <div className="text-xs text-muted">النوع</div>
              <div className="font-bold text-navy">{c.wants_types.map((t) => typeName(t)).join('، ') || '—'}</div>
            </div>
            <div className="rounded-xl border border-line p-3">
              <div className="text-xs text-muted">الغرف</div>
              <div className="num font-bold text-navy">{c.wants_rooms_min ? `${c.wants_rooms_min}+` : '—'}</div>
            </div>
            {c.wants_neighborhoods.length > 0 && (
              <div className="col-span-2 flex flex-wrap gap-1.5 sm:col-span-4">
                {c.wants_neighborhoods.map((h) => (
                  <span key={h} className="rounded-full bg-sand px-2.5 py-1 text-xs font-semibold text-navy">
                    {hoodName(h)}
                  </span>
                ))}
              </div>
            )}
          </div>
        )}
        {c.notes && <p className="rounded-2xl border-s-4 border-gold bg-ivory px-4 py-3 text-sm whitespace-pre-line">{c.notes}</p>}

        <div className="grid grid-cols-2 gap-2">
          <Button variant="gold" icon={<CalendarPlus className="size-4" />} onClick={() => quick('appointment', { kind: 'visit', client_id: c.id, property_id: picked[0] ?? matches[0]?.p.id ?? null })}>
            جدولة زيارة
          </Button>
          <Button variant="outline" icon={<ClipboardPlus className="size-4" />} onClick={() => quick('task', { title: `متابعة ${c.full_name}`, related_type: 'client', related_id: c.id })}>
            مهمة متابعة
          </Button>
        </div>

        {c.kind !== 'owner' && (
          <Card
            title={`عقارات تناسبه (${matches.length})`}
            icon={<Sparkles className="size-4" />}
            bodyClass="p-0"
            action={
              picked.length > 0 ? (
                <Button size="sm" variant="whatsapp" icon={<WhatsAppIcon className="size-4" />} onClick={sendSelected}>
                  إرسال {picked.length} عبر واتساب
                </Button>
              ) : undefined
            }
          >
            {matches.length === 0 ? (
              <MiniEmpty text="لا توجد عقارات مطابقة حالياً. ستظهر هنا تلقائياً عند إضافتها." />
            ) : (
              <ul className="divide-y divide-line">
                {matches.slice(0, 10).map(({ p, score }) => (
                  <li key={p.id} className="flex items-center gap-3 px-4 py-3">
                    <input type="checkbox" className="size-4 accent-[#0b1b33]" checked={picked.includes(p.id)} onChange={() => setPicked((x) => (x.includes(p.id) ? x.filter((i) => i !== p.id) : [...x, p.id]))} />
                    {p.images[0] ? <img src={p.images[0]} alt="" className="size-14 shrink-0 rounded-xl object-cover" /> : <span className="size-14 shrink-0 rounded-xl bg-sand" />}
                    <Link to={`/admin/properties/${p.id}`} className="min-w-0 flex-1">
                      <div className="num text-xs font-bold text-gold-700">{p.ref}</div>
                      <div className="truncate text-sm font-semibold text-navy">{p.title}</div>
                      <div className="num text-xs text-muted">
                        {fmtPrice(p.price, 'ar', p.purpose === 'rent')} · {hoodName(p.neighborhood)}
                      </div>
                    </Link>
                    <span className={cn('num rounded-full px-2 py-1 text-xs font-bold', score >= 85 ? 'bg-success/10 text-success' : 'bg-gold/15 text-gold-700')}>{score}%</span>
                    <a href={waLink(phone, propertyMessage(p, s, c.lang, c.full_name))} target="_blank" rel="noopener noreferrer" className="inline-flex size-8 items-center justify-center rounded-full bg-[#25D366]/10 text-[#128C7E] hover:bg-[#25D366] hover:text-white" title="إرسال عبر واتساب">
                      <WhatsAppIcon className="size-3.5" />
                    </a>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        )}

        {owned.length > 0 && (
          <Card title={`عقاراته (${owned.length})`} bodyClass="p-0">
            <ul className="divide-y divide-line">
              {owned.map((p) => (
                <li key={p.id}>
                  <Link to={`/admin/properties/${p.id}`} className="flex items-center justify-between px-4 py-3 hover:bg-ivory">
                    <span className="text-sm font-semibold text-navy">
                      <span className="num text-gold-700">{p.ref}</span> — {p.title}
                    </span>
                    <span className="num text-sm text-muted">{fmtPrice(p.price, 'ar', p.purpose === 'rent')}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </Card>
        )}

        <Card title="السجل" bodyClass="p-0">
          <ul className="divide-y divide-line text-sm">
            {[
              ...myAppts.map((a) => ({ at: a.starts_at, node: <><Pill color={APPT_KIND[a.kind].color}>{APPT_KIND[a.kind].label}</Pill> <span className="text-navy">{a.title}</span> <Pill color={APPT_STATUS[a.status].color}>{APPT_STATUS[a.status].label}</Pill></> })),
              ...myLeads.map((l) => ({ at: l.created_at, node: <><Pill color={LEAD_STATUS[l.status].color}>طلب · {LEAD_STATUS[l.status].label}</Pill> <span className="text-muted">{l.message?.slice(0, 80) ?? l.property_ref ?? ''}</span></> })),
              ...myCalls.map((x) => ({ at: x.created_at, node: <><Pill color="#475569">{x.direction === 'in' ? 'مكالمة واردة' : 'مكالمة صادرة'}</Pill> <span className="text-navy">{x.subject}</span>{x.outcome && <span className="text-muted"> — {x.outcome}</span>}</> })),
            ]
              .sort((a, b) => b.at.localeCompare(a.at))
              .map((e, i) => (
                <li key={i} className="flex flex-wrap items-center gap-2 px-4 py-3">
                  <span className="num w-[118px] shrink-0 text-xs text-subtle">{fmtDateTime(e.at)}</span>
                  {e.node}
                </li>
              ))}
            {myAppts.length + myLeads.length + myCalls.length === 0 && <li className="px-4 py-6 text-center text-muted">لا يوجد سجل بعد</li>}
          </ul>
        </Card>
      </div>
    </Drawer>
  )
}
