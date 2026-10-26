import { BadgeDollarSign, HandCoins, Plus, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'
import { useTable } from '@/shared/lib/data'
import { fmtDate, fmtNumber, fmtPrice, localDate, nowIso, pick, uid, waLink } from '@/shared/lib/format'
import { offerMessage } from '@/shared/lib/owners'
import type { Financing, Offer, OfferStatus, Property } from '@/shared/lib/types'
import { Button, Field, Input, Modal, Segmented, Select, Switch, Textarea } from '@/shared/ui/base'
import { WhatsAppIcon } from '@/shared/ui/icons'
import { useClientOptions, usePropertyOptions, useQuickAdd } from './dialogs'
import { useCan, useDeleteRow, useLookups, useMe, useNames, useSave } from './hooks'
import { FINANCING, OFFER_STATUS } from './labels'
import { Card, Combo, Pill } from './ui'

const num = (v: string) => (v.trim() === '' || Number.isNaN(Number(v)) ? null : Number(v))
export const OPEN_OFFER: OfferStatus[] = ['pending', 'countered']

/** % of the asking price, e.g. «92%». */
export function pctOf(amount: number, price: number): string {
  return price ? `${Math.round((amount / price) * 1000) / 10}%` : '—'
}

/* ------------------------------------------------------------------ */
/* Record / follow an offer                                             */
/* ------------------------------------------------------------------ */
export function OfferDialog({ initial = {}, onClose, onSaved }: { initial?: Partial<Offer>; onClose: () => void; onSaved?: (o: Offer) => void }) {
  const me = useMe()
  const can = useCan()
  const L = useLookups()
  const { s } = useNames()
  const quick = useQuickAdd()
  const propertyOptions = usePropertyOptions()
  const clientOptions = useClientOptions()
  const isNew = !initial.id
  const [f, setF] = useState<Offer>({
    id: uid(),
    property_id: '',
    client_id: null,
    amount: 0,
    financing: 'cash',
    conditions: null,
    status: 'pending',
    counter_amount: null,
    valid_until: null,
    notes: null,
    created_by: me.id,
    created_at: nowIso(),
    updated_at: nowIso(),
    ...initial,
  } as Offer)
  const [reserve, setReserve] = useState(true)
  const set = <K extends keyof Offer>(k: K, v: Offer[K]) => setF((x) => ({ ...x, [k]: v }))
  const { save, pending } = useSave<Offer>('offers', 'offer', (o) => `${L.property(o.property_id)?.ref ?? ''} · ${fmtNumber(o.amount)} د.م.`)
  const saveProp = useSave<Property>('properties', 'property', (p) => p.ref)
  const del = useDeleteRow('offers', 'offer')
  const p = L.property(f.property_id)
  const owner = L.client(p?.owner_client_id)
  const client = L.client(f.client_id)

  const submit = async () => {
    if (!f.property_id) return toast.error('اختر العقار')
    if (!f.amount || f.amount <= 0) return toast.error('اكتب مبلغ العرض')
    const saved = await save({ ...f, updated_at: nowIso() }, { isNew, message: isNew ? 'تم تسجيل العرض' : undefined })
    if (!saved) return
    if (saved.status === 'accepted' && reserve && p && p.status === 'available' && can('properties')) {
      await saveProp.save({ ...p, status: 'reserved', updated_at: nowIso() }, { action: 'status', meta: { status: 'reserved' }, message: `${p.ref}: محجوز` })
    }
    onSaved?.(saved)
    onClose()
  }

  const tellOwner = () => {
    if (!p || !owner) return
    window.open(waLink(owner.whatsapp || owner.phone, offerMessage(f, p, owner, pick(s.agency.name, owner.lang), (n) => fmtPrice(n, owner.lang))), '_blank', 'noopener')
  }
  const tellClient = () => {
    if (!client || !p || f.counter_amount == null) return
    const text = `السلام عليكم ${client.full_name.split(' ')[0]}، بخصوص عرضكم على العقار ${p.ref}: يقترح المالك ${fmtPrice(f.counter_amount, 'ar')}. هل يناسبكم؟`
    window.open(waLink(client.whatsapp || client.phone, text), '_blank', 'noopener')
  }

  return (
    <Modal
      open
      onClose={onClose}
      size="lg"
      title={isNew ? 'عرض جديد' : `العرض على ${p?.ref ?? ''}`}
      footer={
        <>
          {!isNew && can('delete') && (
            <Button
              variant="ghost"
              className="me-auto text-danger"
              icon={<Trash2 className="size-4" />}
              onClick={async () => {
                if (await del(f.id, 'العرض')) onClose()
              }}
            >
              حذف
            </Button>
          )}
          <Button variant="ghost" onClick={onClose}>
            إلغاء
          </Button>
          <Button loading={pending} onClick={() => void submit()}>
            {isNew ? 'تسجيل العرض' : 'حفظ'}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="العقار" required>
            <Combo value={f.property_id || null} onChange={(v) => set('property_id', v ?? '')} options={propertyOptions} placeholder="اختر العقار" />
          </Field>
          <Field label="صاحب العرض">
            <Combo value={f.client_id} onChange={(v) => set('client_id', v)} options={clientOptions} placeholder="اختر من العملاء" />
          </Field>
          <Field label="مبلغ العرض" hint={p && f.amount ? `${pctOf(f.amount, p.price)} من الثمن المعروض ${fmtPrice(p.price, 'ar', p.purpose === 'rent')}` : undefined}>
            <Input type="number" inputMode="numeric" dir="ltr" className="num" value={f.amount || ''} onChange={(e) => set('amount', num(e.target.value) ?? 0)} />
          </Field>
          <Field label="طريقة الأداء">
            <Segmented value={f.financing} onChange={(v) => set('financing', v)} options={(Object.keys(FINANCING) as Financing[]).map((k) => ({ value: k, label: FINANCING[k] }))} className="flex w-full [&>button]:flex-1" />
          </Field>
          <Field label="الشروط" className="sm:col-span-2">
            <Input value={f.conditions ?? ''} onChange={(e) => set('conditions', e.target.value || null)} placeholder="مثلاً: بشرط موافقة البنك، أو تسليم المفاتيح في يناير" />
          </Field>
          <Field label="صالح حتى">
            <Input type="date" dir="ltr" className="num" min={localDate(new Date())} value={f.valid_until ?? ''} onChange={(e) => set('valid_until', e.target.value || null)} />
          </Field>
          <Field label="الحالة">
            <Select value={f.status} onChange={(e) => set('status', e.target.value as OfferStatus)}>
              {(Object.keys(OFFER_STATUS) as OfferStatus[]).map((k) => (
                <option key={k} value={k}>
                  {OFFER_STATUS[k].label}
                </option>
              ))}
            </Select>
          </Field>
          {f.status === 'countered' && (
            <Field label="العرض المضاد من المالك" hint={p && f.counter_amount ? `${pctOf(f.counter_amount, p.price)} من الثمن المعروض` : undefined}>
              <Input type="number" inputMode="numeric" dir="ltr" className="num" value={f.counter_amount ?? ''} onChange={(e) => set('counter_amount', num(e.target.value))} />
            </Field>
          )}
          <Field label="ملاحظات" className="sm:col-span-2">
            <Textarea rows={2} value={f.notes ?? ''} onChange={(e) => set('notes', e.target.value || null)} />
          </Field>
        </div>
        {f.status === 'accepted' && p?.status === 'available' && can('properties') && <Switch checked={reserve} onChange={setReserve} label={`تحويل ${p.ref} إلى «محجوز»`} />}
        <div className="flex flex-wrap gap-2">
          {owner && p && f.amount > 0 && (
            <Button variant="whatsapp" size="sm" icon={<WhatsAppIcon className="size-4" />} onClick={tellOwner}>
              إخبار المالك {owner.full_name.split(' ')[0]}
            </Button>
          )}
          {client && f.status === 'countered' && f.counter_amount != null && (
            <Button variant="outline" size="sm" icon={<WhatsAppIcon className="size-4" />} onClick={tellClient}>
              إرسال العرض المضاد للزبون
            </Button>
          )}
          {!isNew && f.status === 'accepted' && can('deals') && p && (
            <Button
              variant="gold"
              size="sm"
              icon={<BadgeDollarSign className="size-4" />}
              onClick={() => {
                onClose()
                quick('deal', { property_id: p.id, client_id: f.client_id, kind: p.purpose, amount: f.amount, stage: 'agreement' })
              }}
            >
              فتح ملف الصفقة
            </Button>
          )}
        </div>
        {!owner && p && <p className="text-xs text-muted">لإخبار المالك بالواتساب، اختر مالك العقار في صفحة العقار.</p>}
      </div>
    </Modal>
  )
}

/* ------------------------------------------------------------------ */
/* Offers of a property or of a client                                  */
/* ------------------------------------------------------------------ */
export function OffersCard({ propertyId, clientId, title = 'العروض' }: { propertyId?: string; clientId?: string; title?: string }) {
  const quick = useQuickAdd()
  const L = useLookups()
  const { data: offers = [] } = useTable<Offer>('offers')
  const list = offers.filter((o) => (propertyId ? o.property_id === propertyId : o.client_id === clientId)).sort((a, b) => b.amount - a.amount || b.created_at.localeCompare(a.created_at))
  const best = list.filter((o) => o.status !== 'withdrawn' && o.status !== 'rejected')[0]
  return (
    <Card
      title={
        <span className="inline-flex items-center gap-2">
          {title} <span className="num text-xs font-normal text-muted">({list.length})</span>
        </span>
      }
      icon={<HandCoins className="size-4" />}
      bodyClass="p-0"
      action={
        <Button size="sm" variant="outline" icon={<Plus className="size-4" />} onClick={() => quick('offer', { property_id: propertyId ?? '', client_id: clientId ?? null })}>
          عرض
        </Button>
      }
    >
      {list.length === 0 ? (
        <p className="p-4 text-sm text-muted">لا توجد عروض بعد. سجّل كل عرض يصلك، حتى المنخفض، لتتابع التفاوض وتُخبر المالك.</p>
      ) : (
        <ul className="divide-y divide-line">
          {list.map((o) => {
            const p = L.property(o.property_id)
            return (
              <li key={o.id}>
                <button type="button" onClick={() => quick('offer', o)} className="flex w-full items-center gap-3 px-4 py-2.5 text-start hover:bg-ivory">
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-semibold text-navy">
                      <span className="num">{fmtPrice(o.amount, 'ar', p?.purpose === 'rent')}</span>
                      {p && <span className="num ms-2 text-xs text-muted">{pctOf(o.amount, p.price)}</span>}
                      {best?.id === o.id && <span className="ms-2 text-xs font-bold text-gold-700">الأعلى</span>}
                    </span>
                    <span className="block truncate text-xs text-muted">
                      {propertyId ? L.client(o.client_id)?.full_name ?? 'بدون اسم' : p ? `${p.ref} · ${p.title}` : '—'} · {FINANCING[o.financing]} · {fmtDate(o.created_at)}
                    </span>
                  </span>
                  <Pill color={OFFER_STATUS[o.status].color}>{OFFER_STATUS[o.status].label}</Pill>
                </button>
              </li>
            )
          })}
        </ul>
      )}
    </Card>
  )
}
