import { DEFAULT_COMMISSION, DEFAULT_FEES } from './fee-defaults'
import type { Permission, Settings } from './types'

/** Live site (Supabase configured): no sample figures or testimonials — only what the owner enters. */
const LIVE = Boolean(import.meta.env.VITE_SUPABASE_URL && import.meta.env.VITE_SUPABASE_ANON_KEY)

/** Where the site is published (used for share links and JSON-LD). */
export const SITE_ORIGIN = 'https://yassir1778.github.io'
export const SITE_URL = `${SITE_ORIGIN}${(import.meta.env.BASE_URL ?? '/').replace(/\/$/, '')}`

export const STORAGE_PREFIX = 'shi'

/**
 * Everything below is only the DEFAULT. The owner edits all of it from
 * the dashboard (Settings) and the values are stored in the database.
 */
export const DEFAULT_SETTINGS: Settings = {
  agency: {
    name: { ar: 'سويت هاوس للعقار', fr: 'Sweet House Immobilier', es: 'Sweet House Inmobiliaria' },
    slogan: { ar: 'دارك بثقة', fr: 'Votre maison, en toute confiance', es: 'Tu casa, con confianza' },
    phone: '0702873088',
    whatsapp: '212702873088',
    email: 'contact@sweethouse.ma',
    address: { ar: 'تطوان، المغرب', fr: 'Tétouan, Maroc', es: 'Tetuán, Marruecos' },
    hours: {
      ar: 'الإثنين – السبت: 9:00 – 19:00',
      fr: 'Lundi – Samedi : 9h00 – 19h00',
      es: 'Lunes – Sábado: 9:00 – 19:00',
    },
    about: {
      ar: 'وكالة عقارية من قلب تطوان، نرافقكم في البيع والشراء والكراء بشفافية كاملة: تقييم عادل، ملفات قانونية سليمة، ومتابعة حتى تسليم المفاتيح.',
      fr: 'Agence immobilière au cœur de Tétouan : nous vous accompagnons dans la vente, l’achat et la location en toute transparence — estimation juste, dossiers en règle et suivi jusqu’à la remise des clés.',
      es: 'Agencia inmobiliaria en el corazón de Tetuán: te acompañamos en la venta, la compra y el alquiler con total transparencia — tasación justa, expedientes en regla y seguimiento hasta la entrega de llaves.',
    },
    facebook: 'https://www.facebook.com/SweetHouseY',
    instagram: '',
    tiktok: '',
    lat: 35.5785,
    lng: -5.3684,
  },
  site: {
    hero_eyebrow: { ar: 'وكالة عقارية في تطوان', fr: 'Agence immobilière à Tétouan', es: 'Agencia inmobiliaria en Tetuán' },
    hero_title: { ar: 'دارك بثقة', fr: 'Votre maison, en confiance', es: 'Tu casa, con confianza' },
    hero_subtitle: {
      ar: 'شقق، فيلات، منازل وأراضٍ للبيع والكراء في تطوان، مرتيل، كابو نيغرو والمضيق — مع فريق يعرف كل زنقة في الحمامة البيضاء.',
      fr: 'Appartements, villas, maisons et terrains à vendre ou à louer à Tétouan, Martil, Cabo Negro et M’diq — avec une équipe qui connaît chaque ruelle de la Colombe Blanche.',
      es: 'Pisos, villas, casas y terrenos en venta o alquiler en Tetuán, Martil, Cabo Negro y M’diq — con un equipo que conoce cada callejón de la Paloma Blanca.',
    },
    hero_image: 'https://upload.wikimedia.org/wikipedia/commons/thumb/3/30/Tetouan_city_from_the_Old_Medina.jpg/1920px-Tetouan_city_from_the_Old_Medina.jpg',
    stats: LIVE ? { properties: 0, clients: 0, years: 0, deals: 0 } : { properties: 120, clients: 480, years: 8, deals: 260 },
    testimonials: LIVE
      ? []
      : [
      {
        name: 'فاطمة الزهراء م.',
        role: { ar: 'اشترت شقة في طابولة', fr: 'A acheté un appartement à Tabola', es: 'Compró un piso en Tabola' },
        text: {
          ar: 'تعاملوا معي بصدق من أول مكالمة. راجعوا الوثائق معي خطوة بخطوة ولم أشعر بأي ضغط. أنصح بهم بعين مغمضة.',
          fr: 'Honnêtes dès le premier appel. Ils ont vérifié les documents avec moi pas à pas, sans aucune pression. Je les recommande les yeux fermés.',
          es: 'Honestos desde la primera llamada. Revisaron los documentos conmigo paso a paso, sin ninguna presión. Los recomiendo con los ojos cerrados.',
        },
      },
      {
        name: 'Carlos R.',
        role: { ar: 'اشترى شقة في مرتيل', fr: 'A acheté un appartement à Martil', es: 'Compró un apartamento en Martil' },
        text: {
          ar: 'كنت أبحث من إسبانيا، وقاموا بالزيارات بالفيديو ثم أنهوا كل الإجراءات معي. تجربة سلسة بالكامل.',
          fr: 'Je cherchais depuis l’Espagne : visites en vidéo puis toutes les démarches gérées avec moi. Une expérience parfaitement fluide.',
          es: 'Buscaba desde España: visitas por vídeo y luego todos los trámites conmigo. Una experiencia totalmente fluida.',
        },
      },
      {
        name: 'عبد السلام ب.',
        role: { ar: 'باع منزله في المدينة القديمة', fr: 'A vendu sa maison dans la médina', es: 'Vendió su casa en la medina' },
        text: {
          ar: 'قدّروا المنزل بسعر عادل وجلبوا مشترين جديين في أقل من شهر. المتابعة كانت ممتازة إلى آخر يوم.',
          fr: 'Estimation juste et des acheteurs sérieux en moins d’un mois. Un suivi excellent jusqu’au dernier jour.',
          es: 'Tasación justa y compradores serios en menos de un mes. Un seguimiento excelente hasta el último día.',
        },
      },
    ],
    visit_clause: {
      ar: 'أقرّ أنا الموقّع(ة) أسفله بأنني زرت العقار المذكور أعلاه برفقة وكالة {agency}، وأن هذا العقار عُرض عليّ لأول مرة من طرفها. وألتزم بعدم التفاوض أو التعاقد بشأنه، بشكل مباشر أو غير مباشر، مع المالك أو مع أي وسيط آخر دون إشراك الوكالة، وذلك لمدة 12 شهراً ابتداءً من تاريخ هذه الزيارة.',
      fr: 'Je soussigné(e) reconnais avoir visité le bien désigné ci-dessus par l’intermédiaire de l’agence {agency}, qui me l’a présenté pour la première fois. Je m’engage à ne pas négocier ni conclure, directement ou indirectement, avec le propriétaire ou tout autre intermédiaire sans l’agence, pendant 12 mois à compter de la date de cette visite.',
      es: 'El/la abajo firmante reconoce haber visitado el inmueble arriba indicado a través de la agencia {agency}, que se lo presentó por primera vez, y se compromete a no negociar ni contratar, directa o indirectamente, con el propietario u otro intermediario sin la agencia, durante 12 meses desde la fecha de esta visita.',
    },
    mandate_clause: {
      ar: 'يفوّض المالك الموقّع أسفله وكالة {agency} لعرض العقار المذكور أعلاه {purpose} والبحث عن {party} له بالشروط المبينة في هذا التفويض، طيلة مدته. تتولى الوكالة الإشهار والزيارات والتفاوض، ولا تُبرم أي عقد باسم المالك. يلتزم المالك بتقديم الوثائق اللازمة، وبتمكين الوكالة من زيارة العقار، وبإخبارها فوراً بكل تغيير في الثمن أو في وضعية العقار. تستحق الوكالة العمولة المتفق عليها عند إبرام العقد مع أي {party} قدمته أو عرّفته بالعقار خلال مدة التفويض.',
      fr: 'Le propriétaire soussigné mandate l’agence {agency} pour présenter le bien désigné ci-dessus {purpose} et lui trouver {party} aux conditions du présent mandat, pendant toute sa durée. L’agence assure la publicité, les visites et la négociation, et ne signe aucun acte au nom du propriétaire. Le propriétaire s’engage à fournir les documents nécessaires, à permettre les visites et à informer l’agence de tout changement de prix ou de situation du bien. La commission convenue est due à l’agence à la conclusion de l’acte avec tout {party} présenté par elle pendant la durée du mandat.',
      es: 'El propietario abajo firmante encarga a la agencia {agency} presentar el inmueble arriba indicado {purpose} y encontrarle {party} en las condiciones de este mandato, durante toda su duración. La agencia se ocupa de la publicidad, las visitas y la negociación, y no firma ningún contrato en nombre del propietario. El propietario se compromete a facilitar los documentos necesarios, permitir las visitas e informar a la agencia de cualquier cambio de precio o de situación del inmueble. La comisión acordada se debe a la agencia al firmarse el contrato con cualquier {party} presentado por ella durante el mandato.',
    },
    mandate_exclusive: {
      ar: 'تفويض حصري: يلتزم المالك طيلة مدة التفويض بعدم عرض العقار عن طريق وسيط آخر، وبإحالة كل شخص يتصل به مباشرة بشأن العقار على الوكالة.',
      fr: 'Mandat exclusif : pendant toute la durée du mandat, le propriétaire s’engage à ne pas confier le bien à un autre intermédiaire et à orienter vers l’agence toute personne qui le contacterait directement au sujet du bien.',
      es: 'Mandato exclusivo: durante todo el mandato, el propietario se compromete a no confiar el inmueble a otro intermediario y a remitir a la agencia a cualquier persona que le contacte directamente por el inmueble.',
    },
    whatsapp_template: {
      ar: 'السلام عليكم، أنا مهتم بالعقار {ref} ({title}). هل يمكن الحصول على مزيد من المعلومات؟',
      fr: 'Bonjour, je suis intéressé(e) par le bien {ref} ({title}). Pourriez-vous m’en dire plus ?',
      es: 'Hola, me interesa el inmueble {ref} ({title}). ¿Podrían darme más información?',
    },
  },
  catalog: {
    ref_prefix: 'SH',
    neighborhoods: [
      { id: 'medina', name: { ar: 'المدينة القديمة', fr: 'Médina', es: 'Medina' }, lat: 35.5712, lng: -5.3618 },
      { id: 'centre', name: { ar: 'وسط المدينة (الإنسانتشي)', fr: 'Centre-ville (Ensanche)', es: 'Centro (Ensanche)' }, lat: 35.5735, lng: -5.3698 },
      { id: 'tabola', name: { ar: 'طابولة', fr: 'Tabola', es: 'Tabola' }, lat: 35.5842, lng: -5.3545 },
      { id: 'wafa', name: { ar: 'الوفاء', fr: 'Al Wafa', es: 'Al Wafa' }, lat: 35.5888, lng: -5.3447 },
      { id: 'saniat-rmel', name: { ar: 'سانية الرمل', fr: 'Saniat Rmel', es: 'Saniat Rmel' }, lat: 35.5915, lng: -5.3576 },
      { id: 'sidi-talha', name: { ar: 'سيدي طلحة', fr: 'Sidi Talha', es: 'Sidi Talha' }, lat: 35.5672, lng: -5.3757 },
      { id: 'coelma', name: { ar: 'كويلما', fr: 'Coelma', es: 'Coelma' }, lat: 35.5805, lng: -5.3815 },
      { id: 'boujarrah', name: { ar: 'بوجراح', fr: 'Boujarrah', es: 'Boujarrah' }, lat: 35.5651, lng: -5.3517 },
      { id: 'jbel-dersa', name: { ar: 'جبل درسة', fr: 'Jbel Dersa', es: 'Jbel Dersa' }, lat: 35.5806, lng: -5.3705 },
      { id: 'touilaa', name: { ar: 'الطويلع', fr: 'Touilaa', es: 'Touilaa' }, lat: 35.5745, lng: -5.3892 },
      { id: 'mosalla', name: { ar: 'المصلى', fr: 'El Mosalla', es: 'El Mosalla' }, lat: 35.5768, lng: -5.3772 },
      { id: 'universite', name: { ar: 'حي الجامعة', fr: 'Quartier universitaire', es: 'Barrio universitario' }, lat: 35.5953, lng: -5.3683 },
      { id: 'route-martil', name: { ar: 'طريق مرتيل', fr: 'Route de Martil', es: 'Carretera de Martil' }, lat: 35.5968, lng: -5.3225 },
      { id: 'martil', name: { ar: 'مرتيل', fr: 'Martil', es: 'Martil' }, lat: 35.6174, lng: -5.2749 },
      { id: 'cabo-negro', name: { ar: 'كابو نيغرو', fr: 'Cabo Negro', es: 'Cabo Negro' }, lat: 35.6655, lng: -5.2845 },
      { id: 'mdiq', name: { ar: 'المضيق', fr: 'M’diq', es: 'M’diq' }, lat: 35.6853, lng: -5.3245 },
      { id: 'fnideq', name: { ar: 'الفنيدق', fr: 'Fnideq', es: 'Fnideq' }, lat: 35.8495, lng: -5.3572 },
      { id: 'azla', name: { ar: 'أزلا', fr: 'Azla', es: 'Azla' }, lat: 35.5584, lng: -5.2437 },
      { id: 'oued-laou', name: { ar: 'واد لو', fr: 'Oued Laou', es: 'Oued Laou' }, lat: 35.4486, lng: -5.0908 },
    ],
  },
  fees: DEFAULT_FEES,
  commission: DEFAULT_COMMISSION,
}

/** Property feature ids with their labels (fixed list, translated). */
export const FEATURES: Record<string, { ar: string; fr: string; es: string }> = {
  elevator: { ar: 'مصعد', fr: 'Ascenseur', es: 'Ascensor' },
  parking: { ar: 'موقف سيارات', fr: 'Parking', es: 'Aparcamiento' },
  garage: { ar: 'كراج', fr: 'Garage', es: 'Garaje' },
  balcony: { ar: 'شرفة', fr: 'Balcon', es: 'Balcón' },
  terrace: { ar: 'تراس', fr: 'Terrasse', es: 'Terraza' },
  garden: { ar: 'حديقة', fr: 'Jardin', es: 'Jardín' },
  pool: { ar: 'مسبح', fr: 'Piscine', es: 'Piscina' },
  kitchen: { ar: 'مطبخ مجهز', fr: 'Cuisine équipée', es: 'Cocina equipada' },
  moroccan_salon: { ar: 'صالون مغربي', fr: 'Salon marocain', es: 'Salón marroquí' },
  heating: { ar: 'تدفئة', fr: 'Chauffage', es: 'Calefacción' },
  ac: { ar: 'تكييف', fr: 'Climatisation', es: 'Aire acondicionado' },
  security: { ar: 'حراسة 24/7', fr: 'Gardiennage 24h/24', es: 'Vigilancia 24h' },
  sea_view: { ar: 'إطلالة على البحر', fr: 'Vue mer', es: 'Vistas al mar' },
  mountain_view: { ar: 'إطلالة على الجبل', fr: 'Vue montagne', es: 'Vistas a la montaña' },
  beach: { ar: 'قريب من الشاطئ', fr: 'Proche de la plage', es: 'Cerca de la playa' },
  schools: { ar: 'قريب من المدارس', fr: 'Proche des écoles', es: 'Cerca de colegios' },
  titled: { ar: 'محفَّظ (رسم عقاري)', fr: 'Titre foncier', es: 'Título de propiedad' },
  new_build: { ar: 'بناء جديد', fr: 'Construction neuve', es: 'Obra nueva' },
  double_glazing: { ar: 'زجاج مزدوج', fr: 'Double vitrage', es: 'Doble acristalamiento' },
  storage: { ar: 'مخزن / غرفة تخزين', fr: 'Cave / débarras', es: 'Trastero' },
  independent_entrance: { ar: 'مدخل مستقل', fr: 'Entrée indépendante', es: 'Entrada independiente' },
  fiber: { ar: 'ألياف بصرية', fr: 'Fibre optique', es: 'Fibra óptica' },
}

export const PROPERTY_TYPES = [
  'apartment',
  'house',
  'villa',
  'riad',
  'studio',
  'duplex',
  'land',
  'commercial',
  'office',
  'garage',
  'building',
  'farm',
] as const

export const DEMO_USERS = {
  admin: { id: 'demo-admin', email: 'owner@demo', name: 'ياسر (المدير)', role: 'admin' as const, active: true, title: null, permissions: [] as Permission[] },
  secretary: { id: 'demo-secretary', email: 'secretary@demo', name: 'سلمى (الكاتبة)', role: 'secretary' as const, active: true, title: 'كاتبة', permissions: ['properties'] as Permission[] },
}
