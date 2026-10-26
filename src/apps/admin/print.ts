import QRCode from 'qrcode'
import { toast } from 'sonner'
import { FEATURES, SITE_URL } from '@/shared/lib/config'
import { fmtDate, fmtNumber, fmtPhone, fmtPrice, fmtTime, interpolate, pick } from '@/shared/lib/format'
import { translate } from '@/shared/lib/i18n'
import { amountInWordsFr } from '@/shared/lib/billing'
import { daysOnMarket } from '@/shared/lib/owners'
import type { Appointment, BillingSettings, Client, Invoice, Mandate, OwnerReport, PayMethod, Payment, Property, Settings } from '@/shared/lib/types'
import { KEYS, MANDATE_KIND, PAY_METHOD, PROPERTY_STATUS } from './labels'

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

/* invoice / receipt */
.inv-top { display: grid; grid-template-columns: 1.25fr 1fr; gap: 14px; margin-top: 14px; direction: ltr; text-align: left; }
.inv-top .seller { font-size: 11.5px; line-height: 1.65; }
.inv-top .who { font-size: 16px; font-weight: 800; color: #0b1b33; font-family: Inter, sans-serif; }
.inv-top .ids { color: #5b6475; font-size: 10.5px; }
.inv-top .doc { border: 2px solid #c9a24b; border-radius: 14px; padding: 10px 14px; }
.inv-top .ttl { display: flex; justify-content: space-between; align-items: baseline; gap: 8px; }
.inv-top .ttl .t { font-size: 20px; font-weight: 800; letter-spacing: .05em; color: #0b1b33; font-family: Inter, sans-serif; }
.inv-top .ttl .ta { font-family: 'Amiri', serif; font-size: 18px; color: #a8832f; }
.inv-top .doc table { width: 100%; font-size: 12px; margin-top: 6px; border-collapse: collapse; }
.inv-top .doc td { padding: 2px 0; }
.inv-top .doc td:last-child { text-align: right; }
.client { direction: ltr; text-align: left; margin-top: 12px; padding: 10px 14px; background: #f8f5ee; border-radius: 12px; font-size: 12.5px; line-height: 1.6; }
.client small { display: block; color: #5b6475; font-size: 10px; letter-spacing: .08em; text-transform: uppercase; }
.client b { font-size: 15px; color: #0b1b33; }
table.lines { width: 100%; border-collapse: collapse; margin-top: 14px; font-size: 12.5px; direction: ltr; text-align: left; }
table.lines th { background: #0b1b33; color: #fff; padding: 7px 10px; font-weight: 600; text-align: left; }
table.lines th small { display: block; color: #e7d39a; font-weight: 400; font-size: 10px; }
table.lines td { border-bottom: 1px solid #e6e0d3; padding: 9px 10px; vertical-align: top; }
table.lines .n { text-align: right; white-space: nowrap; font-family: Inter, sans-serif; }
.sum { display: grid; grid-template-columns: 1fr 72mm; gap: 14px; align-items: start; margin-top: 12px; direction: ltr; text-align: left; }
.sum .words { font-size: 12px; line-height: 1.7; padding-top: 6px; }
table.totals { width: 100%; border-collapse: collapse; font-size: 13px; }
table.totals td { padding: 6px 10px; border-bottom: 1px solid #e6e0d3; }
table.totals td:last-child { text-align: right; font-family: Inter, sans-serif; white-space: nowrap; }
table.totals tr.ttc td { background: #0b1b33; color: #fff; font-weight: 800; font-size: 15px; border: 0; }
.note { direction: ltr; text-align: left; font-size: 11.5px; color: #5b6475; margin: 8px 0 0; }
.sign.one { grid-template-columns: 1fr; justify-items: end; }
.sign.one div { width: 72mm; }
.legal { margin-top: 14px; padding-top: 8px; border-top: 1px solid #e6e0d3; direction: ltr; text-align: center; font-size: 9.5px; color: #5b6475; line-height: 1.55; }
.void { position: fixed; top: 38%; left: 0; right: 0; text-align: center; font: 800 64px Inter, sans-serif; color: rgba(185, 28, 28, .15); transform: rotate(-18deg); pointer-events: none; }
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

export interface StatementRow {
  date: string
  ref: string
  kind: string
  amount: number
  commission: number
  share: number
  paid: number
}

/** Account statement of a partner: his share of each deal, what was paid, what is left. */
export function printPartnerStatement(name: string, sub: string, rows: StatementRow[], s: Settings) {
  const total = rows.reduce((a, r) => a + r.share, 0)
  const paid = rows.reduce((a, r) => a + r.paid, 0)
  const td = (v: string | number, num = true) => `<td${num ? ' class="num"' : ''}>${esc(v)}</td>`
  const body = `${header(s)}
  <div class="vtitle"><h1>كشف حساب الشريك</h1><div class="no">${esc(name)}${sub ? ` · ${esc(sub)}` : ''} · ${esc(fmtDate(new Date().toISOString()))}</div></div>
  <table class="v" style="font-size:12px"><thead><tr><th style="width:auto">التاريخ</th><th style="width:auto">العقار</th><th style="width:auto">النوع</th><th style="width:auto">ثمن الصفقة</th><th style="width:auto">العمولة</th><th style="width:auto">حصتك</th><th style="width:auto">المدفوع</th><th style="width:auto">الباقي</th></tr></thead><tbody>
  ${rows.map((r) => `<tr>${td(fmtDate(r.date))}${td(r.ref || '—')}${td(r.kind, false)}${td(fmtNumber(r.amount))}${td(fmtNumber(r.commission))}<td class="num"><b>${esc(fmtNumber(r.share))}</b></td>${td(fmtNumber(r.paid))}${td(fmtNumber(Math.max(0, r.share - r.paid)))}</tr>`).join('')}
  </tbody><tfoot><tr><th colspan="5" style="text-align:right">المجموع بالدرهم</th><td class="num"><b>${esc(fmtNumber(total))}</b></td><td class="num">${esc(fmtNumber(paid))}</td><td class="num"><b>${esc(fmtNumber(Math.max(0, total - paid)))}</b></td></tr></tfoot></table>
  <div class="sign"><div>توقيع الشريك<br><span class="fr">Signature du partenaire</span></div><div>توقيع وختم الوكالة<br><span class="fr">Signature et cachet de l’agence</span></div></div>`
  openPrint(`كشف حساب ${name}`, body)
}

/** A cost estimate to hand to a client (buyer or seller). */
export function printCostQuote(title: string, intro: string, rows: { label: string; amount: number; note?: string }[], totals: { label: string; amount: number; strong?: boolean }[], notes: string[], s: Settings) {
  const body = `${header(s)}
  <div class="vtitle"><h1>${esc(title)}</h1><div class="no">${esc(fmtDate(new Date().toISOString()))}</div></div>
  <p style="font-size:13px;color:#5b6475">${esc(intro)}</p>
  <table class="v"><tbody>
  ${rows.map((r) => `<tr><th>${esc(r.label)}${r.note ? `<small>${esc(r.note)}</small>` : ''}</th><td class="num" style="text-align:left">${esc(fmtNumber(r.amount))} DH</td></tr>`).join('')}
  ${totals.map((t) => `<tr><th style="background:${t.strong ? '#0b1b33;color:#fff' : '#efe8d8'}">${esc(t.label)}</th><td class="num" style="text-align:left;font-weight:800;${t.strong ? 'font-size:16px' : ''}">${esc(fmtNumber(t.amount))} DH</td></tr>`).join('')}
  </tbody></table>
  ${notes.map((n) => `<div class="clause">${esc(n)}</div>`).join('')}`
  openPrint(title, body)
}

/** Bilingual mandate (authorisation to sell / rent) signed by the owner. */
export function printMandate(m: Mandate, p: Property, owner: Client | undefined, s: Settings, hoodName: (id: string) => string) {
  const agency = pick(s.agency.name, 'ar')
  const agencyFr = pick(s.agency.name, 'fr')
  const rent = m.purpose === 'rent'
  const no = m.id.replace(/[^a-z0-9]/gi, '').slice(-6).toUpperCase()
  const row = (ar: string, fr: string, v: string) => `<tr><th>${esc(ar)}<small>${esc(fr)}</small></th><td>${v}</td></tr>`
  const blank = '<span style="color:#b9ad92">............................................</span>'
  const money = (n: number | null | undefined) => (n == null ? blank : `<span class="num">${esc(fmtPrice(n, 'fr', rent))}</span>`)
  const commission =
    m.commission_amount != null && m.commission_amount > 0
      ? `<span class="num">${esc(fmtPrice(m.commission_amount, 'fr'))}</span>`
      : m.commission_rate != null && m.commission_rate > 0
        ? rent
          ? `<span class="num">${esc(m.commission_rate)}</span> شهر كراء · mois de loyer`
          : `<span class="num">${esc(m.commission_rate)}%</span> من الثمن · du prix`
        : blank
  const vars = (lang: 'ar' | 'fr') => ({
    agency: lang === 'ar' ? agency : agencyFr,
    purpose: lang === 'ar' ? (rent ? 'للكراء' : 'للبيع') : rent ? 'à la location' : 'à la vente',
    party: lang === 'ar' ? (rent ? 'مكترٍ' : 'مشترٍ') : rent ? 'locataire' : 'acquéreur',
  })
  const clause = s.site.mandate_clause
  const exclusive = s.site.mandate_exclusive
  const body = `${header(s)}
  <div class="vtitle"><h1>${rent ? 'تفويض بالكراء · Mandat de location' : 'تفويض بالبيع · Mandat de vente'}</h1><div class="no">${esc(MANDATE_KIND[m.kind].label)} · ${m.kind === 'exclusive' ? 'Exclusif' : 'Simple'} · N° <span class="num">${esc(no)}</span></div></div>
  <table class="v">
    ${row('المالك', 'Propriétaire', owner ? esc(owner.full_name) : blank)}
    ${row('رقم البطاقة الوطنية', 'CIN', blank)}
    ${row('الهاتف', 'Téléphone', owner?.phone ? `<span class="num">${esc(fmtPhone(owner.phone))}</span>` : blank)}
    ${row('العقار', 'Bien', `<b class="num">${esc(p.ref)}</b> — ${esc(translate(`type.${p.type}`, 'ar'))} · ${esc(hoodName(p.neighborhood))}${p.address ? ` · ${esc(p.address)}` : ''}<br><span style="color:#5b6475">${esc(p.title)}</span>`)}
    ${row('رقم الرسم العقاري', 'Titre foncier', blank)}
    ${row(rent ? 'ثمن الكراء المعروض' : 'الثمن المعروض', rent ? 'Loyer demandé' : 'Prix demandé', money(m.price ?? p.price))}
    ${row(rent ? 'الصافي للمالك' : 'الصافي للبائع', 'Net propriétaire', money(m.net_price))}
    ${row('عمولة الوكالة على المالك', 'Commission due par le propriétaire', commission)}
    ${row('مدة التفويض', 'Durée du mandat', `<span class="num">${esc(fmtDate(m.start_date, 'fr'))}</span> — <span class="num">${m.end_date ? esc(fmtDate(m.end_date, 'fr')) : blank}</span>`)}
    ${row('المفاتيح', 'Clés', `${esc(KEYS[m.keys])}${m.keys_notes ? ` · ${esc(m.keys_notes)}` : ''}`)}
    ${row('شروط الزيارة', 'Conditions de visite', m.visit_terms ? esc(m.visit_terms) : blank)}
  </table>
  ${clause ? `<div class="clause">${esc(interpolate(pick(clause, 'ar'), vars('ar')))}</div><div class="clause fr">${esc(interpolate(clause.fr || '', vars('fr')))}</div>` : ''}
  ${m.kind === 'exclusive' && exclusive ? `<div class="clause"><b>${esc(interpolate(pick(exclusive, 'ar'), vars('ar')))}</b></div><div class="clause fr"><b>${esc(interpolate(exclusive.fr || '', vars('fr')))}</b></div>` : ''}
  <div class="sign"><div>توقيع المالك مع عبارة «قرأت ووافقت»<br><span class="fr">Signature du propriétaire, précédée de « lu et approuvé »</span></div><div>توقيع وختم الوكالة<br><span class="fr">Signature et cachet de l’agence</span></div></div>
  <div class="small">حُرر في نسختين · Fait en deux exemplaires · ${esc(fmtDate(new Date().toISOString(), 'fr'))}</div>`
  openPrint(`${rent ? 'Mandat de location' : 'Mandat de vente'} ${p.ref}`, body)
}

/** «مهتمون 1 من 3 · الثمن مرتفع عند 2» */
function opinion(f: OwnerReport['properties'][number]['feedback']): string {
  if (!f) return '—'
  const total = f.hot + f.warm + f.cold
  const parts = [total ? `مهتمون <span class="num">${f.hot}</span> من <span class="num">${total}</span>` : '', f.price_high ? `الثمن مرتفع عند <span class="num">${f.price_high}</span>` : '']
  return parts.filter(Boolean).join(' · ') || '—'
}

/** The owner's activity report, with a QR code to his private follow-up page. */
export async function printOwnerReport(r: OwnerReport, ownerName: string, link: string | null, s: Settings) {
  const qr = link ? await QRCode.toDataURL(link, { margin: 1, width: 320, color: { dark: '#0b1b33', light: '#ffffff' } }) : null
  const rows = r.properties
    .map((p) => {
      const first = p.prices[0]?.price
      const change = first && first !== p.price ? ` <small>(${p.price < first ? '-' : '+'}${Math.abs(Math.round(((p.price - first) / first) * 100))}%)</small>` : ''
      return `<tr><td class="num"><b>${esc(p.ref)}</b></td><td>${esc(p.title)}<br><small style="color:#5b6475">${esc(PROPERTY_STATUS[p.status].label)}${p.mandate ? ` · ${esc(MANDATE_KIND[p.mandate.kind].label)}` : ''}</small></td><td class="num">${esc(fmtPrice(p.price, 'fr', p.purpose === 'rent'))}${change}</td><td class="num">${daysOnMarket(p.created_at)}</td><td class="num">${p.views}</td><td class="num">${p.leads}</td><td class="num">${p.visits_done}${p.visits_planned ? ` + ${p.visits_planned}` : ''}</td><td class="num">${p.offers ?? 0}</td><td>${opinion(p.feedback)}</td></tr>`
    })
    .join('')
  const body = `${header(s)}
  <div class="vtitle"><h1>تقرير المالك · Rapport propriétaire</h1><div class="no">${esc(ownerName)} · ${esc(fmtDate(r.generated_at, 'fr'))}</div></div>
  <table class="v" style="font-size:12px"><thead><tr><th style="width:auto">المرجع</th><th style="width:auto">العقار</th><th style="width:auto">الثمن</th><th style="width:auto">أيام العرض</th><th style="width:auto">المشاهدات</th><th style="width:auto">الطلبات</th><th style="width:auto">الزيارات</th><th style="width:auto">العروض</th><th style="width:auto">رأي الزوار</th></tr></thead><tbody>${rows || '<tr><td colspan="9">—</td></tr>'}</tbody></table>
  <p style="font-size:11px;color:#5b6475">الزيارات: المنجزة + المبرمجة · Visites : effectuées + prévues · رأي الزوار دون أسمائهم · Avis des visiteurs, anonymes</p>
  ${qr ? `<div class="foot"><img src="${qr}" alt="QR"><div class="t">امسح الرمز لمتابعة عقاركم مباشرة في أي وقت<br><span class="fr">Scannez pour suivre votre bien en direct</span></div></div>` : ''}`
  openPrint(`Rapport ${ownerName}`, body)
}

/* ------------------------------------------------------------------ */
/* Invoices and receipts (French, with Arabic labels)                   */
/* ------------------------------------------------------------------ */
const PAY_FR: Record<PayMethod, string> = { cash: 'Espèces', transfer: 'Virement bancaire', cheque: 'Chèque', card: 'Carte bancaire', other: 'Autre' }
const money2 = (n: number) => new Intl.NumberFormat('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n).replace(/[  ]/g, ' ')
const dmy = (iso: string) => iso.slice(0, 10).split('-').reverse().join('/')

/** Legal identity line (article 145 of the tax code): name, form, capital, address, RC, IF, ICE, TP, CNSS. */
function legalLine(b: BillingSettings, s: Settings): string {
  const parts = [
    b.company || pick(s.agency.name, 'fr'),
    b.legal_form,
    b.capital ? `capital ${b.capital}` : '',
    [b.address, b.city && !b.address.includes(b.city) ? b.city : ''].filter(Boolean).join(', '),
    b.rc ? `RC ${b.rc}` : '',
    b.fiscal_id ? `IF ${b.fiscal_id}` : '',
    b.ice ? `ICE ${b.ice}` : '',
    b.tp ? `TP ${b.tp}` : '',
    b.cnss ? `CNSS ${b.cnss}` : '',
  ]
  return esc(parts.filter(Boolean).join(' · '))
}

/** A4 invoice or credit note, with the amount in words. */
export function printInvoice(inv: Invoice, b: BillingSettings, s: Settings, original?: Invoice | null) {
  const credit = inv.kind === 'credit'
  const rate = inv.vat_rate || 0
  const ids = [b.rc && `RC ${esc(b.rc)}`, b.fiscal_id && `IF ${esc(b.fiscal_id)}`, b.ice && `ICE ${esc(b.ice)}`, b.tp && `TP ${esc(b.tp)}`, b.cnss && `CNSS ${esc(b.cnss)}`].filter(Boolean).join(' · ')
  const lines = inv.lines
    .map((l) => `<tr><td>${esc(l.label)}</td><td class="n">${esc(l.qty)}</td><td class="n">${money2(l.unit)}</td><td class="n">${money2(Math.round(l.qty * l.unit * 100) / 100)}</td></tr>`)
    .join('')
  const body = `${header(s)}
  ${inv.status === 'cancelled' ? '<div class="void">ANNULÉE · ملغاة</div>' : ''}
  <div class="inv-top">
    <div class="seller">
      <div class="who">${esc(b.company || pick(s.agency.name, 'fr'))}</div>
      ${b.legal_form || b.capital ? `<div>${esc([b.legal_form, b.capital ? `au capital de ${b.capital}` : ''].filter(Boolean).join(' · '))}</div>` : ''}
      <div>${esc([b.address, b.city && !b.address.includes(b.city) ? b.city : ''].filter(Boolean).join(', '))}</div>
      <div>Tél. ${esc(fmtPhone(s.agency.phone))}${s.agency.email ? ` · ${esc(s.agency.email)}` : ''}</div>
      ${ids ? `<div class="ids">${ids}</div>` : ''}
    </div>
    <div class="doc">
      <div class="ttl"><span class="t">${credit ? 'AVOIR' : 'FACTURE'}</span><span class="ta">${credit ? 'فاتورة مضادة' : 'فاتورة'}</span></div>
      <table>
        <tr><td>N°</td><td class="num"><b>${esc(inv.no)}</b></td></tr>
        <tr><td>Date</td><td class="num">${dmy(inv.issued_at)}</td></tr>
        ${credit ? (original ? `<tr><td>Sur facture</td><td class="num">${esc(original.no)} du ${dmy(original.issued_at)}</td></tr>` : '') : `<tr><td>Échéance</td><td class="num">${inv.due_at ? dmy(inv.due_at) : 'À réception'}</td></tr>`}
      </table>
    </div>
  </div>
  <div class="client"><small>Facturé à · الزبون</small><b>${esc(inv.bill_name)}</b>${inv.bill_address ? `<div>${esc(inv.bill_address)}</div>` : ''}${inv.bill_ice ? `<div>ICE <span class="num">${esc(inv.bill_ice)}</span></div>` : ''}</div>
  <table class="lines"><thead><tr><th>Désignation<small>البيان</small></th><th class="n">Qté</th><th class="n">P.U. ${rate ? 'HT' : ''}</th><th class="n">Montant ${rate ? 'HT' : ''}</th></tr></thead><tbody>${lines}</tbody></table>
  <div class="sum">
    <div class="words">Arrêté${credit ? 'e la présente facture d’avoir' : 'e la présente facture'} à la somme de :<br><b>${esc(amountInWordsFr(Math.abs(inv.total_ttc)))}${rate ? ' TTC' : ''}</b>${credit ? ' (en faveur du client)' : ''}.</div>
    <table class="totals">
      ${rate ? `<tr><td>Total HT</td><td>${money2(inv.total_ht)}</td></tr><tr><td>TVA ${esc(rate)} %</td><td>${money2(inv.total_vat)}</td></tr>` : ''}
      <tr class="ttc"><td>${rate ? 'Total TTC' : 'Total'}</td><td>${money2(inv.total_ttc)} DH</td></tr>
    </table>
  </div>
  ${rate ? '' : '<p class="note">TVA non applicable.</p>'}
  ${!credit && b.rib ? `<p class="note">Règlement par virement${b.bank ? ` — ${esc(b.bank)}` : ''} — RIB <span class="num">${esc(b.rib)}</span></p>` : ''}
  ${inv.notes ? `<p class="note">${esc(inv.notes)}</p>` : ''}
  <div class="sign one"><div>Cachet et signature<br><span class="fr">ختم وتوقيع الوكالة</span></div></div>
  <div class="legal">${legalLine(b, s)}${b.footer ? `<br>${esc(b.footer)}` : ''}</div>`
  openPrint(`${credit ? 'Avoir' : 'Facture'} ${inv.no}`, body)
}

/** Receipt for money received, with the amount in words. */
export function printReceipt(p: Payment, b: BillingSettings, s: Settings, about: string) {
  const row = (ar: string, fr: string, v: string) => `<tr><th>${esc(ar)}<small>${esc(fr)}</small></th><td>${v}</td></tr>`
  const body = `${header(s)}
  ${p.status === 'cancelled' ? '<div class="void">ANNULÉ · ملغى</div>' : ''}
  <div class="vtitle"><h1>وصل استلام · Reçu</h1><div class="no">N° <span class="num">${esc(p.no)}</span> · ${esc(b.city || 'Tétouan')}, le <span class="num">${dmy(p.received_at)}</span></div></div>
  <table class="v">
    ${row('استلمنا من', 'Reçu de', `<b>${esc(p.payer_name)}</b>`)}
    ${row('المبلغ', 'La somme de', `<b class="num" style="font-size:18px">${money2(p.amount)} DH</b><div class="fr">${esc(amountInWordsFr(p.amount))}</div>`)}
    ${row('طريقة الأداء', 'Mode de paiement', `${esc(PAY_METHOD[p.method])} · ${esc(PAY_FR[p.method])}${p.reference ? ` — <span class="num">${esc(p.reference)}</span>` : ''}`)}
    ${row('مقابل', 'En règlement de', esc(about))}
    ${p.notes ? row('ملاحظات', 'Notes', esc(p.notes)) : ''}
  </table>
  <div class="sign"><div>توقيع المؤدي<br><span class="fr">Signature du payeur</span></div><div>توقيع وختم الوكالة<br><span class="fr">Cachet et signature de l’agence</span></div></div>
  <div class="legal">${legalLine(b, s)}</div>`
  openPrint(`Reçu ${p.no}`, body)
}
