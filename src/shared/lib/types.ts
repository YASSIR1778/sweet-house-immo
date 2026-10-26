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

export type LeadKind = 'inquiry' | 'visit' | 'sell' | 'valuation' | 'callback' | 'contact'
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
  notes: string | null
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
