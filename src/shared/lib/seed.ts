import { defaultChecklist } from './billing'
import { addMonths, periodOf, periodsBetween } from './rentals'
import { DEMO_USERS } from './config'
import type { Activity, Appointment, Broker, CallLog, Client, Deal, Expense, Invoice, Lead, Lease, Mandate, Offer, Payment, PriceChange, Property, RentPayment, Staff, Task } from './types'

const img = (id: string, w = 1400) => `https://images.unsplash.com/photo-${id}?auto=format&fit=crop&w=${w}&q=80`

const ADMIN = DEMO_USERS.admin.id
const SEC = DEMO_USERS.secretary.id

function at(daysFromNow: number, h = 10, m = 0): string {
  const d = new Date()
  d.setDate(d.getDate() + daysFromNow)
  d.setHours(h, m, 0, 0)
  return d.toISOString()
}
const ago = (days: number, h = 9, m = 0) => at(-days, h, m)

type PropertySeed = Omit<Property, 'created_at' | 'updated_at' | 'created_by' | 'views' | 'owner_client_id' | 'video_url' | 'address' | 'private_notes'> &
  Partial<Pick<Property, 'created_at' | 'views' | 'owner_client_id' | 'video_url' | 'address' | 'private_notes'>>

function prop(p: PropertySeed, createdDaysAgo: number): Property {
  return {
    address: null,
    video_url: null,
    owner_client_id: null,
    private_notes: null,
    views: 40 + Math.round(Math.random() * 400),
    ...p,
    created_by: ADMIN,
    created_at: ago(createdDaysAgo, 11),
    updated_at: ago(Math.max(0, createdDaysAgo - 1), 15),
  }
}

export function seedProperties(): Property[] {
  return [
    prop(
      {
        id: 'p-1001',
        broker_id: 'b-1',
        ref: 'SH-1001',
        title: 'شقة فاخرة بإطلالة مباشرة على البحر — مرتيل',
        title_fr: 'Appartement de standing vue mer — Martil',
        title_es: 'Piso de lujo con vistas al mar — Martil',
        description:
          'شقة راقية في إقامة مؤمَّنة على الواجهة البحرية لمرتيل، على بعد خطوات من الشاطئ. صالون واسع مفتوح على شرفة بانورامية، مطبخ مجهز بالكامل، غرفتا نوم مع خزائن مدمجة، وحمامان عصريان. موقف سيارات في الطابق السفلي ومصعد. العقار محفَّظ وجاهز للسكن.',
        description_fr:
          'Appartement haut de gamme dans une résidence sécurisée en front de mer à Martil, à quelques pas de la plage. Grand salon ouvert sur une terrasse panoramique, cuisine entièrement équipée, deux chambres avec placards et deux salles de bain modernes. Parking en sous-sol et ascenseur. Titre foncier, prêt à habiter.',
        description_es:
          'Piso de alto nivel en residencia vigilada en primera línea de playa de Martil. Amplio salón abierto a una terraza panorámica, cocina totalmente equipada, dos dormitorios con armarios empotrados y dos baños modernos. Parking en sótano y ascensor. Con título de propiedad, listo para entrar a vivir.',
        type: 'apartment',
        purpose: 'sale',
        price: 1_150_000,
        area: 98,
        land_area: null,
        rooms: 3,
        bedrooms: 2,
        bathrooms: 2,
        floor: 4,
        floors: null,
        year_built: 2019,
        furnished: false,
        features: ['elevator', 'parking', 'balcony', 'sea_view', 'beach', 'kitchen', 'titled', 'security'],
        neighborhood: 'martil',
        city: 'مرتيل',
        lat: 35.6188,
        lng: -5.2712,
        images: [img('1502672260266-1c1ef2d93688'), img('1522708323590-d24dbb6b0267'), img('1556912172-45b7abe8b7e1'), img('1540518614846-7eded433c457')],
        status: 'available',
        featured: true,
        published: true,
      },
      6,
    ),
    prop(
      {
        id: 'p-1002',
        ref: 'SH-1002',
        title: 'فيلا عصرية مع مسبح وحديقة — كابو نيغرو',
        title_fr: 'Villa contemporaine avec piscine — Cabo Negro',
        title_es: 'Villa contemporánea con piscina — Cabo Negro',
        description:
          'فيلا مستقلة من طابقين في منتجع كابو نيغرو الهادئ، على بعد 5 دقائق من ملعب الغولف والشاطئ. أربع غرف نوم بحماماتها، صالونان، مطبخ أمريكي، مسبح خاص مُدفَّأ، حديقة مُهيَّأة، كراج لسيارتين، ونظام حراسة على مدار الساعة. إطلالة على البحر من التراس العلوي.',
        description_fr:
          'Villa indépendante sur deux niveaux dans le domaine paisible de Cabo Negro, à 5 min du golf et de la plage. Quatre suites, deux salons, cuisine ouverte, piscine privée chauffée, jardin aménagé, garage double et gardiennage 24h/24. Vue mer depuis la terrasse supérieure.',
        description_es: null,
        type: 'villa',
        purpose: 'sale',
        price: 4_800_000,
        area: 320,
        land_area: 600,
        rooms: 7,
        bedrooms: 4,
        bathrooms: 4,
        floor: null,
        floors: 2,
        year_built: 2021,
        furnished: false,
        features: ['pool', 'garden', 'garage', 'sea_view', 'security', 'ac', 'titled', 'terrace', 'kitchen'],
        neighborhood: 'cabo-negro',
        city: 'كابو نيغرو',
        lat: 35.6632,
        lng: -5.2866,
        images: [img('1613490493576-7fde63acd811'), img('1512917774080-9991f1c4c750'), img('1600585154340-be6161a56a0c'), img('1600607687939-ce8a6c25118c'), img('1600566753086-00f18fb6b3ea')],
        status: 'available',
        featured: true,
        published: true,
      },
      12,
    ),
    prop(
      {
        id: 'p-1003',
        ref: 'SH-1003',
        title: 'شقة مفروشة للكراء — وسط المدينة (الإنسانتشي)',
        title_fr: 'Appartement meublé à louer — Centre-ville',
        title_es: 'Piso amueblado en alquiler — Centro',
        description:
          'شقة مفروشة بالكامل في عمارة أنيقة من العهد الإسباني بعد تجديدها، في قلب الإنسانتشي قرب ساحة مولاي المهدي. غرفتا نوم، صالون مريح، مطبخ مجهز، شرفة على الشارع، ومصعد. مناسبة للأطر والطلبة والعائلات الصغيرة. كراء سنوي.',
        description_fr:
          'Appartement entièrement meublé dans un élégant immeuble d’époque espagnole rénové, au cœur de l’Ensanche près de la place Moulay El Mehdi. Deux chambres, salon confortable, cuisine équipée, balcon et ascenseur. Location annuelle.',
        description_es:
          'Piso totalmente amueblado en un elegante edificio de época española renovado, en pleno Ensanche junto a la plaza Moulay El Mehdi. Dos dormitorios, salón acogedor, cocina equipada, balcón y ascensor. Alquiler anual.',
        type: 'apartment',
        purpose: 'rent',
        price: 4_500,
        area: 85,
        land_area: null,
        rooms: 3,
        bedrooms: 2,
        bathrooms: 1,
        floor: 2,
        floors: null,
        year_built: 1950,
        furnished: true,
        features: ['elevator', 'balcony', 'kitchen', 'fiber', 'double_glazing'],
        neighborhood: 'centre',
        city: 'تطوان',
        lat: 35.5731,
        lng: -5.3706,
        images: [img('1493809842364-78817add7ffb'), img('1484154218962-a197022b5858'), img('1505693416388-ac5ce068fe85')],
        status: 'rented',
        owner_client_id: 'c-7',
        featured: true,
        published: false,
      },
      1300,
    ),
    prop(
      {
        id: 'p-1004',
        ref: 'SH-1004',
        title: 'رياض أصيل مُرمَّم — المدينة القديمة',
        title_fr: 'Riad authentique restauré — Médina',
        title_es: 'Riad auténtico restaurado — Medina',
        description:
          'منزل تقليدي من ثلاثة طوابق في المدينة القديمة لتطوان (تراث عالمي لليونسكو)، رُمِّم بعناية مع الحفاظ على الزليج والخشب المنقوش. فناء داخلي، صالون مغربي، أربع غرف، وتراس على السطح بإطلالة على جبل درسة. مثالي للسكن أو لمشروع دار ضيافة.',
        description_fr:
          'Maison traditionnelle sur trois niveaux dans la médina de Tétouan (patrimoine mondial UNESCO), restaurée avec soin en préservant zellige et bois sculpté. Patio, salon marocain, quatre chambres et terrasse sur le toit avec vue sur le Jbel Dersa. Idéal en résidence ou maison d’hôtes.',
        description_es:
          'Casa tradicional de tres plantas en la medina de Tetuán (Patrimonio Mundial UNESCO), restaurada con esmero conservando zellige y madera tallada. Patio, salón marroquí, cuatro habitaciones y azotea con vistas al Jbel Dersa. Ideal como vivienda o casa de huéspedes.',
        type: 'riad',
        purpose: 'sale',
        price: 1_650_000,
        area: 140,
        land_area: 60,
        rooms: 6,
        bedrooms: 4,
        bathrooms: 2,
        floor: null,
        floors: 3,
        year_built: 1920,
        furnished: false,
        features: ['terrace', 'moroccan_salon', 'mountain_view', 'independent_entrance'],
        neighborhood: 'medina',
        city: 'تطوان',
        lat: 35.5718,
        lng: -5.3611,
        images: [img('1548013146-72479768bada'), img('1553913861-c0fddf2619ee'), img('1600210492486-724fe5c67fb0')],
        status: 'available',
        featured: true,
        published: true,
        owner_client_id: 'c-4',
        private_notes: 'المفتاح عند الجارة في الطابق الأرضي. عمولة 2.5% متفق عليها مع المالكة. أقل سعر تقبله: 1.550.000 د.م.',
      },
      170,
    ),
    prop(
      {
        id: 'p-1005',
        ref: 'SH-1005',
        title: 'أرض محفَّظة للبناء — طريق مرتيل',
        title_fr: 'Terrain titré constructible — Route de Martil',
        title_es: 'Terreno con título, edificable — Carretera de Martil',
        description:
          'بقعة أرضية محفَّظة بمساحة 450 م² على طريق مرتيل، في منطقة سكنية R+3، على واجهة شارع معبَّد مع كل الشبكات (ماء، كهرباء، تطهير). مناسبة لبناء عمارة سكنية صغيرة أو فيلا.',
        description_fr: 'Lot titré de 450 m² sur la route de Martil, zone R+3, en façade sur voie goudronnée avec toutes les commodités (eau, électricité, assainissement). Idéal pour un petit immeuble ou une villa.',
        description_es: 'Parcela con título de 450 m² en la carretera de Martil, zona R+3, con fachada a vía asfaltada y todos los servicios (agua, luz, saneamiento). Ideal para un pequeño edificio o una villa.',
        type: 'land',
        purpose: 'sale',
        price: 2_200_000,
        area: null,
        land_area: 450,
        rooms: null,
        bedrooms: null,
        bathrooms: null,
        floor: null,
        floors: null,
        year_built: null,
        furnished: false,
        features: ['titled'],
        neighborhood: 'route-martil',
        city: 'تطوان',
        lat: 35.5975,
        lng: -5.3198,
        images: [img('1500382017468-9049fed747ef'), img('1464822759023-fed622ff2c3b')],
        status: 'reserved',
        featured: false,
        published: true,
      },
      30,
    ),
    prop(
      {
        id: 'p-1006',
        ref: 'SH-1006',
        title: 'محل تجاري بواجهة كبيرة — شارع محمد الخامس',
        title_fr: 'Local commercial grande vitrine — Av. Mohammed V',
        title_es: 'Local comercial con gran escaparate — Av. Mohammed V',
        description: 'محل تجاري 60 م² بواجهة زجاجية 6 أمتار على الشارع الأكثر حركة في تطوان، مع حمام ومخزن صغير. مناسب لمتجر ملابس، وكالة، أو مقهى صغير. كراء شهري.',
        description_fr: 'Local de 60 m² avec vitrine de 6 m sur l’avenue la plus passante de Tétouan, WC et petite réserve. Idéal boutique, agence ou petit café.',
        description_es: null,
        type: 'commercial',
        purpose: 'rent',
        price: 9_000,
        area: 60,
        land_area: null,
        rooms: 1,
        bedrooms: null,
        bathrooms: 1,
        floor: 0,
        floors: null,
        year_built: null,
        furnished: false,
        features: ['storage', 'fiber'],
        neighborhood: 'centre',
        city: 'تطوان',
        lat: 35.5742,
        lng: -5.3686,
        images: [img('1486406146926-c627a92ad1ab'), img('1497366216548-37526070297c')],
        status: 'available',
        featured: false,
        published: true,
      },
      9,
    ),
    prop(
      {
        id: 'p-1007',
        ref: 'SH-1007',
        title: 'استوديو مفروش قرب الجامعة',
        title_fr: 'Studio meublé près de l’université',
        title_es: 'Estudio amueblado cerca de la universidad',
        description: 'استوديو 42 م² مفروش ومجهز بالكامل (سرير، مكتب، مطبخ صغير، آلة غسيل)، في إقامة جديدة بمصعد على بعد 5 دقائق سيراً من الكلية. ألياف بصرية متاحة. مثالي للطلبة والأطر الشباب.',
        description_fr: 'Studio de 42 m² meublé et équipé (lit, bureau, kitchenette, lave-linge) dans une résidence neuve avec ascenseur à 5 min à pied de la faculté. Fibre disponible.',
        description_es: 'Estudio de 42 m² amueblado y equipado (cama, escritorio, cocina americana, lavadora) en residencia nueva con ascensor a 5 min a pie de la facultad. Fibra disponible.',
        type: 'studio',
        purpose: 'rent',
        price: 2_800,
        area: 42,
        land_area: null,
        rooms: 1,
        bedrooms: 1,
        bathrooms: 1,
        floor: 3,
        floors: null,
        year_built: 2022,
        furnished: true,
        features: ['elevator', 'kitchen', 'fiber', 'new_build'],
        neighborhood: 'universite',
        city: 'تطوان',
        lat: 35.5949,
        lng: -5.3671,
        images: [img('1522771739844-6a9f6d5f14af'), img('1536376072261-38c75010e6c9')],
        status: 'available',
        featured: false,
        published: true,
      },
      2,
    ),
    prop(
      {
        id: 'p-1008',
        ref: 'SH-1008',
        title: 'دوبلكس عصري جديد — طابولة',
        title_fr: 'Duplex neuf — Tabola',
        title_es: 'Dúplex a estrenar — Tabola',
        description: 'دوبلكس 160 م² في إقامة جديدة بطابولة: ثلاث غرف نوم، صالون مزدوج، مطبخ مجهز، تراس خاص 30 م²، زجاج مزدوج، وموقف سيارة. تسليم فوري مع ضمان البناء.',
        description_fr: 'Duplex de 160 m² dans une résidence neuve à Tabola : trois chambres, double salon, cuisine équipée, terrasse privative de 30 m², double vitrage et place de parking. Livraison immédiate.',
        description_es: 'Dúplex de 160 m² en residencia nueva en Tabola: tres dormitorios, doble salón, cocina equipada, terraza privada de 30 m², doble acristalamiento y plaza de garaje. Entrega inmediata.',
        type: 'duplex',
        purpose: 'sale',
        price: 1_480_000,
        area: 160,
        land_area: null,
        rooms: 5,
        bedrooms: 3,
        bathrooms: 2,
        floor: 4,
        floors: 2,
        year_built: 2025,
        furnished: false,
        features: ['terrace', 'parking', 'kitchen', 'double_glazing', 'new_build', 'elevator', 'titled'],
        neighborhood: 'tabola',
        city: 'تطوان',
        lat: 35.5848,
        lng: -5.3538,
        images: [img('1600566753190-17f0baa2a6c3'), img('1600573472592-401b489a3cdc'), img('1600210491892-03d54c0aaf87')],
        status: 'available',
        featured: false,
        published: true,
      },
      5,
    ),
    prop(
      {
        id: 'p-1009',
        ref: 'SH-1009',
        title: 'شقة عائلية بسعر مناسب — الوفاء',
        title_fr: 'Appartement familial à prix doux — Al Wafa',
        title_es: 'Piso familiar a buen precio — Al Wafa',
        description: 'شقة 75 م² في الطابق الأول بحي الوفاء، قرب المدارس والمسجد والسوق. غرفتا نوم، صالون، مطبخ، حمام، وشرفة. محفَّظة. فرصة للعائلات أو للاستثمار في الكراء.',
        description_fr: 'Appartement de 75 m² au 1er étage à Al Wafa, près des écoles, de la mosquée et du marché. Deux chambres, salon, cuisine, salle de bain et balcon. Titre foncier.',
        description_es: null,
        type: 'apartment',
        purpose: 'sale',
        price: 620_000,
        area: 75,
        land_area: null,
        rooms: 3,
        bedrooms: 2,
        bathrooms: 1,
        floor: 1,
        floors: null,
        year_built: 2012,
        furnished: false,
        features: ['schools', 'balcony', 'titled'],
        neighborhood: 'wafa',
        city: 'تطوان',
        lat: 35.5891,
        lng: -5.3439,
        images: [img('1560448204-e02f11c3d0e2'), img('1554995207-c18c203602cb')],
        status: 'available',
        featured: false,
        published: true,
      },
      15,
    ),
    prop(
      {
        id: 'p-1010',
        ref: 'SH-1010',
        title: 'فيلا للكراء الموسمي مع مسبح — شاطئ مرتيل',
        title_fr: 'Villa saisonnière avec piscine — Martil plage',
        title_es: 'Villa de temporada con piscina — Playa de Martil',
        description: 'فيلا مفروشة بالكامل على بعد 300 متر من شاطئ مرتيل: ثلاث غرف نوم، ثلاثة حمامات، مسبح خاص، حديقة مع شواء، تكييف في كل الغرف، وموقف داخلي. متاحة للكراء الشهري خارج الموسم وبالأسبوع في الصيف.',
        description_fr: 'Villa entièrement meublée à 300 m de la plage de Martil : trois chambres, trois salles de bain, piscine privée, jardin avec barbecue, climatisation et parking intérieur. Location au mois hors saison, à la semaine en été.',
        description_es: 'Villa totalmente amueblada a 300 m de la playa de Martil: tres dormitorios, tres baños, piscina privada, jardín con barbacoa, aire acondicionado y parking interior. Alquiler mensual fuera de temporada, semanal en verano.',
        type: 'villa',
        purpose: 'rent',
        price: 15_000,
        area: 220,
        land_area: 300,
        rooms: 5,
        bedrooms: 3,
        bathrooms: 3,
        floor: null,
        floors: 2,
        year_built: 2016,
        furnished: true,
        features: ['pool', 'garden', 'beach', 'ac', 'parking', 'terrace', 'kitchen'],
        neighborhood: 'martil',
        city: 'مرتيل',
        lat: 35.6221,
        lng: -5.2768,
        images: [img('1600596542815-ffad4c1539a9'), img('1564013799919-ab600027ffc6'), img('1600585152220-90363fe7e115')],
        status: 'available',
        featured: true,
        published: true,
      },
      8,
    ),
    prop(
      {
        id: 'p-1011',
        ref: 'SH-1011',
        title: 'مكتب مجهز للكراء — وسط المدينة',
        title_fr: 'Bureau équipé à louer — Centre-ville',
        title_es: 'Oficina equipada en alquiler — Centro',
        description: 'مكتب 110 م² في الطابق الثالث بعمارة مهنية بمصعد: 4 مكاتب مغلقة، قاعة اجتماعات، استقبال، مطبخ صغير وحمامان. تكييف مركزي وألياف بصرية. موقف سيارات بالعمارة.',
        description_fr: 'Bureau de 110 m² au 3e étage d’un immeuble professionnel avec ascenseur : 4 bureaux fermés, salle de réunion, accueil, kitchenette et deux WC. Climatisation et fibre. Parking.',
        description_es: null,
        type: 'office',
        purpose: 'rent',
        price: 6_500,
        area: 110,
        land_area: null,
        rooms: 6,
        bedrooms: null,
        bathrooms: 2,
        floor: 3,
        floors: null,
        year_built: 2008,
        furnished: false,
        features: ['elevator', 'ac', 'fiber', 'parking'],
        neighborhood: 'centre',
        city: 'تطوان',
        lat: 35.5752,
        lng: -5.3721,
        images: [img('1497366811353-6870744d04b2'), img('1497366216548-37526070297c')],
        status: 'rented',
        owner_client_id: 'c-7',
        featured: false,
        published: false,
      },
      450,
    ),
    prop(
      {
        id: 'p-1012',
        ref: 'SH-1012',
        title: 'شقة بإطلالة على الجبل والمدينة — جبل درسة',
        title_fr: 'Appartement vue montagne et ville — Jbel Dersa',
        title_es: 'Piso con vistas a la montaña y la ciudad — Jbel Dersa',
        description: 'شقة 105 م² في الطابق الخامس بإطلالة بانورامية على جبل درسة والمدينة القديمة. ثلاث غرف نوم، صالون كبير، مطبخ مجهز، حمامان، شرفة، مصعد وموقف. محفَّظة.',
        description_fr: 'Appartement de 105 m² au 5e étage avec vue panoramique sur le Jbel Dersa et la médina. Trois chambres, grand salon, cuisine équipée, deux salles de bain, balcon, ascenseur et parking. Titre foncier.',
        description_es: 'Piso de 105 m² en la 5ª planta con vistas panorámicas al Jbel Dersa y la medina. Tres dormitorios, gran salón, cocina equipada, dos baños, balcón, ascensor y parking. Con título.',
        type: 'apartment',
        purpose: 'sale',
        price: 890_000,
        area: 105,
        land_area: null,
        rooms: 4,
        bedrooms: 3,
        bathrooms: 2,
        floor: 5,
        floors: null,
        year_built: 2017,
        furnished: false,
        features: ['elevator', 'mountain_view', 'balcony', 'parking', 'titled', 'kitchen'],
        neighborhood: 'jbel-dersa',
        city: 'تطوان',
        lat: 35.5801,
        lng: -5.3712,
        images: [img('1515263487990-61b07816b324'), img('1484101403633-562f891dc89a'), img('1600585154526-990dced4db0d')],
        status: 'available',
        featured: false,
        published: true,
      },
      11,
    ),
    prop(
      {
        id: 'p-1013',
        ref: 'SH-1013',
        title: 'منزل عائلي من طابقين — سانية الرمل',
        title_fr: 'Maison familiale R+1 — Saniat Rmel',
        title_es: 'Casa familiar de dos plantas — Saniat Rmel',
        description: 'منزل عائلي 180 م² مبني على 120 م² بسانية الرمل: طابق أرضي بصالون مغربي ومطبخ وكراج، وطابق أول بثلاث غرف نوم وصالون، وتراس على السطح. مدخل مستقل، قرب المدارس والمواصلات.',
        description_fr: 'Maison familiale de 180 m² sur 120 m² à Saniat Rmel : rez-de-chaussée avec salon marocain, cuisine et garage ; étage avec trois chambres et salon ; terrasse sur le toit. Entrée indépendante, proche écoles et transports.',
        description_es: null,
        type: 'house',
        purpose: 'sale',
        price: 1_250_000,
        area: 180,
        land_area: 120,
        rooms: 6,
        bedrooms: 4,
        bathrooms: 2,
        floor: null,
        floors: 2,
        year_built: 2010,
        furnished: false,
        features: ['garage', 'terrace', 'independent_entrance', 'moroccan_salon', 'schools'],
        neighborhood: 'saniat-rmel',
        city: 'تطوان',
        lat: 35.5921,
        lng: -5.3569,
        images: [img('1570129477492-45c003edd2be'), img('1600047509807-ba8f99d2cdde'), img('1583608205776-bfd35f0d9f83')],
        status: 'available',
        featured: false,
        published: true,
      },
      25,
    ),
    prop(
      {
        id: 'p-1014',
        ref: 'SH-1014',
        title: 'شقة راقية مطلة على البحر في إقامة بمسبح — المضيق',
        title_fr: 'Appartement vue mer, résidence avec piscine — M’diq',
        title_es: 'Piso con vistas al mar en residencia con piscina — M’diq',
        description: 'شقة 110 م² في الطابق السادس بإقامة مؤمَّنة مع مسبح وحدائق على بعد دقيقتين من مارينا المضيق. غرفتا نوم، صالون بإطلالة بانورامية على البحر، مطبخ مجهز، حمامان، وموقف تحت الأرض. مثالية كمسكن ثانٍ أو للاستثمار.',
        description_fr: 'Appartement de 110 m² au 6e étage d’une résidence sécurisée avec piscine et jardins, à 2 min de la marina de M’diq. Deux chambres, salon vue mer panoramique, cuisine équipée, deux salles de bain et parking en sous-sol. Idéal résidence secondaire ou investissement.',
        description_es: 'Piso de 110 m² en la 6ª planta de una residencia vigilada con piscina y jardines, a 2 min del puerto deportivo de M’diq. Dos dormitorios, salón con vistas panorámicas al mar, cocina equipada, dos baños y parking subterráneo. Ideal como segunda residencia o inversión.',
        type: 'apartment',
        purpose: 'sale',
        price: 1_350_000,
        area: 110,
        land_area: null,
        rooms: 3,
        bedrooms: 2,
        bathrooms: 2,
        floor: 6,
        floors: null,
        year_built: 2020,
        furnished: false,
        features: ['sea_view', 'elevator', 'parking', 'pool', 'security', 'beach', 'titled', 'ac'],
        neighborhood: 'mdiq',
        city: 'المضيق',
        lat: 35.6847,
        lng: -5.3221,
        images: [img('1567767292278-a4f21aa2d36e'), img('1600488999585-e4364713b90a'), img('1512918728675-ed5a9ecdebfd'), img('1600563438938-a9a27216b4f5')],
        status: 'available',
        featured: true,
        published: true,
      },
      4,
    ),
    prop(
      {
        id: 'p-1015',
        ref: 'SH-1015',
        title: 'ضيعة صغيرة بإطلالة على البحر — أزلا',
        title_fr: 'Petite ferme avec vue mer — Azla',
        title_es: 'Pequeña finca con vistas al mar — Azla',
        description: 'ضيعة 5000 م² مسقية بأشجار الزيتون واللوز على تلة بأزلا، مع منزل صغير 80 م² وبئر. إطلالة على البحر والجبل. الطريق معبَّد حتى الباب. فرصة لمشروع سكني أو سياحي.',
        description_fr: 'Ferme de 5 000 m² plantée d’oliviers et d’amandiers sur une colline d’Azla, avec maisonnette de 80 m² et puits. Vue mer et montagne, route goudronnée jusqu’à l’entrée.',
        description_es: 'Finca de 5.000 m² con olivos y almendros en una colina de Azla, con casita de 80 m² y pozo. Vistas al mar y la montaña, carretera asfaltada hasta la puerta.',
        type: 'farm',
        purpose: 'sale',
        price: 1_900_000,
        area: 80,
        land_area: 5000,
        rooms: 3,
        bedrooms: 2,
        bathrooms: 1,
        floor: null,
        floors: 1,
        year_built: 2005,
        furnished: false,
        features: ['sea_view', 'mountain_view', 'garden', 'independent_entrance'],
        neighborhood: 'azla',
        city: 'أزلا',
        lat: 35.5566,
        lng: -5.2461,
        images: [img('1464822759023-fed622ff2c3b'), img('1500382017468-9049fed747ef')],
        status: 'available',
        featured: false,
        published: true,
      },
      40,
    ),
    prop(
      {
        id: 'p-1016',
        ref: 'SH-1016',
        title: 'شقة للكراء قرب المدارس — كويلما',
        title_fr: 'Appartement à louer près des écoles — Coelma',
        title_es: 'Piso en alquiler cerca de colegios — Coelma',
        description: 'شقة 90 م² غير مفروشة في الطابق الثالث بمصعد، حي كويلما الهادئ. غرفتا نوم، صالون، مطبخ، حمام، وشرفة مشمسة. قرب المدارس والمواصلات. متوفرة فوراً.',
        description_fr: 'Appartement de 90 m² non meublé au 3e étage avec ascenseur, quartier calme de Coelma. Deux chambres, salon, cuisine, salle de bain et balcon ensoleillé. Disponible immédiatement.',
        description_es: null,
        type: 'apartment',
        purpose: 'rent',
        price: 3_500,
        area: 90,
        land_area: null,
        rooms: 3,
        bedrooms: 2,
        bathrooms: 1,
        floor: 3,
        floors: null,
        year_built: 2015,
        furnished: false,
        features: ['elevator', 'balcony', 'schools'],
        neighborhood: 'coelma',
        city: 'تطوان',
        lat: 35.5809,
        lng: -5.3821,
        images: [img('1502005229762-cf1b2da7c5d6'), img('1598928506311-c55ded91a20c')],
        status: 'available',
        featured: false,
        published: true,
      },
      1,
    ),
    prop(
      {
        id: 'p-1017',
        ref: 'SH-1017',
        title: 'شقة 3 غرف — طابولة (تم البيع)',
        title_fr: 'Appartement 3 pièces — Tabola (vendu)',
        title_es: null,
        description: 'شقة 80 م² في الطابق الثاني، بيعت في أقل من شهر.',
        description_fr: null,
        description_es: null,
        type: 'apartment',
        purpose: 'sale',
        price: 720_000,
        area: 80,
        land_area: null,
        rooms: 3,
        bedrooms: 2,
        bathrooms: 1,
        floor: 2,
        floors: null,
        year_built: 2014,
        furnished: false,
        features: ['elevator', 'balcony', 'titled'],
        neighborhood: 'tabola',
        city: 'تطوان',
        lat: 35.5839,
        lng: -5.3552,
        images: [img('1600121848594-d8644e57abab')],
        status: 'sold',
        featured: false,
        published: false,
      },
      70,
    ),
    prop(
      {
        id: 'p-1018',
        ref: 'SH-1018',
        title: 'شقة جديدة — بوجراح (قيد التحضير)',
        title_fr: null,
        title_es: null,
        description: 'في انتظار الصور والوثائق من المالك.',
        description_fr: null,
        description_es: null,
        type: 'apartment',
        purpose: 'sale',
        price: 560_000,
        area: 70,
        land_area: null,
        rooms: 3,
        bedrooms: 2,
        bathrooms: 1,
        floor: 2,
        floors: null,
        year_built: 2018,
        furnished: false,
        features: [],
        neighborhood: 'boujarrah',
        city: 'تطوان',
        lat: 35.5655,
        lng: -5.3512,
        images: [],
        status: 'draft',
        featured: false,
        published: false,
      },
      0,
    ),
  ]
}

export function seedClients(): Client[] {
  const base = { whatsapp: null, email: null, lang: 'ar' as const, created_by: SEC, updated_at: ago(1) }
  return [
    { ...base, id: 'c-1', full_name: 'أحمد العلمي', phone: '0661234567', kind: 'buyer', source: 'website', budget_min: 800_000, budget_max: 1_300_000, wants_purpose: 'sale', wants_types: ['apartment', 'duplex'], wants_neighborhoods: ['martil', 'mdiq', 'tabola'], wants_rooms_min: 3, notes: 'يبحث عن شقة قرب البحر لعائلته، يفضل طابقاً مرتفعاً مع مصعد.', created_at: ago(14) },
    { ...base, id: 'c-2', full_name: 'Laura Fernández', phone: '+34612345678', whatsapp: '+34612345678', email: 'laura.f@example.com', lang: 'es', kind: 'buyer', source: 'instagram', budget_min: 1_000_000, budget_max: 1_500_000, wants_purpose: 'sale', wants_types: ['apartment'], wants_neighborhoods: ['martil', 'cabo-negro', 'mdiq'], wants_rooms_min: 2, notes: 'Vive en Málaga. Quiere vistas al mar. Visitas por vídeo primero.', created_at: ago(9) },
    { ...base, id: 'c-3', full_name: 'محمد بنعيسى', phone: '0677889900', kind: 'tenant', source: 'phone', budget_min: 3_000, budget_max: 5_000, wants_purpose: 'rent', wants_types: ['apartment'], wants_neighborhoods: ['centre', 'tabola', 'coelma'], wants_rooms_min: 3, notes: 'أستاذ، يحتاج السكن قبل بداية الشهر المقبل.', created_at: ago(6) },
    { ...base, id: 'c-4', share_token: '7d3f9a52-4c1e-4b8a-9f2d-1a6c5e8b0c41', last_report_at: ago(31), full_name: 'خديجة الريسوني', phone: '0655443322', kind: 'owner', source: 'referral', budget_min: null, budget_max: null, wants_purpose: null, wants_types: [], wants_neighborhoods: [], wants_rooms_min: null, notes: 'مالكة الرياض SH-1004. تفضل التواصل بعد الزوال.', created_at: ago(22) },
    { ...base, id: 'c-5', broker_id: 'b-2', full_name: 'Youssef El Idrissi', phone: '0612345678', email: 'y.idrissi@example.com', lang: 'fr', kind: 'investor', source: 'facebook', budget_min: 1_500_000, budget_max: 3_000_000, wants_purpose: 'sale', wants_types: ['land', 'commercial', 'building'], wants_neighborhoods: ['route-martil', 'centre', 'tabola'], wants_rooms_min: null, notes: 'مستثمر مقيم ببلجيكا، يزور تطوان في الصيف.', created_at: ago(30) },
    { ...base, id: 'c-7', full_name: 'عبد اللطيف الخمليشي', phone: '0661987654', kind: 'owner', source: 'referral', budget_min: null, budget_max: null, wants_purpose: null, wants_types: [], wants_neighborhoods: [], wants_rooms_min: null, notes: 'مالك المكتب SH-1011 والشقة SH-1003. فوّض للوكالة تحصيل كراء المكتب.', created_at: ago(460) },
    { ...base, id: 'c-8', full_name: 'Imane Ziani', phone: '0662456789', email: 'cabinet.ziani@example.com', lang: 'fr', kind: 'tenant', source: 'website', budget_min: null, budget_max: null, wants_purpose: 'rent', wants_types: ['office'], wants_neighborhoods: ['centre'], wants_rooms_min: null, notes: 'Cabinet comptable — locataire du bureau SH-1011.', created_at: ago(440) },
    { ...base, id: 'c-9', full_name: 'سعيد العمراني', phone: '0670654321', kind: 'tenant', source: 'walkin', budget_min: null, budget_max: null, wants_purpose: 'rent', wants_types: ['apartment'], wants_neighborhoods: ['centre'], wants_rooms_min: null, notes: 'مكتري الشقة المفروشة SH-1003.', created_at: ago(1290) },
    { ...base, id: 'c-6', full_name: 'سعاد الحداد', phone: '0698765432', kind: 'tenant', source: 'walkin', budget_min: 2_000, budget_max: 3_000, wants_purpose: 'rent', wants_types: ['studio', 'apartment'], wants_neighborhoods: ['universite', 'saniat-rmel'], wants_rooms_min: 1, notes: 'طالبة ماستر، تبحث عن استوديو مفروش.', created_at: ago(3) },
  ]
}

export function seedLeads(): Lead[] {
  const l = (x: Partial<Lead> & Pick<Lead, 'id' | 'name' | 'phone' | 'kind' | 'status' | 'created_at'>): Lead => ({
    email: null,
    message: null,
    notes: null,
    property_id: null,
    property_ref: null,
    source: 'website',
    assigned_to: null,
    client_id: null,
    preferred_at: null,
    lang: 'ar',
    meta: null,
    updated_at: x.created_at,
    ...x,
  })
  return [
    l({ id: 'l-1', name: 'كريم الطاهري', phone: '0670112233', kind: 'inquiry', status: 'new', property_id: 'p-1001', property_ref: 'SH-1001', message: 'هل السعر قابل للتفاوض؟ وهل الشقة مطلة مباشرة على البحر؟', created_at: ago(0, 8, 40) }),
    l({ id: 'l-2', name: 'Sofía Martín', phone: '+34655001122', kind: 'visit', status: 'new', property_id: 'p-1014', property_ref: 'SH-1014', lang: 'es', preferred_at: at(3, 11), message: 'Me gustaría visitar el piso este fin de semana.', created_at: ago(0, 7, 15) }),
    l({ id: 'l-3', name: 'عبد الرحيم الشاوي', phone: '0662334455', kind: 'sell', status: 'contacted', message: 'شقة 95 م² في الوفاء، الطابق الثالث، أريد بيعها.', meta: { type: 'apartment', area: 95, neighborhood: 'wafa', purpose: 'sale' }, assigned_to: SEC, created_at: ago(1, 17) }),
    l({ id: 'l-4', name: 'Nadia Benali', phone: '0633445566', kind: 'inquiry', status: 'visit', property_id: 'p-1008', property_ref: 'SH-1008', lang: 'fr', message: 'Est-ce que le duplex est encore disponible ? Je cherche à acheter rapidement.', assigned_to: SEC, client_id: null, created_at: ago(2, 10) }),
    l({ id: 'l-5', name: 'رشيد بوزيان', phone: '0644556677', kind: 'callback', status: 'negotiation', property_id: 'p-1013', property_ref: 'SH-1013', source: 'phone', message: 'عرض 1.150.000 على المنزل.', assigned_to: ADMIN, created_at: ago(5, 12) }),
    l({ id: 'l-6', name: 'Laura Fernández', phone: '+34612345678', kind: 'inquiry', status: 'visit', property_id: 'p-1001', property_ref: 'SH-1001', source: 'instagram', lang: 'es', client_id: 'c-2', assigned_to: ADMIN, created_at: ago(9, 19) }),
    l({ id: 'l-7', name: 'هشام العمراني', phone: '0611223344', kind: 'valuation', status: 'won', message: 'تقييم شقة في طابولة', source: 'whatsapp', assigned_to: SEC, created_at: ago(20, 9) }),
    l({ id: 'l-8', name: 'فؤاد المرابط', phone: '0699887766', kind: 'contact', status: 'lost', message: 'يبحث عن محل تجاري بأقل من 4000 درهم', source: 'facebook', created_at: ago(12, 14) }),
    l({ id: 'l-9', name: 'Pierre Dubois', phone: '+33612345678', kind: 'inquiry', status: 'contacted', property_id: 'p-1002', property_ref: 'SH-1002', lang: 'fr', message: 'Bonjour, la villa est-elle disponible en juillet pour une visite ?', assigned_to: SEC, created_at: ago(1, 9, 30) }),
  ]
}

export function seedAppointments(): Appointment[] {
  const a = (x: Omit<Appointment, 'notes' | 'created_by' | 'created_at' | 'lead_id'> & Partial<Appointment>): Appointment => ({
    notes: null,
    lead_id: null,
    created_by: SEC,
    created_at: ago(2),
    ...x,
  })
  return [
    a({ id: 'a-1', title: 'زيارة SH-1001 مع أحمد العلمي', kind: 'visit', starts_at: at(0, 10, 0), ends_at: at(0, 10, 45), property_id: 'p-1001', client_id: 'c-1', assigned_to: ADMIN, status: 'scheduled', notes: 'اللقاء أمام الإقامة. أخذ مفتاح الشقة من الحارس.' }),
    a({ id: 'a-2', title: 'مكالمة فيديو مع Laura — جولة في SH-1014', kind: 'call', starts_at: at(0, 16, 30), ends_at: at(0, 17, 0), property_id: 'p-1014', client_id: 'c-2', assigned_to: SEC, status: 'scheduled' }),
    a({ id: 'a-3', title: 'زيارة الدوبلكس SH-1008 — محمد بنعيسى', kind: 'visit', starts_at: at(1, 11, 0), ends_at: at(1, 11, 45), property_id: 'p-1008', client_id: 'c-3', assigned_to: SEC, status: 'scheduled' }),
    a({ id: 'a-4', title: 'توقيع عقد البيع عند الموثق — SH-1017', kind: 'signing', starts_at: at(2, 15, 0), ends_at: at(2, 16, 30), property_id: 'p-1017', client_id: null, assigned_to: ADMIN, status: 'scheduled', notes: 'مكتب الموثق بشارع محمد الخامس. إحضار نسخة الرسم العقاري.' }),
    a({ id: 'a-5', title: 'اجتماع مع المالكة خديجة — تجديد الوكالة', kind: 'meeting', starts_at: at(4, 12, 0), ends_at: at(4, 12, 30), property_id: 'p-1004', client_id: 'c-4', assigned_to: ADMIN, status: 'scheduled' }),
    a({ id: 'a-6', title: 'زيارة SH-1012 — عائلة الزياني', kind: 'visit', starts_at: ago(1, 17, 0), ends_at: ago(1, 17, 45), property_id: 'p-1012', client_id: null, assigned_to: SEC, status: 'done', notes: 'أعجبتهم الشقة، سيعودون بعرض.', feedback_interest: 'hot', feedback_price: 'fair', feedback_note: 'أعجبتهم الإطلالة والهدوء، يقارنونها بشقة أخرى في المدينة الجديدة.' }),
    a({ id: 'a-7', title: 'زيارة SH-1009 — لم يحضر العميل', kind: 'visit', starts_at: ago(3, 10, 0), ends_at: ago(3, 10, 30), property_id: 'p-1009', client_id: null, assigned_to: SEC, status: 'noshow' }),
    a({ id: 'a-8', title: 'زيارة الاستوديو SH-1007 — سعاد الحداد', kind: 'visit', starts_at: at(1, 16, 0), ends_at: at(1, 16, 30), property_id: 'p-1007', client_id: 'c-6', assigned_to: SEC, status: 'scheduled' }),
    a({ id: 'a-9', title: 'زيارة الرياض SH-1004 — زوجان من ليون', kind: 'visit', starts_at: ago(8, 11, 0), ends_at: ago(8, 12, 0), property_id: 'p-1004', client_id: null, assigned_to: ADMIN, status: 'done', created_at: ago(10), feedback_interest: 'hot', feedback_price: 'high', feedback_note: 'أحبوا الزليج والفناء، يريدون مشروع دار ضيافة. الثمن عندهم مرتفع قليلاً.' }),
    a({ id: 'a-10', title: 'زيارة الرياض SH-1004 — مستثمر من طنجة', kind: 'visit', starts_at: ago(27, 16, 0), ends_at: ago(27, 16, 45), property_id: 'p-1004', client_id: null, assigned_to: SEC, status: 'done', created_at: ago(29), feedback_interest: 'warm', feedback_price: 'high', feedback_note: 'يرى أن الترميم يحتاج ميزانية إضافية.' }),
    a({ id: 'a-11', title: 'زيارة الرياض SH-1004 — عائلة من تطوان', kind: 'visit', starts_at: ago(52, 10, 0), ends_at: ago(52, 10, 45), property_id: 'p-1004', client_id: null, assigned_to: SEC, status: 'done', created_at: ago(54), feedback_interest: 'cold', feedback_price: 'high', feedback_note: 'يبحثون عن شقة بمصعد، الرياض لا يناسبهم.' }),
  ]
}

export function seedTasks(): Task[] {
  const tk = (x: Omit<Task, 'details' | 'related_type' | 'related_id' | 'created_by' | 'created_at' | 'completed_at'> & Partial<Task>): Task => ({
    details: null,
    related_type: null,
    related_id: null,
    created_by: ADMIN,
    created_at: ago(3),
    completed_at: null,
    ...x,
  })
  return [
    tk({ id: 't-1', title: 'الاتصال بكريم الطاهري بخصوص SH-1001', due_at: at(0, 12), priority: 'high', status: 'open', assigned_to: SEC, related_type: 'lead', related_id: 'l-1' }),
    tk({ id: 't-2', title: 'إرسال نسخة الرسم العقاري للموثق — SH-1017', due_at: at(1, 10), priority: 'high', status: 'open', assigned_to: ADMIN, related_type: 'property', related_id: 'p-1017' }),
    tk({ id: 't-3', title: 'تصوير شقة بوجراح SH-1018 ورفع الصور', due_at: at(2, 15), priority: 'normal', status: 'open', assigned_to: ADMIN, related_type: 'property', related_id: 'p-1018' }),
    tk({ id: 't-4', title: 'متابعة Laura بعد مكالمة الفيديو', due_at: ago(1, 18), priority: 'normal', status: 'open', assigned_to: SEC, related_type: 'client', related_id: 'c-2' }),
    tk({ id: 't-5', title: 'تجديد وكالة البيع للأرض SH-1005', due_at: at(6, 10), priority: 'low', status: 'open', assigned_to: ADMIN, related_type: 'property', related_id: 'p-1005' }),
    tk({ id: 't-6', title: 'طباعة بطاقات العقارات لواجهة الوكالة', due_at: ago(2, 10), priority: 'low', status: 'done', assigned_to: SEC, completed_at: ago(2, 11) }),
    tk({ id: 't-7', title: 'الرد على Sofía وتأكيد زيارة نهاية الأسبوع', due_at: at(0, 15), priority: 'high', status: 'open', assigned_to: SEC, related_type: 'lead', related_id: 'l-2' }),
  ]
}

export function seedMandates(): Mandate[] {
  const day = (n: number) => at(n, 12).slice(0, 10)
  return [
    {
      id: 'm-1',
      property_id: 'p-1004',
      owner_client_id: 'c-4',
      kind: 'exclusive',
      purpose: 'sale',
      start_date: day(-160),
      end_date: day(20),
      price: 1_650_000,
      net_price: 1_600_000,
      min_price: 1_550_000,
      commission_rate: 2.5,
      commission_amount: null,
      keys: 'agency',
      keys_notes: 'في خزانة الوكالة، الرف الثاني',
      visit_terms: 'كل الأيام من 10 إلى 18، بإخبار المالكة قبل ساعة',
      signed: true,
      status: 'active',
      notes: 'تفضل التواصل بعد الزوال.',
      created_by: ADMIN,
      created_at: ago(160),
      updated_at: ago(160),
    },
  ]
}

export function seedOffers(): Offer[] {
  const o = (x: Partial<Offer> & Pick<Offer, 'id' | 'property_id' | 'amount' | 'status' | 'created_at'>): Offer => ({
    client_id: null,
    financing: 'cash',
    conditions: null,
    counter_amount: null,
    valid_until: null,
    notes: null,
    created_by: ADMIN,
    updated_at: x.created_at,
    ...x,
  })
  return [
    o({ id: 'o-1', property_id: 'p-1004', amount: 1_450_000, financing: 'loan', conditions: 'بشرط موافقة البنك على القرض', status: 'countered', counter_amount: 1_600_000, valid_until: at(5, 12).slice(0, 10), notes: 'الزوجان من ليون، زارا الرياض مرتين.', created_at: ago(6, 18), updated_at: ago(2, 12) }),
    o({ id: 'o-2', property_id: 'p-1004', amount: 1_300_000, status: 'rejected', notes: 'رفضته المالكة: بعيد عن الثمن.', created_at: ago(26, 11), updated_at: ago(25, 10) }),
    o({ id: 'o-3', property_id: 'p-1013', amount: 1_150_000, status: 'pending', valid_until: at(2, 12).slice(0, 10), notes: 'عرض رشيد بوزيان بالهاتف، أداء نقداً.', created_by: SEC, created_at: ago(5, 12) }),
    o({ id: 'o-4', property_id: 'p-1017', amount: 720_000, financing: 'mixed', status: 'accepted', notes: 'قبله المالك، التوقيع عند الموثق.', created_at: ago(12, 15), updated_at: ago(9, 10) }),
  ]
}

/** The riad started higher and was reduced after a few months. */
export function seedPriceHistory(): PriceChange[] {
  return [
    { id: 'h-1', property_id: 'p-1004', old_price: null, new_price: 1_800_000, changed_by: ADMIN, created_at: ago(160) },
    { id: 'h-2', property_id: 'p-1004', old_price: 1_800_000, new_price: 1_650_000, changed_by: ADMIN, created_at: ago(45) },
  ]
}

export function seedBrokers(): Broker[] {
  const b = (x: Partial<Broker> & Pick<Broker, 'id' | 'full_name' | 'phone'>, days: number): Broker => ({
    whatsapp: null,
    email: null,
    kind: 'broker',
    company: null,
    zones: [],
    specialties: [],
    agreement_mode: 'side',
    agreement_value: 0,
    rating: null,
    active: true,
    notes: null,
    created_by: ADMIN,
    created_at: ago(days),
    updated_at: ago(days),
    ...x,
  })
  return [
    b({ id: 'b-1', full_name: 'عبد السلام الشاوني', phone: '0661102030', zones: ['martil', 'mdiq', 'cabo-negro'], specialties: ['sale', 'rent', 'seasonal'], rating: 5, notes: 'يعرف الشقق المطلة على البحر في مرتيل والمضيق. نقتسم العمولة مناصفة.' }, 120),
    b({ id: 'b-2', full_name: 'نزهة البقالي', phone: '0662203040', kind: 'agency', company: 'وكالة الريف للعقار', zones: ['centre', 'tabola', 'coelma'], specialties: ['sale', 'commercial'], rating: 4, notes: 'وكالة شريكة في وسط المدينة.' }, 90),
    b({ id: 'b-3', full_name: 'رشيد بوزيان', phone: '0663304050', kind: 'referrer', agreement_mode: 'percent', agreement_value: 10, specialties: ['sale'], rating: 3, notes: 'حارس عمارة بمرتيل، يخبرنا بالشقق المعروضة.' }, 60),
    b({ id: 'b-4', full_name: 'مجموعة الأمل للإنعاش العقاري', phone: '0539700000', kind: 'developer', company: 'Groupe Al Amal Immobilier', agreement_mode: 'percent', agreement_value: 2, zones: ['route-martil'], specialties: ['new'], rating: 4, notes: 'مشروع شقق جديدة على طريق مرتيل. يدفع لنا 2% من ثمن كل شقة.' }, 45),
  ]
}

export function seedDeals(): Deal[] {
  const d = (x: Omit<Deal, 'notes' | 'created_by' | 'created_at'> & Partial<Deal>): Deal => ({
    notes: null,
    created_by: ADMIN,
    created_at: x.closed_at,
    commission_seller: 0,
    commission_buyer: x.commission,
    shares: [],
    received: x.commission,
    ...x,
  })
  const share = (id: string, ref: string, name: string, side: 'listing' | 'client' | 'other', value: number, paid: number, party: 'broker' | 'referrer' = 'broker') => ({ id, party, ref_id: ref, name, side, mode: 'percent' as const, value, paid, paid_at: paid ? ago(3) : null })
  return [
    d({ id: 'd-1', property_id: 'p-1017', client_id: null, kind: 'sale', amount: 720_000, commission: 18_000, received: 0, closed_at: ago(4, 16), notes: 'عمولة 2.5% من المشتري', shares: [share('s-1', 'b-3', 'رشيد بوزيان', 'other', 10, 0, 'referrer')] }),
    d({ id: 'd-2', property_id: null, client_id: 'c-3', kind: 'rent', amount: 4_200, commission: 4_200, closed_at: ago(33, 11), notes: 'شقة بطابولة — عمولة شهر كراء' }),
    d({ id: 'd-3', property_id: null, client_id: 'c-5', kind: 'sale', amount: 1_100_000, commission: 55_000, commission_seller: 27_500, commission_buyer: 27_500, received: 55_000, closed_at: ago(58, 10), notes: 'الزبون جاء عن طريق وكالة الريف', shares: [share('s-2', 'b-2', 'نزهة البقالي', 'client', 50, 27_500)] }),
    d({ id: 'd-4', property_id: null, client_id: null, kind: 'rent', amount: 3_200, commission: 3_200, closed_at: ago(75, 12) }),
    d({ id: 'd-5', property_id: null, client_id: null, kind: 'sale', amount: 2_400_000, commission: 120_000, commission_seller: 60_000, commission_buyer: 60_000, received: 120_000, closed_at: ago(110, 15), notes: 'فيلا بمرتيل جلبها عبد السلام', shares: [share('s-3', 'b-1', 'عبد السلام الشاوني', 'listing', 50, 30_000)] }),
    d({ id: 'd-6', property_id: null, client_id: null, kind: 'rent', amount: 6_000, commission: 6_000, closed_at: ago(125, 9) }),
    d({ id: 'd-7', property_id: null, client_id: null, kind: 'sale', amount: 650_000, commission: 16_250, closed_at: ago(150, 14) }),
    d({ id: 'd-8', property_id: null, client_id: null, kind: 'rent', amount: 3_800, commission: 3_800, closed_at: ago(12, 10) }),
    // in progress: the investor is buying the land (documents and bank), a buyer agreed on the sea-view flat
    d({
      id: 'd-9',
      property_id: 'p-1005',
      client_id: 'c-5',
      kind: 'sale',
      amount: 2_150_000,
      commission: 107_500,
      commission_seller: 53_750,
      commission_buyer: 53_750,
      received: 0,
      stage: 'paperwork',
      deposit: 215_000,
      notary: 'الأستاذ يوسف البقالي، موثق بتطوان (مثال)',
      // a plot of land: no co-ownership certificate
      checklist: defaultChecklist('sale', (() => { let n = 0; return () => `ck-9-${++n}` })())
        .filter((x) => !x.label.includes('السانديك'))
        .map((x, i) => (i < 4 ? { ...x, done: true, at: ago(14 - i * 3) } : x)),
      closed_at: at(21, 11),
      created_at: ago(15, 11),
      notes: 'العربون مودع عند الموثق. ننتظر موافقة البنك على القرض.',
      shares: [share('s-9', 'b-2', 'نزهة البقالي', 'client', 50, 0)],
    }),
    d({
      id: 'd-10',
      property_id: 'p-1014',
      client_id: 'c-2',
      kind: 'sale',
      amount: 1_300_000,
      commission: 65_000,
      commission_seller: 32_500,
      commission_buyer: 32_500,
      received: 0,
      stage: 'agreement',
      checklist: defaultChecklist('sale', (() => { let n = 0; return () => `ck-10-${++n}` })()),
      closed_at: at(45, 11),
      created_at: ago(1, 18),
      notes: 'اتفاق مبدئي على 1.300.000 بعد الجولة بالفيديو. العربون عند زيارتها في نونبر.',
    }),
  ]
}

/* Two leases: an office the agency manages (rent collected every month), and an apartment let three years ago. */
export function seedLeases(): Lease[] {
  const now = new Date()
  const first = (monthsAgo: number) => `${addMonths(periodOf(now), -monthsAgo)}-01`
  const base = { owner_client_id: 'c-7', end_date: null, charges_note: null, deposit_returned_at: null, revisions: [], equipment: null, obligations: null, inventory: {}, status: 'active' as const, ended_at: null, notes: null, created_by: ADMIN }
  return [
    {
      ...base,
      id: 'ls-1',
      property_id: 'p-1011',
      tenant_client_id: 'c-8',
      usage: 'professional',
      start_date: first(14),
      rent: 6_500,
      charges: 300,
      charges_note: 'السانديك والتنظيف',
      pay_day: 5,
      payment_method: 'transfer',
      deposit: 13_000,
      deposit_holder: 'agency',
      managed: true,
      management_rate: 8,
      equipment: 'مكيفان، 4 مكاتب و8 كراسٍ، خزانة أرشيف، ثلاجة صغيرة',
      obligations: 'يتحمل المكتري استهلاك الماء والكهرباء والإنترنت.',
      inventory: {
        in: {
          date: first(14),
          items: [
            { area: 'المكتب الرئيسي', note: 'أرضية رخام أبيض بدون كسور، 4 مقابس كهربائية تشتغل، نافذتان بزجاج سليم وستائر رمادية' },
            { area: 'قاعة الاستقبال', note: 'طلاء أبيض جديد، مكيف LG يشتغل مع جهاز التحكم، باب زجاجي بقفل' },
            { area: 'المطبخ الصغير', note: 'مغسلة وصنبور يشتغلان، ثلاجة صغيرة، خزانتان معلقتان' },
            { area: 'دورة المياه', note: 'مرحاض ومغسلة بحالة اشتغال، سخان ماء كهربائي 30 لتراً' },
          ],
          water: '00125 m³',
          electricity: '045213 kWh',
          keys: '3 مفاتيح للباب الرئيسي وبطاقة المرأب',
          notes: null,
        },
      },
      created_at: ago(430),
      updated_at: ago(430),
    },
    {
      ...base,
      id: 'ls-2',
      property_id: 'p-1003',
      tenant_client_id: 'c-9',
      usage: 'housing',
      start_date: first(40),
      rent: 4_500,
      charges: 0,
      pay_day: 1,
      payment_method: 'cash',
      deposit: 9_000,
      deposit_holder: 'owner',
      managed: false,
      management_rate: 0,
      notes: 'حررت الوكالة العقد فقط؛ الكراء يؤدى مباشرة للمالك.',
      created_at: ago(1215),
      updated_at: ago(1215),
    },
  ]
}

/** Every rent of the managed office up to last month; the current month is still unpaid. */
export function seedRentPayments(): RentPayment[] {
  const now = new Date()
  const periods = periodsBetween(addMonths(periodOf(now), -14), addMonths(periodOf(now), -1))
  const perYear = new Map<string, number>()
  return periods
    .map((period, i) => {
      const year = period.slice(0, 4)
      const n = (perYear.get(year) ?? 0) + 1
      perYear.set(year, n)
      const day = String(3 + (i % 4)).padStart(2, '0')
      const paid_at = `${period}-${day}`
      const last = i === periods.length - 1
      return {
        id: `rp-${period}`,
        no: `Q-${year}-${String(n).padStart(4, '0')}`,
        lease_id: 'ls-1',
        period,
        rent: 6_500,
        charges: 300,
        method: 'transfer' as const,
        reference: `Virement ${period.replace('-', '')}`,
        paid_at,
        status: 'valid' as const,
        // the owner is paid a few days later; last month's share is still to remit
        remitted_at: last ? null : `${period}-${String(Number(day) + 4).padStart(2, '0')}`,
        notes: null,
        created_by: SEC,
        created_at: `${paid_at}T10:00:00.000Z`,
      }
    })
    .reverse()
}

/* Invoices and receipts of the last deals, and the agency's expenses (VAT 20 %). */
export function seedInvoices(): Invoice[] {
  const day = (n: number) => at(-n, 12).slice(0, 10)
  const inv = (x: Partial<Invoice> & Pick<Invoice, 'id' | 'no' | 'bill_name' | 'total_ttc' | 'issued_at'> & { label: string }): Invoice => {
    const ht = Math.round((x.total_ttc / 1.2) * 100) / 100
    const { label, ...rest } = x
    return {
      kind: 'invoice',
      deal_id: null,
      client_id: null,
      party: 'buyer',
      bill_ice: null,
      bill_address: null,
      lines: [{ label, qty: 1, unit: ht }],
      vat_rate: 20,
      total_ht: ht,
      total_vat: Math.round((x.total_ttc - ht) * 100) / 100,
      due_at: null,
      status: 'paid',
      paid: x.total_ttc,
      ref_invoice_id: null,
      notes: null,
      created_by: ADMIN,
      created_at: `${x.issued_at}T11:00:00.000Z`,
      updated_at: `${x.issued_at}T11:00:00.000Z`,
      ...rest,
    }
  }
  return [
    inv({ id: 'inv-4', no: 'F-2026-0004', deal_id: 'd-1', bill_name: 'M. Kamal Ouazzani', bill_address: 'Tabola, Tétouan', total_ttc: 18_000, issued_at: day(4), due_at: day(-26), status: 'issued', paid: 0, label: "Honoraires d'intermédiation — achat du bien SH-1017 (appartement, Tabola), prix 720 000 DH" }),
    inv({ id: 'inv-3', no: 'F-2026-0003', deal_id: 'd-8', bill_name: 'M. Omar El Kacemi', total_ttc: 3_800, issued_at: day(12), label: 'Honoraires de location — part du locataire, loyer mensuel 3 800 DH' }),
    inv({ id: 'inv-2', no: 'F-2026-0002', deal_id: 'd-3', party: 'seller', bill_name: 'Mme Fatima Zahra Bennani', total_ttc: 27_500, issued_at: day(58), label: "Honoraires d'intermédiation — vente, part du vendeur, prix 1 100 000 DH" }),
    inv({ id: 'inv-1', no: 'F-2026-0001', deal_id: 'd-3', client_id: 'c-5', bill_name: 'Youssef El Idrissi', total_ttc: 27_500, issued_at: day(58), label: "Honoraires d'intermédiation — achat, part de l'acquéreur, prix 1 100 000 DH" }),
  ]
}

export function seedPayments(): Payment[] {
  const day = (n: number) => at(-n, 12).slice(0, 10)
  const pay = (x: Partial<Payment> & Pick<Payment, 'id' | 'no' | 'payer_name' | 'amount' | 'received_at'>): Payment => ({
    deal_id: null,
    invoice_id: null,
    client_id: null,
    party: 'buyer',
    method: 'cash',
    reference: null,
    status: 'valid',
    notes: null,
    created_by: ADMIN,
    created_at: `${x.received_at}T15:00:00.000Z`,
    ...x,
  })
  return [
    pay({ id: 'pay-3', no: 'R-2026-0003', deal_id: 'd-8', invoice_id: 'inv-3', payer_name: 'M. Omar El Kacemi', amount: 3_800, received_at: day(12) }),
    pay({ id: 'pay-2', no: 'R-2026-0002', deal_id: 'd-3', invoice_id: 'inv-2', party: 'seller', payer_name: 'Mme Fatima Zahra Bennani', amount: 27_500, method: 'cheque', reference: 'Chèque n° 0012457', received_at: day(56) }),
    pay({ id: 'pay-1', no: 'R-2026-0001', deal_id: 'd-3', invoice_id: 'inv-1', client_id: 'c-5', payer_name: 'Youssef El Idrissi', amount: 27_500, method: 'transfer', reference: 'Virement 58213', received_at: day(57) }),
  ]
}

export function seedExpenses(): Expense[] {
  const day = (n: number) => at(-n, 12).slice(0, 10)
  const e = (x: Partial<Expense> & Pick<Expense, 'id' | 'category' | 'label' | 'amount' | 'spent_at'>): Expense => ({
    method: 'cash',
    vendor: null,
    property_id: null,
    deal_id: null,
    notes: null,
    created_by: ADMIN,
    created_at: `${x.spent_at}T16:00:00.000Z`,
    updated_at: `${x.spent_at}T16:00:00.000Z`,
    ...x,
  })
  return [
    e({ id: 'e-12', category: 'photo', label: 'تصوير شقة بوجراح SH-1018', amount: 1_500, vendor: 'مصور مستقل', property_id: 'p-1018', spent_at: day(2) }),
    e({ id: 'e-11', category: 'other', label: 'نسخ الرسم العقاري وتنقل للموثق — SH-1005', amount: 300, deal_id: 'd-9', spent_at: day(5) }),
    e({ id: 'e-10', category: 'phone', label: 'الهاتف والإنترنت', amount: 449, method: 'transfer', vendor: 'Maroc Telecom', spent_at: day(10) }),
    e({ id: 'e-9', category: 'transport', label: 'وقود الزيارات', amount: 600, spent_at: day(15) }),
    e({ id: 'e-8', category: 'utilities', label: 'فاتورة الكهرباء والماء', amount: 380, vendor: 'Amendis', spent_at: day(18) }),
    e({ id: 'e-7', category: 'ads', label: 'اشتراك Avito Pro', amount: 990, method: 'card', vendor: 'Avito', spent_at: day(20) }),
    e({ id: 'e-6', category: 'rent', label: 'كراء المكتب — شهر أكتوبر', amount: 4_000, method: 'transfer', spent_at: day(25) }),
    e({ id: 'e-5', category: 'fees', label: 'أتعاب المحاسب — الربع الثالث', amount: 1_500, method: 'transfer', spent_at: day(28) }),
    e({ id: 'e-4', category: 'ads', label: 'إعلانات فيسبوك وإنستغرام', amount: 1_200, method: 'card', vendor: 'Meta', spent_at: day(40) }),
    e({ id: 'e-3', category: 'rent', label: 'كراء المكتب — شهر شتنبر', amount: 4_000, method: 'transfer', spent_at: day(56) }),
    e({ id: 'e-2', category: 'rent', label: 'كراء المكتب — شهر غشت', amount: 4_000, method: 'transfer', spent_at: day(86) }),
    e({ id: 'e-1', category: 'office', label: 'طابعة ولوازم المكتب', amount: 2_350, vendor: 'Bureau Plus', spent_at: day(90) }),
  ]
}

export function seedCalls(): CallLog[] {
  return [
    { id: 'k-1', caller_name: 'كريم الطاهري', phone: '0670112233', direction: 'in', subject: 'سؤال عن سعر SH-1001', outcome: 'سيزور يوم السبت', client_id: null, lead_id: 'l-1', logged_by: SEC, created_at: ago(0, 9, 5) },
    { id: 'k-2', caller_name: 'خديجة الريسوني', phone: '0655443322', direction: 'out', subject: 'تأكيد اجتماع تجديد الوكالة', outcome: 'موافقة على الخميس 12:00', client_id: 'c-4', lead_id: null, logged_by: SEC, created_at: ago(0, 10, 20) },
    { id: 'k-3', caller_name: 'مجهول', phone: '0600000000', direction: 'in', subject: 'يبحث عن كراج للكراء', outcome: 'لا يوجد حالياً — سُجّل الطلب', client_id: null, lead_id: null, logged_by: SEC, created_at: ago(1, 11, 45) },
    { id: 'k-4', caller_name: 'Pierre Dubois', phone: '+33612345678', direction: 'out', subject: 'Retour sur la villa SH-1002', outcome: 'Visite en juillet, rappeler fin juin', client_id: null, lead_id: 'l-9', logged_by: SEC, created_at: ago(1, 15, 10) },
    { id: 'k-5', caller_name: 'محمد بنعيسى', phone: '0677889900', direction: 'in', subject: 'تأكيد زيارة الدوبلكس', outcome: 'مؤكد غداً 11:00', client_id: 'c-3', lead_id: null, logged_by: SEC, created_at: ago(1, 16, 30) },
  ]
}

export function seedStaff(): Staff[] {
  return [
    { id: ADMIN, full_name: DEMO_USERS.admin.name, email: 'owner@sweethouse.ma', role: 'admin', phone: '0702873088', active: true, created_at: ago(400), title: null, permissions: [] },
    { id: SEC, full_name: DEMO_USERS.secretary.name, email: 'secretary@sweethouse.ma', role: 'secretary', phone: '0600000001', active: true, created_at: ago(200), title: 'كاتبة', permissions: ['properties'] },
  ]
}

export function seedActivity(): Activity[] {
  return [
    { id: 'ac-1', actor: SEC, actor_name: DEMO_USERS.secretary.name, action: 'create', entity: 'appointment', entity_id: 'a-3', meta: { title: 'زيارة الدوبلكس SH-1008 — محمد بنعيسى' }, created_at: ago(1, 16, 35) },
    { id: 'ac-2', actor: SEC, actor_name: DEMO_USERS.secretary.name, action: 'create', entity: 'call', entity_id: 'k-5', meta: { title: 'تأكيد زيارة الدوبلكس' }, created_at: ago(1, 16, 31) },
    { id: 'ac-3', actor: ADMIN, actor_name: DEMO_USERS.admin.name, action: 'update', entity: 'property', entity_id: 'p-1017', meta: { title: 'SH-1017', status: 'sold' }, created_at: ago(4, 16, 10) },
    { id: 'ac-4', actor: ADMIN, actor_name: DEMO_USERS.admin.name, action: 'create', entity: 'deal', entity_id: 'd-1', meta: { title: 'SH-1017 — 720 000 DH' }, created_at: ago(4, 16, 12) },
    { id: 'ac-5', actor: SEC, actor_name: DEMO_USERS.secretary.name, action: 'update', entity: 'lead', entity_id: 'l-4', meta: { title: 'Nadia Benali', status: 'visit' }, created_at: ago(2, 11, 0) },
    { id: 'ac-6', actor: ADMIN, actor_name: DEMO_USERS.admin.name, action: 'create', entity: 'property', entity_id: 'p-1016', meta: { title: 'SH-1016' }, created_at: ago(1, 11, 0) },
  ]
}

export function seedData() {
  return {
    properties: seedProperties(),
    clients: seedClients(),
    leads: seedLeads(),
    appointments: seedAppointments(),
    tasks: seedTasks(),
    deals: seedDeals(),
    brokers: seedBrokers(),
    mandates: seedMandates(),
    price_history: seedPriceHistory(),
    offers: seedOffers(),
    invoices: seedInvoices(),
    payments: seedPayments(),
    expenses: seedExpenses(),
    leases: seedLeases(),
    rent_payments: seedRentPayments(),
    calls: seedCalls(),
    staff: seedStaff(),
    activity: seedActivity(),
  }
}
