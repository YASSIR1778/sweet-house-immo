export type Lang = 'ar' | 'fr' | 'es'
export type L10n = { ar: string; fr: string; es: string }

export type Purpose = 'sale' | 'rent'
export type PropertyType =
  | 'apartment'
  | 'house'
  | 'villa'
  | 'riad'
  | 'studio'
  | 'duplex'
  | 'land'
  | 'commercial'
  | 'office'
  | 'garage'
  | 'building'
  | 'farm'
export type PropertyStatus = 'available' | 'reserved' | 'sold' | 'rented' | 'draft'

export interface Property {
  id: string
  ref: string
  title: string
  title_fr: string | null
  title_es: string | null
  description: string
  description_fr: string | null
  description_es: string | null
  type: PropertyType
  purpose: Purpose
  price: number
  area: number | null
  land_area: number | null
  rooms: number | null
  bedrooms: number | null
  bathrooms: number | null
  floor: number | null
  floors: number | null
  year_built: number | null
  furnished: boolean
  features: string[]
  neighborhood: string
  city: string
  address: string | null
  lat: number | null
  lng: number | null
  images: string[]
  video_url: string | null
  status: PropertyStatus
  featured: boolean
  published: boolean
  views: number
  owner_client_id: string | null
  private_notes: string | null
  /** partner broker who brought this property (never public) */
  broker_id?: string | null
  /** also rented by the night (summer…), with its own rates */
  seasonal?: boolean
  season?: Partial<SeasonRates>
  created_by: string | null
  created_at: string
  updated_at: string
}

export type ClientKind = 'buyer' | 'tenant' | 'owner' | 'investor'
export interface Client {
  id: string
  full_name: string
  phone: string
  whatsapp: string | null
  email: string | null
  kind: ClientKind
  source: LeadSource
  budget_min: number | null
  budget_max: number | null
  wants_purpose: Purpose | null
  wants_types: PropertyType[]
  wants_neighborhoods: string[]
  wants_rooms_min: number | null
  /** language used for WhatsApp messages */
  lang: Lang
  notes: string | null
  /** partner broker who brought this client */
  broker_id?: string | null
  /** secret of the owner's private follow-up link (null = no link) */
  share_token?: string | null
  /** when the owner last received a report */
  last_report_at?: string | null
  created_by: string | null
  created_at: string
  updated_at: string
}

export type LeadKind = 'inquiry' | 'visit' | 'sell' | 'valuation' | 'callback' | 'contact' | 'booking'
export type LeadSource = 'website' | 'phone' | 'walkin' | 'whatsapp' | 'facebook' | 'instagram' | 'referral' | 'other'
export type LeadStatus = 'new' | 'contacted' | 'visit' | 'negotiation' | 'won' | 'lost'
export interface Lead {
  id: string
  name: string
  phone: string
  email: string | null
  message: string | null
  notes: string | null
  kind: LeadKind
  property_id: string | null
  property_ref: string | null
  source: LeadSource
  status: LeadStatus
  assigned_to: string | null
  client_id: string | null
  preferred_at: string | null
  lang: Lang
  meta: Record<string, unknown> | null
  created_at: string
  updated_at: string
}

export type AppointmentKind = 'visit' | 'meeting' | 'call' | 'signing'
export type AppointmentStatus = 'scheduled' | 'done' | 'cancelled' | 'noshow'
export interface Appointment {
  id: string
  title: string
  kind: AppointmentKind
  starts_at: string
  ends_at: string
  property_id: string | null
  client_id: string | null
  lead_id: string | null
  assigned_to: string | null
  status: AppointmentStatus
  notes: string | null
  created_by: string | null
  created_at: string
  /** what the visitor thought, recorded after a visit */
  feedback_interest?: Interest | null
  feedback_price?: PriceOpinion | null
  feedback_note?: string | null
}

export type Interest = 'hot' | 'warm' | 'cold'
export type PriceOpinion = 'low' | 'fair' | 'high'

export type OfferStatus = 'pending' | 'countered' | 'accepted' | 'rejected' | 'withdrawn'
export type Financing = 'cash' | 'loan' | 'mixed'
/** An offer made by a buyer (or tenant) on a property. */
export interface Offer {
  id: string
  property_id: string
  client_id: string | null
  amount: number
  financing: Financing
  conditions: string | null
  status: OfferStatus
  counter_amount: number | null
  valid_until: string | null
  notes: string | null
  created_by: string | null
  created_at: string
  updated_at: string
}

export interface VisitFeedback {
  hot: number
  warm: number
  cold: number
  price_high: number
  price_fair: number
  price_low: number
}

export type TaskPriority = 'low' | 'normal' | 'high'
export interface Task {
  id: string
  title: string
  details: string | null
  due_at: string | null
  priority: TaskPriority
  status: 'open' | 'done'
  assigned_to: string | null
  related_type: 'property' | 'client' | 'lead' | null
  related_id: string | null
  created_by: string | null
  created_at: string
  completed_at: string | null
}

export interface Deal {
  id: string
  property_id: string | null
  client_id: string | null
  kind: Purpose
  amount: number
  /** total commission = commission_seller + commission_buyer */
  commission: number
  /** paid by the owner (seller / landlord) */
  commission_seller?: number
  /** paid by the client (buyer / tenant) */
  commission_buyer?: number
  /** brokers, referrers and staff bonuses taken from the commission; the rest is the agency's */
  shares?: DealShare[]
  /** commission actually collected from the parties so far */
  received?: number
  /** where the deal stands; deals recorded before stages existed are «done» */
  stage?: DealStage
  /** documents and steps until the signature */
  checklist?: ChecklistItem[]
  /** earnest money paid by the buyer / tenant (العربون) */
  deposit?: number | null
  /** notary or adoul in charge of the deed */
  notary?: string | null
  notes: string | null
  /** date of the deal (expected date while it is in progress) */
  closed_at: string
  created_by: string | null
  created_at: string
}

export type ShareParty = 'broker' | 'referrer' | 'staff'
export type ShareSide = 'listing' | 'client' | 'other'
export interface DealShare {
  id: string
  party: ShareParty
  /** broker id or staff id */
  ref_id: string | null
  /** name kept with the deal (stays readable if the broker is removed) */
  name: string
  side: ShareSide
  /** percent: value = % of the total commission ; fixed: value = dirhams */
  mode: 'percent' | 'fixed'
  value: number
  /** paid to this partner so far (dirhams) */
  paid: number
  paid_at: string | null
}

/* ---------------------------------------------------------------- deal file & money */
export type DealStage = 'agreement' | 'paperwork' | 'signing' | 'done' | 'cancelled'
export interface ChecklistItem {
  id: string
  label: string
  done: boolean
  at: string | null
}

export type InvoiceKind = 'invoice' | 'credit'
export type InvoiceStatus = 'issued' | 'paid' | 'cancelled'
/** seller = owner / landlord ; buyer = buyer / tenant */
export type BillParty = 'seller' | 'buyer' | 'other'
export interface InvoiceLine {
  label: string
  qty: number
  /** unit price before VAT */
  unit: number
}
/** A numbered invoice (or credit note). Never rewritten once issued: it is cancelled by a credit note. */
export interface Invoice {
  id: string
  /** given by the database: F-2026-0001, AV-2026-0001 ('' before the first save) */
  no: string
  kind: InvoiceKind
  deal_id: string | null
  client_id: string | null
  party: BillParty
  bill_name: string
  /** customer's ICE (companies) */
  bill_ice: string | null
  bill_address: string | null
  lines: InvoiceLine[]
  vat_rate: number
  total_ht: number
  total_vat: number
  total_ttc: number
  /** yyyy-mm-dd */
  issued_at: string
  due_at: string | null
  status: InvoiceStatus
  /** received so far (receipts) */
  paid: number
  ref_invoice_id: string | null
  notes: string | null
  created_by: string | null
  created_at: string
  updated_at: string
}

export type PayMethod = 'cash' | 'transfer' | 'cheque' | 'card' | 'other'
/** A numbered receipt for money received (R-2026-0001). */
export interface Payment {
  id: string
  no: string
  deal_id: string | null
  invoice_id: string | null
  /** a seasonal stay this money is for */
  booking_id?: string | null
  client_id: string | null
  party: BillParty
  payer_name: string
  amount: number
  method: PayMethod
  /** cheque number, transfer reference… */
  reference: string | null
  /** yyyy-mm-dd */
  received_at: string
  status: 'valid' | 'cancelled'
  notes: string | null
  created_by: string | null
  created_at: string
}

export type ExpenseCategory = 'rent' | 'salaries' | 'ads' | 'photo' | 'transport' | 'phone' | 'utilities' | 'taxes' | 'fees' | 'office' | 'other'
export interface Expense {
  id: string
  /** yyyy-mm-dd */
  spent_at: string
  category: ExpenseCategory
  label: string
  amount: number
  method: PayMethod | null
  vendor: string | null
  property_id: string | null
  deal_id: string | null
  notes: string | null
  created_by: string | null
  created_at: string
  updated_at: string
}

/** Legal identity printed on invoices and receipts (team only). */
export interface BillingSettings {
  /** raison sociale */
  company: string
  /** SARL, SARL AU, entreprise individuelle… */
  legal_form: string
  capital: string
  address: string
  city: string
  /** registre de commerce */
  rc: string
  /** identifiant fiscal (IF) */
  fiscal_id: string
  /** identifiant commun de l'entreprise (15 digits) */
  ice: string
  /** taxe professionnelle (ex-patente) */
  tp: string
  cnss: string
  /** 0 = the agency does not charge VAT */
  vat_rate: number
  bank: string
  rib: string
  /** payment term in days (0 = on receipt) */
  payment_days: number
  /** extra line at the bottom of invoices */
  footer: string
}

/* ---------------------------------------------------------------- seasonal rentals */
/** Rates of a property rented by the night. */
export interface SeasonRates {
  /** price of a night out of the high season */
  night: number
  /** price of a night in the high season (empty: same price all year) */
  high_night: number | null
  /** high season, mm-dd to mm-dd (may wrap the new year) */
  high_from: string
  high_to: string
  /** % off for 7 nights or more */
  week_discount: number
  min_nights: number
  /** minimum stay when the high season is involved */
  high_min_nights: number | null
  /** most guests allowed */
  guests: number
  cleaning: number
  /** % of the total paid to confirm */
  deposit_pct: number
  /** security deposit, given back after the stay */
  caution: number
  check_in: string
  check_out: string
  /** agency's % of the nights */
  commission: number
  /** authorisation number (law 80-14) */
  license: string
}
export type BookingStatus = 'request' | 'confirmed' | 'checked_in' | 'completed' | 'cancelled' | 'blocked'
export type BookingSource = 'website' | 'phone' | 'whatsapp' | 'walkin' | 'airbnb' | 'booking' | 'owner' | 'other'
export type GuestIdType = 'cin' | 'passport' | 'residence' | 'other'
export type CautionStatus = 'none' | 'held' | 'returned' | 'kept'
/** A stay: dates are yyyy-mm-dd, check_out is the day of departure (not a night). */
export interface Booking {
  id: string
  property_id: string
  client_id: string | null
  lead_id: string | null
  status: BookingStatus
  source: BookingSource
  check_in: string
  check_out: string
  guests: number
  guest_name: string
  guest_phone: string | null
  guest_lang: Lang
  /** for the guest's form and the online declaration of stays (law 80-14, art. 36-38) */
  guest_id_type: GuestIdType | null
  guest_id_no: string | null
  guest_nationality: string | null
  guest_birth: string | null
  guest_address: string | null
  declared_at: string | null
  /** the nights, after discount */
  rent: number
  cleaning: number
  /** earnest money asked to confirm */
  deposit: number
  caution: number
  caution_status: CautionStatus
  /** received so far (receipts) */
  paid: number
  commission_rate: number
  owner_paid_at: string | null
  notes: string | null
  created_by: string | null
  created_at: string
  updated_at: string
}

/* ---------------------------------------------------------------- rentals */
/** housing: revision up to 8 % every 3 years ; professional: up to 10 % (law 67-12, art. 33-34) */
export type LeaseUsage = 'housing' | 'professional'
export interface LeaseRevision {
  /** first month at the new rent, yyyy-mm */
  from: string
  rent: number
  charges: number
  note: string | null
}
export interface InventoryItem {
  area: string
  note: string
}
/** State of the premises (art. 7-8: detailed, not «good condition»). */
export interface InventoryState {
  date: string | null
  items: InventoryItem[]
  water: string | null
  electricity: string | null
  keys: string | null
  notes: string | null
}
export type LeaseStatus = 'active' | 'ended' | 'cancelled'
export interface Lease {
  id: string
  property_id: string | null
  owner_client_id: string | null
  tenant_client_id: string | null
  usage: LeaseUsage
  /** yyyy-mm-dd */
  start_date: string
  /** empty: renewed by tacit agreement */
  end_date: string | null
  /** rent and charges at the start (later ones are in revisions) */
  rent: number
  charges: number
  charges_note: string | null
  /** day of the month the rent is due (1-28) */
  pay_day: number
  payment_method: PayMethod
  deposit: number
  deposit_holder: 'owner' | 'agency'
  deposit_returned_at: string | null
  /** the agency collects the rent for the owner */
  managed: boolean
  /** % of the rent kept by the agency */
  management_rate: number
  revisions: LeaseRevision[]
  equipment: string | null
  obligations: string | null
  inventory: { in?: InventoryState; out?: InventoryState }
  status: LeaseStatus
  ended_at: string | null
  notes: string | null
  created_by: string | null
  created_at: string
  updated_at: string
}
/** A rent received, with its receipt (Q-2026-0001): rent and charges shown apart (art. 11). */
export interface RentPayment {
  id: string
  no: string
  lease_id: string
  /** yyyy-mm */
  period: string
  rent: number
  charges: number
  method: PayMethod
  reference: string | null
  /** yyyy-mm-dd */
  paid_at: string
  status: 'valid' | 'cancelled'
  /** managed lease: when the owner received his share */
  remitted_at: string | null
  notes: string | null
  created_by: string | null
  created_at: string
}

/* ---------------------------------------------------------------- owners */
export type MandateKind = 'exclusive' | 'simple'
export type KeysHolder = 'agency' | 'owner' | 'concierge' | 'none'
export type MandateStatus = 'active' | 'ended' | 'cancelled'
/** Authorisation given by an owner to sell or rent a property. */
export interface Mandate {
  id: string
  property_id: string
  owner_client_id: string | null
  kind: MandateKind
  purpose: Purpose
  start_date: string
  end_date: string | null
  price: number | null
  net_price: number | null
  min_price: number | null
  /** sale: % of the price ; rent: months of rent */
  commission_rate: number | null
  /** or a fixed amount in dirhams */
  commission_amount: number | null
  keys: KeysHolder
  keys_notes: string | null
  visit_terms: string | null
  signed: boolean
  status: MandateStatus
  notes: string | null
  created_by: string | null
  created_at: string
  updated_at: string
}

export type DocKind = 'title' | 'plan' | 'id' | 'mandate' | 'contract' | 'permit' | 'tax' | 'other'
/** A private file (title deed, plans, ID copy, signed mandate…) of an owner or a property. */
export interface PropertyDocument {
  id: string
  client_id: string | null
  property_id: string | null
  kind: DocKind
  title: string
  /** path in the private storage bucket (demo: a data URL) */
  path: string
  file_name: string
  mime: string | null
  size: number | null
  expires_at: string | null
  uploaded_by: string | null
  created_at: string
}

export interface PriceChange {
  id: string
  property_id: string
  old_price: number | null
  new_price: number
  changed_by: string | null
  created_at: string
}

/** What an owner sees through his private link. */
export interface OwnerReport {
  name: string
  lang: Lang
  generated_at: string
  properties: {
    ref: string
    title: string
    purpose: Purpose
    type: PropertyType
    status: PropertyStatus
    published: boolean
    price: number
    image: string | null
    views: number
    created_at: string
    leads: number
    visits_done: number
    visits_planned: number
    last_visit: string | null
    prices: { price: number; at: string }[]
    mandate: { kind: MandateKind; start_date: string; end_date: string | null } | null
    /** offers received (not withdrawn) */
    offers?: number
    feedback?: VisitFeedback | null
  }[]
}

/* ---------------------------------------------------------------- network */
export type BrokerKind = 'broker' | 'agency' | 'referrer' | 'developer'
/** side: the customary share of the side he brought (split equally with other brokers on that side) */
export type AgreementMode = 'side' | 'percent' | 'fixed'
export interface Broker {
  id: string
  full_name: string
  phone: string
  whatsapp: string | null
  email: string | null
  kind: BrokerKind
  company: string | null
  zones: string[]
  specialties: string[]
  agreement_mode: AgreementMode
  agreement_value: number
  rating: number | null
  active: boolean
  notes: string | null
  created_by: string | null
  created_at: string
  updated_at: string
}

export interface CallLog {
  id: string
  caller_name: string
  phone: string
  direction: 'in' | 'out'
  subject: string
  outcome: string | null
  client_id: string | null
  lead_id: string | null
  logged_by: string | null
  created_at: string
}

export type Role = 'admin' | 'secretary'
/** Extra rights of a member (the admin role has them all). Same list as the database check. */
export type Permission = 'properties' | 'delete' | 'deals' | 'reports' | 'export' | 'settings' | 'activity'
export interface Staff {
  id: string
  full_name: string
  email: string
  role: Role
  phone: string | null
  active: boolean
  created_at: string
  /** job title shown in the team, e.g. «كاتبة» */
  title?: string | null
  permissions?: Permission[] | null
}

export interface Activity {
  id: string
  actor: string | null
  actor_name: string | null
  action: string
  entity: string
  entity_id: string | null
  meta: Record<string, unknown> | null
  created_at: string
}

export interface Neighborhood {
  id: string
  name: L10n
  lat: number
  lng: number
  image?: string
  /** the agency's reference price per m² for a sale (used when listings are few) */
  ref_sale_m2?: number | null
  /** reference monthly rent per m² */
  ref_rent_m2?: number | null
}

export interface Testimonial {
  name: string
  role: L10n
  text: L10n
}

export interface AgencySettings {
  name: L10n
  slogan: L10n
  phone: string
  whatsapp: string
  email: string
  address: L10n
  hours: L10n
  about: L10n
  facebook: string
  instagram: string
  tiktok: string
  /** link where clients leave a review (Google Business profile…) */
  review_url?: string
  lat: number
  lng: number
}

export interface SiteSettings {
  hero_eyebrow: L10n
  hero_title: L10n
  hero_subtitle: L10n
  hero_image: string
  stats: { properties: number; clients: number; years: number; deals: number }
  testimonials: Testimonial[]
  whatsapp_template: L10n
  /** commitment printed on the visit voucher (bon de visite) */
  visit_clause: L10n
  /** main text of the mandate printed for the owner */
  mandate_clause?: L10n
  /** extra paragraph of an exclusive mandate */
  mandate_exclusive?: L10n
  /** dirhams for one euro, to show indicative prices in € (Moroccans abroad, foreign buyers) */
  eur_rate?: number
}

export interface CatalogSettings {
  neighborhoods: Neighborhood[]
  ref_prefix: string
}

export interface Settings {
  agency: AgencySettings
  site: SiteSettings
  catalog: CatalogSettings
  /** Moroccan purchase / sale costs used by the calculators (public, editable) */
  fees: FeeSettings
  /** the agency's own fees, as shown to clients (public, editable) */
  commission: CommissionSettings
}

/** slice of an amount taxed at `rate` % up to `upTo` dirhams (null = no limit) */
export interface FeeBracket {
  upTo: number | null
  rate: number
}

/** All rates in %, amounts in dirhams. Defaults: Moroccan law as reviewed in October 2026. */
export interface FeeSettings {
  reviewed_at: string
  registration: {
    /** built property: housing, commercial, professional (CGI art. 133) */
    built: number
    /** bare land or land with buildings to demolish */
    land: number
    /** first sale of social / low-value housing by a developer under State agreement */
    social: number
    /** extra duty on the part paid in cash (LF 2026) */
    cash_extra: number
    cash_threshold: number
    cash_from: string
  }
  /** land registry: sale registration (decree 2.16.375) */
  conservation: { rate: number; fixed: number; min: number; certificate: number }
  /** notary: fees are agreed with the notary; these are estimates */
  notary: { rate: number; min: number; vat: number; disbursements: number }
  /** bank loan with a mortgage */
  loan: { brackets: FeeBracket[]; fixed: number; registration: number; bank_rate: number; notary_rate: number }
  /** releasing a mortgage when selling (mainlevée) */
  release: { conservation: number; registration: number }
  /** tax on real estate profits (IR / profits fonciers) */
  tpi: {
    rate: number
    min_rate: number
    residence_years: number
    residence_cap: number
    social_years: number
    social_cap: number
    small_cap: number
    flat_costs: number
    /** year of the revaluation table below */
    coef_year: number
    /** acquisition year → coefficient */
    coefficients: Record<string, number>
  }
  /** direct housing aid (Daam Sakane) shown as information */
  aid: { enabled: boolean; until: number; tiers: { upTo: number; amount: number }[] }
}

export interface CommissionSettings {
  /** sale: % of the price paid by the buyer */
  sale_buyer: number
  /** sale: % of the price paid by the seller */
  sale_seller: number
  /** long-term rent: months of rent paid by the tenant */
  rent_tenant: number
  /** long-term rent: months of rent paid by the owner */
  rent_owner: number
  /** VAT added to the commission (0 = none) */
  vat: number
  /** minimum per side in dirhams (0 = none) */
  min_amount: number
}

/** Internal rules for sharing a commission with partners (never public). */
export interface NetworkSettings {
  /** % of the total commission for the side that brought the property */
  listing_share: number
  /** % of the total commission for the side that brought the client */
  client_share: number
  /** % of the total commission for a referrer who only passed the contact */
  referrer_share: number
  /** % of the total commission as a bonus for the employee who closed (0 = none) */
  staff_bonus: number
}

export interface PropertyFilter {
  purpose?: Purpose | ''
  type?: PropertyType | ''
  neighborhood?: string
  min_price?: number
  max_price?: number
  rooms?: number
  min_area?: number
  q?: string
  featured?: boolean
  sort?: 'newest' | 'price_asc' | 'price_desc' | 'area_desc'
}

export interface SessionUser {
  id: string
  email: string
  name: string
  role: Role
  active: boolean
  title?: string | null
  permissions: Permission[]
}
