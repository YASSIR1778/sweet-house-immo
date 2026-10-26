import type { AgreementMode, AppointmentKind, AppointmentStatus, BillParty, BrokerKind, ClientKind, DealStage, DocKind, ExpenseCategory, Financing, Interest, InvoiceStatus, KeysHolder, LeadKind, LeadSource, LeadStatus, MandateKind, OfferStatus, PayMethod, PriceOpinion, PropertyStatus, Purpose, Role, ShareParty, ShareSide, TaskPriority} from '@/shared/lib/types'

export interface Lbl {
  label: string
  color: string
}

export const LEAD_STATUS: Record<LeadStatus, Lbl> = {
  new: { label: 'جديد', color: '#1d4ed8' },
  contacted: { label: 'تم الاتصال', color: '#7c3aed' },
  visit: { label: 'زيارة', color: '#0f766e' },
  negotiation: { label: 'تفاوض', color: '#b45309' },
  won: { label: 'صفقة ناجحة', color: '#15803d' },
  lost: { label: 'لم تنجح', color: '#b91c1c' },
}
export const LEAD_STATUS_ORDER: LeadStatus[] = ['new', 'contacted', 'visit', 'negotiation', 'won', 'lost']

export const LEAD_KIND: Record<LeadKind, Lbl> = {
  inquiry: { label: 'استفسار عن عقار', color: '#1d4ed8' },
  visit: { label: 'طلب زيارة', color: '#0f766e' },
  sell: { label: 'يعرض عقاره', color: '#a8832f' },
  valuation: { label: 'طلب تقييم', color: '#7c3aed' },
  callback: { label: 'معاودة الاتصال', color: '#475569' },
  contact: { label: 'رسالة تواصل', color: '#475569' },
}

export const SOURCE: Record<LeadSource, Lbl> = {
  website: { label: 'الموقع', color: '#0b1b33' },
  phone: { label: 'الهاتف', color: '#475569' },
  walkin: { label: 'زيارة للوكالة', color: '#a8832f' },
  whatsapp: { label: 'واتساب', color: '#16a34a' },
  facebook: { label: 'فيسبوك', color: '#1877f2' },
  instagram: { label: 'إنستغرام', color: '#c13584' },
  referral: { label: 'توصية', color: '#0f766e' },
  other: { label: 'أخرى', color: '#94a3b8' },
}

export const CLIENT_KIND: Record<ClientKind, Lbl> = {
  buyer: { label: 'مشترٍ', color: '#a8832f' },
  tenant: { label: 'مكترٍ', color: '#0f766e' },
  owner: { label: 'مالك', color: '#0b1b33' },
  investor: { label: 'مستثمر', color: '#7c3aed' },
}

export const PROPERTY_STATUS: Record<PropertyStatus, Lbl> = {
  available: { label: 'متاح', color: '#15803d' },
  reserved: { label: 'محجوز', color: '#b45309' },
  sold: { label: 'مُباع', color: '#b91c1c' },
  rented: { label: 'مُكترى', color: '#7c3aed' },
  draft: { label: 'مسودة', color: '#64748b' },
}

export const PURPOSE: Record<Purpose, Lbl> = {
  sale: { label: 'للبيع', color: '#a8832f' },
  rent: { label: 'للكراء', color: '#0f766e' },
}

export const APPT_KIND: Record<AppointmentKind, Lbl> = {
  visit: { label: 'زيارة عقار', color: '#0f766e' },
  meeting: { label: 'اجتماع', color: '#1d4ed8' },
  call: { label: 'مكالمة / فيديو', color: '#7c3aed' },
  signing: { label: 'توقيع', color: '#a8832f' },
}

export const APPT_STATUS: Record<AppointmentStatus, Lbl> = {
  scheduled: { label: 'مبرمج', color: '#1d4ed8' },
  done: { label: 'تم', color: '#15803d' },
  cancelled: { label: 'ملغى', color: '#64748b' },
  noshow: { label: 'لم يحضر', color: '#b91c1c' },
}

export const PRIORITY: Record<TaskPriority, Lbl> = {
  low: { label: 'منخفضة', color: '#64748b' },
  normal: { label: 'عادية', color: '#1d4ed8' },
  high: { label: 'مستعجلة', color: '#b91c1c' },
}

export const OFFER_STATUS: Record<OfferStatus, Lbl> = {
  pending: { label: 'قيد الدراسة', color: '#1d4ed8' },
  countered: { label: 'عرض مضاد', color: '#b45309' },
  accepted: { label: 'مقبول', color: '#15803d' },
  rejected: { label: 'مرفوض', color: '#b91c1c' },
  withdrawn: { label: 'مسحوب', color: '#64748b' },
}

export const FINANCING: Record<Financing, string> = {
  cash: 'نقداً',
  loan: 'بقرض بنكي',
  mixed: 'نقداً وقرض',
}

export const INTEREST: Record<Interest, Lbl> = {
  hot: { label: 'مهتم جداً', color: '#15803d' },
  warm: { label: 'متردد', color: '#b45309' },
  cold: { label: 'غير مهتم', color: '#64748b' },
}

export const PRICE_OPINION: Record<PriceOpinion, Lbl> = {
  low: { label: 'يراه فرصة', color: '#15803d' },
  fair: { label: 'الثمن مناسب', color: '#0f766e' },
  high: { label: 'يراه مرتفعاً', color: '#b91c1c' },
}

export const MANDATE_KIND: Record<MandateKind, Lbl> = {
  exclusive: { label: 'تفويض حصري', color: '#a8832f' },
  simple: { label: 'تفويض عادي', color: '#0f766e' },
}

export const KEYS: Record<KeysHolder, string> = {
  agency: 'المفتاح عند الوكالة',
  owner: 'المفتاح عند المالك',
  concierge: 'المفتاح عند الحارس',
  none: 'لا يوجد مفتاح',
}

export const DOC_KIND: Record<DocKind, string> = {
  title: 'شهادة الملكية',
  plan: 'التصميم أو الرسم العقاري',
  id: 'نسخة البطاقة الوطنية',
  mandate: 'التفويض الموقّع',
  contract: 'عقد',
  permit: 'رخصة البناء أو السكن',
  tax: 'وثائق ضريبية',
  other: 'وثيقة أخرى',
}

/** 0 → اليوم, 1 → يوم واحد, 2 → يومان, 3-10 → أيام, 11+ → يوماً */
export function daysAr(n: number): string {
  const a = Math.abs(n)
  if (a === 0) return 'اليوم'
  if (a === 1) return 'يوم واحد'
  if (a === 2) return 'يومان'
  if (a <= 10) return `${a} أيام`
  return `${a} يوماً`
}

export const BROKER_KIND: Record<BrokerKind, Lbl> = {
  broker: { label: 'وسيط عقاري', color: '#0f766e' },
  agency: { label: 'وكالة شريكة', color: '#1d4ed8' },
  referrer: { label: 'مُرشد', color: '#a8832f' },
  developer: { label: 'منعش عقاري', color: '#7c3aed' },
}

export const AGREEMENT: Record<AgreementMode, string> = {
  side: 'حصة الجانب حسب العرف',
  percent: 'نسبة من العمولة',
  fixed: 'مبلغ ثابت لكل صفقة',
}

export const SIDE: Record<ShareSide, string> = {
  listing: 'جانب العقار',
  client: 'جانب الزبون',
  other: 'أخرى',
}

export const SHARE_PARTY: Record<ShareParty, Lbl> = {
  broker: { label: 'وسيط', color: '#0f766e' },
  referrer: { label: 'مُرشد', color: '#a8832f' },
  staff: { label: 'مكافأة موظف', color: '#1d4ed8' },
}

export const SPECIALTIES: { value: string; label: string }[] = [
  { value: 'sale', label: 'البيع' },
  { value: 'rent', label: 'الكراء' },
  { value: 'seasonal', label: 'الكراء الموسمي' },
  { value: 'land', label: 'الأراضي' },
  { value: 'villa', label: 'الفيلات' },
  { value: 'commercial', label: 'المحلات والمكاتب' },
  { value: 'new', label: 'المشاريع الجديدة' },
]

export const ROLE: Record<Role, string> = {
  admin: 'المدير',
  secretary: 'موظف',
}

export const ENTITY: Record<string, string> = {
  property: 'عقار',
  lead: 'طلب',
  client: 'عميل',
  appointment: 'موعد',
  task: 'مهمة',
  call: 'مكالمة',
  deal: 'صفقة',
  settings: 'الإعدادات',
  staff: 'عضو الفريق',
  broker: 'شريك',
  mandate: 'تفويض',
  document: 'وثيقة',
  owner_report: 'تقرير المالك',
  offer: 'عرض',
  invoice: 'فاتورة',
  payment: 'وصل',
  expense: 'مصروف',
  billing: 'معلومات الفوترة',
  session: 'الجلسة',
}

/* ---------------------------------------------------------------- deal file & money */
export const DEAL_STAGE: Record<DealStage, { label: string; rent?: string; color: string }> = {
  agreement: { label: 'الاتفاق والعربون', rent: 'الاتفاق', color: '#7c3aed' },
  paperwork: { label: 'الوثائق والتمويل', rent: 'الوثائق والضمانات', color: '#1d4ed8' },
  signing: { label: 'التوقيع عند الموثق', rent: 'توقيع العقد والمفاتيح', color: '#b45309' },
  done: { label: 'تمت الصفقة', color: '#15803d' },
  cancelled: { label: 'أُلغيت', color: '#64748b' },
}
export const stageLabel = (s: DealStage, kind: Purpose) => (kind === 'rent' && DEAL_STAGE[s].rent) || DEAL_STAGE[s].label

export const INVOICE_STATUS: Record<InvoiceStatus, Lbl> = {
  issued: { label: 'غير مؤداة', color: '#b45309' },
  paid: { label: 'مؤداة', color: '#15803d' },
  cancelled: { label: 'ملغاة', color: '#64748b' },
}

export const PAY_METHOD: Record<PayMethod, string> = {
  cash: 'نقداً',
  transfer: 'تحويل بنكي',
  cheque: 'شيك',
  card: 'بطاقة بنكية',
  other: 'أخرى',
}

/** Who pays, in the words of the deal. */
export const partyLabel = (p: BillParty, kind: Purpose) => (p === 'seller' ? (kind === 'rent' ? 'المالك' : 'البائع') : p === 'buyer' ? (kind === 'rent' ? 'المكتري' : 'المشتري') : 'آخر')

export const EXPENSE_CAT: Record<ExpenseCategory, Lbl> = {
  rent: { label: 'كراء المكتب', color: '#0b1b33' },
  salaries: { label: 'الأجور والتحفيزات', color: '#7c3aed' },
  ads: { label: 'الإشهار والإعلانات', color: '#be185d' },
  photo: { label: 'التصوير والفيديو', color: '#0f766e' },
  transport: { label: 'التنقل والوقود', color: '#b45309' },
  phone: { label: 'الهاتف والإنترنت', color: '#1d4ed8' },
  utilities: { label: 'الماء والكهرباء', color: '#0891b2' },
  taxes: { label: 'الضرائب والرسوم', color: '#b91c1c' },
  fees: { label: 'المحاسب والأتعاب', color: '#a8832f' },
  office: { label: 'معدات ولوازم المكتب', color: '#475569' },
  other: { label: 'أخرى', color: '#64748b' },
}

export const ACTION: Record<string, string> = {
  create: 'أضاف',
  update: 'عدّل',
  delete: 'حذف',
  login: 'سجّل الدخول',
  status: 'غيّر حالة',
}

export const LANG_LABEL = { ar: 'العربية', fr: 'Français', es: 'Español' } as const
