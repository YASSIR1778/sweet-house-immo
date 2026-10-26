import { SITE_URL } from '@/shared/lib/config'
import { fmtDate, fmtPhone, fmtPrice, fmtTime, pick } from '@/shared/lib/format'
import { translate } from '@/shared/lib/i18n'
import type { Appointment, Lang, Lead, Property, Settings } from '@/shared/lib/types'

/** Ready-to-send WhatsApp messages in the client's language. */

const title = (p: Property, lang: Lang) => (lang === 'fr' && p.title_fr) || (lang === 'es' && p.title_es) || p.title
const url = (p: Property) => `${SITE_URL}/biens/${p.ref}`
const sign = (s: Settings, lang: Lang) => `${pick(s.agency.name, lang)} — ${fmtPhone(s.agency.phone)}`
const hello = (lang: Lang, name?: string | null) => {
  const n = name ? ` ${name.split(/\s+/)[0]}` : ''
  return lang === 'fr' ? `Bonjour${n},` : lang === 'es' ? `Hola${n},` : `السلام عليكم${n}،`
}

export function propertyMessage(p: Property, s: Settings, lang: Lang, name?: string | null): string {
  const price = fmtPrice(p.price, lang, p.purpose === 'rent')
  const intro = lang === 'fr' ? 'voici le bien dont nous avons parlé :' : lang === 'es' ? 'aquí tiene el inmueble del que hablamos:' : 'إليك تفاصيل العقار الذي تحدثنا عنه:'
  return `${hello(lang, name)} ${intro}\n\n🏠 ${title(p, lang)}\n💰 ${price}\n🔖 ${p.ref}\n${url(p)}\n\n${sign(s, lang)}`
}

export function matchesMessage(list: Property[], s: Settings, lang: Lang, name?: string | null): string {
  const intro =
    lang === 'fr'
      ? 'voici une sélection de biens qui correspondent à votre recherche :'
      : lang === 'es'
        ? 'esta es una selección de inmuebles que encajan con su búsqueda:'
        : 'هذه مجموعة من العقارات التي تناسب طلبك:'
  const lines = list.map((p, i) => `${i + 1}. ${title(p, lang)} — ${fmtPrice(p.price, lang, p.purpose === 'rent')}\n${url(p)}`)
  const outro = lang === 'fr' ? 'Laquelle souhaitez-vous visiter ?' : lang === 'es' ? '¿Cuál le gustaría visitar?' : 'أيها تريد أن تزور؟'
  return `${hello(lang, name)} ${intro}\n\n${lines.join('\n\n')}\n\n${outro}\n${sign(s, lang)}`
}

export function visitReminder(a: Appointment, p: Property | undefined, s: Settings, lang: Lang, name: string | null | undefined, hood: string): string {
  const day = fmtDate(a.starts_at, lang, { weekday: 'long', day: 'numeric', month: 'long' })
  const time = fmtTime(a.starts_at, lang)
  const what = p ? `${translate(`type.${p.type}`, lang)} ${p.ref} (${hood})` : ''
  const body =
    lang === 'fr'
      ? `nous vous confirmons votre rendez-vous${what ? ` pour la visite du bien ${what}` : ''} le ${day} à ${time}.`
      : lang === 'es'
        ? `le confirmamos su cita${what ? ` para visitar el inmueble ${what}` : ''} el ${day} a las ${time}.`
        : `نؤكد لكم موعد${what ? ` زيارة العقار ${what}` : 'كم'} يوم ${day} على الساعة ${time}.`
  const outro = lang === 'fr' ? 'Merci de nous prévenir en cas d’empêchement.' : lang === 'es' ? 'Avísenos si no puede asistir, por favor.' : 'المرجو إخبارنا في حال وجود أي تغيير.'
  return `${hello(lang, name)} ${body}\n${outro}\n\n${sign(s, lang)}${p ? `\n${url(p)}` : ''}`
}

export function leadReply(l: Lead, p: Property | undefined, s: Settings, staffName: string): string {
  const lang = l.lang ?? 'ar'
  const me = staffName.replace(/\(.*?\)/g, '').trim()
  const about = p ? (lang === 'fr' ? ` concernant le bien ${p.ref}` : lang === 'es' ? ` sobre el inmueble ${p.ref}` : ` بخصوص العقار ${p.ref}`) : ''
  const body =
    lang === 'fr'
      ? `ici ${me}, de ${pick(s.agency.name, lang)}. Merci pour votre demande${about}. Quand puis-je vous appeler ?`
      : lang === 'es'
        ? `soy ${me}, de ${pick(s.agency.name, lang)}. Gracias por su solicitud${about}. ¿Cuándo le puedo llamar?`
        : `معك ${me} من ${pick(s.agency.name, lang)}. شكراً على طلبك${about}. متى يناسبك أن نتصل بك؟`
  return `${hello(lang, l.name)} ${body}${p ? `\n${url(p)}` : ''}`
}
