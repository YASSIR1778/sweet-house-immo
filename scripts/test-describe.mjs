// npm run test:describe — the listing written from a property's facts (src/shared/lib/describe.ts):
// titles and descriptions in Arabic, French and Spanish, with the right counts and genders.
import { describe } from '../src/shared/lib/describe.ts'

let pass = 0
let fail = 0
const ok = (name, cond, extra = '') => {
  if (cond) pass++
  else fail++
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}${extra ? '  -> ' + extra : ''}`)
}

const NAMES = {
  elevator: { ar: 'مصعد', fr: 'Ascenseur', es: 'Ascensor', en: 'Lift' },
  parking: { ar: 'موقف سيارات', fr: 'Parking', es: 'Aparcamiento', en: 'Parking' },
  pool: { ar: 'مسبح', fr: 'Piscine', es: 'Piscina', en: 'Swimming pool' },
  garden: { ar: 'حديقة', fr: 'Jardin', es: 'Jardín', en: 'Garden' },
  sea_view: { ar: 'إطلالة على البحر', fr: 'Vue mer', es: 'Vistas al mar', en: 'Sea view' },
  titled: { ar: 'محفَّظ (رسم عقاري)', fr: 'Titre foncier', es: 'Título de propiedad', en: 'Land title' },
  ac: { ar: 'تكييف', fr: 'Climatisation', es: 'Aire acondicionado', en: 'Air conditioning' },
}
const MARTIL = { hood: { ar: 'مرتيل', fr: 'Martil', es: 'Martil', en: 'Martil' }, city: { ar: 'مرتيل', fr: 'Martil', es: 'Martil', en: 'Martil' } }
const WILAYA = { hood: { ar: 'الولاية', fr: 'Wilaya', es: 'Wilaya', en: 'Wilaya' }, city: { ar: 'تطوان', fr: 'Tétouan', es: 'Tetuán', en: 'Tetouan' } }
const base = { type: 'apartment', purpose: 'sale', area: null, land_area: null, rooms: null, bedrooms: null, bathrooms: null, floor: null, floors: null, year_built: null, furnished: false, features: [] }

// ------------------------------------------------------------ a flat for sale with a sea view
const flat = describe({ ...base, area: 120, rooms: 5, bedrooms: 3, bathrooms: 2, floor: 2, year_built: 2018, features: ['sea_view', 'elevator', 'parking', 'titled'] }, MARTIL, NAMES)
ok('title AR: type, purpose, best point, place', flat.title.ar === 'شقة للبيع بإطلالة على البحر — مرتيل', flat.title.ar)
ok('title FR', flat.title.fr === 'Appartement à vendre avec vue sur mer — Martil', flat.title.fr)
ok('title ES', flat.title.es === 'Piso en venta con vistas al mar — Martil', flat.title.es)
ok('AR: surface, rooms in the genitive, floor with lift', flat.description.ar.startsWith('شقة للبيع في مرتيل، بمساحة 120 م².') && flat.description.ar.includes('يحتوي العقار على 3 غرف نوم وحمامين (5 غرف في المجموع).') && flat.description.ar.includes('يقع في الطابق 2 مع مصعد.'), flat.description.ar)
ok('AR: features, year, contact', flat.description.ar.includes('من مزاياه: إطلالة على البحر، موقف سيارات، محفَّظ (رسم عقاري).') && flat.description.ar.includes('سنة البناء: 2018.') && flat.description.ar.endsWith('عبر واتساب.'))
ok('FR: chambres, salles de bain, étage', flat.description.fr.includes('Le bien comprend 3 chambres et 2 salles de bain (5 pièces au total).') && flat.description.fr.includes('Il est situé au 2e étage avec ascenseur.'), flat.description.fr)
ok('FR: features in lower case', flat.description.fr.includes('Points forts : vue mer, parking, titre foncier.'), flat.description.fr)
ok('ES: dormitorios, baños, planta', flat.description.es.includes('El inmueble cuenta con 3 dormitorios y 2 baños (5 estancias en total).') && flat.description.es.includes('Está situado en la 2.ª planta con ascensor.'), flat.description.es)
ok('the lift is said once (not again in the features)', !flat.description.ar.includes('مصعد،') && !flat.description.fr.includes('ascenseur,'))
ok('city not repeated when it is the place itself', !flat.description.ar.includes('مرتيل، مرتيل'))

// ------------------------------------------------------------ one bedroom, one bathroom, ground floor, furnished, for rent
const small = describe({ ...base, type: 'apartment', purpose: 'rent', area: 55, bedrooms: 1, bathrooms: 1, floor: 0, furnished: true, features: ['ac'] }, WILAYA, NAMES)
ok('title: furnished flat for rent (feminine in Arabic)', small.title.ar === 'شقة مفروشة للكراء — الولاية' && small.title.fr === 'Appartement meublé à louer — Wilaya' && small.title.es === 'Piso amueblado en alquiler — Wilaya', JSON.stringify(small.title))
ok('AR: one bedroom, one bathroom, ground floor, «furnished» said once', small.description.ar.includes('يحتوي العقار على غرفة نوم واحدة وحمام واحد.') && small.description.ar.includes('يقع في الطابق الأرضي.') && !small.description.ar.includes('يُكرى مفروشاً'), small.description.ar)
ok('AR: neighbourhood and city', small.description.ar.includes('في الولاية، تطوان'))
ok('FR: singular, rez-de-chaussée, «meublé» said once', small.description.fr.includes('1 chambre et 1 salle de bain.') && small.description.fr.includes('au rez-de-chaussée') && !small.description.fr.includes('loué meublé'), small.description.fr)
ok('ES: singular, planta baja', small.description.es.includes('1 dormitorio y 1 baño.') && small.description.es.includes('la planta baja') && !small.description.es.includes('Se alquila'), small.description.es)

// ------------------------------------------------------------ a house: masculine in Arabic, feminine in French and Spanish
const house = describe({ ...base, type: 'house', purpose: 'rent', area: 180, land_area: 300, bedrooms: 2, bathrooms: 2, floors: 2, furnished: true, features: ['garden'] }, MARTIL, NAMES)
ok('title: genders follow each language', house.title.ar === 'منزل مفروش للكراء مع حديقة — مرتيل' && house.title.fr === 'Maison meublée à louer avec jardin — Martil' && house.title.es === 'Casa amueblada en alquiler con jardín — Martil', JSON.stringify(house.title))
ok('AR: land and two floors (dual)', house.description.ar.includes('بمساحة 180 م² على أرض مساحتها 300 م²') && house.description.ar.includes('غرفتي نوم وحمامين') && house.description.ar.includes('يمتد على طابقين.'), house.description.ar)
ok('FR/ES: terrain, niveaux / parcela, plantas', house.description.fr.includes('sur un terrain de 300 m²') && house.description.fr.includes('Il s’étend sur 2 niveaux.') && house.description.es.includes('en una parcela de 300 m²') && house.description.es.includes('Se distribuye en 2 plantas.'))

// ------------------------------------------------------------ land: no rooms, the land surface
const land = describe({ ...base, type: 'land', land_area: 1500, features: ['titled', 'sea_view'] }, MARTIL, NAMES)
ok('land: title', land.title.ar === 'بقعة أرضية للبيع بإطلالة على البحر — مرتيل' && land.title.fr === 'Terrain à vendre avec vue sur mer — Martil')
ok('land: surface with thousands', land.description.ar.includes('بمساحة 1.500 م²') && land.description.fr.includes('d’une surface de 1 500 m²') && land.description.es.includes('de 1.500 m²'), land.description.fr)
ok('land: no rooms or floors', !land.description.ar.includes('يحتوي') && !land.description.fr.includes('Le bien comprend'))

// ------------------------------------------------------------ summer rental
const summer = describe({ ...base, type: 'villa', purpose: 'rent', bedrooms: 4, bathrooms: 3, furnished: true, seasonal: true, features: ['pool', 'sea_view'] }, MARTIL, NAMES)
ok('seasonal: «للكراء الموسمي» and the best point first', summer.title.ar === 'فيلا مفروشة للكراء الموسمي بإطلالة على البحر — مرتيل' && summer.title.es === 'Villa amueblada de alquiler vacacional con vistas al mar — Martil', JSON.stringify(summer.title))
ok('seasonal: by the night, booked online', summer.description.ar.includes('يُكرى بالليلة أو بالأسبوع') && summer.description.fr.includes('Location à la nuit ou à la semaine') && summer.description.es.includes('Alquiler por noches o por semanas'))
ok('Arabic counts from 3 to 10', summer.description.ar.includes('4 غرف نوم و3 حمامات'), summer.description.ar)

// ------------------------------------------------------------ commercial and office: no bedrooms, gender of «oficina»
const office = describe({ ...base, type: 'office', purpose: 'rent', area: 70, bedrooms: 2, floor: 3, furnished: true, features: ['elevator'] }, WILAYA, NAMES)
ok('office: no bedrooms, not «furnished» as a home', !office.description.ar.includes('غرف') && !office.title.fr.includes('meublé'), JSON.stringify(office))
ok('office: floor with lift', office.description.fr.includes('au 3e étage avec ascenseur'))
ok('office: Spanish noun', office.title.es === 'Oficina en alquiler — Wilaya')

// ------------------------------------------------------------ nothing about rooms: the type noun is the subject
const flatNoRooms = describe({ ...base, type: 'apartment', purpose: 'rent', area: 60, floor: 4, furnished: true }, MARTIL, NAMES)
ok('AR feminine verb for «شقة»', flatNoRooms.description.ar.includes('تقع في الطابق 4.'), flatNoRooms.description.ar)
const maison = describe({ ...base, type: 'house', purpose: 'sale', floors: 3, furnished: true }, MARTIL, NAMES)
ok('FR feminine for «maison»', maison.description.fr.includes('Elle s’étend sur 3 niveaux.') && maison.description.fr.includes('Elle est vendue meublée.'), maison.description.fr)
ok('ES feminine for «casa» and «oficina»', maison.description.es.includes('Se vende amueblada.') && office.description.es.includes('Está situada en la 3.ª planta'), office.description.es)
ok('AR masculine for «منزل»', maison.description.ar.includes('يمتد على 3 طوابق.'), maison.description.ar)

// ------------------------------------------------------------ English
ok('EN title: purpose, best point, place', flat.title.en === 'Apartment for sale with sea view — Martil', flat.title.en)
ok('EN furnished comes first', small.title.en === 'Furnished apartment for rent — Wilaya' && house.title.en === 'Furnished house for rent with garden — Martil', JSON.stringify([small.title.en, house.title.en]))
ok('EN: bedrooms, bathrooms, ordinal floor with lift', flat.description.en.startsWith('Apartment for sale in Martil, 120 m².') && flat.description.en.includes('The property has 3 bedrooms and 2 bathrooms (5 rooms in total).') && flat.description.en.includes('It is on the 2nd floor with a lift.'), flat.description.en)
ok('EN: singular, ground floor, «furnished» said once', small.description.en.includes('1 bedroom and 1 bathroom.') && small.description.en.includes('It is on the ground floor.') && !small.description.en.includes('rented furnished') && small.description.en.includes('in Wilaya, Tetouan'), small.description.en)
ok('EN: plot and levels, thousands with a comma', house.description.en.includes('180 m² on a 300 m² plot') && house.description.en.includes('It is spread over 2 levels.') && land.description.en.includes('1,500 m²'), house.description.en)
ok('EN: holiday rental and highlights in lower case', summer.title.en === 'Furnished villa for holiday rental with sea view — Martil' && summer.description.en.includes('Highlights: swimming pool, sea view.') && summer.description.en.includes('Rented by the night or by the week'), summer.description.en)
ok('EN: 1st, 3rd and 11th floors', describe({ ...base, floor: 1 }, MARTIL, NAMES).description.en.includes('1st floor') && office.description.en.includes('3rd floor') && describe({ ...base, floor: 11 }, MARTIL, NAMES).description.en.includes('11th floor'))

// ------------------------------------------------------------ almost nothing entered
const bare = describe({ ...base }, { hood: { ar: '', fr: '', es: '', en: '' }, city: { ar: 'تطوان', fr: 'Tétouan', es: 'Tetuán', en: 'Tetouan' } }, NAMES)
ok('only type and city: still clean sentences', bare.title.ar === 'شقة للبيع — تطوان' && bare.title.en === 'Apartment for sale — Tetouan' && bare.description.ar.startsWith('شقة للبيع في تطوان.') && !/undefined|null|NaN|\s,|،،/.test(JSON.stringify(bare)), JSON.stringify(bare))
ok('no double spaces anywhere', ![flat, small, house, land, summer, office, bare].some((l) => /\s{2}/.test(JSON.stringify(l))))

console.log(`\n${pass} passed, ${fail} failed`)
process.exit(fail ? 1 : 0)
