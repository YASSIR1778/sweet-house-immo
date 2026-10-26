import { Landmark, Receipt, Save, Wallet } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'
import { billingMissing } from '@/shared/lib/billing'
import { useBilling, useSaveBilling } from '@/shared/lib/data'
import { logActivity } from '@/shared/lib/repo'
import type { BillingSettings } from '@/shared/lib/types'
import { Button, Field, Input, Switch } from '@/shared/ui/base'
import { errorText, useMe } from '../hooks'
import { Card } from '../ui'

/** Legal identity, VAT and bank details printed on invoices and receipts. */
export function BillingTab() {
  const { data } = useBilling()
  return <BillingForm key={JSON.stringify(data)} value={data as BillingSettings} />
}

function BillingForm({ value }: { value: BillingSettings }) {
  const me = useMe()
  const save = useSaveBilling()
  const [f, setF] = useState(value)
  const set = <K extends keyof BillingSettings>(k: K, v: BillingSettings[K]) => setF((x) => ({ ...x, [k]: v }))
  const missing = billingMissing(f)

  const submit = async () => {
    if (f.ice && f.ice.replace(/\D/g, '').length !== 15) return toast.error('رقم ICE يتكون من 15 رقماً')
    if (f.vat_rate < 0 || f.vat_rate > 30) return toast.error('نسبة الضريبة غير صحيحة')
    try {
      await save.mutateAsync({ ...f, ice: f.ice.replace(/\D/g, '') })
      void logActivity(me, 'update', 'settings', 'billing', { title: 'معلومات الفوترة' })
      toast.success('تم حفظ معلومات الفوترة. تظهر في كل فاتورة ووصل جديد.')
    } catch (e) {
      toast.error(errorText(e))
    }
  }

  return (
    <>
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <Card title="الهوية القانونية للوكالة" icon={<Landmark className="size-4" />}>
          <p className="mb-4 text-sm text-muted">
            تُطبع على كل فاتورة ووصل. تفرض المادة 145 من المدونة العامة للضرائب ذكر الاسم التجاري والعنوان ورقم السجل التجاري والتعريف الضريبي ورقم الرسم المهني والتعريف الموحد للمقاولة (ICE).
          </p>
          {missing.length > 0 && <p className="mb-4 rounded-xl bg-warning/10 p-3 text-xs font-semibold text-warning">ناقص: {missing.join('، ')}</p>}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="الاسم التجاري (Raison sociale)" className="sm:col-span-2">
              <Input dir="ltr" value={f.company} onChange={(e) => set('company', e.target.value)} placeholder="Sweet House Immobilier SARL" />
            </Field>
            <Field label="الشكل القانوني" hint="SARL، SARL AU، شخص ذاتي…">
              <Input dir="ltr" value={f.legal_form} onChange={(e) => set('legal_form', e.target.value)} />
            </Field>
            <Field label="رأس المال" hint="للشركات">
              <Input dir="ltr" value={f.capital} onChange={(e) => set('capital', e.target.value)} placeholder="100 000 DH" />
            </Field>
            <Field label="العنوان (كما في السجل التجاري)" className="sm:col-span-2">
              <Input dir="ltr" value={f.address} onChange={(e) => set('address', e.target.value)} />
            </Field>
            <Field label="المدينة" hint="تُكتب في الوصولات: «حُرر بـ…»">
              <Input dir="ltr" value={f.city} onChange={(e) => set('city', e.target.value)} />
            </Field>
            <Field label="السجل التجاري (RC)">
              <Input dir="ltr" className="num" value={f.rc} onChange={(e) => set('rc', e.target.value)} />
            </Field>
            <Field label="التعريف الضريبي (IF)">
              <Input dir="ltr" className="num" value={f.fiscal_id} onChange={(e) => set('fiscal_id', e.target.value)} />
            </Field>
            <Field label="التعريف الموحد للمقاولة (ICE)" hint="15 رقماً">
              <Input dir="ltr" className="num" inputMode="numeric" maxLength={15} value={f.ice} onChange={(e) => set('ice', e.target.value.replace(/\D/g, ''))} />
            </Field>
            <Field label="الرسم المهني (TP / Patente)">
              <Input dir="ltr" className="num" value={f.tp} onChange={(e) => set('tp', e.target.value)} />
            </Field>
            <Field label="الضمان الاجتماعي (CNSS)" hint="اختياري">
              <Input dir="ltr" className="num" value={f.cnss} onChange={(e) => set('cnss', e.target.value)} />
            </Field>
          </div>
        </Card>
        <div className="space-y-6">
          <Card title="الضريبة على القيمة المضافة" icon={<Receipt className="size-4" />}>
            <Switch checked={f.vat_rate > 0} onChange={(on) => set('vat_rate', on ? 20 : 0)} label="الوكالة تفوتر بالضريبة على القيمة المضافة" />
            {f.vat_rate > 0 && (
              <Field label="المعدل" hint="المعدل العادي للخدمات 20%" className="mt-4 max-w-40">
                <div className="relative">
                  <Input type="number" min={0} max={30} dir="ltr" className="num pe-10" value={f.vat_rate} onChange={(e) => set('vat_rate', Number(e.target.value) || 0)} />
                  <span className="pointer-events-none absolute inset-y-0 end-3 flex items-center text-xs text-muted">%</span>
                </div>
              </Field>
            )}
            <p className="mt-4 text-xs leading-relaxed text-muted">
              العمولة المسجلة في كل صفقة هي ما يؤديه الطرف فعلاً: الفاتورة تقسمها إلى مبلغ دون ضريبة + الضريبة. إن كانت الوكالة غير خاضعة (معفاة أو مقاولاً ذاتياً)، أطفئ هذا الخيار فتُطبع على الفاتورة عبارة «TVA non applicable». الحسم في وضعكم الضريبي يعود لمحاسبكم.
            </p>
          </Card>
          <Card title="الأداء" icon={<Wallet className="size-4" />}>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label="البنك">
                <Input dir="ltr" value={f.bank} onChange={(e) => set('bank', e.target.value)} />
              </Field>
              <Field label="رقم الحساب البنكي (RIB)" hint="24 رقماً، يُطبع لأداء الفواتير بالتحويل">
                <Input dir="ltr" className="num" value={f.rib} onChange={(e) => set('rib', e.target.value)} />
              </Field>
              <Field label="أجل الأداء بالأيام" hint="0 = عند التوصل. حسب القانون 69.21: 60 يوماً إن لم يُتفق على غيره، و120 كحد أقصى">
                <Input type="number" min={0} max={120} dir="ltr" className="num" value={f.payment_days} onChange={(e) => set('payment_days', Math.max(0, Math.min(120, Number(e.target.value) || 0)))} />
              </Field>
              <Field label="سطر إضافي أسفل الفاتورة" hint="اختياري" className="sm:col-span-2">
                <Input dir="ltr" value={f.footer} onChange={(e) => set('footer', e.target.value)} placeholder="Merci pour votre confiance." />
              </Field>
            </div>
          </Card>
        </div>
      </div>
      <div className="sticky bottom-4 z-10 mt-6 flex justify-end">
        <Button variant="gold" size="lg" loading={save.isPending} onClick={() => void submit()} icon={<Save className="size-4" />} className="shadow-pop">
          حفظ معلومات الفوترة
        </Button>
      </div>
    </>
  )
}
