import { useQueryClient } from '@tanstack/react-query'
import { ArrowDown, ArrowUp, Building, Database, Download, FileText, Globe, Handshake, Landmark, MapPinned, MessageSquareQuote, Plus, Receipt, RotateCcw, Save, Settings as SettingsIcon, Trash2, Upload } from 'lucide-react'
import { useRef, useState } from 'react'
import { useSearchParams } from 'react-router'
import { toast } from 'sonner'
import { useSaveSettings, useSettings, useTable } from '@/shared/lib/data'
import { download, fmtNumber, slugify, toCsv } from '@/shared/lib/format'
import { resizeImage } from '@/shared/lib/images'
import { logActivity, repo, TABLE, type TableName } from '@/shared/lib/repo'
import { DEFAULT_SETTINGS } from '@/shared/lib/config'
import type { AgencySettings, CatalogSettings, Lead, Neighborhood, Property, Settings as SettingsT, SiteSettings, Testimonial } from '@/shared/lib/types'
import { Button, Field, Input, useConfirm } from '@/shared/ui/base'
import { LocationPicker } from '@/shared/ui/map'
import { errorText, useCan, useMe } from '../hooks'
import { LEAD_KIND, LEAD_STATUS, PROPERTY_STATUS, SOURCE } from '../labels'
import { Card, L10nField, PageHeader, Tabs } from '../ui'
import { BillingTab } from './settings-billing'
import { CommissionTab, FeesTab } from './settings-fees'

type Tab = 'agency' | 'site' | 'testimonials' | 'areas' | 'docs' | 'commission' | 'billing' | 'fees' | 'data'
const TABS: Tab[] = ['agency', 'site', 'testimonials', 'areas', 'docs', 'commission', 'billing', 'fees', 'data']

function useSaveSection() {
  const { mutateAsync, isPending } = useSaveSettings()
  const me = useMe()
  const save = async <K extends keyof SettingsT>(key: K, value: SettingsT[K], label: string) => {
    try {
      await mutateAsync({ key, value })
      void logActivity(me, 'update', 'settings', key, { title: label })
      toast.success('تم الحفظ — التغييرات ظاهرة الآن في الموقع')
    } catch (e) {
      toast.error(errorText(e))
    }
  }
  return { save, pending: isPending }
}

function SaveBar({ onSave, pending }: { onSave: () => void; pending: boolean }) {
  return (
    <div className="sticky bottom-4 z-10 mt-6 flex justify-end">
      <Button variant="gold" size="lg" loading={pending} onClick={onSave} icon={<Save className="size-4" />} className="shadow-pop">
        حفظ التغييرات
      </Button>
    </div>
  )
}

export function Settings() {
  const { data } = useSettings()
  const s = data as SettingsT
  const [params, setParams] = useSearchParams()
  const tab = (TABS.includes(params.get('tab') as Tab) ? params.get('tab') : 'agency') as Tab
  const setTab = (t: Tab) => setParams(t === 'agency' ? {} : { tab: t }, { replace: true })
  return (
    <>
      <PageHeader title="الإعدادات" subtitle="كل ما يظهر في الموقع يُعدَّل من هنا، بدون برمجة" icon={<SettingsIcon className="size-6" />} />
      <Tabs
        value={tab}
        onChange={setTab}
        tabs={[
          { value: 'agency', label: <span className="inline-flex items-center gap-1.5"><Building className="size-4" /> الوكالة</span> },
          { value: 'site', label: <span className="inline-flex items-center gap-1.5"><Globe className="size-4" /> الصفحة الرئيسية</span> },
          { value: 'testimonials', label: <span className="inline-flex items-center gap-1.5"><MessageSquareQuote className="size-4" /> آراء العملاء</span> },
          { value: 'areas', label: <span className="inline-flex items-center gap-1.5"><MapPinned className="size-4" /> المناطق والمراجع</span> },
          { value: 'docs', label: <span className="inline-flex items-center gap-1.5"><FileText className="size-4" /> الوثائق</span> },
          { value: 'commission', label: <span className="inline-flex items-center gap-1.5"><Handshake className="size-4" /> العمولات والشركاء</span> },
          { value: 'billing', label: <span className="inline-flex items-center gap-1.5"><Receipt className="size-4" /> الفوترة</span> },
          { value: 'fees', label: <span className="inline-flex items-center gap-1.5"><Landmark className="size-4" /> المصاريف والضرائب</span> },
          { value: 'data', label: <span className="inline-flex items-center gap-1.5"><Database className="size-4" /> البيانات والنسخ</span> },
        ]}
      />
      <div className="mt-6">
        {tab === 'agency' && <AgencyForm key={JSON.stringify(s.agency)} value={s.agency} />}
        {tab === 'site' && <SiteForm key={JSON.stringify(s.site)} value={s.site} />}
        {tab === 'testimonials' && <TestimonialsForm key={JSON.stringify(s.site.testimonials)} site={s.site} />}
        {tab === 'areas' && <AreasForm key={JSON.stringify(s.catalog)} value={s.catalog} />}
        {tab === 'docs' && <DocsForm key={JSON.stringify([s.site.visit_clause, s.site.mandate_clause, s.site.mandate_exclusive])} site={s.site} />}
        {tab === 'commission' && <CommissionTab />}
        {tab === 'billing' && <BillingTab />}
        {tab === 'fees' && <FeesTab />}
        {tab === 'data' && <DataTab />}
      </div>
    </>
  )
}

/* ------------------------------------------------------------------ */
function AgencyForm({ value }: { value: AgencySettings }) {
  const [f, setF] = useState(value)
  const { save, pending } = useSaveSection()
  const set = <K extends keyof AgencySettings>(k: K, v: AgencySettings[K]) => setF((x) => ({ ...x, [k]: v }))
  return (
    <>
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <Card title="الهوية">
          <div className="space-y-5">
            <L10nField label="اسم الوكالة" value={f.name} onChange={(v) => set('name', v)} />
            <L10nField label="الشعار (Slogan)" value={f.slogan} onChange={(v) => set('slogan', v)} />
            <L10nField label="نبذة عن الوكالة" value={f.about} onChange={(v) => set('about', v)} multiline />
          </div>
        </Card>
        <div className="space-y-6">
          <Card title="التواصل">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label="الهاتف" hint="يظهر في الموقع وفي البطاقات المطبوعة">
                <Input dir="ltr" className="num" value={f.phone} onChange={(e) => set('phone', e.target.value)} />
              </Field>
              <Field label="رقم واتساب" hint="بالصيغة الدولية بدون + مثلاً 212702873088">
                <Input dir="ltr" className="num" value={f.whatsapp} onChange={(e) => set('whatsapp', e.target.value.replace(/[^\d]/g, ''))} />
              </Field>
              <Field label="البريد الإلكتروني">
                <Input dir="ltr" type="email" value={f.email} onChange={(e) => set('email', e.target.value)} />
              </Field>
              <Field label="فيسبوك (رابط الصفحة)">
                <Input dir="ltr" value={f.facebook} onChange={(e) => set('facebook', e.target.value)} />
              </Field>
              <Field label="إنستغرام (رابط الحساب)">
                <Input dir="ltr" value={f.instagram} onChange={(e) => set('instagram', e.target.value)} />
              </Field>
              <Field label="تيك توك (رابط الحساب)">
                <Input dir="ltr" value={f.tiktok} onChange={(e) => set('tiktok', e.target.value)} />
              </Field>
            </div>
          </Card>
          <Card title="العنوان وأوقات العمل">
            <div className="space-y-5">
              <L10nField label="العنوان" value={f.address} onChange={(v) => set('address', v)} />
              <L10nField label="أوقات العمل" value={f.hours} onChange={(v) => set('hours', v)} />
            </div>
          </Card>
        </div>
      </div>
      <Card title="موقع الوكالة على الخريطة" className="mt-6">
        <LocationPicker lat={f.lat} lng={f.lng} onChange={(lat, lng) => setF((x) => ({ ...x, lat, lng }))} height={300} />
        <p className="mt-2 text-xs text-muted">اضغط على مكان الوكالة بالضبط. يظهر في صفحتي «الوكالة» و«اتصل بنا».</p>
      </Card>
      <SaveBar pending={pending} onSave={() => void save('agency', f, 'معلومات الوكالة')} />
    </>
  )
}

/* ------------------------------------------------------------------ */
function SiteForm({ value }: { value: SiteSettings }) {
  const [f, setF] = useState(value)
  const [uploading, setUploading] = useState(false)
  const input = useRef<HTMLInputElement>(null)
  const { save, pending } = useSaveSection()
  const set = <K extends keyof SiteSettings>(k: K, v: SiteSettings[K]) => setF((x) => ({ ...x, [k]: v }))
  const upload = async (file: File) => {
    setUploading(true)
    try {
      const blob = await resizeImage(file, repo.mode === 'demo' ? 1600 : 2200, repo.mode === 'demo' ? 0.7 : 0.82)
      set('hero_image', await repo.uploadImage(blob, 'hero.jpg'))
    } catch (e) {
      toast.error(errorText(e))
    } finally {
      setUploading(false)
    }
  }
  return (
    <>
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <Card title="واجهة الصفحة الرئيسية">
          <div className="space-y-5">
            <L10nField label="السطر الصغير فوق العنوان" value={f.hero_eyebrow} onChange={(v) => set('hero_eyebrow', v)} />
            <L10nField label="العنوان الكبير" value={f.hero_title} onChange={(v) => set('hero_title', v)} />
            <L10nField label="النص التعريفي" value={f.hero_subtitle} onChange={(v) => set('hero_subtitle', v)} multiline rows={3} />
          </div>
        </Card>
        <div className="space-y-6">
          <Card title="صورة الغلاف">
            <div className="relative overflow-hidden rounded-2xl bg-navy">
              <img src={f.hero_image} alt="" className="h-52 w-full object-cover opacity-80" />
              <div className="absolute inset-0 flex items-end bg-gradient-to-t from-navy-950/80 to-transparent p-4">
                <span className="font-display text-2xl text-white">{f.hero_title.ar}</span>
              </div>
            </div>
            <div className="mt-3 flex gap-2">
              <Input dir="ltr" value={f.hero_image} onChange={(e) => set('hero_image', e.target.value)} className="text-xs" />
              <Button variant="outline" loading={uploading} onClick={() => input.current?.click()} icon={<Upload className="size-4" />}>
                رفع
              </Button>
              <input ref={input} type="file" accept="image/*" hidden onChange={(e) => e.target.files?.[0] && void upload(e.target.files[0])} />
            </div>
            <p className="mt-2 text-xs text-muted">صورة أفقية عالية الجودة (2000 بكسل عرضاً على الأقل). الأفضل صورة حقيقية لتطوان أو لأحد عقاراتكم.</p>
          </Card>
          <Card title="الأرقام المعروضة">
            <div className="grid grid-cols-2 gap-4">
              {(
                [
                  ['properties', 'عقار في المحفظة'],
                  ['clients', 'عميل سعيد'],
                  ['years', 'سنوات الخبرة'],
                  ['deals', 'صفقة منجزة'],
                ] as const
              ).map(([k, l]) => (
                <Field key={k} label={l}>
                  <Input type="number" dir="ltr" className="num" value={f.stats[k]} onChange={(e) => set('stats', { ...f.stats, [k]: Number(e.target.value) || 0 })} />
                </Field>
              ))}
            </div>
            <p className="mt-2 text-xs text-muted">اكتب أرقاماً حقيقية: الصدق يبني الثقة.</p>
          </Card>
        </div>
      </div>
      <Card title="رسالة واتساب الجاهزة (من صفحة العقار)" className="mt-6">
        <L10nField label="نص الرسالة" value={f.whatsapp_template} onChange={(v) => set('whatsapp_template', v)} multiline rows={2} hint="{ref} = مرجع العقار، {title} = عنوانه. يُضاف رابط العقار تلقائياً." />
      </Card>
      <Card title="الأثمنة بالأورو" className="mt-6">
        <Field label="ثمن 1 أورو بالدرهم" hint="سعر إرشادي يظهر للزوار بالفرنسية والإسبانية وفي صفحة مغاربة العالم. حدّثه من أسعار بنك المغرب المرجعية. 0 = لا يظهر الأورو.">
          <Input type="number" step="0.01" min={0} dir="ltr" className="num w-40" value={f.eur_rate ?? 0} onChange={(e) => set('eur_rate', Number(e.target.value) || 0)} />
        </Field>
      </Card>
      <SaveBar pending={pending} onSave={() => void save('site', f, 'الصفحة الرئيسية')} />
    </>
  )
}

/* ------------------------------------------------------------------ */
function TestimonialsForm({ site }: { site: SiteSettings }) {
  const [list, setList] = useState<Testimonial[]>(site.testimonials)
  const { save, pending } = useSaveSection()
  const upd = (i: number, t: Testimonial) => setList((l) => l.map((x, j) => (j === i ? t : x)))
  const move = (i: number, d: number) =>
    setList((l) => {
      const n = l.slice()
      const j = i + d
      if (j < 0 || j >= n.length) return l
      ;[n[i], n[j]] = [n[j], n[i]]
      return n
    })
  return (
    <>
      <div className="space-y-4">
        {list.map((t, i) => (
          <Card
            key={i}
            title={t.name || `رأي ${i + 1}`}
            action={
              <div className="flex gap-1">
                <button onClick={() => move(i, -1)} className="rounded-lg p-1.5 hover:bg-sand" aria-label="أعلى">
                  <ArrowUp className="size-4" />
                </button>
                <button onClick={() => move(i, 1)} className="rounded-lg p-1.5 hover:bg-sand" aria-label="أسفل">
                  <ArrowDown className="size-4" />
                </button>
                <button onClick={() => setList((l) => l.filter((_, j) => j !== i))} className="rounded-lg p-1.5 text-danger hover:bg-danger/10" aria-label="حذف">
                  <Trash2 className="size-4" />
                </button>
              </div>
            }
          >
            <div className="grid grid-cols-1 gap-5 lg:grid-cols-[260px_1fr]">
              <div className="space-y-4">
                <Field label="اسم العميل">
                  <Input value={t.name} onChange={(e) => upd(i, { ...t, name: e.target.value })} />
                </Field>
                <L10nField label="صفته" value={t.role} onChange={(v) => upd(i, { ...t, role: v })} />
              </div>
              <L10nField label="الرأي" value={t.text} onChange={(v) => upd(i, { ...t, text: v })} multiline rows={3} />
            </div>
          </Card>
        ))}
      </div>
      <Button variant="outline" className="mt-4" icon={<Plus className="size-4" />} onClick={() => setList((l) => [...l, { name: '', role: { ar: '', fr: '', es: '' }, text: { ar: '', fr: '', es: '' } }])}>
        إضافة رأي
      </Button>
      <p className="mt-3 text-xs text-muted">انشر فقط آراء حقيقية لعملائك وبموافقتهم.</p>
      <SaveBar pending={pending} onSave={() => void save('site', { ...site, testimonials: list.filter((t) => t.name.trim()) }, 'آراء العملاء')} />
    </>
  )
}

/* ------------------------------------------------------------------ */
function AreasForm({ value }: { value: CatalogSettings }) {
  const [f, setF] = useState(value)
  const [pickIdx, setPickIdx] = useState<number | null>(null)
  const { data: props = [] } = useTable<Property>('properties')
  const { save, pending } = useSaveSection()
  const used = (id: string) => props.filter((p) => p.neighborhood === id).length
  const upd = (i: number, n: Neighborhood) => setF((x) => ({ ...x, neighborhoods: x.neighborhoods.map((y, j) => (j === i ? n : y)) }))
  const add = () => {
    const id = `zone-${Date.now().toString(36)}`
    setF((x) => ({ ...x, neighborhoods: [...x.neighborhoods, { id, name: { ar: '', fr: '', es: '' }, lat: 35.5785, lng: -5.3684 }] }))
    setPickIdx(f.neighborhoods.length)
  }
  const picked = pickIdx != null ? f.neighborhoods[pickIdx] : null
  return (
    <>
      <Card title="مرجع العقارات">
        <Field label="بادئة المرجع" hint="تُستعمل لتوليد المراجع تلقائياً، مثلاً SH-1019">
          <Input dir="ltr" className="num w-40 font-bold" value={f.ref_prefix} onChange={(e) => setF((x) => ({ ...x, ref_prefix: e.target.value.toUpperCase().replace(/[^A-Z]/g, '').slice(0, 4) }))} />
        </Field>
      </Card>
      <Card title={`المناطق والأحياء (${f.neighborhoods.length})`} className="mt-6" bodyClass="p-0 overflow-x-auto" action={<Button size="sm" variant="outline" icon={<Plus className="size-4" />} onClick={add}>منطقة جديدة</Button>}>
        <table className="table">
          <thead>
            <tr>
              <th>العربية</th>
              <th>Français</th>
              <th>Español</th>
              <th>العقارات</th>
              <th title="الثمن المرجعي للمتر المربع عند البيع، يُستعمل في تقدير الثمن ومرصد الأثمنة حين تقل العروض">بيع د.م./م²</th>
              <th title="الكراء الشهري المرجعي للمتر المربع">كراء د.م./م²</th>
              <th>الموقع</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {f.neighborhoods.map((n, i) => {
              const u = used(n.id)
              return (
                <tr key={n.id} className={pickIdx === i ? 'bg-gold/5' : undefined}>
                  <td>
                    <Input value={n.name.ar} onChange={(e) => upd(i, { ...n, name: { ...n.name, ar: e.target.value } })} className="h-9 min-w-[140px] py-1 text-sm" />
                  </td>
                  <td>
                    <Input dir="ltr" value={n.name.fr} onChange={(e) => upd(i, { ...n, name: { ...n.name, fr: e.target.value } })} className="h-9 min-w-[130px] py-1 text-sm" />
                  </td>
                  <td>
                    <Input dir="ltr" value={n.name.es} onChange={(e) => upd(i, { ...n, name: { ...n.name, es: e.target.value } })} className="h-9 min-w-[130px] py-1 text-sm" />
                  </td>
                  <td className="num text-center">{u}</td>
                  <td>
                    <Input type="number" min={0} dir="ltr" className="num h-9 w-24 py-1 text-sm" value={n.ref_sale_m2 ?? ''} onChange={(e) => upd(i, { ...n, ref_sale_m2: Number(e.target.value) || null })} />
                  </td>
                  <td>
                    <Input type="number" min={0} step="0.5" dir="ltr" className="num h-9 w-20 py-1 text-sm" value={n.ref_rent_m2 ?? ''} onChange={(e) => upd(i, { ...n, ref_rent_m2: Number(e.target.value) || null })} />
                  </td>
                  <td>
                    <button onClick={() => setPickIdx(pickIdx === i ? null : i)} className="text-xs font-semibold whitespace-nowrap text-teal hover:underline">
                      {pickIdx === i ? 'إغلاق الخريطة' : 'تحديد على الخريطة'}
                    </button>
                  </td>
                  <td>
                    <button
                      disabled={u > 0}
                      title={u > 0 ? 'مستعملة في عقارات — غيّر حي تلك العقارات أولاً' : 'حذف'}
                      onClick={() => setF((x) => ({ ...x, neighborhoods: x.neighborhoods.filter((_, j) => j !== i) }))}
                      className="rounded-lg p-1.5 text-danger hover:bg-danger/10 disabled:opacity-30"
                      aria-label="حذف"
                    >
                      <Trash2 className="size-4" />
                    </button>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </Card>
      {picked && pickIdx != null && (
        <Card title={`مركز «${picked.name.ar || 'المنطقة الجديدة'}» على الخريطة`} className="mt-6">
          <LocationPicker lat={picked.lat} lng={picked.lng} onChange={(lat, lng) => upd(pickIdx, { ...picked, lat, lng })} height={320} />
        </Card>
      )}
      <SaveBar
        pending={pending}
        onSave={() => {
          const clean = f.neighborhoods.filter((n) => n.name.ar.trim())
          const fixed = clean.map((n) => (n.id.startsWith('zone-') && n.name.fr ? { ...n, id: slugify(n.name.fr) || n.id } : n))
          const ids = new Set<string>()
          for (const n of fixed) {
            if (ids.has(n.id)) return toast.error(`اسم مكرر: ${n.name.fr || n.name.ar}`)
            ids.add(n.id)
          }
          void save('catalog', { ...f, neighborhoods: fixed }, 'المناطق')
        }}
      />
    </>
  )
}

/* ------------------------------------------------------------------ */
function DocsForm({ site }: { site: SiteSettings }) {
  const [clause, setClause] = useState(site.visit_clause)
  const [mandate, setMandate] = useState(site.mandate_clause ?? DEFAULT_SETTINGS.site.mandate_clause!)
  const [exclusive, setExclusive] = useState(site.mandate_exclusive ?? DEFAULT_SETTINGS.site.mandate_exclusive!)
  const { save, pending } = useSaveSection()
  return (
    <>
      <Card title="نص الالتزام في «ورقة الزيارة»">
        <L10nField label="النص" value={clause} onChange={setClause} multiline rows={4} hint="{agency} = اسم الوكالة. تُطبع النسختان العربية والفرنسية في الورقة." />
      </Card>
      <Card title="نص «التفويض بالبيع أو الكراء»" className="mt-6">
        <L10nField label="النص الرئيسي" value={mandate} onChange={setMandate} multiline rows={5} hint="{agency} = اسم الوكالة، {purpose} = للبيع أو للكراء، {party} = مشترٍ أو مكترٍ." />
        <div className="mt-4">
          <L10nField label="فقرة التفويض الحصري" value={exclusive} onChange={setExclusive} multiline rows={3} hint="تُطبع فقط حين يكون التفويض حصرياً." />
        </div>
      </Card>
      <p className="mt-4 rounded-xl bg-warning/10 px-3 py-2.5 text-xs leading-relaxed text-warning">نصيحة: اعرض هذه النصوص على موثق أو محامٍ للتأكد من صيغتها القانونية قبل اعتمادها مع العملاء.</p>
      <SaveBar pending={pending} onSave={() => void save('site', { ...site, visit_clause: clause, mandate_clause: mandate, mandate_exclusive: exclusive }, 'نصوص الوثائق')} />
    </>
  )
}

/* ------------------------------------------------------------------ */
function DataTab() {
  const can = useCan()
  const qc = useQueryClient()
  const confirm = useConfirm()
  const { data: settings } = useSettings()
  const { data: props = [] } = useTable<Property>('properties')
  const { data: leads = [] } = useTable<Lead>('leads')
  const [busy, setBusy] = useState(false)
  const today = new Date().toISOString().slice(0, 10)

  const backup = async () => {
    setBusy(true)
    try {
      const out: Record<string, unknown> = { app: 'sweet-house-immo', exported_at: new Date().toISOString(), mode: repo.mode, settings }
      for (const t of Object.keys(TABLE) as TableName[]) out[t] = await repo.list(t)
      download(`sweet-house-immo-backup-${today}.json`, JSON.stringify(out, null, 2))
      toast.success('تم تنزيل النسخة الاحتياطية')
    } catch (e) {
      toast.error(errorText(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
      <Card title="حالة النظام">
        {repo.mode === 'demo' ? (
          <div className="space-y-3 text-sm leading-relaxed">
            <p className="rounded-xl bg-warning/10 px-3 py-2.5 text-warning">
              <b>وضع تجريبي:</b> البيانات محفوظة في هذا المتصفح فقط ولا يراها أحد غيرك. لتشغيل النظام الحقيقي (فريق متعدد، أجهزة متعددة، صور على السحابة) اتبع دليل الربط بقاعدة البيانات.
            </p>
            <Button
              variant="outline"
              icon={<RotateCcw className="size-4" />}
              onClick={async () => {
                if (!(await confirm({ title: 'إعادة البيانات التجريبية؟', text: 'ستُحذف كل التعديلات التي قمت بها في الوضع التجريبي وتعود البيانات النموذجية.', confirmLabel: 'نعم، أعد التعيين', danger: true }))) return
                await repo.resetDemo()
                await qc.invalidateQueries()
                toast.success('أعيدت البيانات التجريبية')
              }}
            >
              إعادة البيانات التجريبية
            </Button>
          </div>
        ) : (
          <p className="rounded-xl bg-success/10 px-3 py-2.5 text-sm text-success">
            <b>متصل بقاعدة البيانات:</b> البيانات محفوظة على السحابة ومحمية بصلاحيات كل عضو.
          </p>
        )}
      </Card>
      {can('export') && (
      <Card title="النسخ الاحتياطي والتصدير">
        <div className="grid gap-2">
          <Button variant="primary" loading={busy} onClick={() => void backup()} icon={<Download className="size-4" />}>
            نسخة احتياطية كاملة (JSON)
          </Button>
          <Button
            variant="outline"
            icon={<Download className="size-4" />}
            onClick={() =>
              download(
                `properties-${today}.csv`,
                toCsv(props.map((p) => ({ المرجع: p.ref, العنوان: p.title, النوع: p.type, الغرض: p.purpose === 'sale' ? 'بيع' : 'كراء', الثمن: p.price, المساحة: p.area, الحي: p.neighborhood, الحالة: PROPERTY_STATUS[p.status].label, منشور: p.published ? 'نعم' : 'لا', المشاهدات: p.views }))),
                'text/csv;charset=utf-8',
              )
            }
          >
            تصدير العقارات (Excel / CSV) — {fmtNumber(props.length)}
          </Button>
          <Button
            variant="outline"
            icon={<Download className="size-4" />}
            onClick={() =>
              download(
                `leads-${today}.csv`,
                toCsv(leads.map((l) => ({ التاريخ: l.created_at.slice(0, 16).replace('T', ' '), الاسم: l.name, الهاتف: l.phone, النوع: LEAD_KIND[l.kind].label, المصدر: SOURCE[l.source].label, الحالة: LEAD_STATUS[l.status].label, العقار: l.property_ref, الرسالة: l.message }))),
                'text/csv;charset=utf-8',
              )
            }
          >
            تصدير الطلبات (Excel / CSV) — {fmtNumber(leads.length)}
          </Button>
          <p className="mt-1 text-xs text-muted">احتفظ بنسخة احتياطية كل أسبوع في مكان آمن (Google Drive مثلاً).</p>
        </div>
      </Card>
      )}
    </div>
  )
}
