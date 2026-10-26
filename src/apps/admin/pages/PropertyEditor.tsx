import { ArrowRight, ChevronLeft, ChevronRight, ExternalLink, ImagePlus, Link2, Loader2, Lock, MapPin, Megaphone, Printer, Save, Star, Sun, Trash2, Upload, Video, X } from 'lucide-react'
import { useEffect, useRef, useState, type ReactNode } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { toast } from 'sonner'
import { FEATURES, PROPERTY_TYPES } from '@/shared/lib/config'
import { useTable } from '@/shared/lib/data'
import { fmtDate, fmtNumber, nowIso, pick, uid, youtubeId } from '@/shared/lib/format'
import { resizeImage } from '@/shared/lib/images'
import { repo } from '@/shared/lib/repo'
import { currentMandate, mandateState } from '@/shared/lib/owners'
import type { Mandate, Property, PropertyStatus, PropertyType, Purpose } from '@/shared/lib/types'
import { Button, Field, FullSpinner, Input, Segmented, Select, Switch, Textarea, cn } from '@/shared/ui/base'
import { WhatsAppIcon } from '@/shared/ui/icons'
import { LocationPicker } from '@/shared/ui/map'
import { useClientOptions } from '../dialogs'
import { useBrokerOptions } from '../network-dialogs'
import { ShareKitDialog } from '../marketing'
import { OffersCard } from '../offers'
import { DocumentsPanel, MandateDialog, MandatePill, PriceHistory, renewalOf } from '../owners'
import { SeasonCard } from '../seasonal'
import { errorText, nextRef, useCan, useDeleteRow, useLookups, useMe, useNames, useSave } from '../hooks'
import { PROPERTY_STATUS } from '../labels'
import { printMandate, printPropertySheet } from '../print'
import { propertyMessage } from '../templates'
import { Card, Combo } from '../ui'

const CITY_OF: Record<string, string> = { martil: 'مرتيل', 'cabo-negro': 'كابو نيغرو', mdiq: 'المضيق', fnideq: 'الفنيدق', azla: 'أزلا', 'oued-laou': 'واد لو' }
const num = (v: string) => (v.trim() === '' || Number.isNaN(Number(v)) ? null : Number(v))

function blank(ref: string, me: string): Property {
  return {
    id: uid(),
    ref,
    title: '',
    title_fr: null,
    title_es: null,
    description: '',
    description_fr: null,
    description_es: null,
    type: 'apartment',
    purpose: 'sale',
    price: 0,
    area: null,
    land_area: null,
    rooms: null,
    bedrooms: null,
    bathrooms: null,
    floor: null,
    floors: null,
    year_built: null,
    furnished: false,
    features: [],
    neighborhood: '',
    city: 'تطوان',
    address: null,
    lat: null,
    lng: null,
    images: [],
    video_url: null,
    status: 'available',
    featured: false,
    published: true,
    seasonal: false,
    season: {},
    views: 0,
    owner_client_id: null,
    private_notes: null,
    created_by: me,
    created_at: nowIso(),
    updated_at: nowIso(),
  }
}

/* ------------------------------------------------------------------ */
const WATERMARK_KEY = 'shi:watermark'

function ImageManager({ images, onChange, mark }: { images: string[]; onChange: (imgs: string[]) => void; mark: string }) {
  const [busy, setBusy] = useState(0)
  const [watermark, setWatermark] = useState(() => {
    try {
      return localStorage.getItem(WATERMARK_KEY) === '1'
    } catch {
      return false
    }
  })
  const [url, setUrl] = useState('')
  const [drag, setDrag] = useState<number | null>(null)
  const [over, setOver] = useState(false)
  const input = useRef<HTMLInputElement>(null)
  const latest = useRef(images)
  useEffect(() => {
    latest.current = images
  }, [images])

  const upload = async (files: FileList | File[]) => {
    const arr = Array.from(files).filter((f) => f.type.startsWith('image/'))
    if (!arr.length) return toast.error('اختر ملفات صور (JPG، PNG، WEBP)')
    setBusy(arr.length)
    const demo = repo.mode === 'demo'
    for (const file of arr) {
      try {
        const blob = await resizeImage(file, demo ? 1200 : 1800, demo ? 0.72 : 0.84, watermark ? mark : undefined)
        const u = await repo.uploadImage(blob, file.name.replace(/\.\w+$/, '') + '.jpg')
        latest.current = [...latest.current, u]
        onChange(latest.current)
      } catch (e) {
        toast.error(errorText(e))
      }
      setBusy((b) => b - 1)
    }
  }
  const move = (from: number, to: number) => {
    if (to < 0 || to >= images.length || from === to) return
    const next = images.slice()
    const [x] = next.splice(from, 1)
    next.splice(to, 0, x)
    onChange(next)
  }
  const addUrl = () => {
    const u = url.trim()
    if (!/^https?:\/\//.test(u)) return toast.error('الصق رابط صورة يبدأ بـ https://')
    onChange([...images, u])
    setUrl('')
  }

  return (
    <div>
      {images.length > 0 && (
        <ul className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {images.map((src, i) => (
            <li
              key={src + i}
              draggable
              onDragStart={() => setDrag(i)}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault()
                if (drag != null) move(drag, i)
                setDrag(null)
              }}
              className={cn('group relative aspect-[4/3] cursor-grab overflow-hidden rounded-xl border-2 bg-sand', i === 0 ? 'border-gold' : 'border-transparent', drag === i && 'opacity-40')}
            >
              <img src={src} alt="" className="h-full w-full object-cover" loading="lazy" />
              {i === 0 && <span className="absolute top-1.5 start-1.5 rounded-full bg-gold px-2 py-0.5 text-[10px] font-bold text-navy-950">صورة الغلاف</span>}
              <div className="absolute inset-x-0 bottom-0 flex items-center justify-between gap-1 bg-gradient-to-t from-navy-950/80 to-transparent p-1.5 opacity-100 transition sm:opacity-0 sm:group-hover:opacity-100">
                <div className="flex gap-1">
                  <button type="button" onClick={() => move(i, i - 1)} disabled={i === 0} className="rounded-md bg-white/90 p-1 text-navy disabled:opacity-30" title="قبل" aria-label="قبل">
                    <ChevronRight className="size-4" />
                  </button>
                  <button type="button" onClick={() => move(i, i + 1)} disabled={i === images.length - 1} className="rounded-md bg-white/90 p-1 text-navy disabled:opacity-30" title="بعد" aria-label="بعد">
                    <ChevronLeft className="size-4" />
                  </button>
                  {i !== 0 && (
                    <button type="button" onClick={() => move(i, 0)} className="rounded-md bg-white/90 p-1 text-gold-700" title="اجعلها صورة الغلاف" aria-label="صورة الغلاف">
                      <Star className="size-4" />
                    </button>
                  )}
                </div>
                <button type="button" onClick={() => onChange(images.filter((_, j) => j !== i))} className="rounded-md bg-danger p-1 text-white" title="حذف" aria-label="حذف الصورة">
                  <X className="size-4" />
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
      <div
        onDragOver={(e) => {
          if (e.dataTransfer.types.includes('Files')) {
            e.preventDefault()
            setOver(true)
          }
        }}
        onDragLeave={() => setOver(false)}
        onDrop={(e) => {
          if (!e.dataTransfer.files.length) return
          e.preventDefault()
          setOver(false)
          void upload(e.dataTransfer.files)
        }}
        onClick={() => input.current?.click()}
        className={cn('flex cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed px-4 py-8 text-center transition', over ? 'border-gold bg-gold/10' : 'border-line-2 bg-ivory hover:border-gold/60')}
      >
        {busy > 0 ? <Loader2 className="size-7 animate-spin text-gold" /> : <Upload className="size-7 text-gold-600" />}
        <div className="text-sm font-bold text-navy">{busy > 0 ? `جارٍ رفع ${busy} صورة…` : 'اسحب الصور هنا أو اضغط للاختيار'}</div>
        <div className="text-xs text-muted">تُصغَّر الصور تلقائياً قبل الرفع · اسحب صورة لتغيير الترتيب · الأولى هي صورة الغلاف</div>
        <input
          ref={input}
          type="file"
          accept="image/*"
          multiple
          hidden
          onChange={(e) => {
            if (e.target.files) void upload(e.target.files)
            e.target.value = ''
          }}
        />
      </div>
      <div className="mt-3">
        <Switch
          checked={watermark}
          onChange={(v) => {
            setWatermark(v)
            try {
              localStorage.setItem(WATERMARK_KEY, v ? '1' : '0')
            } catch {
              /* ignore */
            }
          }}
          label={`كتابة «${mark}» على الصور الجديدة (يحميها من النسخ)`}
        />
      </div>
      <div className="mt-3 flex gap-2">
        <Input value={url} onChange={(e) => setUrl(e.target.value)} dir="ltr" placeholder="أو الصق رابط صورة https://…" className="text-sm" onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addUrl())} />
        <Button type="button" variant="outline" onClick={addUrl} icon={<Link2 className="size-4" />}>
          إضافة
        </Button>
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ */
export function PropertyEditor() {
  const { id } = useParams()
  const isNew = !id
  const nav = useNavigate()
  const me = useMe()
  const can = useCan()
  const canEdit = can('properties')
  const { data: props = [], isLoading } = useTable<Property>('properties')
  const { s, hoodName, typeName } = useNames()
  const ownerOptions = useClientOptions()
  const brokerOptions = useBrokerOptions()
  const { data: mandates = [] } = useTable<Mandate>('mandates')
  const [mandateOpen, setMandateOpen] = useState<Partial<Mandate> | null>(null)
  const [shareKit, setShareKit] = useState(false)
  const ownerOf = useLookups().client
  const existing = id ? props.find((p) => p.id === id) : undefined
  const [f, setF] = useState<Property | null>(null)
  const [dirty, setDirty] = useState(false)
  const [refTouched, setRefTouched] = useState(false)
  const [showTr, setShowTr] = useState(false)
  const { save, pending } = useSave<Property>('properties', 'property', (p) => `${p.ref} — ${p.title}`)
  const del = useDeleteRow('properties', 'property')

  useEffect(() => {
    if (isNew) {
      if (!isLoading && !f) setF(blank(nextRef(props, s.catalog.ref_prefix), me.id))
    } else if (existing && (!f || f.id !== existing.id)) {
      setF(existing)
      setDirty(false)
      setShowTr(Boolean(existing.title_fr || existing.title_es))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isNew, isLoading, existing?.id])

  // saved elsewhere while the page is open (an accepted offer reserves it, a deal sells it): keep the form in step
  useEffect(() => {
    if (!existing || !f || f.id !== existing.id || existing.updated_at === f.updated_at) return
    if (!dirty) setF(existing)
    else setF((x) => (x ? { ...x, status: existing.status, published: existing.published, updated_at: existing.updated_at } : x))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [existing?.updated_at])

  useEffect(() => {
    if (!dirty) return
    const h = (e: BeforeUnloadEvent) => {
      e.preventDefault()
      e.returnValue = ''
    }
    window.addEventListener('beforeunload', h)
    return () => window.removeEventListener('beforeunload', h)
  }, [dirty])

  if (!isNew && !existing && !isLoading)
    return (
      <div className="card mx-auto mt-10 max-w-lg p-10 text-center">
        <h1 className="text-xl font-bold text-navy">العقار غير موجود</h1>
        <Link to="/admin/properties" className="mt-4 inline-block font-semibold text-teal">
          العودة إلى العقارات
        </Link>
      </div>
    )
  if (!f) return <FullSpinner />

  const set = <K extends keyof Property>(k: K, v: Property[K]) => {
    setF((x) => (x ? { ...x, [k]: v } : x))
    setDirty(true)
  }
  const prefix = s.catalog.ref_prefix
  const rent = f.purpose === 'rent'

  const submit = async () => {
    const missing = [!f.title.trim() && 'العنوان', !(f.price > 0) && 'الثمن', !f.neighborhood && 'الحي'].filter(Boolean)
    if (missing.length) return toast.error(`أكمل الحقول المطلوبة: ${missing.join('، ')}`)
    let ref = f.ref.trim().toUpperCase() || nextRef(props, prefix)
    if (props.some((p) => p.ref === ref && p.id !== f.id)) {
      if (isNew && !refTouched) ref = nextRef(props, prefix)
      else return toast.error(`المرجع ${ref} مستعمل لعقار آخر`)
    }
    // only a property for rent can be let by the night
    const row: Property = { ...f, ref, title: f.title.trim(), seasonal: f.purpose === 'rent' && Boolean(f.seasonal), updated_at: nowIso() }
    const saved = await save(row, { isNew, message: isNew ? `تمت إضافة العقار ${ref}${row.published && row.status !== 'draft' ? ' ونشره على الموقع' : ''}` : undefined })
    if (!saved) return
    if (existing) for (const img of existing.images) if (!row.images.includes(img)) void repo.deleteImage(img)
    setF(row)
    setDirty(false)
    if (isNew) nav(`/admin/properties/${row.id}`, { replace: true })
  }

  const remove = async () => {
    if (await del(f.id, `${f.ref} — ${f.title}`, { text: 'سيُحذف العقار وصوره نهائياً. إن كان قد بيع فالأفضل تغيير حالته إلى «مُباع».' })) {
      for (const img of f.images) void repo.deleteImage(img)
      setDirty(false)
      nav('/admin/properties')
    }
  }

  const hood = s.catalog.neighborhoods.find((n) => n.id === f.neighborhood)
  const yt = youtubeId(f.video_url)
  const numField = (k: 'area' | 'land_area' | 'rooms' | 'bedrooms' | 'bathrooms' | 'floor' | 'floors' | 'year_built', label: ReactNode, hint?: string) => (
    <Field label={label} hint={hint}>
      <Input type="number" inputMode="numeric" dir="ltr" className="num" value={f[k] ?? ''} onChange={(e) => set(k, num(e.target.value))} />
    </Field>
  )

  return (
    <div className="pb-24 lg:pb-0">
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <button onClick={() => nav('/admin/properties')} className="flex size-10 items-center justify-center rounded-full bg-white text-navy shadow-soft hover:bg-sand" aria-label="رجوع">
            <ArrowRight className="size-5" />
          </button>
          <div>
            <div className="num text-xs font-bold text-gold-700">{f.ref}</div>
            <h1 className="font-display text-2xl leading-tight text-navy">{isNew ? 'عقار جديد' : f.title || 'بدون عنوان'}</h1>
          </div>
          {dirty && <span className="rounded-full bg-warning/10 px-2.5 py-1 text-xs font-semibold text-warning">تغييرات غير محفوظة</span>}
        </div>
        <div className="hidden gap-2 lg:flex">
          {!isNew && f.published && f.status !== 'draft' && (
            <a href={`${import.meta.env.BASE_URL}biens/${f.ref}`} target="_blank" rel="noopener noreferrer" className="inline-flex h-11 items-center gap-2 rounded-xl border border-navy/25 px-4 text-sm font-semibold text-navy hover:bg-navy/5">
              <ExternalLink className="size-4" /> عرض في الموقع
            </a>
          )}
          {canEdit ? (
            <Button variant="gold" size="md" loading={pending} onClick={submit} icon={<Save className="size-4" />}>
              {isNew ? 'حفظ العقار' : 'حفظ التغييرات'}
            </Button>
          ) : (
            <span className="inline-flex h-11 items-center rounded-xl bg-sand px-4 text-sm font-semibold text-muted">عرض فقط: التعديل يحتاج صلاحية «العقارات»</span>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_340px]">
        <div className="min-w-0 space-y-6">
          <Card title="المعلومات الأساسية">
            <div className="space-y-4">
              <Segmented
                value={f.purpose}
                onChange={(v: Purpose) => set('purpose', v)}
                options={[
                  { value: 'sale', label: 'للبيع' },
                  { value: 'rent', label: 'للكراء' },
                ]}
                className="flex w-full [&>button]:flex-1"
              />
              <Field label="عنوان الإعلان" required hint="مثال: شقة فاخرة بإطلالة على البحر — مرتيل">
                <Input value={f.title} onChange={(e) => set('title', e.target.value)} />
              </Field>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Field label="نوع العقار">
                  <Select value={f.type} onChange={(e) => set('type', e.target.value as PropertyType)}>
                    {PROPERTY_TYPES.map((t) => (
                      <option key={t} value={t}>
                        {typeName(t)}
                      </option>
                    ))}
                  </Select>
                </Field>
                <Field label={rent ? 'ثمن الكراء الشهري (د.م.)' : 'ثمن البيع (د.م.)'} required hint={f.price > 0 ? `${fmtNumber(f.price)} د.م.${!rent && f.area ? ` · ${fmtNumber(Math.round(f.price / f.area))} د.م./م²` : ''}` : undefined}>
                  <Input type="number" inputMode="numeric" dir="ltr" className="num text-lg font-bold" value={f.price || ''} onChange={(e) => set('price', Number(e.target.value) || 0)} />
                </Field>
                <Field label="الحي / المنطقة" required>
                  <Select
                    value={f.neighborhood}
                    onChange={(e) => {
                      const v = e.target.value
                      setF((x) => (x ? { ...x, neighborhood: v, city: CITY_OF[v] ?? 'تطوان' } : x))
                      setDirty(true)
                    }}
                  >
                    <option value="">— اختر —</option>
                    {s.catalog.neighborhoods.map((n) => (
                      <option key={n.id} value={n.id}>
                        {n.name.ar}
                      </option>
                    ))}
                  </Select>
                </Field>
                <Field label="المدينة">
                  <Input value={f.city} onChange={(e) => set('city', e.target.value)} />
                </Field>
              </div>
              <Field label="العنوان (يظهر للعموم)" hint="اكتب عنواناً تقريبياً إن كنت لا تريد إظهار العنوان الدقيق، مثلاً: قرب مسجد الحي">
                <Input value={f.address ?? ''} onChange={(e) => set('address', e.target.value || null)} />
              </Field>
            </div>
          </Card>

          <Card title="التفاصيل">
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              {numField('area', 'المساحة المبنية (م²)')}
              {numField('land_area', 'مساحة الأرض (م²)')}
              {numField('rooms', 'عدد الغرف')}
              {numField('bedrooms', 'غرف النوم')}
              {numField('bathrooms', 'الحمامات')}
              {numField('floor', 'الطابق', '0 = الطابق الأرضي')}
              {numField('floors', 'عدد الطوابق')}
              {numField('year_built', 'سنة البناء')}
            </div>
            <div className="mt-4">
              <Switch checked={f.furnished} onChange={(v) => set('furnished', v)} label="مفروش" />
            </div>
          </Card>

          <Card title={`الصور (${f.images.length})`} icon={<ImagePlus className="size-4" />}>
            <ImageManager images={f.images} onChange={(imgs) => set('images', imgs)} mark={pick(s.agency.name, 'fr') || 'Sweet House'} />
          </Card>

          <Card title="الوصف">
            <Field label="الوصف بالعربية" hint={`${f.description.length} حرف — صف المزايا، الحالة، القرب من المرافق…`}>
              <Textarea rows={7} value={f.description} onChange={(e) => set('description', e.target.value)} />
            </Field>
            <button type="button" onClick={() => setShowTr((v) => !v)} className="mt-4 text-sm font-semibold text-teal hover:underline">
              {showTr ? '− إخفاء الترجمة' : '+ إضافة ترجمة فرنسية / إسبانية (لزوار المغاربة المقيمين بالخارج والأجانب)'}
            </button>
            {showTr && (
              <div className="mt-4 space-y-4 rounded-2xl border border-line bg-ivory p-4">
                <p className="text-xs text-muted">الزائر الذي يختار الفرنسية أو الإسبانية يرى هذه الترجمة؛ إن تركتها فارغة يرى النص العربي.</p>
                <Field label="Titre (FR)">
                  <Input dir="ltr" value={f.title_fr ?? ''} onChange={(e) => set('title_fr', e.target.value || null)} />
                </Field>
                <Field label="Description (FR)">
                  <Textarea dir="ltr" rows={5} value={f.description_fr ?? ''} onChange={(e) => set('description_fr', e.target.value || null)} />
                </Field>
                <Field label="Título (ES)">
                  <Input dir="ltr" value={f.title_es ?? ''} onChange={(e) => set('title_es', e.target.value || null)} />
                </Field>
                <Field label="Descripción (ES)">
                  <Textarea dir="ltr" rows={5} value={f.description_es ?? ''} onChange={(e) => set('description_es', e.target.value || null)} />
                </Field>
              </div>
            )}
          </Card>

          <Card title="المزايا والتجهيزات">
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {Object.entries(FEATURES).map(([key, l]) => {
                const on = f.features.includes(key)
                return (
                  <label key={key} className={cn('flex cursor-pointer items-center gap-2.5 rounded-xl border px-3 py-2.5 text-sm transition', on ? 'border-teal bg-teal-50 text-teal-700' : 'border-line bg-white hover:border-line-2')}>
                    <input type="checkbox" className="size-4 accent-[#0f766e]" checked={on} onChange={() => set('features', on ? f.features.filter((x) => x !== key) : [...f.features, key])} />
                    {l.ar}
                  </label>
                )
              })}
            </div>
          </Card>

          <Card
            title="الموقع على الخريطة"
            icon={<MapPin className="size-4" />}
            action={
              <div className="flex gap-2">
                {hood && (
                  <button
                    type="button"
                    onClick={() => {
                      setF((x) => (x ? { ...x, lat: hood.lat, lng: hood.lng } : x))
                      setDirty(true)
                    }}
                    className="text-xs font-semibold text-teal hover:underline"
                  >
                    مركز الحي
                  </button>
                )}
                {f.lat != null && (
                  <button
                    type="button"
                    onClick={() => {
                      setF((x) => (x ? { ...x, lat: null, lng: null } : x))
                      setDirty(true)
                    }}
                    className="text-xs font-semibold text-danger hover:underline"
                  >
                    مسح
                  </button>
                )}
              </div>
            }
          >
            <LocationPicker
              lat={f.lat}
              lng={f.lng}
              fallback={hood ? [hood.lat, hood.lng] : undefined}
              onChange={(lat, lng) => {
                setF((x) => (x ? { ...x, lat, lng } : x))
                setDirty(true)
              }}
            />
            <p className="mt-2 text-xs text-muted">
              اضغط على الخريطة لوضع الدبوس أو اسحبه. ضع موقعاً تقريبياً إن كنت لا تريد إظهار المكان الدقيق.
              {f.lat != null && (
                <span className="num ms-2" dir="ltr">
                  ({f.lat.toFixed(5)}, {f.lng?.toFixed(5)})
                </span>
              )}
            </p>
          </Card>

          <Card title="فيديو (يوتيوب)" icon={<Video className="size-4" />}>
            <Field label="رابط الفيديو" hint="جولة مصورة في العقار تزيد الثقة والزيارات الجدية">
              <Input dir="ltr" value={f.video_url ?? ''} onChange={(e) => set('video_url', e.target.value || null)} placeholder="https://youtu.be/…" />
            </Field>
            {f.video_url && !yt && <p className="mt-2 text-xs text-danger">الرابط غير معروف — استعمل رابط يوتيوب.</p>}
            {yt && <img src={`https://img.youtube.com/vi/${yt}/hqdefault.jpg`} alt="" className="mt-3 w-60 rounded-xl" />}
          </Card>

          {rent && (
            <Card
              title="الكراء الموسمي (بالليلة)"
              icon={<Sun className="size-4" />}
              action={
                !isNew && f.seasonal ? (
                  <Link to="/admin/seasonal" className="text-xs font-semibold text-teal hover:underline">
                    تقويم الحجوزات
                  </Link>
                ) : undefined
              }
            >
              <SeasonCard
                property={f}
                onChange={(patch) => {
                  setF((x) => (x ? { ...x, ...patch } : x))
                  setDirty(true)
                }}
              />
            </Card>
          )}
        </div>

        <aside className="space-y-6">
          <div className="space-y-6 lg:sticky lg:top-24">
            <Card title="النشر والحالة">
              <div className="space-y-4">
                <Field label="المرجع">
                  <Input
                    dir="ltr"
                    className="num font-bold"
                    value={f.ref}
                    onChange={(e) => {
                      setRefTouched(true)
                      set('ref', e.target.value.toUpperCase())
                    }}
                  />
                </Field>
                <Field label="الحالة">
                  <Select value={f.status} onChange={(e) => set('status', e.target.value as PropertyStatus)} style={{ color: PROPERTY_STATUS[f.status].color, fontWeight: 600 }}>
                    {(Object.keys(PROPERTY_STATUS) as PropertyStatus[]).map((k) => (
                      <option key={k} value={k}>
                        {PROPERTY_STATUS[k].label}
                      </option>
                    ))}
                  </Select>
                </Field>
                <Switch checked={f.published} onChange={(v) => set('published', v)} label="منشور على الموقع" />
                {f.published && f.status === 'draft' && <p className="text-xs text-warning">الحالة «مسودة» تخفي العقار من الموقع حتى لو كان منشوراً.</p>}
                <Switch checked={f.featured} onChange={(v) => set('featured', v)} label="مميز في الصفحة الرئيسية ★" />
                {!isNew && (
                  <dl className="grid grid-cols-2 gap-2 rounded-xl bg-ivory p-3 text-xs">
                    <dt className="text-muted">المشاهدات</dt>
                    <dd className="num font-bold text-navy">{fmtNumber(f.views)}</dd>
                    <dt className="text-muted">أضيف في</dt>
                    <dd className="text-navy">{fmtDate(f.created_at)}</dd>
                    <dt className="text-muted">آخر تعديل</dt>
                    <dd className="text-navy">{fmtDate(f.updated_at)}</dd>
                  </dl>
                )}
                {canEdit && (
                  <Button variant="gold" size="lg" className="w-full max-lg:hidden" loading={pending} onClick={submit} icon={<Save className="size-4" />}>
                    حفظ
                  </Button>
                )}
              </div>
            </Card>

            <Card title="المالك ومعلومات داخلية" icon={<Lock className="size-4" />}>
              <div className="space-y-4">
                <Field label="مالك العقار">
                  <Combo value={f.owner_client_id} onChange={(v) => set('owner_client_id', v)} options={ownerOptions} placeholder="اختر من العملاء" />
                </Field>
                {!isNew && (
                  <div className="rounded-xl border border-gold/30 bg-gold/5 p-3">
                    <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                      <span className="text-xs font-bold text-gold-700">التفويض</span>
                      <MandatePill m={currentMandate(mandates, f.id)} />
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {(() => {
                        const m = currentMandate(mandates, f.id)
                        return (
                          <>
                            <Button size="sm" variant="outline" onClick={() => setMandateOpen(m ?? {})}>
                              {m ? 'تفاصيل التفويض' : 'تسجيل تفويض'}
                            </Button>
                            {m && (
                              <Button size="sm" variant="ghost" icon={<Printer className="size-4" />} onClick={() => printMandate(m, f, ownerOf(m.owner_client_id), s, hoodName)}>
                                طباعة
                              </Button>
                            )}
                            {m && mandateState(m).state !== 'active' && (
                              <Button size="sm" variant="ghost" onClick={() => setMandateOpen(renewalOf(m))}>
                                تجديد
                              </Button>
                            )}
                          </>
                        )
                      })()}
                    </div>
                    {f.owner_client_id && (
                      <Link to={`/admin/owners?open=${f.owner_client_id}`} className="mt-2 inline-block text-xs font-semibold text-teal hover:underline">
                        ملف المالك الكامل
                      </Link>
                    )}
                  </div>
                )}
                <Field label="جاء عن طريق وسيط أو منعش" hint="لا يظهر في الموقع. تُقترح حصته عند تسجيل الصفقة.">
                  <Combo value={f.broker_id ?? null} onChange={(v) => set('broker_id', v)} options={brokerOptions} placeholder="لا أحد: عقار مباشر من المالك" />
                </Field>
                <Field label="ملاحظات خاصة" hint="لا تظهر أبداً في الموقع: أقل ثمن، العمولة المتفق عليها، مكان المفتاح…">
                  <Textarea rows={4} value={f.private_notes ?? ''} onChange={(e) => set('private_notes', e.target.value || null)} />
                </Field>
              </div>
            </Card>

            {!isNew && <OffersCard propertyId={f.id} />}
            {!isNew && <DocumentsPanel propertyId={f.id} clientId={f.owner_client_id} title="وثائق العقار" />}
            {!isNew && <PriceHistory propertyId={f.id} rent={f.purpose === 'rent'} />}

            {!isNew && (
              <Card title="أدوات">
                <div className="grid gap-2">
                  <Button variant="gold" onClick={() => setShareKit(true)} icon={<Megaphone className="size-4" />}>
                    التسويق: صورة ونص للنشر
                  </Button>
                  <Button variant="outline" onClick={() => void printPropertySheet(f, s, hoodName)} icon={<Printer className="size-4" />}>
                    طباعة بطاقة الواجهة (QR)
                  </Button>
                  {f.published && (
                    <Button variant="outline" onClick={() => window.open(`https://wa.me/?text=${encodeURIComponent(propertyMessage(f, s, 'ar'))}`, '_blank', 'noopener')} icon={<WhatsAppIcon className="size-4" />}>
                      إرسال عبر واتساب
                    </Button>
                  )}
                  {can('delete') && (
                    <Button variant="ghost" className="text-danger" onClick={() => void remove()} icon={<Trash2 className="size-4" />}>
                      حذف العقار
                    </Button>
                  )}
                </div>
              </Card>
            )}
          </div>
        </aside>
      </div>

      {mandateOpen && <MandateDialog key={mandateOpen.id ?? 'new'} property={f} initial={mandateOpen} onClose={() => setMandateOpen(null)} />}
      {shareKit && <ShareKitDialog p={f} onClose={() => setShareKit(false)} />}

      <div className="fixed inset-x-0 bottom-0 z-40 flex gap-2 border-t border-line bg-white/95 p-3 backdrop-blur lg:hidden">
        <Button variant="ghost" className="flex-1" onClick={() => nav('/admin/properties')}>
          رجوع
        </Button>
        <Button variant="gold" className="flex-[2]" loading={pending} onClick={submit} disabled={!canEdit} icon={<Save className="size-4" />}>
          حفظ
        </Button>
      </div>
    </div>
  )
}
