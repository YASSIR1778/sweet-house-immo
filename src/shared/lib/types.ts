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
  commission: number
  notes: string | null
  closed_at: string
  created_by: string | null
  created_at: string
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
export interface Staff {
  id: string
  full_name: string
  email: string
  role: Role
  phone: string | null
  active: boolean
  created_at: string
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
}

export interface CatalogSettings {
  neighborhoods: Neighborhood[]
  ref_prefix: string
}

export interface Settings {
  agency: AgencySettings
  site: SiteSettings
  catalog: CatalogSettings
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
}
