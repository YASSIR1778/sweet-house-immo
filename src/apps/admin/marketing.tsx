import { Copy, Download, ImageIcon, Link2, QrCode, Type } from 'lucide-react'
import QRCode from 'qrcode'
import { useEffect, useMemo, useRef, useState } from 'react'
import { toast } from 'sonner'
import { cityName, placeLabel, propertyTitle } from '@/apps/site/site'
import { FEATURES, SITE_URL } from '@/shared/lib/config'
import { fmtNumber, fmtPhone, fmtPrice, pick } from '@/shared/lib/format'
import { translate } from '@/shared/lib/i18n'
import { propertyPost } from '@/shared/lib/social'
import type { Lang, Property } from '@/shared/lib/types'
import { Button, Modal, Segmented, Textarea, cn } from '@/shared/ui/base'
import { FacebookIcon, WhatsAppIcon } from '@/shared/ui/icons'
import { useNames } from './hooks'
import { LANG_LABEL } from './labels'
import { canvasBlob, drawSocialCard, type SocialFormat } from './social-image'
import { Tabs } from './ui'

const SPEC: Record<Lang, { m2: string; beds: string; baths: string; sale: string; rent: string }> = {
  ar: { m2: 'م²', beds: 'غرف نوم', baths: 'حمامات', sale: 'للبيع', rent: 'للكراء' },
  fr: { m2: 'm²', beds: 'chambres', baths: 'SdB', sale: 'À vendre', rent: 'À louer' },
  es: { m2: 'm²', beds: 'dormitorios', baths: 'baños', sale: 'En venta', rent: 'En alquiler' },
  en: { m2: 'm²', beds: 'bedrooms', baths: 'baths', sale: 'For sale', rent: 'For rent' },
}

function saveBlob(blob: Blob, name: string) {
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = name
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(a.href), 4000)
}

async function copy(text: string, done = 'نُسخ') {
  try {
    await navigator.clipboard.writeText(text)
    toast.success(done)
  } catch {
    toast.error('تعذر النسخ: انسخه يدوياً')
  }
}

/** Everything to advertise a property: a picture for social networks, a ready text, share links. */
export function ShareKitDialog({ p, onClose }: { p: Property; onClose: () => void }) {
  const { s } = useNames()
  const [tab, setTab] = useState<'image' | 'text' | 'links'>('image')
  const [lang, setLang] = useState<Lang>('ar')
  const [format, setFormat] = useState<SocialFormat>('post')
  const [photo, setPhoto] = useState(0)
  const [ready, setReady] = useState(false)
  const canvas = useRef<HTMLCanvasElement>(null)
  const url = `${SITE_URL}/biens/${p.ref}`
  const rent = p.purpose === 'rent'
  const t = SPEC[lang]

  const data = useMemo(() => {
    const hood = pick(s.catalog.neighborhoods.find((n) => n.id === p.neighborhood)?.name, lang)
    return {
      hood,
      place: placeLabel(hood, p.city, lang),
      title: propertyTitle(p, lang),
      price: fmtPrice(p.price, lang, rent),
      type: translate(`type.${p.type}`, lang),
      specs: [p.area ? `${fmtNumber(p.area)} ${t.m2}` : '', p.bedrooms ? `${p.bedrooms} ${t.beds}` : '', p.bathrooms ? `${p.bathrooms} ${t.baths}` : ''].filter(Boolean),
      features: p.features.map((f) => FEATURES[f]?.[lang]).filter((x): x is string => Boolean(x)),
    }
  }, [p, lang, s, rent, t])

  useEffect(() => {
    if (tab !== 'image' || !canvas.current) return
    let alive = true
    setReady(false)
    void drawSocialCard(
      canvas.current,
      { image: p.images[photo] ?? null, badge: rent ? t.rent : t.sale, ref: p.ref, title: data.title, place: data.place, price: data.price, specs: data.specs, agency: pick(s.agency.name, lang), phone: fmtPhone(s.agency.phone), rtl: lang === 'ar' },
      format,
    ).then(() => alive && setReady(true))
    return () => {
      alive = false
    }
  }, [tab, format, lang, photo, p, data, rent, s, t])

  const post = propertyPost(
    {
      purpose: p.purpose,
      title: data.title,
      ref: p.ref,
      price: data.price,
      place: data.place,
      type: data.type,
      area: p.area,
      bedrooms: p.bedrooms,
      bathrooms: p.bathrooms,
      features: data.features,
      url,
      phone: fmtPhone(s.agency.phone),
      agency: pick(s.agency.name, lang),
      tags: [data.hood, cityName(p.city, lang) || p.city],
    },
    lang,
  )

  const downloadImage = async () => {
    if (!canvas.current) return
    const blob = await canvasBlob(canvas.current)
    if (!blob) return toast.error('تعذر حفظ الصورة لأن موقع الصورة الأصلية يمنع ذلك. اختر صورة أخرى أو ارفع الصورة من جديد.')
    saveBlob(blob, `${p.ref}-${format}-${lang}.png`)
  }
  const downloadQr = async () => {
    const dataUrl = await QRCode.toDataURL(url, { margin: 2, width: 800, color: { dark: '#0b1b33', light: '#ffffff' } })
    const blob = await (await fetch(dataUrl)).blob()
    saveBlob(blob, `${p.ref}-qr.png`)
  }

  return (
    <Modal open onClose={onClose} size="xl" title={`التسويق — ${p.ref}`}>
      <div className="space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <Tabs
            value={tab}
            onChange={setTab}
            tabs={[
              { value: 'image', label: <span className="inline-flex items-center gap-1.5"><ImageIcon className="size-4" /> صورة للنشر</span> },
              { value: 'text', label: <span className="inline-flex items-center gap-1.5"><Type className="size-4" /> نص المنشور</span> },
              { value: 'links', label: <span className="inline-flex items-center gap-1.5"><Link2 className="size-4" /> روابط ومشاركة</span> },
            ]}
          />
          <Segmented value={lang} onChange={setLang} options={(['ar', 'fr', 'es', 'en'] as Lang[]).map((l) => ({ value: l, label: LANG_LABEL[l] }))} />
        </div>

        {tab === 'image' && (
          <div className="grid grid-cols-1 gap-5 lg:grid-cols-[1fr_300px]">
            <div className="flex justify-center rounded-2xl bg-sand p-3">
              <canvas ref={canvas} className={cn('h-auto max-h-[62vh] w-auto max-w-full rounded-xl shadow-card transition', !ready && 'opacity-50')} />
            </div>
            <div className="space-y-4">
              <div>
                <div className="label">المقاس</div>
                <Segmented
                  value={format}
                  onChange={setFormat}
                  options={[
                    { value: 'post' as SocialFormat, label: 'منشور 4:5' },
                    { value: 'story' as SocialFormat, label: 'ستوري' },
                    { value: 'square' as SocialFormat, label: 'مربع' },
                  ]}
                  className="flex w-full [&>button]:flex-1 [&>button]:px-2"
                />
              </div>
              {p.images.length > 1 && (
                <div>
                  <div className="label">الصورة</div>
                  <div className="grid grid-cols-4 gap-1.5">
                    {p.images.slice(0, 8).map((src, i) => (
                      <button key={src} type="button" onClick={() => setPhoto(i)} className={cn('aspect-square overflow-hidden rounded-lg border-2', i === photo ? 'border-gold' : 'border-transparent')}>
                        <img src={src} alt="" className="h-full w-full object-cover" loading="lazy" />
                      </button>
                    ))}
                  </div>
                </div>
              )}
              <Button variant="gold" className="w-full" icon={<Download className="size-4" />} disabled={!ready} onClick={() => void downloadImage()}>
                تحميل الصورة
              </Button>
              <p className="text-xs text-muted">مقاسات فيسبوك وإنستغرام وحالات واتساب. انشرها مع نص المنشور.</p>
            </div>
          </div>
        )}

        {tab === 'text' && (
          <div className="space-y-3">
            <Textarea rows={13} dir={lang === 'ar' ? 'rtl' : 'ltr'} value={post} readOnly className="font-sans text-sm leading-relaxed" />
            <div className="flex flex-wrap gap-2">
              <Button icon={<Copy className="size-4" />} onClick={() => void copy(post, 'نُسخ النص: الصقه في فيسبوك أو إنستغرام')}>
                نسخ النص
              </Button>
              <Button variant="whatsapp" icon={<WhatsAppIcon className="size-4" />} onClick={() => window.open(`https://wa.me/?text=${encodeURIComponent(post)}`, '_blank', 'noopener')}>
                إرسال بواتساب
              </Button>
            </div>
          </div>
        )}

        {tab === 'links' && (
          <div className="space-y-3">
            <div className="flex items-center gap-2 rounded-xl bg-ivory p-3">
              <code dir="ltr" className="min-w-0 flex-1 truncate text-sm text-navy">
                {url}
              </code>
              <Button size="sm" variant="outline" icon={<Copy className="size-4" />} onClick={() => void copy(url, 'نُسخ الرابط')}>
                نسخ
              </Button>
            </div>
            {!p.published && <p className="text-xs text-warning">العقار غير منشور: الرابط لن يفتح للزوار حتى تنشره.</p>}
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
              <Button variant="outline" icon={<FacebookIcon className="size-4" />} onClick={() => window.open(`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`, '_blank', 'noopener')}>
                مشاركة على فيسبوك
              </Button>
              <Button variant="outline" icon={<WhatsAppIcon className="size-4" />} onClick={() => window.open(`https://wa.me/?text=${encodeURIComponent(`${data.title}\n${url}`)}`, '_blank', 'noopener')}>
                مشاركة الرابط بواتساب
              </Button>
              <Button variant="outline" icon={<QrCode className="size-4" />} onClick={() => void downloadQr()}>
                تحميل رمز QR
              </Button>
            </div>
          </div>
        )}
      </div>
    </Modal>
  )
}
