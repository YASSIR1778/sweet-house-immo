import { SITE_URL } from '@/shared/lib/config'
import { fmtDate, fmtPhone, fmtPrice, fmtTime, pick } from '@/shared/lib/format'
import { translate } from '@/shared/lib/i18n'
import type { Appointment, Lang, Lead, Property, Settings } from '@/shared/lib/types'

/** Ready-to-send WhatsApp messages in the client's language. */

const title = (p: Property, lang: Lang) => (lang === 'fr' && p.title_fr) || (lang === 'es' && p.title_es) || (lang === 'en' && (p.title_en || p.title_fr)) || p.title
const url = (p: Property) => `${SITE_URL}/biens/${p.ref}`
const sign = (s: Settings, lang: Lang) => `${pick(s.agency.name, lang)} — ${fmtPhone(s.agency.phone)}`
const hello = (lang: Lang, name?: string | null) => {
  const n = name ? ` ${name.split(/\s+/)[0]}` : ''
  return { ar: `السلام عليكم${n}،`, fr: `Bonjour${n},`, es: `Hola${n},`, en: `Hello${n},` }[lang]
}

export function propertyMessage(p: Property, s: Settings, lang: Lang, name?: string | null): string {
  const price = fmtPrice(p.price, lang, p.purpose === 'rent')
  const intro = { ar: 'إليك تفاصيل العقار الذي تحدثنا عنه:', fr: 'voici le bien dont nous avons parlé :', es: 'aquí tiene el inmueble del que hablamos:', en: 'here is the property we talked about:' }[lang]
  return `${hello(lang, name)} ${intro}\n\n🏠 ${title(p, lang)}\n💰 ${price}\n🔖 ${p.ref}\n${url(p)}\n\n${sign(s, lang)}`
}

export function matchesMessage(list: Property[], s: Settings, lang: Lang, name?: string | null): string {
  const intro = {
    ar: 'هذه مجموعة من العقارات التي تناسب طلبك:',
    fr: 'voici une sélection de biens qui correspondent à votre recherche :',
    es: 'esta es una selección de inmuebles que encajan con su búsqueda:',
    en: 'here is a selection of properties that match your search:',
  }[lang]
  const lines = list.map((p, i) => `${i + 1}. ${title(p, lang)} — ${fmtPrice(p.price, lang, p.purpose === 'rent')}\n${url(p)}`)
  const outro = { ar: 'أيها تريد أن تزور؟', fr: 'Laquelle souhaitez-vous visiter ?', es: '¿Cuál le gustaría visitar?', en: 'Which one would you like to see?' }[lang]
  return `${hello(lang, name)} ${intro}\n\n${lines.join('\n\n')}\n\n${outro}\n${sign(s, lang)}`
}

export function visitReminder(a: Appointment, p: Property | undefined, s: Settings, lang: Lang, name: string | null | undefined, hood: string): string {
  const day = fmtDate(a.starts_at, lang, { weekday: 'long', day: 'numeric', month: 'long' })
  const time = fmtTime(a.starts_at, lang)
  const what = p ? `${translate(`type.${p.type}`, lang)} ${p.ref} (${hood})` : ''
  const body = {
    ar: `نؤكد لكم موعد${what ? ` زيارة العقار ${what}` : 'كم'} يوم ${day} على الساعة ${time}.`,
    fr: `nous vous confirmons votre rendez-vous${what ? ` pour la visite du bien ${what}` : ''} le ${day} à ${time}.`,
    es: `le confirmamos su cita${what ? ` para visitar el inmueble ${what}` : ''} el ${day} a las ${time}.`,
    en: `we confirm your appointment${what ? ` to view the property ${what}` : ''} on ${day} at ${time}.`,
  }[lang]
  const outro = { ar: 'المرجو إخبارنا في حال وجود أي تغيير.', fr: 'Merci de nous prévenir en cas d’empêchement.', es: 'Avísenos si no puede asistir, por favor.', en: 'Please let us know if you cannot make it.' }[lang]
  return `${hello(lang, name)} ${body}\n${outro}\n\n${sign(s, lang)}${p ? `\n${url(p)}` : ''}`
}

export function leadReply(l: Lead, p: Property | undefined, s: Settings, staffName: string): string {
  const lang = l.lang ?? 'ar'
  const me = staffName.replace(/\(.*?\)/g, '').trim()
  const about = p ? { ar: ` بخصوص العقار ${p.ref}`, fr: ` concernant le bien ${p.ref}`, es: ` sobre el inmueble ${p.ref}`, en: ` about the property ${p.ref}` }[lang] : ''
  const agency = pick(s.agency.name, lang)
  const body = {
    ar: `معك ${me} من ${agency}. شكراً على طلبك${about}. متى يناسبك أن نتصل بك؟`,
    fr: `ici ${me}, de ${agency}. Merci pour votre demande${about}. Quand puis-je vous appeler ?`,
    es: `soy ${me}, de ${agency}. Gracias por su solicitud${about}. ¿Cuándo le puedo llamar?`,
    en: `this is ${me} from ${agency}. Thank you for your request${about}. When can I call you?`,
  }[lang]
  return `${hello(lang, l.name)} ${body}${p ? `\n${url(p)}` : ''}`
}
