import type { Lang } from './types'

/*
 * Ready-to-post texts for Facebook, Instagram and WhatsApp, and the message asking a client for
 * a review. Pure functions (tests: npm run test:social).
 */

export interface PostInput {
  purpose: 'sale' | 'rent'
  title: string
  ref: string
  /** «1 150 000 DH» already formatted for the language */
  price: string
  place: string
  type: string
  area: number | null
  bedrooms: number | null
  bathrooms: number | null
  features: string[]
  url: string
  phone: string
  agency: string
  /** neighbourhood and city names used for hashtags */
  tags: string[]
}

const T: Record<Lang, { sale: string; rent: string; area: string; beds: string; baths: string; ref: string; call: string; more: string; base: string[] }> = {
  ar: { sale: 'للبيع', rent: 'للكراء', area: 'م²', beds: 'غرف نوم', baths: 'حمامات', ref: 'المرجع', call: 'للاتصال والواتساب', more: 'كل الصور والتفاصيل', base: ['عقارات', 'تطوان', 'سويت_هاوس'] },
  fr: { sale: 'À vendre', rent: 'À louer', area: 'm²', beds: 'chambres', baths: 'salles de bain', ref: 'Réf.', call: 'Appel et WhatsApp', more: 'Toutes les photos et détails', base: ['immobilier', 'Tetouan', 'Maroc'] },
  es: { sale: 'En venta', rent: 'En alquiler', area: 'm²', beds: 'dormitorios', baths: 'baños', ref: 'Ref.', call: 'Llamada y WhatsApp', more: 'Todas las fotos y detalles', base: ['inmobiliaria', 'Tetuan', 'Marruecos'] },
  en: { sale: 'For sale', rent: 'For rent', area: 'm²', beds: 'bedrooms', baths: 'bathrooms', ref: 'Ref.', call: 'Call & WhatsApp', more: 'All photos and details', base: ['realestate', 'Tetouan', 'Morocco'] },
}
const KIND: Record<Lang, { sale: string; rent: string }> = {
  ar: { sale: 'للبيع', rent: 'للكراء' },
  fr: { sale: 'a_vendre', rent: 'a_louer' },
  es: { sale: 'en_venta', rent: 'en_alquiler' },
  en: { sale: 'for_sale', rent: 'for_rent' },
}

/** «#مرتيل» from a name: spaces become underscores, punctuation goes. */
export function hashtag(word: string): string {
  const w = word
    .normalize('NFC')
    .replace(/[’'`´]/g, '')
    .replace(/[^\p{L}\p{N}]+/gu, '_')
    .replace(/^_+|_+$/g, '')
  return w ? `#${w}` : ''
}

export function postHashtags(p: Pick<PostInput, 'purpose' | 'type' | 'tags'>, lang: Lang): string[] {
  const t = T[lang] ?? T.ar
  const list = [...p.tags, `${p.type}_${KIND[lang][p.purpose]}`, ...t.base].map(hashtag).filter(Boolean)
  return [...new Set(list)].slice(0, 9)
}

export function propertyPost(p: PostInput, lang: Lang): string {
  const t = T[lang] ?? T.ar
  const specs = [p.area ? `${p.area} ${t.area}` : '', p.bedrooms ? `${p.bedrooms} ${t.beds}` : '', p.bathrooms ? `${p.bathrooms} ${t.baths}` : ''].filter(Boolean).join(' · ')
  const lines = [
    `🏡 ${p.purpose === 'rent' ? t.rent : t.sale} — ${p.title}`,
    `📍 ${p.place}`,
    `💰 ${p.price}`,
    specs ? `📐 ${specs}` : '',
    p.features.length ? `✨ ${p.features.slice(0, 4).join(' · ')}` : '',
    `🔑 ${t.ref} ${p.ref}`,
    `📞 ${t.call}: ${p.phone}`,
    `👉 ${t.more}: ${p.url}`,
    '',
    postHashtags(p, lang).join(' '),
  ]
  return lines.filter((l, i) => l !== '' || i === lines.length - 2).join('\n')
}

const REVIEW: Record<Lang, string> = {
  ar: 'السلام عليكم {name}، شكراً لثقتكم في {agency}. يسعدنا أن تشاركونا رأيكم في خدمتنا في دقيقة واحدة، فهو يساعد أسراً أخرى على اختيار وكالتها: {link}',
  fr: 'Bonjour {name}, merci pour votre confiance envers {agency}. Votre avis sur notre service (une minute) aide d’autres familles à choisir leur agence : {link}',
  es: 'Hola {name}, gracias por confiar en {agency}. Su opinión sobre nuestro servicio (un minuto) ayuda a otras familias a elegir su agencia: {link}',
  en: 'Hello {name}, thank you for trusting {agency}. Your opinion of our service (one minute) helps other families choose their agency: {link}',
}

/** WhatsApp message asking a satisfied client to leave a review (Google, Facebook…). */
export function reviewRequest(lang: Lang, name: string, agency: string, link: string): string {
  return (REVIEW[lang] ?? REVIEW.ar).replace('{name}', name.split(' ')[0]).replace('{agency}', agency).replace('{link}', link)
}
