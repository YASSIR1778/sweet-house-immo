import { DEFAULT_SETTINGS } from './config'
import { nowIso, uid } from './format'
import { IMAGES_BUCKET, getSupabase, isConfigured } from './supabase'
import { DEFAULT_FEES } from './fee-defaults'
import { buildOwnerReport } from './owners'
import type { Activity, Appointment, Client, FeeSettings, Lead, Mandate, OwnerReport, PriceChange, Property, SessionUser, Settings } from './types'

export type TableName = 'properties' | 'clients' | 'leads' | 'appointments' | 'tasks' | 'deals' | 'calls' | 'staff' | 'activity' | 'brokers' | 'mandates' | 'documents' | 'price_history' | 'trash' | 'offers'

export const TABLE: Record<TableName, string> = {
  properties: 're_properties',
  clients: 're_clients',
  leads: 're_leads',
  appointments: 're_appointments',
  tasks: 're_tasks',
  deals: 're_deals',
  calls: 're_calls',
  staff: 're_staff',
  activity: 're_activity',
  brokers: 're_brokers',
  mandates: 're_mandates',
  documents: 're_documents',
  price_history: 're_price_history',
  trash: 're_trash',
  offers: 're_offers',
}

/** Demo: deleted rows of these tables are kept in the local trash, like the database trigger does. */
const LOCAL_TRASH: TableName[] = ['properties', 'clients', 'leads', 'appointments', 'tasks', 'calls', 'deals', 'brokers', 'mandates', 'documents', 'offers']

export const DOCS_BUCKET = 'property-docs'

/** Internal settings (never public): read by the team, written with the «settings» permission. */
export type PrivateKey = 'network'

export interface Row {
  id: string
}

export type LeadInput = Omit<Lead, 'id' | 'created_at' | 'updated_at' | 'status' | 'assigned_to' | 'client_id' | 'notes'>

export interface Repo {
  mode: 'demo' | 'live'
  list<T extends Row>(table: TableName): Promise<T[]>
  upsert<T extends Row>(table: TableName, row: T): Promise<T>
  remove(table: TableName, id: string): Promise<void>
  /** append-only audit trail (staff may write, only the owner reads it) */
  log(row: Activity): Promise<void>
  publicProperties(): Promise<Property[]>
  publicProperty(refOrId: string): Promise<Property | null>
  incrementViews(id: string): Promise<void>
  submitLead(input: LeadInput): Promise<void>
  getSettings(): Promise<Settings>
  saveSettings<K extends keyof Settings>(key: K, value: Settings[K]): Promise<void>
  getPrivate<T>(key: PrivateKey): Promise<T | null>
  savePrivate<T>(key: PrivateKey, value: T): Promise<void>
  uploadImage(blob: Blob, name: string): Promise<string>
  deleteImage(url: string): Promise<void>
  /** private documents: returns the storage path (demo: a data URL) */
  uploadDocument(file: Blob, name: string): Promise<string>
  /** short-lived link to open a private document */
  documentUrl(path: string): Promise<string>
  deleteDocumentFile(path: string): Promise<void>
  /** the owner's private follow-up page (null when the link is unknown or revoked) */
  ownerReport(token: string): Promise<OwnerReport | null>
  resetDemo(): Promise<void>
}

const obj = (x: unknown) => (x && typeof x === 'object' && !Array.isArray(x) ? (x as Record<string, unknown>) : {})

/** Saved fees over the defaults, one level deep (a parameter added later keeps its default). */
function mergeFees(saved: unknown): FeeSettings {
  const s = obj(saved)
  const out: Record<string, unknown> = { ...DEFAULT_FEES }
  for (const [k, def] of Object.entries(DEFAULT_FEES)) {
    if (!(k in s)) continue
    out[k] = def && typeof def === 'object' && !Array.isArray(def) ? { ...def, ...obj(s[k]) } : s[k]
  }
  return out as unknown as FeeSettings
}

function mergeSettings(partial: Partial<Record<keyof Settings, unknown>>): Settings {
  return {
    agency: { ...DEFAULT_SETTINGS.agency, ...obj(partial.agency) },
    site: { ...DEFAULT_SETTINGS.site, ...obj(partial.site) },
    catalog: { ...DEFAULT_SETTINGS.catalog, ...obj(partial.catalog) },
    fees: mergeFees(partial.fees),
    commission: { ...DEFAULT_SETTINGS.commission, ...obj(partial.commission) },
  } as Settings
}

/** Fields that must never reach the public website. */
function stripPrivate(p: Property): Property {
  return { ...p, private_notes: null, owner_client_id: null }
}

/* ------------------------------------------------------------------ */
/* Demo mode: everything in localStorage, seeded with sample data        */
/* ------------------------------------------------------------------ */
/** Raise when the demo gains a table, so browsers seeded before receive its sample rows. */
const SEED_VERSION = '2'

class LocalRepo implements Repo {
  mode = 'demo' as const
  private ready: Promise<void>

  constructor() {
    this.ready = this.ensureSeed()
  }

  private key(t: string) {
    return `shi:${t}`
  }
  private read<T>(t: string): T[] {
    try {
      const raw = localStorage.getItem(this.key(t))
      return raw ? (JSON.parse(raw) as T[]) : []
    } catch {
      return []
    }
  }
  private write(t: string, rows: unknown[]) {
    try {
      localStorage.setItem(this.key(t), JSON.stringify(rows))
    } catch (e) {
      throw new Error(`quota: ${e instanceof Error ? e.message : String(e)}`)
    }
  }
  private async ensureSeed() {
    try {
      const seeded = localStorage.getItem('shi:seeded')
      if (seeded === SEED_VERSION) return
      const { seedData } = await import('./seed')
      const s = seedData()
      // a browser seeded by an older version keeps its data and only receives the new tables
      for (const [t, rows] of Object.entries(s)) if (!seeded || localStorage.getItem(this.key(t)) === null) this.write(t, rows as unknown[])
      localStorage.setItem('shi:seeded', SEED_VERSION)
    } catch {
      /* private browsing: run without persistence */
    }
  }
  async resetDemo() {
    for (const t of Object.keys(TABLE)) localStorage.removeItem(this.key(t))
    localStorage.removeItem('shi:settings')
    localStorage.removeItem('shi:private:network')
    localStorage.removeItem('shi:seeded')
    this.ready = this.ensureSeed()
    await this.ready
  }

  async list<T extends Row>(table: TableName): Promise<T[]> {
    await this.ready
    return this.read<T>(table)
  }
  async upsert<T extends Row>(table: TableName, row: T): Promise<T> {
    await this.ready
    const rows = this.read<T>(table)
    const i = rows.findIndex((r) => r.id === row.id)
    if (table === 'properties') {
      // the database keeps a price history with a trigger; the demo does it here
      const before = i >= 0 ? (rows[i] as unknown as Property).price : null
      const after = (row as unknown as Property).price
      if (i < 0 || before !== after) {
        const h: PriceChange = { id: uid(), property_id: row.id, old_price: before, new_price: after, changed_by: null, created_at: nowIso() }
        this.write('price_history', [h, ...this.read<PriceChange>('price_history')])
      }
    }
    if (i >= 0) rows[i] = { ...rows[i], ...row }
    else rows.unshift(row)
    this.write(table, rows)
    return row
  }
  async remove(table: TableName, id: string): Promise<void> {
    await this.ready
    const rows = this.read<Row>(table)
    const old = rows.find((r) => r.id === id) as (Row & Record<string, unknown>) | undefined
    if (old && LOCAL_TRASH.includes(table)) {
      const label = [old.ref, old.full_name, old.name, old.title, old.caller_name].find((v) => typeof v === 'string' && v) as string | undefined
      const item = { id: uid(), table_name: TABLE[table], row_id: id, label: label ?? '', data: old, deleted_by: null, created_at: nowIso() }
      this.write('trash', [item, ...this.read('trash')].slice(0, 300))
    }
    this.write(
      table,
      rows.filter((r) => r.id !== id),
    )
  }
  async log(row: Activity): Promise<void> {
    await this.ready
    const rows = [row, ...this.read<Activity>('activity')].slice(0, 500)
    this.write('activity', rows)
  }
  async publicProperties(): Promise<Property[]> {
    await this.ready
    return this.read<Property>('properties')
      .filter((p) => p.published && p.status !== 'draft')
      .sort((a, b) => Number(b.featured) - Number(a.featured) || b.created_at.localeCompare(a.created_at))
      .map(stripPrivate)
  }
  async publicProperty(refOrId: string): Promise<Property | null> {
    await this.ready
    const p = this.read<Property>('properties').find((x) => x.ref === refOrId || x.id === refOrId)
    return p && p.published && p.status !== 'draft' ? stripPrivate(p) : null
  }
  async incrementViews(id: string): Promise<void> {
    const rows = this.read<Property>('properties')
    const p = rows.find((x) => x.id === id)
    if (p) {
      p.views = (p.views ?? 0) + 1
      try {
        this.write('properties', rows)
      } catch {
        /* ignore */
      }
    }
  }
  async submitLead(input: LeadInput): Promise<void> {
    const lead: Lead = { ...input, id: uid(), notes: null, status: 'new', assigned_to: null, client_id: null, created_at: nowIso(), updated_at: nowIso() }
    await this.upsert('leads', lead)
  }
  async getSettings(): Promise<Settings> {
    try {
      const raw = localStorage.getItem('shi:settings')
      return mergeSettings(raw ? JSON.parse(raw) : {})
    } catch {
      return mergeSettings({})
    }
  }
  async saveSettings<K extends keyof Settings>(key: K, value: Settings[K]): Promise<void> {
    const cur = await this.getSettings()
    try {
      localStorage.setItem('shi:settings', JSON.stringify({ ...cur, [key]: value }))
    } catch (e) {
      throw new Error(`quota: ${e instanceof Error ? e.message : String(e)}`)
    }
  }
  async getPrivate<T>(key: PrivateKey): Promise<T | null> {
    try {
      const raw = localStorage.getItem(`shi:private:${key}`)
      return raw ? (JSON.parse(raw) as T) : null
    } catch {
      return null
    }
  }
  async savePrivate<T>(key: PrivateKey, value: T): Promise<void> {
    try {
      localStorage.setItem(`shi:private:${key}`, JSON.stringify(value))
    } catch (e) {
      throw new Error(`quota: ${e instanceof Error ? e.message : String(e)}`)
    }
  }
  async uploadImage(blob: Blob): Promise<string> {
    return new Promise((resolve, reject) => {
      const r = new FileReader()
      r.onload = () => resolve(String(r.result))
      r.onerror = () => reject(r.error)
      r.readAsDataURL(blob)
    })
  }
  async deleteImage(): Promise<void> {
    /* data URLs live inside the row */
  }
  async uploadDocument(file: Blob): Promise<string> {
    if (file.size > 1_500_000) throw new Error('demo_file_too_big')
    return this.uploadImage(file)
  }
  async documentUrl(path: string): Promise<string> {
    return path
  }
  async deleteDocumentFile(): Promise<void> {
    /* stored inside the row */
  }
  async ownerReport(token: string): Promise<OwnerReport | null> {
    await this.ready
    const client = this.read<Client>('clients').find((c) => c.share_token && c.share_token === token)
    if (!client) return null
    return buildOwnerReport(client, this.read<Property>('properties'), this.read<Lead>('leads'), this.read<Appointment>('appointments'), this.read<PriceChange>('price_history'), this.read<Mandate>('mandates'), new Date(), this.read<{ property_id: string; status: string }>('offers'))
  }
}

/* ------------------------------------------------------------------ */
/* Live mode: Supabase (row level security protects everything)         */
/* ------------------------------------------------------------------ */
class SupabaseRepo implements Repo {
  mode = 'live' as const
  private sb = getSupabase()

  async resetDemo() {
    /* not applicable */
  }

  async list<T extends Row>(table: TableName): Promise<T[]> {
    const { data, error } = await this.sb.from(TABLE[table]).select('*').order('created_at', { ascending: false }).limit(5000)
    if (error) throw error
    return (data ?? []) as T[]
  }
  async upsert<T extends Row>(table: TableName, row: T): Promise<T> {
    const { data, error } = await this.sb.from(TABLE[table]).upsert(row).select().single()
    if (error) throw error
    return data as T
  }
  async remove(table: TableName, id: string): Promise<void> {
    const { error } = await this.sb.from(TABLE[table]).delete().eq('id', id)
    if (error) throw error
  }
  async log(row: Activity): Promise<void> {
    await this.sb.from(TABLE.activity).insert(row)
  }
  async publicProperties(): Promise<Property[]> {
    const { data, error } = await this.sb.rpc('re_public_properties')
    if (error) throw error
    return ((data ?? []) as Property[]).map(stripPrivate)
  }
  async publicProperty(refOrId: string): Promise<Property | null> {
    const { data, error } = await this.sb.rpc('re_public_properties', { p_ref: refOrId })
    if (error) throw error
    const row = ((data ?? []) as Property[])[0]
    return row ? stripPrivate(row) : null
  }
  async incrementViews(id: string): Promise<void> {
    await this.sb.rpc('re_increment_views', { p_id: id })
  }
  async submitLead(input: LeadInput): Promise<void> {
    const { error } = await this.sb.from(TABLE.leads).insert({ ...input, status: 'new' })
    if (error) throw error
  }
  async getSettings(): Promise<Settings> {
    const { data, error } = await this.sb.from('re_settings').select('key,value')
    if (error) throw error
    const partial: Record<string, unknown> = {}
    for (const r of (data ?? []) as { key: string; value: unknown }[]) partial[r.key] = r.value
    return mergeSettings(partial)
  }
  async saveSettings<K extends keyof Settings>(key: K, value: Settings[K]): Promise<void> {
    const { error } = await this.sb.from('re_settings').upsert({ key, value, updated_at: nowIso() })
    if (error) throw error
  }
  async getPrivate<T>(key: PrivateKey): Promise<T | null> {
    const { data, error } = await this.sb.from('re_private').select('value').eq('key', key).maybeSingle()
    if (error) throw error
    return ((data as { value: T } | null)?.value ?? null) as T | null
  }
  async savePrivate<T>(key: PrivateKey, value: T): Promise<void> {
    const { error } = await this.sb.from('re_private').upsert({ key, value, updated_at: nowIso() })
    if (error) throw error
  }
  async uploadImage(blob: Blob, name: string): Promise<string> {
    const safe = name.toLowerCase().replace(/[^a-z0-9.]+/g, '-').slice(-60) || 'photo.jpg'
    const path = `${new Date().getFullYear()}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}-${safe}`
    const { error } = await this.sb.storage.from(IMAGES_BUCKET).upload(path, blob, { contentType: blob.type || 'image/jpeg', cacheControl: '31536000' })
    if (error) throw error
    return this.sb.storage.from(IMAGES_BUCKET).getPublicUrl(path).data.publicUrl
  }
  async deleteImage(url: string): Promise<void> {
    const marker = `/object/public/${IMAGES_BUCKET}/`
    const i = url.indexOf(marker)
    if (i < 0) return
    await this.sb.storage.from(IMAGES_BUCKET).remove([decodeURIComponent(url.slice(i + marker.length))])
  }
  async uploadDocument(file: Blob, name: string): Promise<string> {
    const dot = name.lastIndexOf('.')
    const ext = dot > 0 ? name.slice(dot + 1).toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 5) : 'bin'
    const path = `${new Date().getFullYear()}/${Date.now()}-${Math.random().toString(36).slice(2, 10)}.${ext || 'bin'}`
    const { error } = await this.sb.storage.from(DOCS_BUCKET).upload(path, file, { contentType: file.type || 'application/octet-stream' })
    if (error) throw error
    return path
  }
  async documentUrl(path: string): Promise<string> {
    const { data, error } = await this.sb.storage.from(DOCS_BUCKET).createSignedUrl(path, 600)
    if (error) throw error
    return data.signedUrl
  }
  async deleteDocumentFile(path: string): Promise<void> {
    await this.sb.storage.from(DOCS_BUCKET).remove([path])
  }
  async ownerReport(token: string): Promise<OwnerReport | null> {
    const { data, error } = await this.sb.rpc('re_owner_report', { p_token: token })
    if (error) throw error
    return (data as OwnerReport | null) ?? null
  }
}

export const repo: Repo = isConfigured ? new SupabaseRepo() : new LocalRepo()

/** Fire-and-forget audit trail (never blocks the UI). */
export async function logActivity(
  user: SessionUser | null,
  action: 'create' | 'update' | 'delete' | 'login' | 'status',
  entity: string,
  entity_id: string | null,
  meta?: Record<string, unknown>,
) {
  try {
    await repo.log({
      id: uid(),
      actor: user?.id ?? null,
      actor_name: user?.name ?? null,
      action,
      entity,
      entity_id,
      meta: meta ?? null,
      created_at: nowIso(),
    })
  } catch {
    /* ignore */
  }
}
