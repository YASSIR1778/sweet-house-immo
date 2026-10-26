import QRCode from 'qrcode'
import { toast } from 'sonner'
import { FEATURES, SITE_URL } from '@/shared/lib/config'
import { fmtDate, fmtNumber, fmtPhone, fmtPrice, fmtTime, interpolate, pick } from '@/shared/lib/format'
import { translate } from '@/shared/lib/i18n'
import type { Appointment, Client, Property, Settings } from '@/shared/lib/types'

const esc = (s: string | number | null | undefined) =>
  String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!)

const LOGO = `<svg viewBox="0 0 64 64" width="54" height="54"><rect width="64" height="64" rx="16" fill="#0b1b33"/><path d="M14 50V30c0-10 8-18 18-18s18 8 18 18v20" fill="none" stroke="#c9a24b" stroke-width="3" stroke-linecap="round"/><path d="M32 28l-9 8v12h18V36z" fill="none" stroke="#c9a24b" stroke-width="2.6" stroke-linejoin="round"/><rect x="29" y="40" width="6" height="8" rx="1" fill="#c9a24b"/><path d="M12 50h40" stroke="#c9a24b" stroke-width="2.6" stroke-linecap="round"/><circle cx="32" cy="20" r="2" fill="#c9a24b"/></svg>`

const CSS = `
@page { size: A4; margin: 10mm; }
* { box-sizing: border-box; }
body { margin: 0; font-family: 'IBM Plex Sans Arabic', 'Inter', sans-serif; color: #1a2233; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
.page { width: 190mm; margin: 0 auto; }
.head { display: flex; align-items: center; justify-content: space-between; gap: 12px; background: #0b1b33; color: #fff; border-radius: 14px; padding: 12px 16px; }
.head .brand { display: flex; align-items: center; gap: 12px; }
.head .name { font-family: 'Amiri', serif; font-size: 22px; font-weight: 700; line-height: 1.1; }
.head .sub { color: #e7d39a; font-size: 11px; letter-spacing: .12em; text-transform: uppercase; }
.head .contact { text-align: left; font-size: 12px; line-height: 1.6; direction: ltr; }
.gold { color: #a8832f; }
.badges { display: flex; gap: 6px; margin: 14px 0 6px; }
.badge { display: inline-block; padding: 4px 10px; border-radius: 999px; font-size: 11px; font-weight: 700; background: #efe8d8; color: #0b1b33; }
.badge.sale { background: #c9a24b; color: #060d1b; } .badge.rent { background: #0f766e; color: #fff; }
h1 { font-family: 'Amiri', serif; font-size: 26px; line-height: 1.25; margin: 4px 0 2px; color: #0b1b33; }
.fr { direction: ltr; text-align: left; color: #5b6475; font-size: 13px; }
.photos { display: grid; grid-template-columns: 2fr 1fr; gap: 6px; margin-top: 12px; height: 92mm; }
.photos img { width: 100%; height: 100%; object-fit: cover; border-radius: 12px; display: block; }
.photos .side { display: grid; grid-template-rows: 1fr 1fr; gap: 6px; min-height: 0; }
.photos .side img { min-height: 0; }
.price { display: flex; align-items: baseline; justify-content: space-between; margin-top: 12px; padding: 10px 16px; border: 2px solid #c9a24b; border-radius: 14px; }
.price b { font-size: 30px; font-family: Inter, sans-serif; color: #0b1b33; direction: ltr; }
.specs { display: grid; grid-template-columns: repeat(4, 1fr); gap: 6px; margin-top: 10px; }
.spec { background: #f8f5ee; border-radius: 10px; padding: 7px 10px; }
.spec small { display: block; color: #5b6475; font-size: 10px; }
.spec strong { font-size: 14px; color: #0b1b33; }
.feat { margin-top: 10px; display: flex; flex-wrap: wrap; gap: 5px; }
.feat span { font-size: 11px; border: 1px solid #d7cfbd; border-radius: 999px; padding: 3px 9px; }
.desc { margin-top: 10px; font-size: 12.5px; line-height: 1.75; max-height: 34mm; overflow: hidden; }
.foot { display: flex; align-items: center; gap: 14px; margin-top: 12px; padding-top: 10px; border-top: 1px solid #e6e0d3; }
.foot img { width: 30mm; height: 30mm; }
.foot .t { font-size: 13px; line-height: 1.6; }
.foot .big { font-size: 20px; font-weight: 800; direction: ltr; display: inline-block; color: #0b1b33; font-family: Inter, sans-serif; }
.num { font-family: Inter, sans-serif; direction: ltr; unicode-bidi: embed; }
/* voucher */
.vtitle { text-align: center; margin: 18px 0 6px; }
.vtitle h1 { margin: 0; }
.vtitle .no { color: #5b6475; font-size: 12px; }
table.v { width: 100%; border-collapse: collapse; margin-top: 12px; font-size: 13px; }
table.v th, table.v td { border: 1px solid #d7cfbd; padding: 9px 10px; vertical-align: top; }
table.v th { width: 34%; background: #f8f5ee; text-align: right; font-weight: 600; }
table.v th small { display: block; color: #5b6475; font-weight: 400; direction: ltr; text-align: right; }
.clause { margin-top: 14px; padding: 12px 14px; border-radius: 12px; background: #f8f5ee; font-size: 12.5px; line-height: 1.8; }
.clause.fr { direction: ltr; text-align: justify; margin-top: 8px; }
.sign { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; margin-top: 18px; }
.sign div { border: 1px dashed #b9ad92; border-radius: 12px; height: 34mm; padding: 8px 10px; font-size: 12px; color: #5b6475; }
.small { font-size: 10.5px; color: #96a0b0; text-align: center; margin-top: 12px; }
`

function openPrint(title: string, body: string) {
  const w = window.open('', '_blank', 'width=900,height=1100')
  if (!w) {
    toast.error('اسمح للمتصفح بفتح النوافذ المنبثقة لهذا الموقع ثم أعد المحاولة.')
    return
  }
  w.document.open()
  w.document.write(`<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><title>${esc(title)}</title>
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Amiri:wght@700&family=IBM+Plex+Sans+Arabic:wght@400;600;700&family=Inter:wght@500;700;800&display=swap" rel="stylesheet">
<style>${CSS}</style></head><body><div class="page">${body}</div>
<script>window.addEventListener('load',function(){setTimeout(function(){window.focus();window.print()},350)})</script></body></html>`)
  w.document.close()
}

function header(s: Settings) {
  return `<div class="head"><div class="brand">${LOGO}<div><div class="name">${esc(pick(s.agency.name, 'ar'))}</div><div class="sub">${esc(pick(s.agency.name, 'fr'))}</div></div></div>
  <div class="contact"><div>☎ ${esc(fmtPhone(s.agency.phone))}</div><div>WhatsApp +${esc(s.agency.whatsapp.replace(/^\+/, ''))}</div>${s.agency.email ? `<div>${esc(s.agency.email)}</div>` : ''}</div></div>`
}

/** A4 sheet for the agency window / to hand to clients, with a QR code to the online page. */
export async function printPropertySheet(p: Property, s: Settings, hoodName: (id: string) => string) {
  const link = `${SITE_URL}/biens/${p.ref}`
  const qr = await QRCode.toDataURL(link, { margin: 1, width: 360, color: { dark: '#0b1b33', light: '#ffffff' } })
  const rent = p.purpose === 'rent'
  const imgs = p.images.length ? p.images : []
  const spec = (label: string, v: string | number | null | undefined) => (v == null || v === '' ? '' : `<div class="spec"><small>${esc(label)}</small><strong class="num">${esc(v)}</strong></div>`)
  const specs = [
    spec('النوع', translate(`type.${p.type}`, 'ar')),
    spec('المساحة', p.area ? `${fmtNumber(p.area)} m²` : null),
    spec('مساحة الأرض', p.land_area ? `${fmtNumber(p.land_area)} m²` : null),
    spec('الغرف', p.rooms),
    spec('غرف النوم', p.bedrooms),
    spec('الحمامات', p.bathrooms),
    spec('الطابق', p.floor),
    spec('الحي', hoodName(p.neighborhood)),
    spec('مفروش', p.furnished ? 'نعم' : 'لا'),
  ].join('')
  const photos = imgs.length
    ? `<div class="photos" style="${imgs.length < 3 ? 'grid-template-columns:1fr' : ''}"><img src="${esc(imgs[0])}">${imgs.length >= 3 ? `<div class="side"><img src="${esc(imgs[1])}"><img src="${esc(imgs[2])}"></div>` : ''}</div>`
    : ''
  const body = `${header(s)}
  <div class="badges"><span class="badge ${rent ? 'rent' : 'sale'}">${rent ? 'للكراء · À louer' : 'للبيع · À vendre'}</span><span class="badge num">${esc(p.ref)}</span></div>
  <h1>${esc(p.title)}</h1>${p.title_fr ? `<div class="fr">${esc(p.title_fr)}</div>` : ''}
  ${photos}
  <div class="price"><span>${rent ? 'ثمن الكراء الشهري' : 'الثمن'}</span><b>${esc(fmtPrice(p.price, 'fr', rent))}</b></div>
  <div class="specs">${specs}</div>
  ${p.features.length ? `<div class="feat">${p.features.map((f) => `<span>${esc(FEATURES[f]?.ar ?? f)}</span>`).join('')}</div>` : ''}
  <div class="desc">${esc(p.description)}</div>
  <div class="foot"><img src="${qr}" alt="QR"><div class="t">امسح الرمز لمشاهدة كل الصور والموقع على الخريطة<br><span class="fr">Scannez pour voir toutes les photos · Escanee para ver todas las fotos</span><br>للزيارة والاستفسار: <span class="big">${esc(fmtPhone(s.agency.phone))}</span></div></div>`
  openPrint(`${p.ref} — ${p.title}`, body)
}

/** Bilingual visit voucher (bon de visite) signed by the visitor. */
export function printVisitVoucher(a: Appointment, p: Property | undefined, c: Client | undefined, s: Settings, hoodName: (id: string) => string, agentName: string) {
  const agency = pick(s.agency.name, 'ar')
  const agencyFr = pick(s.agency.name, 'fr')
  const no = a.id.replace(/[^a-z0-9]/gi, '').slice(-6).toUpperCase()
  const row = (ar: string, fr: string, v: string) => `<tr><th>${esc(ar)}<small>${esc(fr)}</small></th><td>${v}</td></tr>`
  const blank = '<span style="color:#b9ad92">............................................</span>'
  const body = `${header(s)}
  <div class="vtitle"><h1>ورقة الزيارة · Bon de visite</h1><div class="no">N° <span class="num">${esc(no)}</span></div></div>
  <table class="v">
    ${row('التاريخ والساعة', 'Date et heure', `<span class="num">${esc(fmtDate(a.starts_at, 'fr', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }))} — ${esc(fmtTime(a.starts_at, 'fr'))}</span>`)}
    ${row('اسم الزائر', 'Nom du visiteur', c ? esc(c.full_name) : blank)}
    ${row('رقم البطاقة الوطنية / الجواز', 'CIN / Passeport', blank)}
    ${row('الهاتف', 'Téléphone', c?.phone ? `<span class="num">${esc(fmtPhone(c.phone))}</span>` : blank)}
    ${row('العقار', 'Bien visité', p ? `<b class="num">${esc(p.ref)}</b> — ${esc(translate(`type.${p.type}`, 'ar'))} · ${esc(hoodName(p.neighborhood))}${p.address ? ` · ${esc(p.address)}` : ''}<br><span style="color:#5b6475">${esc(p.title)}</span>` : blank)}
    ${row('الثمن المعروض', 'Prix affiché', p ? `<span class="num">${esc(fmtPrice(p.price, 'fr', p.purpose === 'rent'))}</span>` : blank)}
    ${row('مرافق الزيارة', 'Visite accompagnée par', esc(agentName))}
  </table>
  <div class="clause">${esc(interpolate(pick(s.site.visit_clause, 'ar'), { agency }))}</div>
  <div class="clause fr">${esc(interpolate(s.site.visit_clause.fr || '', { agency: agencyFr }))}</div>
  <div class="sign"><div>توقيع الزائر (مع عبارة «قرأت ووافقت»)<br><span class="fr">Signature du visiteur (précédée de « lu et approuvé »)</span></div><div>توقيع وختم الوكالة<br><span class="fr">Signature et cachet de l’agence</span></div></div>
  <div class="small">${esc(pick(s.agency.address, 'ar'))} · ${esc(fmtPhone(s.agency.phone))}</div>`
  openPrint(`Bon de visite ${no}`, body)
}
