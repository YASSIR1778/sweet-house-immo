import { CalendarPlus, ClipboardPlus, ExternalLink, Inbox, KanbanSquare, List, Plus, Trash2, UserCheck, UserPlus } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router'
import { useTable } from '@/shared/lib/data'
import { fmtDate, fmtDateTime, fmtNumber, fmtPrice, fmtRelative, nowIso } from '@/shared/lib/format'
import type { Lead, LeadKind, LeadSource, LeadStatus } from '@/shared/lib/types'
import { Button, Drawer, Field, Segmented, Select, Textarea, cn } from '@/shared/ui/base'
import { StaffSelect, useQuickAdd } from '../dialogs'
import { useCan, useDeleteRow, useLookups, useMe, useNames, useSave } from '../hooks'
import { LANG_LABEL, LEAD_KIND, LEAD_STATUS, LEAD_STATUS_ORDER, PURPOSE, SOURCE } from '../labels'
import { leadReply } from '../templates'
import { Avatar, PageHeader, PhoneLinks, Pill, SearchBox } from '../ui'

export function Leads() {
  const me = useMe()
  const quick = useQuickAdd()
  const L = useLookups()
  const [sp, setSp] = useSearchParams()
  const { data: leads = [], isLoading } = useTable<Lead>('leads', { refetchInterval: 60_000 })
  const [view, setView] = useState<'board' | 'list'>(() => (typeof window !== 'undefined' && window.innerWidth < 900 ? 'list' : 'board'))
  const [q, setQ] = useState('')
  const [kind, setKind] = useState<'' | LeadKind>('')
  const [source, setSource] = useState<'' | LeadSource>('')
  const [mine, setMine] = useState(false)
  const [dragId, setDragId] = useState<string | null>(null)
  const [overCol, setOverCol] = useState<LeadStatus | null>(null)
  const { save } = useSave<Lead>('leads', 'lead', (l) => l.name)

  const openId = sp.get('open')
  const open = leads.find((l) => l.id === openId) ?? null
  const setOpen = (id: string | null) => {
    const n = new URLSearchParams(sp)
    if (id) n.set('open', id)
    else n.delete('open')
    setSp(n, { replace: true })
  }

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase()
    return leads
      .filter(
        (l) =>
          (!kind || l.kind === kind) &&
          (!source || l.source === source) &&
          (!mine || l.assigned_to === me.id) &&
          (!term || `${l.name} ${l.phone} ${l.email ?? ''} ${l.property_ref ?? ''} ${l.message ?? ''}`.toLowerCase().includes(term)),
      )
      .sort((a, b) => b.created_at.localeCompare(a.created_at))
  }, [leads, q, kind, source, mine, me.id])

  const move = (l: Lead, status: LeadStatus) => {
    if (l.status === status) return
    void save({ ...l, status, assigned_to: l.assigned_to ?? me.id, updated_at: nowIso() }, { action: 'status', meta: { status }, message: `«${l.name}» ← ${LEAD_STATUS[status].label}` })
  }

  return (
    <>
      <PageHeader
        title="الطلبات"
        subtitle={`${leads.filter((l) => l.status === 'new').length} طلب جديد · ${leads.length} في المجموع — من الموقع، الهاتف، واتساب والشبكات`}
        icon={<Inbox className="size-6" />}
        actions={
          <Button variant="gold" onClick={() => quick('lead')} icon={<Plus className="size-4" />}>
            طلب جديد
          </Button>
        }
      />

      <div className="card mb-4 flex flex-wrap items-center gap-2 p-3">
        <SearchBox value={q} onChange={setQ} placeholder="الاسم، الهاتف، المرجع…" className="min-w-[200px] flex-1" />
        <Select value={kind} onChange={(e) => setKind(e.target.value as '' | LeadKind)} className="h-10 w-auto py-1 text-sm">
          <option value="">كل الأنواع</option>
          {(Object.keys(LEAD_KIND) as LeadKind[]).map((k) => (
            <option key={k} value={k}>
              {LEAD_KIND[k].label}
            </option>
          ))}
        </Select>
        <Select value={source} onChange={(e) => setSource(e.target.value as '' | LeadSource)} className="h-10 w-auto py-1 text-sm">
          <option value="">كل المصادر</option>
          {(Object.keys(SOURCE) as LeadSource[]).map((k) => (
            <option key={k} value={k}>
              {SOURCE[k].label}
            </option>
          ))}
        </Select>
        <Segmented
          value={mine ? 'mine' : 'all'}
          onChange={(v) => setMine(v === 'mine')}
          options={[
            { value: 'all', label: 'الكل' },
            { value: 'mine', label: 'المكلف بها أنا' },
          ]}
        />
        <Segmented
          value={view}
          onChange={setView}
          options={[
            { value: 'board', label: '', icon: <KanbanSquare className="size-4" /> },
            { value: 'list', label: '', icon: <List className="size-4" /> },
          ]}
        />
      </div>

      {isLoading ? (
        <div className="skeleton h-80 rounded-2xl" />
      ) : view === 'board' ? (
        <div className="no-scrollbar -mx-4 grid auto-cols-[minmax(270px,1fr)] grid-flow-col gap-4 overflow-x-auto px-4 pb-4 md:mx-0 md:px-0">
          {LEAD_STATUS_ORDER.map((st) => {
            const col = filtered.filter((l) => l.status === st)
            return (
              <section
                key={st}
                onDragOver={(e) => {
                  e.preventDefault()
                  setOverCol(st)
                }}
                onDragLeave={() => setOverCol((c) => (c === st ? null : c))}
                onDrop={(e) => {
                  e.preventDefault()
                  const l = leads.find((x) => x.id === (dragId ?? e.dataTransfer.getData('text/plain')))
                  if (l) move(l, st)
                  setDragId(null)
                  setOverCol(null)
                }}
                className={cn('flex min-h-[420px] flex-col rounded-2xl border bg-[#ebe8df]/60 transition', overCol === st ? 'border-gold bg-gold/10' : 'border-transparent')}
              >
                <header className="flex items-center justify-between px-3.5 pt-3 pb-2">
                  <span className="flex items-center gap-2 text-sm font-bold text-navy">
                    <span className="size-2.5 rounded-full" style={{ background: LEAD_STATUS[st].color }} />
                    {LEAD_STATUS[st].label}
                  </span>
                  <span className="num rounded-full bg-white px-2 py-0.5 text-xs font-bold text-muted">{col.length}</span>
                </header>
                <div className="flex-1 space-y-2.5 px-2.5 pb-3">
                  {col.map((l) => (
                    <article
                      key={l.id}
                      draggable
                      onDragStart={(e) => {
                        setDragId(l.id)
                        e.dataTransfer.setData('text/plain', l.id)
                        e.dataTransfer.effectAllowed = 'move'
                      }}
                      onDragEnd={() => setDragId(null)}
                      onClick={() => setOpen(l.id)}
                      className={cn('cursor-pointer rounded-xl border border-line bg-white p-3 shadow-soft transition hover:-translate-y-0.5 hover:shadow-card', dragId === l.id && 'opacity-50')}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <div className="truncate font-bold text-navy">{l.name}</div>
                          <div className="num text-xs text-muted" dir="ltr">
                            {l.phone}
                          </div>
                        </div>
                        {l.assigned_to && <Avatar name={L.staffName(l.assigned_to)} size="sm" />}
                      </div>
                      <div className="mt-2 flex flex-wrap items-center gap-1.5">
                        <Pill color={LEAD_KIND[l.kind].color}>{LEAD_KIND[l.kind].label}</Pill>
                        {l.property_ref && <span className="num rounded-full bg-gold/15 px-2 py-0.5 text-[11px] font-bold text-gold-700">{l.property_ref}</span>}
                      </div>
                      {l.message && <p className="mt-2 line-clamp-2 text-xs leading-relaxed text-muted">{l.message}</p>}
                      <div className="mt-2 flex items-center justify-between text-[11px] text-subtle">
                        <span style={{ color: SOURCE[l.source].color }} className="font-semibold">
                          {SOURCE[l.source].label}
                        </span>
                        <span className={cn(l.status === 'new' && Date.now() - new Date(l.created_at).getTime() > 864e5 && 'font-bold text-danger')}>{fmtRelative(l.created_at)}</span>
                      </div>
                    </article>
                  ))}
                  {col.length === 0 && <div className="rounded-xl border border-dashed border-line-2 py-8 text-center text-xs text-subtle">اسحب طلباً إلى هنا</div>}
                </div>
              </section>
            )
          })}
        </div>
      ) : (
        <div className="card overflow-x-auto">
          <table className="table">
            <thead>
              <tr>
                <th>الاسم</th>
                <th>الطلب</th>
                <th>العقار</th>
                <th>المصدر</th>
                <th>الحالة</th>
                <th>المكلف</th>
                <th>التاريخ</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((l) => (
                <tr key={l.id} className="cursor-pointer" onClick={() => setOpen(l.id)}>
                  <td>
                    <div className="font-semibold text-navy">{l.name}</div>
                    <div className="num text-xs text-muted" dir="ltr">
                      {l.phone}
                    </div>
                  </td>
                  <td>
                    <Pill color={LEAD_KIND[l.kind].color}>{LEAD_KIND[l.kind].label}</Pill>
                  </td>
                  <td className="num font-semibold text-gold-700">{l.property_ref ?? '—'}</td>
                  <td>
                    <span className="text-sm" style={{ color: SOURCE[l.source].color }}>
                      {SOURCE[l.source].label}
                    </span>
                  </td>
                  <td>
                    <Pill color={LEAD_STATUS[l.status].color} dot>
                      {LEAD_STATUS[l.status].label}
                    </Pill>
                  </td>
                  <td className="text-sm text-muted">{L.staffName(l.assigned_to)}</td>
                  <td className="text-xs whitespace-nowrap text-muted">{fmtDateTime(l.created_at)}</td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={7} className="py-10 text-center text-muted">
                    لا توجد طلبات
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {open && <LeadDrawer lead={open} onClose={() => setOpen(null)} />}
    </>
  )
}

function LeadDrawer({ lead, onClose }: { lead: Lead; onClose: () => void }) {
  const me = useMe()
  const can = useCan()
  const quick = useQuickAdd()
  const L = useLookups()
  const { s, hoodName, typeName } = useNames()
  const { save, pending } = useSave<Lead>('leads', 'lead', (l) => l.name)
  const del = useDeleteRow('leads', 'lead')
  const [notes, setNotes] = useState(lead.notes ?? '')
  useEffect(() => setNotes(lead.notes ?? ''), [lead.id, lead.notes])
  const p = L.property(lead.property_id) ?? L.properties.find((x) => x.ref === lead.property_ref)
  const client = L.client(lead.client_id) ?? L.clientByPhone(lead.phone)
  const meta = (lead.meta ?? {}) as Record<string, unknown>

  const update = (patch: Partial<Lead>, opts?: Parameters<typeof save>[1]) => save({ ...lead, ...patch, updated_at: nowIso() }, opts)

  const toClient = () => {
    if (client) {
      void update({ client_id: client.id }, { message: `رُبط الطلب بملف ${client.full_name}` })
      return
    }
    const purpose = p?.purpose ?? (meta.purpose === 'rent' ? 'rent' : 'sale')
    quick(
      'client',
      {
        full_name: lead.name,
        phone: lead.phone,
        email: lead.email,
        lang: lead.lang,
        source: lead.source,
        kind: lead.kind === 'sell' || lead.kind === 'valuation' ? 'owner' : purpose === 'rent' ? 'tenant' : 'buyer',
        wants_purpose: lead.kind === 'sell' || lead.kind === 'valuation' ? null : purpose,
        wants_types: p ? [p.type] : [],
        wants_neighborhoods: p ? [p.neighborhood] : [],
        notes: lead.message,
      },
      (c) => void update({ client_id: (c as { id: string }).id }, { silent: true }),
    )
  }

  return (
    <Drawer
      open
      onClose={onClose}
      title={
        <span className="flex items-center gap-2">
          {lead.name}
          <Pill color={LEAD_STATUS[lead.status].color} dot>
            {LEAD_STATUS[lead.status].label}
          </Pill>
        </span>
      }
      footer={
        can('delete') ? (
          <Button
            variant="ghost"
            className="me-auto text-danger"
            icon={<Trash2 className="size-4" />}
            onClick={async () => {
              if (await del(lead.id, lead.name)) onClose()
            }}
          >
            حذف الطلب
          </Button>
        ) : undefined
      }
    >
      <div className="space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-ivory p-4">
          <PhoneLinks phone={lead.phone} waText={leadReply(lead, p, s, me.name)} />
          {lead.email && (
            <a href={`mailto:${lead.email}`} className="text-sm text-teal hover:underline" dir="ltr">
              {lead.email}
            </a>
          )}
        </div>

        <div>
          <span className="label">نقل إلى مرحلة</span>
          <div className="grid grid-cols-3 gap-1.5">
            {LEAD_STATUS_ORDER.map((st) => (
              <button
                key={st}
                onClick={() => void update({ status: st, assigned_to: lead.assigned_to ?? me.id }, { action: 'status', meta: { status: st }, message: `الحالة: ${LEAD_STATUS[st].label}` })}
                className={cn('rounded-xl border px-2 py-2 text-xs font-bold transition', lead.status === st ? 'text-white' : 'border-line bg-white text-navy hover:border-line-2')}
                style={lead.status === st ? { background: LEAD_STATUS[st].color, borderColor: LEAD_STATUS[st].color } : undefined}
              >
                {LEAD_STATUS[st].label}
              </button>
            ))}
          </div>
        </div>

        <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
          <div>
            <dt className="text-xs text-muted">نوع الطلب</dt>
            <dd className="mt-0.5">
              <Pill color={LEAD_KIND[lead.kind].color}>{LEAD_KIND[lead.kind].label}</Pill>
            </dd>
          </div>
          <div>
            <dt className="text-xs text-muted">المصدر</dt>
            <dd className="mt-0.5 font-semibold" style={{ color: SOURCE[lead.source].color }}>
              {SOURCE[lead.source].label}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-muted">تاريخ الطلب</dt>
            <dd className="mt-0.5 text-navy">{fmtDateTime(lead.created_at)}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted">لغة التواصل</dt>
            <dd className="mt-0.5 text-navy">{LANG_LABEL[lead.lang] ?? lead.lang}</dd>
          </div>
          {lead.preferred_at && (
            <div className="col-span-2 rounded-xl bg-teal-50 px-3 py-2 text-teal-700">
              <dt className="text-xs">الموعد المفضل للزيارة</dt>
              <dd className="font-bold">{fmtDate(lead.preferred_at, 'ar', { weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' })}</dd>
            </div>
          )}
        </dl>

        {p && (
          <div className="flex items-center gap-3 rounded-2xl border border-line p-3">
            {p.images[0] ? <img src={p.images[0]} alt="" className="size-16 shrink-0 rounded-xl object-cover" /> : <span className="size-16 shrink-0 rounded-xl bg-sand" />}
            <div className="min-w-0 flex-1">
              <div className="num text-xs font-bold text-gold-700">{p.ref}</div>
              <Link to={`/admin/properties/${p.id}`} className="line-clamp-1 font-semibold text-navy hover:underline">
                {p.title}
              </Link>
              <div className="num text-sm text-muted">
                {fmtPrice(p.price, 'ar', p.purpose === 'rent')} · {hoodName(p.neighborhood)}
              </div>
            </div>
            {p.published && (
              <a href={`${import.meta.env.BASE_URL}biens/${p.ref}`} target="_blank" rel="noopener noreferrer" className="rounded-full p-2 text-muted hover:bg-sand" title="عرض في الموقع">
                <ExternalLink className="size-4" />
              </a>
            )}
          </div>
        )}

        {lead.message && (
          <div>
            <span className="label">رسالة العميل</span>
            <blockquote className="rounded-2xl border-s-4 border-gold bg-ivory px-4 py-3 text-sm leading-relaxed whitespace-pre-line text-text">{lead.message}</blockquote>
          </div>
        )}

        {(lead.kind === 'sell' || lead.kind === 'valuation') && Object.keys(meta).length > 0 && (
          <div className="rounded-2xl border border-line p-4 text-sm">
            <span className="label">تفاصيل العقار المعروض</span>
            <ul className="grid grid-cols-2 gap-2">
              {typeof meta.purpose === 'string' && <li>الغرض: <b>{meta.purpose === 'valuation' ? 'تقييم فقط' : PURPOSE[meta.purpose as 'sale' | 'rent']?.label}</b></li>}
              {typeof meta.type === 'string' && <li>النوع: <b>{typeName(meta.type as never)}</b></li>}
              {typeof meta.neighborhood === 'string' && meta.neighborhood && <li>الحي: <b>{hoodName(meta.neighborhood)}</b></li>}
              {typeof meta.area === 'number' && <li>المساحة: <b className="num">{meta.area} م²</b></li>}
              {typeof meta.price === 'number' && <li>الثمن المطلوب: <b className="num">{fmtNumber(meta.price)} د.م.</b></li>}
            </ul>
          </div>
        )}
        {meta.alert === true && <p className="rounded-xl bg-gold/10 px-3 py-2 text-xs text-gold-700">طلب تنبيه: يريد أن نخبره عند توفر عقار يناسب بحثه.</p>}

        <Field label="المكلف بالطلب">
          <StaffSelect value={lead.assigned_to} onChange={(v) => void update({ assigned_to: v }, { message: 'تم تعيين المكلف' })} />
        </Field>

        <Field label="ملاحظات الفريق (داخلية)">
          <Textarea rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="ما الذي تم؟ ما الخطوة التالية؟" />
        </Field>
        {notes !== (lead.notes ?? '') && (
          <Button size="sm" loading={pending} onClick={() => void update({ notes: notes || null })}>
            حفظ الملاحظات
          </Button>
        )}

        <div className="grid grid-cols-2 gap-2 border-t border-line pt-5">
          <Button
            variant="gold"
            icon={<CalendarPlus className="size-4" />}
            onClick={() =>
              quick('appointment', { kind: 'visit', property_id: p?.id ?? null, client_id: client?.id ?? null, lead_id: lead.id, notes: lead.message }, (row) => {
                const appt = row as { client_id: string | null }
                const patch: Partial<Lead> = {}
                if (lead.status === 'new' || lead.status === 'contacted') patch.status = 'visit'
                if (!lead.client_id && appt.client_id) patch.client_id = appt.client_id
                if (Object.keys(patch).length) void update({ ...patch, assigned_to: lead.assigned_to ?? me.id }, { action: 'status', silent: true, meta: { status: patch.status ?? lead.status } })
              })
            }
          >
            جدولة زيارة
          </Button>
          <Button variant="outline" icon={client ? <UserCheck className="size-4" /> : <UserPlus className="size-4" />} onClick={toClient}>
            {client ? (lead.client_id ? 'مرتبط بعميل' : 'ربط بالعميل') : 'تحويل إلى عميل'}
          </Button>
          <Button variant="outline" icon={<ClipboardPlus className="size-4" />} onClick={() => quick('task', { title: `متابعة ${lead.name}`, related_type: 'lead', related_id: lead.id, assigned_to: lead.assigned_to ?? me.id })}>
            مهمة متابعة
          </Button>
          {client && (
            <Link to={`/admin/clients?open=${client.id}`} className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-navy/25 text-sm font-semibold text-navy hover:bg-navy/5">
              ملف العميل
            </Link>
          )}
        </div>
      </div>
    </Drawer>
  )
}
