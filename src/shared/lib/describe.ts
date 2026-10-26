import type { Lang, Property } from './types'

/*
 * A listing written from the property's facts: a title and a description in Arabic, French,
 * Spanish and English, made here (no outside service). Only the facts entered are used, nothing is
 * invented; the owner reads the text and changes what he wants.
 * Tests: npm run test:describe
 */

export type Facts = Pick<Property, 'type' | 'purpose' | 'area' | 'land_area' | 'rooms' | 'bedrooms' | 'bathrooms' | 'floor' | 'floors' | 'year_built' | 'furnished' | 'features'> & {
  seasonal?: boolean
}
export interface Place {
  hood: Record<Lang, string>
  city: Record<Lang, string>
}
/** feature key → its name in each language (FEATURES of config.ts) */
export type FeatureNames = Record<string, Record<Lang, string>>
export interface Listing {
  title: Record<Lang, string>
  description: Record<Lang, string>
}

type G = 'm' | 'f'
const TYPES: Record<string, Record<Lang, [string, G]>> = {
  apartment: { ar: ['شقة', 'f'], fr: ['Appartement', 'm'], es: ['Piso', 'm'], en: ['Apartment', 'm'] },
  house: { ar: ['منزل', 'm'], fr: ['Maison', 'f'], es: ['Casa', 'f'], en: ['House', 'm'] },
  villa: { ar: ['فيلا', 'f'], fr: ['Villa', 'f'], es: ['Villa', 'f'], en: ['Villa', 'm'] },
  riad: { ar: ['رياض', 'm'], fr: ['Riad', 'm'], es: ['Riad', 'm'], en: ['Riad', 'm'] },
  studio: { ar: ['استوديو', 'm'], fr: ['Studio', 'm'], es: ['Estudio', 'm'], en: ['Studio', 'm'] },
  duplex: { ar: ['دوبلكس', 'm'], fr: ['Duplex', 'm'], es: ['Dúplex', 'm'], en: ['Duplex', 'm'] },
  land: { ar: ['بقعة أرضية', 'f'], fr: ['Terrain', 'm'], es: ['Terreno', 'm'], en: ['Plot of land', 'm'] },
  commercial: { ar: ['محل تجاري', 'm'], fr: ['Local commercial', 'm'], es: ['Local comercial', 'm'], en: ['Commercial premises', 'm'] },
  office: { ar: ['مكتب', 'm'], fr: ['Bureau', 'm'], es: ['Oficina', 'f'], en: ['Office', 'm'] },
  garage: { ar: ['كراج', 'm'], fr: ['Garage', 'm'], es: ['Garaje', 'm'], en: ['Garage', 'm'] },
  building: { ar: ['عمارة', 'f'], fr: ['Immeuble', 'm'], es: ['Edificio', 'm'], en: ['Building', 'm'] },
  farm: { ar: ['ضيعة', 'f'], fr: ['Ferme', 'f'], es: ['Finca', 'f'], en: ['Farm', 'm'] },
}
/** homes: rooms, floors and furniture make sense */
const LIVING = ['apartment', 'house', 'villa', 'riad', 'studio', 'duplex', 'farm', 'building']
const ON_A_FLOOR = ['apartment', 'studio', 'duplex', 'office', 'commercial']
const ON_FLOORS = ['house', 'villa', 'riad', 'duplex', 'building']
const WITH_LAND = ['house', 'villa', 'riad', 'farm', 'building']

const PURPOSE: Record<Lang, { sale: string; rent: string; seasonal: string }> = {
  ar: { sale: 'للبيع', rent: 'للكراء', seasonal: 'للكراء الموسمي' },
  fr: { sale: 'à vendre', rent: 'à louer', seasonal: 'en location saisonnière' },
  es: { sale: 'en venta', rent: 'en alquiler', seasonal: 'de alquiler vacacional' },
  en: { sale: 'for sale', rent: 'for rent', seasonal: 'for holiday rental' },
}
const FURNISHED: Record<Lang, Record<G, string>> = {
  ar: { m: 'مفروش', f: 'مفروشة' },
  fr: { m: 'meublé', f: 'meublée' },
  es: { m: 'amueblado', f: 'amueblada' },
  en: { m: 'furnished', f: 'furnished' },
}
/** the strongest point, shown in the title */
const HIGHLIGHT: [string, Record<Lang, string>][] = [
  ['sea_view', { ar: 'بإطلالة على البحر', fr: 'avec vue sur mer', es: 'con vistas al mar', en: 'with sea view' }],
  ['pool', { ar: 'مع مسبح', fr: 'avec piscine', es: 'con piscina', en: 'with swimming pool' }],
  ['garden', { ar: 'مع حديقة', fr: 'avec jardin', es: 'con jardín', en: 'with garden' }],
  ['beach', { ar: 'قرب الشاطئ', fr: 'proche de la plage', es: 'cerca de la playa', en: 'near the beach' }],
  ['terrace', { ar: 'مع تراس', fr: 'avec terrasse', es: 'con terraza', en: 'with terrace' }],
  ['mountain_view', { ar: 'بإطلالة على الجبل', fr: 'avec vue sur la montagne', es: 'con vistas a la montaña', en: 'with mountain view' }],
]

const group = (n: number, lang: Lang) => String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, lang === 'fr' ? ' ' : lang === 'en' ? ',' : '.')
const has = (n: number | null | undefined): n is number => typeof n === 'number' && n > 0

/** Arabic counts after «على» (genitive) */
function arCount(n: number, one: string, two: string, few: string, many: string): string {
  if (n === 1) return one
  if (n === 2) return two
  return n <= 10 ? `${n} ${few}` : `${n} ${many}`
}
const s = (n: number, word: string, plural = `${word}s`) => `${n} ${n > 1 ? plural : word}`
/** 1st, 2nd, 3rd, 4th… 11th, 12th, 13th, 21st */
const ordinal = (n: number) => `${n}${n % 100 >= 11 && n % 100 <= 13 ? 'th' : ['th', 'st', 'nd', 'rd'][n % 10] ?? 'th'}`

function place(p: Place, lang: Lang): string {
  const hood = p.hood[lang] || p.city[lang]
  const city = p.city[lang]
  return city && hood && city !== hood ? `${hood}${lang === 'ar' ? '، ' : ', '}${city}` : hood || city
}

export function describe(f: Facts, where: Place, names: FeatureNames): Listing {
  const t = TYPES[f.type] ?? TYPES.apartment
  const living = LIVING.includes(f.type)
  const purposeKey = f.purpose === 'rent' && f.seasonal ? 'seasonal' : f.purpose
  const furnished = living && f.furnished // for rent it is said in the first words, for sale in its own sentence
  const hl = HIGHLIGHT.find(([k]) => f.features.includes(k))?.[1]
  const titleOf = (lang: Lang) => {
    const [noun, g] = t[lang]
    const dressed = furnished && f.purpose === 'rent'
    const head = (lang === 'en'
      ? [dressed ? `Furnished ${noun.toLowerCase()}` : noun, PURPOSE.en[purposeKey], hl ? hl.en : '']
      : [noun, dressed ? FURNISHED[lang][g] : '', PURPOSE[lang][purposeKey], hl ? hl[lang] : '']
    )
      .filter(Boolean)
      .join(' ')
    const at = where.hood[lang] || where.city[lang]
    return at ? `${head} — ${at}` : head
  }

  const surface = f.type === 'land' ? (f.land_area ?? f.area) : f.area
  const land = WITH_LAND.includes(f.type) && has(f.land_area) && f.land_area !== f.area ? f.land_area : null
  const floor = ON_A_FLOOR.includes(f.type) && f.floor != null && f.floor >= 0 ? f.floor : null
  const floors = ON_FLOORS.includes(f.type) && has(f.floors) && f.floors > 1 ? f.floors : null
  const elevator = f.features.includes('elevator')
  const featureList = (lang: Lang) =>
    f.features
      .filter((k) => names[k] && !(k === 'elevator' && floor != null && floor > 0))
      .map((k) => (lang === 'ar' ? names[k].ar : names[k][lang].replace(/^\p{Lu}(?=\p{Ll})/u, (c) => c.toLowerCase())))
  const bedrooms = living && has(f.bedrooms) ? f.bedrooms : null
  const bathrooms = living && has(f.bathrooms) ? f.bathrooms : null
  const rooms = living && has(f.rooms) ? f.rooms : null
  const totalRooms = rooms && bedrooms && rooms > bedrooms ? rooms : null

  // ------------------------------------------------------------ Arabic
  const ar: string[] = []
  {
    const [noun, g] = t.ar
    let first = `${noun}${furnished && f.purpose === 'rent' ? ` ${FURNISHED.ar[g]}` : ''} ${PURPOSE.ar[purposeKey]} في ${place(where, 'ar')}`
    if (has(surface)) first += `، بمساحة ${group(surface, 'ar')} م²`
    if (land) first += ` على أرض مساحتها ${group(land, 'ar')} م²`
    ar.push(first + '.')
    const parts: string[] = []
    if (bedrooms) parts.push(arCount(bedrooms, 'غرفة نوم واحدة', 'غرفتي نوم', 'غرف نوم', 'غرفة نوم'))
    else if (rooms) parts.push(arCount(rooms, 'غرفة واحدة', 'غرفتين', 'غرف', 'غرفة'))
    if (bathrooms) parts.push(arCount(bathrooms, 'حمام واحد', 'حمامين', 'حمامات', 'حماماً'))
    if (parts.length) ar.push(`يحتوي العقار على ${parts.join(' و')}${totalRooms ? ` (${arCount(totalRooms, 'غرفة واحدة', 'غرفتان', 'غرف', 'غرفة')} في المجموع)` : ''}.`)
    const fem = !parts.length && g === 'f' // «يحتوي العقار» makes the property the subject
    if (floor != null) ar.push(`${fem ? 'تقع' : 'يقع'} في ${floor === 0 ? 'الطابق الأرضي' : `الطابق ${floor}`}${elevator && floor > 0 ? ' مع مصعد' : ''}.`)
    if (floors) ar.push(`${fem ? 'تمتد' : 'يمتد'} على ${arCount(floors, 'طابق واحد', 'طابقين', 'طوابق', 'طابقاً')}.`)
    if (furnished && f.purpose === 'sale') ar.push(`العقار ${f.purpose === 'sale' ? 'يُباع' : 'يُكرى'} مفروشاً.`)
    const list = featureList('ar')
    if (list.length) ar.push(`من مزاياه: ${list.join('، ')}.`)
    if (has(f.year_built)) ar.push(`سنة البناء: ${f.year_built}.`)
    if (purposeKey === 'seasonal') ar.push('يُكرى بالليلة أو بالأسبوع، والحجز ممكن مباشرة من صفحة العقار.')
    ar.push('للزيارة أو لمزيد من المعلومات، تواصلوا معنا بالهاتف أو عبر واتساب.')
  }

  // ------------------------------------------------------------ French
  const fr: string[] = []
  {
    const [noun, g] = t.fr
    let first = `${noun}${furnished && f.purpose === 'rent' ? ` ${FURNISHED.fr[g]}` : ''} ${PURPOSE.fr[purposeKey]} à ${place(where, 'fr')}`
    if (has(surface)) first += `, d’une surface de ${group(surface, 'fr')} m²`
    if (land) first += ` sur un terrain de ${group(land, 'fr')} m²`
    fr.push(first + '.')
    const parts: string[] = []
    if (bedrooms) parts.push(s(bedrooms, 'chambre'))
    else if (rooms) parts.push(s(rooms, 'pièce'))
    if (bathrooms) parts.push(s(bathrooms, 'salle de bain', 'salles de bain'))
    if (parts.length) fr.push(`Le bien comprend ${parts.join(' et ')}${totalRooms ? ` (${totalRooms} pièces au total)` : ''}.`)
    const fem = !parts.length && g === 'f' // after «le bien», the subject is masculine
    const e = fem ? 'e' : ''
    if (floor != null) fr.push(`${fem ? 'Elle' : 'Il'} est situé${e} ${floor === 0 ? 'au rez-de-chaussée' : `au ${floor}${floor === 1 ? 'er' : 'e'} étage`}${elevator && floor > 0 ? ' avec ascenseur' : ''}.`)
    if (floors) fr.push(`${fem ? 'Elle' : 'Il'} s’étend sur ${floors} niveaux.`)
    if (furnished && f.purpose === 'sale') fr.push(`${fem ? 'Elle' : 'Il'} est ${f.purpose === 'sale' ? 'vendu' : 'loué'}${e} meublé${e}.`)
    const list = featureList('fr')
    if (list.length) fr.push(`Points forts : ${list.join(', ')}.`)
    if (has(f.year_built)) fr.push(`Année de construction : ${f.year_built}.`)
    if (purposeKey === 'seasonal') fr.push('Location à la nuit ou à la semaine, avec réservation directe depuis la page du bien.')
    fr.push('Pour une visite ou plus d’informations, contactez-nous par téléphone ou sur WhatsApp.')
  }

  // ------------------------------------------------------------ Spanish
  const es: string[] = []
  {
    const [noun, g] = t.es
    let first = `${noun}${furnished && f.purpose === 'rent' ? ` ${FURNISHED.es[g]}` : ''} ${PURPOSE.es[purposeKey]} en ${place(where, 'es')}`
    if (has(surface)) first += `, de ${group(surface, 'es')} m²`
    if (land) first += ` en una parcela de ${group(land, 'es')} m²`
    es.push(first + '.')
    const parts: string[] = []
    if (bedrooms) parts.push(s(bedrooms, 'dormitorio'))
    else if (rooms) parts.push(s(rooms, 'estancia'))
    if (bathrooms) parts.push(s(bathrooms, 'baño'))
    if (parts.length) es.push(`El inmueble cuenta con ${parts.join(' y ')}${totalRooms ? ` (${totalRooms} estancias en total)` : ''}.`)
    const o = !parts.length && g === 'f' ? 'a' : 'o' // after «el inmueble», masculine
    if (floor != null) es.push(`Está situad${o} en ${floor === 0 ? 'la planta baja' : `la ${floor}.ª planta`}${elevator && floor > 0 ? ' con ascensor' : ''}.`)
    if (floors) es.push(`Se distribuye en ${floors} plantas.`)
    if (furnished && f.purpose === 'sale') es.push(`Se ${f.purpose === 'sale' ? 'vende' : 'alquila'} amueblad${o}.`)
    const list = featureList('es')
    if (list.length) es.push(`Características destacadas: ${list.join(', ')}.`)
    if (has(f.year_built)) es.push(`Año de construcción: ${f.year_built}.`)
    if (purposeKey === 'seasonal') es.push('Alquiler por noches o por semanas, con reserva directa desde la página del inmueble.')
    es.push('Para una visita o más información, contáctenos por teléfono o por WhatsApp.')
  }

  // ------------------------------------------------------------ English
  const en: string[] = []
  {
    const [noun] = t.en
    let first = `${furnished && f.purpose === 'rent' ? `Furnished ${noun.toLowerCase()}` : noun} ${PURPOSE.en[purposeKey]} in ${place(where, 'en')}`
    if (has(surface)) first += `, ${group(surface, 'en')} m²`
    if (land) first += ` on a ${group(land, 'en')} m² plot`
    en.push(first + '.')
    const parts: string[] = []
    if (bedrooms) parts.push(s(bedrooms, 'bedroom'))
    else if (rooms) parts.push(s(rooms, 'room'))
    if (bathrooms) parts.push(s(bathrooms, 'bathroom'))
    if (parts.length) en.push(`The property has ${parts.join(' and ')}${totalRooms ? ` (${totalRooms} rooms in total)` : ''}.`)
    if (floor != null) en.push(`It is on the ${floor === 0 ? 'ground floor' : `${ordinal(floor)} floor`}${elevator && floor > 0 ? ' with a lift' : ''}.`)
    if (floors) en.push(`It is spread over ${floors} levels.`)
    if (furnished && f.purpose === 'sale') en.push(`It is ${f.purpose === 'sale' ? 'sold' : 'rented'} furnished.`)
    const list = featureList('en')
    if (list.length) en.push(`Highlights: ${list.join(', ')}.`)
    if (has(f.year_built)) en.push(`Year built: ${f.year_built}.`)
    if (purposeKey === 'seasonal') en.push('Rented by the night or by the week, with direct booking from the property page.')
    en.push('For a viewing or more information, contact us by phone or on WhatsApp.')
  }

  return {
    title: { ar: titleOf('ar'), fr: titleOf('fr'), es: titleOf('es'), en: titleOf('en') },
    description: { ar: ar.join(' '), fr: fr.join(' '), es: es.join(' '), en: en.join(' ') },
  }
}
