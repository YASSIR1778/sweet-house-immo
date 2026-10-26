import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import type { L10n, Lang } from './types'
import { interpolate } from './format'

export const LANGS: { code: Lang; label: string; dir: 'rtl' | 'ltr' }[] = [
  { code: 'ar', label: 'العربية', dir: 'rtl' },
  { code: 'fr', label: 'Français', dir: 'ltr' },
  { code: 'es', label: 'Español', dir: 'ltr' },
]

type Dict = Record<string, L10n>

const D: Dict = {
  // ---- navigation
  'nav.home': { ar: 'الرئيسية', fr: 'Accueil', es: 'Inicio' },
  'nav.properties': { ar: 'العقارات', fr: 'Nos biens', es: 'Inmuebles' },
  'nav.sale': { ar: 'للبيع', fr: 'À vendre', es: 'En venta' },
  'nav.rent': { ar: 'للكراء', fr: 'À louer', es: 'En alquiler' },
  'nav.sell': { ar: 'بيع أو كراء عقارك', fr: 'Vendre / louer mon bien', es: 'Vender / alquilar mi inmueble' },
  'nav.agency': { ar: 'الوكالة', fr: 'L’agence', es: 'La agencia' },
  'nav.contact': { ar: 'اتصل بنا', fr: 'Contact', es: 'Contacto' },
  'nav.favorites': { ar: 'المفضلة', fr: 'Favoris', es: 'Favoritos' },
  'nav.admin': { ar: 'دخول الفريق', fr: 'Espace équipe', es: 'Acceso equipo' },
  'nav.whatsapp': { ar: 'واتساب', fr: 'WhatsApp', es: 'WhatsApp' },
  'nav.call': { ar: 'اتصل', fr: 'Appeler', es: 'Llamar' },
  'nav.menu': { ar: 'القائمة', fr: 'Menu', es: 'Menú' },

  // ---- hero / search
  'hero.search.sale': { ar: 'أريد أن أشتري', fr: 'Acheter', es: 'Comprar' },
  'hero.search.rent': { ar: 'أريد أن أكتري', fr: 'Louer', es: 'Alquilar' },
  'search.type': { ar: 'نوع العقار', fr: 'Type de bien', es: 'Tipo de inmueble' },
  'search.neighborhood': { ar: 'الحي / المنطقة', fr: 'Quartier / zone', es: 'Barrio / zona' },
  'search.budget': { ar: 'الميزانية القصوى', fr: 'Budget maximum', es: 'Presupuesto máximo' },
  'search.any': { ar: 'الكل', fr: 'Tous', es: 'Todos' },
  'search.anyNeighborhood': { ar: 'كل المناطق', fr: 'Toutes les zones', es: 'Todas las zonas' },
  'search.noLimit': { ar: 'بدون حد', fr: 'Sans limite', es: 'Sin límite' },
  'search.button': { ar: 'ابحث عن عقارك', fr: 'Rechercher', es: 'Buscar' },
  'search.keyword': { ar: 'كلمة مفتاحية أو مرجع…', fr: 'Mot-clé ou référence…', es: 'Palabra clave o referencia…' },
  'hero.scroll': { ar: 'اكتشف', fr: 'Découvrir', es: 'Descubrir' },
  'hero.trust1': { ar: 'عقارات موثّقة', fr: 'Biens vérifiés', es: 'Inmuebles verificados' },
  'hero.trust2': { ar: 'مرافقة قانونية', fr: 'Accompagnement juridique', es: 'Acompañamiento legal' },
  'hero.trust3': { ar: 'بدون عمولات مخفية', fr: 'Zéro frais cachés', es: 'Sin comisiones ocultas' },

  // ---- stats
  'stats.properties': { ar: 'عقار في محفظتنا', fr: 'biens en portefeuille', es: 'inmuebles en cartera' },
  'stats.clients': { ar: 'عميل سعيد', fr: 'clients satisfaits', es: 'clientes satisfechos' },
  'stats.years': { ar: 'سنوات من الخبرة', fr: 'ans d’expérience', es: 'años de experiencia' },
  'stats.deals': { ar: 'صفقة منجزة', fr: 'transactions conclues', es: 'operaciones cerradas' },

  // ---- sections
  'featured.eyebrow': { ar: 'اختياراتنا', fr: 'Notre sélection', es: 'Nuestra selección' },
  'featured.title': { ar: 'عقارات مميزة هذا الأسبوع', fr: 'Les biens à ne pas manquer', es: 'Inmuebles destacados' },
  'home.soonTitle': { ar: 'عقاراتنا الجديدة قريباً على الموقع', fr: 'Nos biens arrivent très bientôt en ligne', es: 'Nuestros inmuebles llegan muy pronto' },
  'home.soonText': {
    ar: 'نحن بصدد إضافة عقاراتنا. أخبرنا بما تبحث عنه، ونرسل لك العروض المناسبة مباشرة.',
    fr: 'Nous ajoutons nos biens en ce moment. Dites-nous ce que vous cherchez, nous vous envoyons les offres adaptées.',
    es: 'Estamos añadiendo nuestros inmuebles. Dinos qué buscas y te enviamos las ofertas adecuadas.',
  },
  'featured.all': { ar: 'عرض كل العقارات', fr: 'Voir tous les biens', es: 'Ver todos los inmuebles' },
  'latest.eyebrow': { ar: 'جديد', fr: 'Nouveautés', es: 'Novedades' },
  'latest.title': { ar: 'أحدث العروض', fr: 'Dernières offres', es: 'Últimas ofertas' },
  'hoods.eyebrow': { ar: 'اكتشف المناطق', fr: 'Explorer par zone', es: 'Explorar por zona' },
  'hoods.title': { ar: 'أين تريد أن تسكن؟', fr: 'Où souhaitez-vous vivre ?', es: '¿Dónde quieres vivir?' },
  'hoods.subtitle': {
    ar: 'من أزقة المدينة القديمة إلى شواطئ مرتيل وكابو نيغرو، كل منطقة لها طابعها — ونعرفها جميعاً.',
    fr: 'Des ruelles de la médina aux plages de Martil et Cabo Negro, chaque zone a son caractère — et nous les connaissons toutes.',
    es: 'De los callejones de la medina a las playas de Martil y Cabo Negro, cada zona tiene su carácter — y las conocemos todas.',
  },
  'hoods.count': { ar: '{n} عقار', fr: '{n} bien(s)', es: '{n} inmueble(s)' },
  'services.eyebrow': { ar: 'خدماتنا', fr: 'Nos services', es: 'Nuestros servicios' },
  'services.title': { ar: 'نرافقك في كل خطوة', fr: 'À vos côtés à chaque étape', es: 'A tu lado en cada paso' },
  'services.sale.t': { ar: 'بيع عقارك', fr: 'Vendre votre bien', es: 'Vender tu inmueble' },
  'services.sale.d': {
    ar: 'تقييم عادل، تصوير احترافي، نشر على كل القنوات، وتفاوض يحمي مصلحتك.',
    fr: 'Estimation juste, photos professionnelles, diffusion sur tous les canaux et négociation dans votre intérêt.',
    es: 'Tasación justa, fotos profesionales, difusión en todos los canales y negociación en tu interés.',
  },
  'services.buy.t': { ar: 'شراء بثقة', fr: 'Acheter en confiance', es: 'Comprar con confianza' },
  'services.buy.d': {
    ar: 'نبحث لك، نتحقق من الوثائق (الرسم العقاري، الرخص)، ونرافقك حتى عقد البيع عند الموثق.',
    fr: 'Nous cherchons pour vous, vérifions les documents (titre foncier, autorisations) et vous accompagnons jusqu’au notaire.',
    es: 'Buscamos por ti, verificamos los documentos (título, licencias) y te acompañamos hasta el notario.',
  },
  'services.rent.t': { ar: 'الكراء', fr: 'Location', es: 'Alquiler' },
  'services.rent.d': {
    ar: 'شقق واستوديوهات ومحلات للكراء السنوي أو الموسمي، مع عقود واضحة للطرفين.',
    fr: 'Appartements, studios et locaux en location annuelle ou saisonnière, avec des contrats clairs pour les deux parties.',
    es: 'Pisos, estudios y locales en alquiler anual o de temporada, con contratos claros para ambas partes.',
  },
  'services.manage.t': { ar: 'تدبير الأملاك', fr: 'Gestion locative', es: 'Gestión de alquileres' },
  'services.manage.d': {
    ar: 'نتكفل بعقارك أثناء غيابك: اختيار المكترين، تحصيل الكراء، والمتابعة التقنية.',
    fr: 'Nous gérons votre bien en votre absence : sélection des locataires, encaissement des loyers, suivi technique.',
    es: 'Gestionamos tu inmueble en tu ausencia: selección de inquilinos, cobro de rentas y seguimiento técnico.',
  },
  'services.legal.t': { ar: 'مرافقة قانونية', fr: 'Accompagnement juridique', es: 'Acompañamiento legal' },
  'services.legal.d': {
    ar: 'تحقق من الملكية، تحفيظ، عقود، وتنسيق مع الموثق والمحافظة العقارية.',
    fr: 'Vérification de propriété, immatriculation, contrats et coordination avec le notaire et la conservation foncière.',
    es: 'Verificación de propiedad, registro, contratos y coordinación con el notario y el registro de la propiedad.',
  },
  'services.mre.t': { ar: 'مغاربة العالم', fr: 'MRE & étrangers', es: 'MRE y extranjeros' },
  'services.mre.d': {
    ar: 'زيارات بالفيديو، وكالة قانونية، ومتابعة كاملة عن بُعد حتى تسليم المفاتيح.',
    fr: 'Visites en vidéo, procuration, et suivi complet à distance jusqu’à la remise des clés.',
    es: 'Visitas por vídeo, poder notarial y seguimiento completo a distancia hasta la entrega de llaves.',
  },
  'why.eyebrow': { ar: 'لماذا نحن', fr: 'Pourquoi nous', es: 'Por qué nosotros' },
  'why.title': { ar: 'الثقة تُبنى بالتفاصيل', fr: 'La confiance se construit dans les détails', es: 'La confianza se construye en los detalles' },
  'why.1.t': { ar: 'نعرف تطوان زنقة بزنقة', fr: 'Tétouan, rue par rue', es: 'Tetuán, calle a calle' },
  'why.1.d': {
    ar: 'أسعار حقيقية لكل حي، لا تخمينات. نقول لك أين تستثمر وأين تنتظر.',
    fr: 'Des prix réels pour chaque quartier, pas d’estimations au hasard. Nous vous disons où investir et où attendre.',
    es: 'Precios reales de cada barrio, sin suposiciones. Te decimos dónde invertir y dónde esperar.',
  },
  'why.2.t': { ar: 'وثائق سليمة أولاً', fr: 'Des dossiers en règle d’abord', es: 'Expedientes en regla primero' },
  'why.2.d': {
    ar: 'لا نعرض عقاراً قبل التحقق من وضعه القانوني. راحتك تبدأ قبل الزيارة.',
    fr: 'Aucun bien n’est publié avant vérification de sa situation juridique. Votre sérénité commence avant la visite.',
    es: 'Ningún inmueble se publica antes de verificar su situación legal. Tu tranquilidad empieza antes de la visita.',
  },
  'why.3.t': { ar: 'شفافية كاملة', fr: 'Transparence totale', es: 'Transparencia total' },
  'why.3.d': {
    ar: 'عمولة واضحة متفق عليها من البداية، وتقارير منتظمة عن كل خطوة.',
    fr: 'Une commission claire convenue dès le départ et des comptes rendus réguliers à chaque étape.',
    es: 'Una comisión clara acordada desde el principio e informes regulares en cada paso.',
  },
  'why.badgeYears': { ar: '{n} سنوات في خدمتكم', fr: '{n} ans à votre service', es: '{n} años a su servicio' },
  'why.badgeSub': { ar: 'تطوان · مرتيل · المضيق', fr: 'Tétouan · Martil · M’diq', es: 'Tetuán · Martil · M’diq' },
  'why.4.t': { ar: 'سرعة في الإنجاز', fr: 'Rapidité d’exécution', es: 'Rapidez de ejecución' },
  'why.4.d': {
    ar: 'شبكة واسعة من المشترين والمكترين الجديين تعني وقتاً أقل في الانتظار.',
    fr: 'Un large réseau d’acheteurs et de locataires sérieux : moins de temps à attendre.',
    es: 'Una amplia red de compradores e inquilinos serios: menos tiempo de espera.',
  },
  'testi.eyebrow': { ar: 'آراء عملائنا', fr: 'Ils nous font confiance', es: 'Confían en nosotros' },
  'testi.title': { ar: 'قصص نجاح من تطوان', fr: 'Histoires de confiance à Tétouan', es: 'Historias de confianza en Tetuán' },
  'cta.sell.eyebrow': { ar: 'لأصحاب العقارات', fr: 'Propriétaires', es: 'Propietarios' },
  'cta.sell.title': { ar: 'تريد بيع أو كراء عقارك؟', fr: 'Vous souhaitez vendre ou louer ?', es: '¿Quieres vender o alquilar?' },
  'cta.sell.text': {
    ar: 'احصل على تقييم مجاني في 48 ساعة، ودعنا نتكفل بالباقي: التصوير، النشر، الزيارات والتفاوض.',
    fr: 'Obtenez une estimation gratuite sous 48 h et laissez-nous gérer le reste : photos, diffusion, visites et négociation.',
    es: 'Obtén una tasación gratuita en 48 h y déjanos el resto: fotos, difusión, visitas y negociación.',
  },
  'cta.sell.button': { ar: 'اطلب تقييماً مجانياً', fr: 'Demander une estimation gratuite', es: 'Pedir una tasación gratuita' },
  'cta.whatsapp': { ar: 'تحدث معنا على واتساب', fr: 'Discuter sur WhatsApp', es: 'Hablar por WhatsApp' },

  // ---- property
  'p.forSale': { ar: 'للبيع', fr: 'À vendre', es: 'En venta' },
  'p.forRent': { ar: 'للكراء', fr: 'À louer', es: 'En alquiler' },
  'p.featured': { ar: 'مميز', fr: 'Coup de cœur', es: 'Destacado' },
  'p.new': { ar: 'جديد', fr: 'Nouveau', es: 'Nuevo' },
  'p.rooms': { ar: 'غرف', fr: 'pièces', es: 'habitaciones' },
  'p.bedrooms': { ar: 'غرف نوم', fr: 'chambres', es: 'dormitorios' },
  'p.bathrooms': { ar: 'حمامات', fr: 'salles de bain', es: 'baños' },
  'p.area': { ar: 'المساحة', fr: 'Surface', es: 'Superficie' },
  'p.landArea': { ar: 'مساحة الأرض', fr: 'Surface du terrain', es: 'Superficie del terreno' },
  'p.floor': { ar: 'الطابق', fr: 'Étage', es: 'Planta' },
  'p.floors': { ar: 'عدد الطوابق', fr: 'Niveaux', es: 'Plantas' },
  'p.year': { ar: 'سنة البناء', fr: 'Année de construction', es: 'Año de construcción' },
  'p.furnished': { ar: 'مفروش', fr: 'Meublé', es: 'Amueblado' },
  'p.unfurnished': { ar: 'غير مفروش', fr: 'Non meublé', es: 'Sin amueblar' },
  'p.features': { ar: 'المزايا', fr: 'Équipements & atouts', es: 'Características' },
  'p.description': { ar: 'الوصف', fr: 'Description', es: 'Descripción' },
  'p.details': { ar: 'التفاصيل', fr: 'Caractéristiques', es: 'Detalles' },
  'p.location': { ar: 'الموقع', fr: 'Localisation', es: 'Ubicación' },
  'p.ref': { ar: 'المرجع', fr: 'Réf.', es: 'Ref.' },
  'p.views': { ar: '{n} مشاهدة', fr: '{n} vues', es: '{n} visitas' },
  'p.share': { ar: 'مشاركة', fr: 'Partager', es: 'Compartir' },
  'p.copied': { ar: 'تم نسخ الرابط', fr: 'Lien copié', es: 'Enlace copiado' },
  'p.whatsapp': { ar: 'استفسر عبر واتساب', fr: 'Demander sur WhatsApp', es: 'Preguntar por WhatsApp' },
  'p.call': { ar: 'اتصل بالوكالة', fr: 'Appeler l’agence', es: 'Llamar a la agencia' },
  'p.requestVisit': { ar: 'اطلب زيارة', fr: 'Demander une visite', es: 'Solicitar una visita' },
  'p.inquire': { ar: 'أرسل استفساراً', fr: 'Envoyer une demande', es: 'Enviar una consulta' },
  'p.similar': { ar: 'عقارات مشابهة', fr: 'Biens similaires', es: 'Inmuebles similares' },
  'p.price': { ar: 'السعر', fr: 'Prix', es: 'Precio' },
  'p.pricePerM2': { ar: '{n} د.م./م²', fr: '{n} DH/m²', es: '{n} DH/m²' },
  'p.notFound': { ar: 'هذا العقار غير متاح أو تم بيعه.', fr: 'Ce bien n’est plus disponible.', es: 'Este inmueble ya no está disponible.' },
  'p.backToList': { ar: 'العودة إلى العقارات', fr: 'Retour aux biens', es: 'Volver a los inmuebles' },
  'p.favorite': { ar: 'أضف إلى المفضلة', fr: 'Ajouter aux favoris', es: 'Añadir a favoritos' },
  'p.unfavorite': { ar: 'إزالة من المفضلة', fr: 'Retirer des favoris', es: 'Quitar de favoritos' },
  'p.gallery': { ar: 'الصور', fr: 'Photos', es: 'Fotos' },
  'p.photos': { ar: '{n} صور', fr: '{n} photos', es: '{n} fotos' },
  'p.video': { ar: 'فيديو', fr: 'Vidéo', es: 'Vídeo' },
  'p.agent': { ar: 'مستشارك العقاري', fr: 'Votre conseiller', es: 'Tu asesor' },
  'p.agentText': { ar: 'فريق سويت هاوس يجيبك خلال ساعات العمل، وعلى واتساب في أي وقت.', fr: 'L’équipe Sweet House vous répond aux heures d’ouverture, et sur WhatsApp à tout moment.', es: 'El equipo Sweet House te responde en horario de apertura y por WhatsApp en cualquier momento.' },
  'p.status.reserved': { ar: 'محجوز', fr: 'Réservé', es: 'Reservado' },
  'p.status.sold': { ar: 'تم البيع', fr: 'Vendu', es: 'Vendido' },
  'p.status.rented': { ar: 'تم الكراء', fr: 'Loué', es: 'Alquilado' },
  'p.print': { ar: 'طباعة البطاقة', fr: 'Imprimer la fiche', es: 'Imprimir la ficha' },

  // ---- mortgage
  'nav.calc': { ar: 'حاسبة المصاريف', fr: 'Frais & taxes', es: 'Gastos e impuestos' },
  'calc.title': { ar: 'حاسبة مصاريف الشراء والبيع', fr: 'Simulateur des frais d’achat et de vente', es: 'Simulador de gastos de compra y venta' },
  'calc.eyebrow': { ar: 'أدوات مجانية', fr: 'Outils gratuits', es: 'Herramientas gratuitas' },
  'calc.subtitle': { ar: 'احسب كل ما يدفعه المشتري زيادة على الثمن، وما يصل البائع صافياً بعد الضريبة والمصاريف، حسب القانون المغربي المحيّن.', fr: 'Calculez tout ce que l’acheteur paie en plus du prix, et ce que le vendeur touche net après impôt et frais, selon la loi marocaine à jour.', es: 'Calcule lo que el comprador paga además del precio, y lo que el vendedor recibe neto tras impuestos y gastos, según la ley marroquí vigente.' },
  'calc.tab.buyer': { ar: 'مصاريف الشراء', fr: 'Frais d’achat', es: 'Gastos de compra' },
  'calc.tab.seller': { ar: 'البيع وضريبة الربح', fr: 'Vente et impôt sur le profit', es: 'Venta e impuesto sobre la plusvalía' },
  'calc.price': { ar: 'ثمن العقار بالدرهم', fr: 'Prix du bien en dirhams', es: 'Precio del inmueble en dírhams' },
  'calc.kind': { ar: 'نوع العقار', fr: 'Type de bien', es: 'Tipo de inmueble' },
  'calc.kind.built': { ar: 'شقة، منزل، فيلا أو محل', fr: 'Appartement, maison, villa ou local', es: 'Piso, casa, villa o local' },
  'calc.kind.land': { ar: 'أرض عارية', fr: 'Terrain nu', es: 'Terreno sin edificar' },
  'calc.kind.social': { ar: 'سكن اجتماعي جديد', fr: 'Logement social neuf', es: 'Vivienda social nueva' },
  'calc.kind.social.hint': { ar: 'أول بيع من منعش متعاقد مع الدولة، بين 50 و80 م² وبثمن لا يتجاوز 250 000 درهم دون الضريبة.', fr: 'Première vente par un promoteur conventionné, 50 à 80 m², prix jusqu’à 250 000 DH hors TVA.', es: 'Primera venta por un promotor con convenio, de 50 a 80 m², precio hasta 250 000 DH sin IVA.' },
  'calc.cash': { ar: 'الجزء المؤدى نقداً بالدرهم', fr: 'Part payée en espèces, en dirhams', es: 'Parte pagada en efectivo, en dírhams' },
  'calc.cash.hint': { ar: 'التحويل البنكي والشيك المسطر والقرض لا تدخل هنا.', fr: 'Virement, chèque barré et crédit ne comptent pas ici.', es: 'Transferencia, cheque cruzado y préstamo no cuentan aquí.' },
  'calc.loan': { ar: 'مبلغ القرض البنكي بالدرهم', fr: 'Montant du crédit bancaire en dirhams', es: 'Importe del préstamo bancario en dírhams' },
  'calc.loan.hint': { ar: 'اتركه 0 إن كان الشراء بدون قرض.', fr: 'Laissez 0 pour un achat sans crédit.', es: 'Deje 0 si compra sin préstamo.' },
  'calc.agency': { ar: 'احتساب أتعاب الوكالة', fr: 'Inclure les honoraires d’agence', es: 'Incluir los honorarios de la agencia' },
  'calc.line.registration': { ar: 'رسوم التسجيل', fr: 'Droits d’enregistrement', es: 'Derechos de registro' },
  'calc.line.cash_extra': { ar: 'واجب إضافي على الجزء المؤدى نقداً', fr: 'Droit supplémentaire sur la part en espèces', es: 'Derecho adicional sobre la parte en efectivo' },
  'calc.line.conservation': { ar: 'المحافظة العقارية', fr: 'Conservation foncière', es: 'Conservación de la propiedad' },
  'calc.line.notary': { ar: 'أتعاب الموثق', fr: 'Honoraires du notaire', es: 'Honorarios del notario' },
  'calc.line.notary_vat': { ar: 'الضريبة على أتعاب الموثق', fr: 'TVA sur les honoraires du notaire', es: 'IVA sobre los honorarios del notario' },
  'calc.line.disbursements': { ar: 'مصاريف إدارية لدى الموثق', fr: 'Frais divers chez le notaire', es: 'Gastos diversos del notario' },
  'calc.line.agency': { ar: 'أتعاب الوكالة', fr: 'Honoraires d’agence', es: 'Honorarios de la agencia' },
  'calc.line.loan_conservation': { ar: 'تقييد الرهن بالمحافظة العقارية', fr: 'Inscription de l’hypothèque', es: 'Inscripción de la hipoteca' },
  'calc.line.loan_registration': { ar: 'تسجيل عقد الرهن', fr: 'Enregistrement de l’acte d’hypothèque', es: 'Registro de la escritura de hipoteca' },
  'calc.line.loan_bank': { ar: 'مصاريف ملف القرض لدى البنك', fr: 'Frais de dossier bancaire', es: 'Comisión de apertura del banco' },
  'calc.line.loan_notary': { ar: 'أتعاب الموثق على عقد القرض', fr: 'Honoraires du notaire sur l’acte de prêt', es: 'Honorarios del notario por el préstamo' },
  'calc.line.tpi': { ar: 'الضريبة على الربح العقاري', fr: 'Impôt sur le profit immobilier', es: 'Impuesto sobre la plusvalía inmobiliaria' },
  'calc.line.agency_seller': { ar: 'أتعاب الوكالة', fr: 'Honoraires d’agence', es: 'Honorarios de la agencia' },
  'calc.line.other_costs': { ar: 'مصاريف بيع أخرى', fr: 'Autres frais de vente', es: 'Otros gastos de venta' },
  'calc.line.release_conservation': { ar: 'رفع الرهن بالمحافظة العقارية', fr: 'Mainlevée à la conservation foncière', es: 'Cancelación de la hipoteca en la conservación' },
  'calc.line.release_registration': { ar: 'تسجيل عقد رفع الرهن', fr: 'Enregistrement de la mainlevée', es: 'Registro de la cancelación' },
  'calc.line.release_fees': { ar: 'مصاريف البنك والموثق لرفع الرهن', fr: 'Frais de banque et de notaire pour la mainlevée', es: 'Gastos de banco y notario de la cancelación' },
  'calc.line.local_taxes': { ar: 'الضرائب المحلية المتأخرة', fr: 'Taxes locales en retard', es: 'Impuestos locales atrasados' },
  'calc.line.certificate': { ar: 'شهادة الملكية', fr: 'Certificat de propriété', es: 'Certificado de propiedad' },
  'calc.total': { ar: 'مجموع المصاريف', fr: 'Total des frais', es: 'Total de gastos' },
  'calc.share': { ar: '{n}% من الثمن', fr: '{n} % du prix', es: '{n} % del precio' },
  'calc.cashNeeded': { ar: 'المبلغ الذي تحتاجه من مالك', fr: 'Apport personnel nécessaire', es: 'Aportación propia necesaria' },
  'calc.estimate': { ar: 'تقديري', fr: 'estimation', es: 'estimación' },
  'calc.aid': { ar: 'قد تستفيد من الدعم المباشر للسكن بمبلغ {n}، إن كان أول سكن تشتريه جديداً من منعش عقاري وتوفرت باقي الشروط.', fr: 'Vous pourriez bénéficier de l’aide directe au logement de {n}, s’il s’agit de votre premier logement acheté neuf auprès d’un promoteur et si les autres conditions sont remplies.', es: 'Podría recibir la ayuda directa a la vivienda de {n}, si es su primera vivienda comprada nueva a un promotor y cumple las demás condiciones.' },
  'calc.sprice': { ar: 'ثمن البيع بالدرهم', fr: 'Prix de vente en dirhams', es: 'Precio de venta en dírhams' },
  'calc.mode': { ar: 'كيف تملكت العقار؟', fr: 'Comment avez-vous acquis le bien ?', es: '¿Cómo adquirió el inmueble?' },
  'calc.mode.purchase': { ar: 'شراء', fr: 'Achat', es: 'Compra' },
  'calc.mode.inheritance': { ar: 'إرث', fr: 'Héritage', es: 'Herencia' },
  'calc.mode.donation': { ar: 'هبة', fr: 'Donation', es: 'Donación' },
  'calc.year': { ar: 'سنة التملك', fr: 'Année d’acquisition', es: 'Año de adquisición' },
  'calc.acquired': { ar: 'ثمن الشراء بالدرهم', fr: 'Prix d’achat en dirhams', es: 'Precio de compra en dírhams' },
  'calc.acquired.declared': { ar: 'القيمة المصرح بها عند الإرث أو الهبة', fr: 'Valeur déclarée à la succession ou à la donation', es: 'Valor declarado en la herencia o donación' },
  'calc.useActual': { ar: 'لدي وثائق بمصاريف شراء أكبر من {n}% الجزافية', fr: 'J’ai des justificatifs de frais supérieurs au forfait de {n} %', es: 'Tengo justificantes de gastos superiores al {n} % a tanto alzado' },
  'calc.actual': { ar: 'مصاريف التملك الفعلية بالوثائق', fr: 'Frais d’acquisition réels justifiés', es: 'Gastos de adquisición reales justificados' },
  'calc.investments': { ar: 'أشغال البناء أو التحسين بفواتير', fr: 'Travaux de construction ou d’amélioration facturés', es: 'Obras de construcción o mejora con factura' },
  'calc.interest': { ar: 'فوائد قرض الشراء المؤداة', fr: 'Intérêts payés sur le crédit d’achat', es: 'Intereses pagados del préstamo de compra' },
  'calc.otherCosts': { ar: 'مصاريف بيع أخرى: إشهار، وثائق', fr: 'Autres frais de vente : annonces, documents', es: 'Otros gastos de venta: anuncios, documentos' },
  'calc.residence': { ar: 'سكني الرئيسي منذ {n} سنوات على الأقل ولم أكْرِه', fr: 'Ma résidence principale depuis au moins {n} ans, jamais louée', es: 'Mi vivienda habitual desde hace al menos {n} años, nunca alquilada' },
  'calc.social': { ar: 'أول بيع لسكن اجتماعي أسكنه منذ {n} سنوات', fr: 'Première vente d’un logement social occupé depuis {n} ans', es: 'Primera venta de una vivienda social ocupada desde hace {n} años' },
  'calc.small': { ar: 'مجموع مبيعاتي العقارية هذه السنة لا يتجاوز {n}', fr: 'Mes ventes immobilières de l’année ne dépassent pas {n}', es: 'Mis ventas inmobiliarias del año no superan {n}' },
  'calc.release': { ar: 'على العقار رهن بنكي يجب رفعه', fr: 'Le bien est hypothéqué, une mainlevée est nécessaire', es: 'El inmueble está hipotecado y hay que cancelar la hipoteca' },
  'calc.releaseFees': { ar: 'مصاريف البنك والموثق لرفع الرهن', fr: 'Frais de banque et de notaire pour la mainlevée', es: 'Gastos de banco y notario para cancelar la hipoteca' },
  'calc.loanBalance': { ar: 'الباقي من القرض يُسدَّد من الثمن', fr: 'Reste du crédit remboursé sur le prix', es: 'Resto del préstamo pagado con el precio' },
  'calc.localTaxes': { ar: 'ضرائب محلية غير مؤداة', fr: 'Taxes locales impayées', es: 'Impuestos locales pendientes' },
  'calc.more': { ar: 'معلومات إضافية', fr: 'Informations complémentaires', es: 'Información adicional' },
  'calc.tpi.title': { ar: 'كيف حُسبت الضريبة', fr: 'Comment l’impôt est calculé', es: 'Cómo se calcula el impuesto' },
  'calc.tpi.base': { ar: 'كلفة التملك: الثمن والمصاريف والأشغال والفوائد', fr: 'Coût d’acquisition : prix, frais, travaux et intérêts', es: 'Coste de adquisición: precio, gastos, obras e intereses' },
  'calc.tpi.coef': { ar: 'معامل إعادة التقييم لسنة {y}', fr: 'Coefficient de réévaluation de {y}', es: 'Coeficiente de revalorización de {y}' },
  'calc.tpi.revalued': { ar: 'الكلفة بعد إعادة التقييم', fr: 'Coût réévalué', es: 'Coste revalorizado' },
  'calc.tpi.selling': { ar: 'مصاريف البيع المخصومة', fr: 'Frais de cession déduits', es: 'Gastos de venta deducidos' },
  'calc.tpi.profit': { ar: 'الربح الصافي', fr: 'Profit net', es: 'Beneficio neto' },
  'calc.tpi.rate': { ar: '{n}% من الربح', fr: '{n} % du profit', es: '{n} % del beneficio' },
  'calc.tpi.min': { ar: 'الحد الأدنى: {n}% من ثمن البيع', fr: 'Minimum : {n} % du prix de vente', es: 'Mínimo: {n} % del precio de venta' },
  'calc.tpi.due': { ar: 'تؤدّى القيمة الأعلى بين الاثنين.', fr: 'Le plus élevé des deux montants est dû.', es: 'Se paga el mayor de los dos importes.' },
  'calc.ex.residence': { ar: 'معفى لأنه سكن رئيسي منذ {n} سنوات. يبقى الحد الأدنى {r}% على ما يتجاوز {cap} من الثمن.', fr: 'Exonéré : résidence principale depuis {n} ans. Le minimum de {r} % reste dû sur la part du prix au-delà de {cap}.', es: 'Exento por ser vivienda habitual desde {n} años. El mínimo del {r} % se aplica a la parte del precio que supera {cap}.' },
  'calc.ex.social': { ar: 'معفى لأنه أول بيع لسكن اجتماعي تسكنه.', fr: 'Exonéré : première vente d’un logement social occupé.', es: 'Exento: primera venta de una vivienda social ocupada.' },
  'calc.ex.small': { ar: 'معفى لأن مبيعات السنة لا تتجاوز {cap}.', fr: 'Exonéré : ventes de l’année inférieures à {cap}.', es: 'Exento: ventas del año inferiores a {cap}.' },
  'calc.net': { ar: 'الصافي الذي يصلك', fr: 'Montant net pour vous', es: 'Importe neto para usted' },
  'calc.netAfterLoan': { ar: 'الصافي بعد سداد القرض', fr: 'Net après remboursement du crédit', es: 'Neto tras pagar el préstamo' },
  'calc.sellerTotal': { ar: 'مجموع ما يُخصم من الثمن', fr: 'Total déduit du prix', es: 'Total descontado del precio' },
  'calc.note.buyer': { ar: 'النسب حسب المدونة العامة للضرائب وقانون المالية 2026 وتعريفة المحافظة العقارية. أتعاب الموثق ومصاريف البنك تقديرية وتُتفق معهم.', fr: 'Taux selon le Code général des impôts, la loi de finances 2026 et le tarif de la conservation foncière. Les honoraires du notaire et les frais bancaires sont estimés et se négocient.', es: 'Tipos según el Código General de Impuestos, la ley de finanzas 2026 y la tarifa de la conservación. Los honorarios del notario y del banco son estimados y negociables.' },
  'calc.note.cash': { ar: 'منذ 1 يوليوز 2026، يُضاف واجب {n}% على الجزء المؤدى نقداً إذا تجاوز الثمن {cap}.', fr: 'Depuis le 1er juillet 2026, un droit de {n} % s’ajoute sur la part payée en espèces si le prix dépasse {cap}.', es: 'Desde el 1 de julio de 2026 se añade un {n} % sobre la parte pagada en efectivo si el precio supera {cap}.' },
  'calc.note.seller': { ar: 'تُصرَّح الضريبة وتؤدى إلكترونياً خلال 30 يوماً من البيع. يمكن طلب رأي مسبق من المديرية العامة للضرائب خلال 30 يوماً من الوعد بالبيع.', fr: 'L’impôt se déclare et se paie en ligne dans les 30 jours suivant la vente. Un avis préalable peut être demandé à la DGI dans les 30 jours suivant le compromis.', es: 'El impuesto se declara y paga en línea en los 30 días siguientes a la venta. Puede pedirse un dictamen previo a la DGI en los 30 días siguientes al compromiso.' },
  'calc.note.reviewed': { ar: 'آخر مراجعة للنسب: {d}', fr: 'Taux vérifiés le {d}', es: 'Tipos revisados el {d}' },
  'calc.disclaimer': { ar: 'تقدير للتوضيح، لا يعوّض الموثق أو الإدارة الضريبية.', fr: 'Estimation indicative, ne remplace ni le notaire ni l’administration fiscale.', es: 'Estimación orientativa, no sustituye al notario ni a la administración fiscal.' },
  'calc.ask': { ar: 'اطلب حساباً دقيقاً لملفك', fr: 'Demander un calcul précis pour votre dossier', es: 'Pedir un cálculo exacto para su caso' },
  'calc.ask.text': { ar: 'مرحباً، أريد حساباً دقيقاً لمصاريف {w} عقار بثمن {p}.', fr: 'Bonjour, je souhaite un calcul précis des frais pour {w} un bien de {p}.', es: 'Hola, quisiera un cálculo exacto de los gastos para {w} un inmueble de {p}.' },
  'calc.ask.buy': { ar: 'شراء', fr: 'acheter', es: 'comprar' },
  'calc.ask.sell': { ar: 'بيع', fr: 'vendre', es: 'vender' },
  'calc.box.title': { ar: 'مصاريف الشراء التقديرية', fr: 'Frais d’achat estimés', es: 'Gastos de compra estimados' },
  'calc.box.more': { ar: 'التفاصيل والحاسبة الكاملة', fr: 'Détail et simulateur complet', es: 'Detalle y simulador completo' },
  'sell.calc.title': { ar: 'كم سيصلك صافياً بعد البيع؟', fr: 'Combien toucherez-vous net après la vente ?', es: '¿Cuánto recibirá neto tras la venta?' },
  'sell.calc.text': { ar: 'احسب ضريبة الربح العقاري ومصاريف البيع في دقيقة، حسب القانون المحيّن.', fr: 'Calculez l’impôt sur le profit immobilier et les frais de vente en une minute, selon la loi à jour.', es: 'Calcule el impuesto sobre la plusvalía y los gastos de venta en un minuto, según la ley vigente.' },
  'sell.calc.cta': { ar: 'احسب الآن', fr: 'Calculer maintenant', es: 'Calcular ahora' },
  'mortgage.title': { ar: 'حاسبة القرض العقاري', fr: 'Simulateur de crédit', es: 'Simulador de hipoteca' },
  'mortgage.sub': { ar: 'تقدير تقريبي لا يعوّض عرض البنك.', fr: 'Estimation indicative, ne remplace pas l’offre de la banque.', es: 'Estimación orientativa, no sustituye la oferta del banco.' },
  'mortgage.price': { ar: 'سعر العقار', fr: 'Prix du bien', es: 'Precio del inmueble' },
  'mortgage.down': { ar: 'الدفعة الأولى', fr: 'Apport personnel', es: 'Entrada' },
  'mortgage.rate': { ar: 'نسبة الفائدة السنوية', fr: 'Taux annuel', es: 'Tipo de interés anual' },
  'mortgage.years': { ar: 'المدة (سنوات)', fr: 'Durée (ans)', es: 'Plazo (años)' },
  'mortgage.monthly': { ar: 'القسط الشهري التقريبي', fr: 'Mensualité estimée', es: 'Cuota mensual estimada' },
  'mortgage.total': { ar: 'إجمالي الفوائد', fr: 'Total des intérêts', es: 'Total de intereses' },

  // ---- listings
  'list.title': { ar: 'عقاراتنا', fr: 'Nos biens', es: 'Nuestros inmuebles' },
  'list.titleSale': { ar: 'عقارات للبيع في تطوان', fr: 'Biens à vendre à Tétouan', es: 'Inmuebles en venta en Tetuán' },
  'list.titleRent': { ar: 'عقارات للكراء في تطوان', fr: 'Biens à louer à Tétouan', es: 'Inmuebles en alquiler en Tetuán' },
  'list.results': { ar: '{n} عقار', fr: '{n} bien(s)', es: '{n} inmueble(s)' },
  'list.sort': { ar: 'ترتيب', fr: 'Trier', es: 'Ordenar' },
  'list.sort.newest': { ar: 'الأحدث', fr: 'Plus récents', es: 'Más recientes' },
  'list.sort.price_asc': { ar: 'السعر: من الأقل', fr: 'Prix croissant', es: 'Precio ascendente' },
  'list.sort.price_desc': { ar: 'السعر: من الأعلى', fr: 'Prix décroissant', es: 'Precio descendente' },
  'list.sort.area_desc': { ar: 'المساحة: الأكبر', fr: 'Surface décroissante', es: 'Superficie descendente' },
  'list.filters': { ar: 'الفلاتر', fr: 'Filtres', es: 'Filtros' },
  'list.purpose': { ar: 'الغرض', fr: 'Transaction', es: 'Operación' },
  'list.minPrice': { ar: 'السعر الأدنى', fr: 'Prix min', es: 'Precio mín.' },
  'list.maxPrice': { ar: 'السعر الأقصى', fr: 'Prix max', es: 'Precio máx.' },
  'list.rooms': { ar: 'الغرف (على الأقل)', fr: 'Pièces (min)', es: 'Habitaciones (mín.)' },
  'list.minArea': { ar: 'المساحة الأدنى (م²)', fr: 'Surface min (m²)', es: 'Superficie mín. (m²)' },
  'list.reset': { ar: 'مسح الفلاتر', fr: 'Réinitialiser', es: 'Limpiar filtros' },
  'list.apply': { ar: 'تطبيق', fr: 'Appliquer', es: 'Aplicar' },
  'list.map': { ar: 'الخريطة', fr: 'Carte', es: 'Mapa' },
  'list.grid': { ar: 'القائمة', fr: 'Liste', es: 'Lista' },
  'list.empty': { ar: 'لا توجد عقارات تطابق بحثك حالياً.', fr: 'Aucun bien ne correspond à votre recherche pour le moment.', es: 'Ningún inmueble coincide con tu búsqueda por ahora.' },
  'list.emptyHint': { ar: 'اترك لنا طلبك وسنتصل بك عندما يتوفر عقار مناسب.', fr: 'Laissez-nous votre demande : nous vous rappelons dès qu’un bien correspond.', es: 'Déjanos tu solicitud: te llamamos en cuanto haya un inmueble que encaje.' },
  'list.alert': { ar: 'أبلغوني عند توفر عقار مناسب', fr: 'Me prévenir d’un nouveau bien', es: 'Avisarme de un nuevo inmueble' },
  'fav.title': { ar: 'عقاراتك المفضلة', fr: 'Vos biens favoris', es: 'Tus inmuebles favoritos' },
  'fav.empty': { ar: 'لم تضف أي عقار إلى المفضلة بعد.', fr: 'Vous n’avez pas encore de favoris.', es: 'Aún no tienes favoritos.' },
  'fav.browse': { ar: 'تصفح العقارات', fr: 'Parcourir les biens', es: 'Explorar inmuebles' },
  'fav.shareAll': { ar: 'أرسل قائمتي للوكالة', fr: 'Envoyer ma liste à l’agence', es: 'Enviar mi lista a la agencia' },

  // ---- forms
  'form.name': { ar: 'الاسم الكامل', fr: 'Nom complet', es: 'Nombre completo' },
  'form.phone': { ar: 'رقم الهاتف', fr: 'Téléphone', es: 'Teléfono' },
  'form.email': { ar: 'البريد الإلكتروني (اختياري)', fr: 'E-mail (facultatif)', es: 'Correo electrónico (opcional)' },
  'form.message': { ar: 'رسالتك', fr: 'Votre message', es: 'Tu mensaje' },
  'form.send': { ar: 'إرسال', fr: 'Envoyer', es: 'Enviar' },
  'form.sending': { ar: 'جارٍ الإرسال…', fr: 'Envoi…', es: 'Enviando…' },
  'form.sent': { ar: 'تم استلام طلبك', fr: 'Demande bien reçue', es: 'Solicitud recibida' },
  'form.sentText': { ar: 'شكراً لك! سيتصل بك فريقنا في أقرب وقت خلال ساعات العمل.', fr: 'Merci ! Notre équipe vous contacte très vite pendant les heures d’ouverture.', es: '¡Gracias! Nuestro equipo te contactará muy pronto en horario de apertura.' },
  'form.error': { ar: 'تعذر الإرسال. حاول مرة أخرى أو اتصل بنا مباشرة.', fr: 'Envoi impossible. Réessayez ou appelez-nous directement.', es: 'No se pudo enviar. Inténtalo de nuevo o llámanos directamente.' },
  'form.required': { ar: 'هذا الحقل مطلوب', fr: 'Champ obligatoire', es: 'Campo obligatorio' },
  'form.phoneInvalid': { ar: 'رقم هاتف غير صحيح', fr: 'Numéro invalide', es: 'Número no válido' },
  'form.preferredDate': { ar: 'التاريخ والوقت المفضل للزيارة', fr: 'Date et heure souhaitées', es: 'Fecha y hora preferidas' },
  'form.visitTitle': { ar: 'طلب زيارة', fr: 'Demande de visite', es: 'Solicitud de visita' },
  'form.visitText': { ar: 'اختر الوقت الذي يناسبك وسنؤكد لك الموعد هاتفياً.', fr: 'Choisissez le créneau qui vous convient, nous confirmons par téléphone.', es: 'Elige el horario que te convenga y te lo confirmamos por teléfono.' },
  'form.inquiryTitle': { ar: 'اطلب معلومات عن هذا العقار', fr: 'Demander des informations', es: 'Solicitar información' },
  'form.consent': { ar: 'بإرسال هذا النموذج توافق على أن نتصل بك بخصوص طلبك.', fr: 'En envoyant ce formulaire, vous acceptez d’être contacté(e) au sujet de votre demande.', es: 'Al enviar este formulario aceptas que te contactemos sobre tu solicitud.' },
  'form.demoSent': {
    ar: 'هذه نسخة تجريبية من الموقع: طلبك لم يصل إلى الوكالة بعد. أرسله لنا عبر واتساب بضغطة واحدة.',
    fr: 'Ceci est une version de démonstration : votre demande n’est pas encore transmise à l’agence. Envoyez-la-nous sur WhatsApp en un clic.',
    es: 'Esta es una versión de demostración: tu solicitud aún no ha llegado a la agencia. Envíanosla por WhatsApp con un clic.',
  },
  'form.demoSend': { ar: 'إرسال الطلب عبر واتساب', fr: 'Envoyer sur WhatsApp', es: 'Enviar por WhatsApp' },
  'form.anotherOne': { ar: 'إرسال طلب آخر', fr: 'Envoyer une autre demande', es: 'Enviar otra solicitud' },

  // ---- sell page
  'sell.eyebrow': { ar: 'لأصحاب العقارات', fr: 'Espace propriétaires', es: 'Espacio propietarios' },
  'sell.title': { ar: 'بيع أو كراء عقارك مع سويت هاوس', fr: 'Vendez ou louez votre bien avec Sweet House', es: 'Vende o alquila tu inmueble con Sweet House' },
  'sell.subtitle': { ar: 'تقييم مجاني، تصوير احترافي، وشبكة مشترين جديين. أخبرنا عن عقارك ونتصل بك في أقل من 24 ساعة.', fr: 'Estimation gratuite, photos professionnelles et un réseau d’acheteurs sérieux. Parlez-nous de votre bien, nous vous rappelons sous 24 h.', es: 'Tasación gratuita, fotos profesionales y una red de compradores serios. Cuéntanos sobre tu inmueble y te llamamos en menos de 24 h.' },
  'sell.purpose': { ar: 'ماذا تريد؟', fr: 'Votre projet', es: 'Tu proyecto' },
  'sell.purpose.sale': { ar: 'بيع عقاري', fr: 'Vendre', es: 'Vender' },
  'sell.purpose.rent': { ar: 'كراء عقاري', fr: 'Mettre en location', es: 'Alquilar' },
  'sell.purpose.valuation': { ar: 'تقييم فقط', fr: 'Estimation seulement', es: 'Solo tasación' },
  'sell.type': { ar: 'نوع العقار', fr: 'Type de bien', es: 'Tipo de inmueble' },
  'sell.area': { ar: 'المساحة التقريبية (م²)', fr: 'Surface approximative (m²)', es: 'Superficie aproximada (m²)' },
  'sell.price': { ar: 'السعر المطلوب (اختياري)', fr: 'Prix souhaité (facultatif)', es: 'Precio deseado (opcional)' },
  'sell.notes': { ar: 'وصف مختصر (الطابق، الحالة، المزايا…)', fr: 'Description rapide (étage, état, atouts…)', es: 'Descripción breve (planta, estado, ventajas…)' },
  'sell.step1.t': { ar: 'أخبرنا عن عقارك', fr: 'Parlez-nous de votre bien', es: 'Cuéntanos sobre tu inmueble' },
  'sell.step1.d': { ar: 'نموذج بسيط من دقيقتين.', fr: 'Un formulaire de deux minutes.', es: 'Un formulario de dos minutos.' },
  'sell.step2.t': { ar: 'زيارة وتقييم مجاني', fr: 'Visite et estimation gratuite', es: 'Visita y tasación gratuita' },
  'sell.step2.d': { ar: 'نحدد السعر العادل بناءً على السوق الحقيقي في حيك.', fr: 'Nous fixons le juste prix selon le marché réel de votre quartier.', es: 'Fijamos el precio justo según el mercado real de tu barrio.' },
  'sell.step3.t': { ar: 'نشر وزيارات', fr: 'Diffusion et visites', es: 'Difusión y visitas' },
  'sell.step3.d': { ar: 'تصوير احترافي ونشر على موقعنا وشبكاتنا، ونتكفل بالزيارات.', fr: 'Photos pro, diffusion sur notre site et nos réseaux, visites gérées par nous.', es: 'Fotos profesionales, difusión en nuestra web y redes, visitas gestionadas por nosotros.' },
  'sell.step4.t': { ar: 'تفاوض وتوقيع', fr: 'Négociation et signature', es: 'Negociación y firma' },
  'sell.step4.d': { ar: 'نحمي مصلحتك حتى التوقيع عند الموثق وتسليم المفاتيح.', fr: 'Nous défendons vos intérêts jusqu’à la signature chez le notaire et la remise des clés.', es: 'Defendemos tus intereses hasta la firma ante notario y la entrega de llaves.' },

  // ---- agency page
  'agency.eyebrow': { ar: 'من نحن', fr: 'Qui sommes-nous', es: 'Quiénes somos' },
  'agency.title': { ar: 'وكالة من قلب تطوان', fr: 'Une agence au cœur de Tétouan', es: 'Una agencia en el corazón de Tetuán' },
  'agency.values': { ar: 'قيمنا', fr: 'Nos valeurs', es: 'Nuestros valores' },
  'agency.v1.t': { ar: 'الصدق', fr: 'Honnêteté', es: 'Honestidad' },
  'agency.v1.d': { ar: 'نقول الحقيقة عن العقار حتى لو كلّفنا الصفقة.', fr: 'Nous disons la vérité sur le bien, même si cela nous coûte la vente.', es: 'Decimos la verdad sobre el inmueble, aunque nos cueste la venta.' },
  'agency.v2.t': { ar: 'الاحترافية', fr: 'Professionnalisme', es: 'Profesionalidad' },
  'agency.v2.d': { ar: 'ملفات كاملة، مواعيد محترمة، وتواصل واضح.', fr: 'Des dossiers complets, des rendez-vous respectés, une communication claire.', es: 'Expedientes completos, citas respetadas y comunicación clara.' },
  'agency.v3.t': { ar: 'القرب', fr: 'Proximité', es: 'Cercanía' },
  'agency.v3.d': { ar: 'نحن من تطوان، نعيش فيها ونعرف ناسها وأحياءها.', fr: 'Nous sommes de Tétouan : nous y vivons et connaissons ses habitants et ses quartiers.', es: 'Somos de Tetuán: vivimos aquí y conocemos a su gente y sus barrios.' },
  'agency.cta': { ar: 'تعال لزيارتنا أو تحدث معنا الآن', fr: 'Venez nous voir ou écrivez-nous', es: 'Ven a vernos o escríbenos' },
  'agency.visit': { ar: 'زورونا', fr: 'Nous rendre visite', es: 'Visítanos' },

  // ---- contact
  'contact.eyebrow': { ar: 'تواصل معنا', fr: 'Contactez-nous', es: 'Contáctanos' },
  'contact.title': { ar: 'نحن هنا للإجابة عن أسئلتك', fr: 'Nous sommes là pour répondre à vos questions', es: 'Estamos aquí para responder a tus preguntas' },
  'contact.address': { ar: 'العنوان', fr: 'Adresse', es: 'Dirección' },
  'contact.hours': { ar: 'أوقات العمل', fr: 'Horaires', es: 'Horario' },
  'contact.phone': { ar: 'الهاتف', fr: 'Téléphone', es: 'Teléfono' },
  'contact.email': { ar: 'البريد الإلكتروني', fr: 'E-mail', es: 'Correo electrónico' },
  'contact.formTitle': { ar: 'أرسل لنا رسالة', fr: 'Envoyez-nous un message', es: 'Envíanos un mensaje' },
  'contact.subject': { ar: 'موضوع الرسالة', fr: 'Objet', es: 'Asunto' },
  'contact.subject.buy': { ar: 'أبحث عن عقار للشراء', fr: 'Je cherche à acheter', es: 'Busco comprar' },
  'contact.subject.rent': { ar: 'أبحث عن عقار للكراء', fr: 'Je cherche à louer', es: 'Busco alquilar' },
  'contact.subject.sell': { ar: 'أريد بيع/كراء عقاري', fr: 'Je veux vendre / louer mon bien', es: 'Quiero vender / alquilar mi inmueble' },
  'contact.subject.other': { ar: 'موضوع آخر', fr: 'Autre', es: 'Otro' },
  'contact.social': { ar: 'تابعنا', fr: 'Suivez-nous', es: 'Síguenos' },

  // ---- footer
  'footer.links': { ar: 'روابط سريعة', fr: 'Liens rapides', es: 'Enlaces rápidos' },
  'footer.contact': { ar: 'اتصل بنا', fr: 'Contact', es: 'Contacto' },
  'footer.rights': { ar: 'جميع الحقوق محفوظة', fr: 'Tous droits réservés', es: 'Todos los derechos reservados' },
  'footer.photo': { ar: 'صورة الغلاف', fr: 'Photo de couverture', es: 'Foto de portada' },
  'footer.types': { ar: 'أنواع العقارات', fr: 'Types de biens', es: 'Tipos de inmuebles' },

  // ---- common
  'common.loading': { ar: 'جارٍ التحميل…', fr: 'Chargement…', es: 'Cargando…' },
  'common.error': { ar: 'حدث خطأ ما.', fr: 'Une erreur est survenue.', es: 'Se ha producido un error.' },
  'common.viewAll': { ar: 'عرض الكل', fr: 'Tout voir', es: 'Ver todo' },
  'common.back': { ar: 'رجوع', fr: 'Retour', es: 'Volver' },
  'common.close': { ar: 'إغلاق', fr: 'Fermer', es: 'Cerrar' },
  'common.next': { ar: 'التالي', fr: 'Suivant', es: 'Siguiente' },
  'common.prev': { ar: 'السابق', fr: 'Précédent', es: 'Anterior' },
  'common.more': { ar: 'عرض المزيد', fr: 'Afficher plus', es: 'Mostrar más' },
  'common.details': { ar: 'التفاصيل', fr: 'Voir le bien', es: 'Ver inmueble' },
  'common.notFound': { ar: 'الصفحة غير موجودة', fr: 'Page introuvable', es: 'Página no encontrada' },
  'common.notFoundText': { ar: 'ربما تم نقل الصفحة أو حذفها.', fr: 'La page a peut-être été déplacée ou supprimée.', es: 'La página puede haberse movido o eliminado.' },
  'common.goHome': { ar: 'العودة إلى الرئيسية', fr: 'Retour à l’accueil', es: 'Volver al inicio' },
  'common.demo': { ar: 'وضع تجريبي: البيانات نموذجية ومحفوظة على هذا الجهاز فقط.', fr: 'Mode démo : données d’exemple enregistrées sur cet appareil uniquement.', es: 'Modo demo: datos de ejemplo guardados solo en este dispositivo.' },
  'common.langAuto': { ar: 'اللغة', fr: 'Langue', es: 'Idioma' },

  // ---- property types
  'type.apartment': { ar: 'شقة', fr: 'Appartement', es: 'Piso' },
  'type.house': { ar: 'منزل', fr: 'Maison', es: 'Casa' },
  'type.villa': { ar: 'فيلا', fr: 'Villa', es: 'Villa' },
  'type.riad': { ar: 'رياض', fr: 'Riad', es: 'Riad' },
  'type.studio': { ar: 'استوديو', fr: 'Studio', es: 'Estudio' },
  'type.duplex': { ar: 'دوبلكس', fr: 'Duplex', es: 'Dúplex' },
  'type.land': { ar: 'أرض', fr: 'Terrain', es: 'Terreno' },
  'type.commercial': { ar: 'محل تجاري', fr: 'Local commercial', es: 'Local comercial' },
  'type.office': { ar: 'مكتب', fr: 'Bureau', es: 'Oficina' },
  'type.garage': { ar: 'كراج', fr: 'Garage', es: 'Garaje' },
  'type.building': { ar: 'عمارة', fr: 'Immeuble', es: 'Edificio' },
  'type.farm': { ar: 'ضيعة', fr: 'Ferme', es: 'Finca' },
  'type.apartment.pl': { ar: 'شقق', fr: 'Appartements', es: 'Pisos' },
  'type.house.pl': { ar: 'منازل', fr: 'Maisons', es: 'Casas' },
  'type.villa.pl': { ar: 'فيلات', fr: 'Villas', es: 'Villas' },
  'type.riad.pl': { ar: 'رياضات', fr: 'Riads', es: 'Riads' },
  'type.studio.pl': { ar: 'استوديوهات', fr: 'Studios', es: 'Estudios' },
  'type.duplex.pl': { ar: 'دوبلكس', fr: 'Duplex', es: 'Dúplex' },
  'type.land.pl': { ar: 'أراضٍ', fr: 'Terrains', es: 'Terrenos' },
  'type.commercial.pl': { ar: 'محلات تجارية', fr: 'Locaux commerciaux', es: 'Locales comerciales' },
  'type.office.pl': { ar: 'مكاتب', fr: 'Bureaux', es: 'Oficinas' },
  'type.garage.pl': { ar: 'كراجات', fr: 'Garages', es: 'Garajes' },
  'type.building.pl': { ar: 'عمارات', fr: 'Immeubles', es: 'Edificios' },
  'type.farm.pl': { ar: 'ضيعات', fr: 'Fermes', es: 'Fincas' },

  // ---- SEO
  'seo.home': { ar: 'سويت هاوس للعقار — بيع، شراء وكراء العقارات بتطوان', fr: 'Sweet House Immobilier — Vente, achat et location à Tétouan', es: 'Sweet House Inmobiliaria — Venta, compra y alquiler en Tetuán' },
  'seo.list': { ar: 'العقارات — سويت هاوس للعقار تطوان', fr: 'Nos biens — Sweet House Immobilier Tétouan', es: 'Inmuebles — Sweet House Inmobiliaria Tetuán' },
}

const PLURALS: Record<string, { ar: string[]; fr: string[]; es: string[] }> = {
  'list.results': { ar: ['لا توجد عقارات', 'عقار واحد', 'عقاران', '{n} عقارات', '{n} عقاراً', '{n} عقار'], fr: ['Aucun bien', '{n} bien', '{n} biens'], es: ['Ningún inmueble', '{n} inmueble', '{n} inmuebles'] },
  'hoods.count': { ar: ['قريباً', 'عقار واحد', 'عقاران', '{n} عقارات', '{n} عقاراً', '{n} عقار'], fr: ['Bientôt', '{n} bien', '{n} biens'], es: ['Próximamente', '{n} inmueble', '{n} inmuebles'] },
  'p.photos': { ar: ['الصور', 'صورة واحدة', 'صورتان', '{n} صور', '{n} صورة', '{n} صورة'], fr: ['Photos', '{n} photo', '{n} photos'], es: ['Fotos', '{n} foto', '{n} fotos'] },
  'p.views': { ar: ['0 مشاهدة', 'مشاهدة واحدة', 'مشاهدتان', '{n} مشاهدات', '{n} مشاهدة', '{n} مشاهدة'], fr: ['0 vue', '{n} vue', '{n} vues'], es: ['0 visitas', '{n} visita', '{n} visitas'] },
}

function pluralForm(key: string, lang: Lang, n: number): string | null {
  const f = PLURALS[key]?.[lang]
  if (!f) return null
  if (lang !== 'ar') return n === 0 ? f[0] : f[n === 1 ? 1 : 2]
  const m = n % 100
  if (n === 0) return f[0]
  if (n === 1) return f[1]
  if (n === 2) return f[2]
  if (m >= 3 && m <= 10) return f[3]
  if (m >= 11) return f[4]
  return f[5]
}

export function translate(key: string, lang: Lang, vars?: Record<string, string | number | null | undefined>): string {
  const e = D[key]
  if (!e) return key
  const raw = vars?.n
  const n = typeof raw === 'number' ? raw : typeof raw === 'string' ? Number(raw.replace(/[\s\u202f\u00a0]/g, '')) : NaN
  const s = (Number.isFinite(n) ? pluralForm(key, lang, n) : null) ?? (e[lang] || e.ar)
  return vars ? interpolate(s, vars) : s
}

interface Ctx {
  lang: Lang
  dir: 'rtl' | 'ltr'
  setLang: (l: Lang) => void
  t: (key: string, vars?: Record<string, string | number | null | undefined>) => string
}

const I18nContext = createContext<Ctx | null>(null)

function readLang(): Lang {
  try {
    const v = localStorage.getItem('shi-lang')
    if (v === 'fr' || v === 'es' || v === 'ar') return v
  } catch {
    /* ignore */
  }
  return 'ar'
}

export function I18nProvider({ children, fixed }: { children: ReactNode; fixed?: Lang }) {
  const [lang, setLangState] = useState<Lang>(fixed ?? readLang)
  const dir: 'rtl' | 'ltr' = lang === 'ar' ? 'rtl' : 'ltr'

  useEffect(() => {
    document.documentElement.lang = lang
    document.documentElement.dir = dir
  }, [lang, dir])

  const setLang = useCallback((l: Lang) => {
    setLangState(l)
    try {
      localStorage.setItem('shi-lang', l)
    } catch {
      /* ignore */
    }
  }, [])

  const t = useCallback((key: string, vars?: Record<string, string | number | null | undefined>) => translate(key, lang, vars), [lang])

  const value = useMemo(() => ({ lang, dir, setLang, t }), [lang, dir, setLang, t])
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>
}

export function useI18n(): Ctx {
  const c = useContext(I18nContext)
  if (!c) throw new Error('useI18n outside provider')
  return c
}
