import { DEFAULT_SETTINGS } from './config'
import { nowIso, uid } from './format'
import { IMAGES_BUCKET, getSupabase, isConfigured } from './supabase'
import type { Activity, Lead, Property, SessionUser, Settings } from './types'

export type TableName = 'properties' | 'clients' | 'leads' | 'appointments' | 'tasks' | 'deals' | 'calls' | 'staff' | 'activity'

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
}

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
  uploadImage(blob: Blob, name: string): Promise<string>
  deleteImage(url: string): Promise<void>
  resetDemo(): Promise<void>
}

function mergeSettings(partial: Partial<Record<keyof Settings, unknown>>): Settings {
  const o = (x: unknown) => (x && typeof x === 'object' ? (x as object) : {})
  return {
    agency: { ...DEFAULT_SETTINGS.agency, ...o(partial.agency) },
    site: { ...DEFAULT_SETTINGS.site, ...o(partial.site) },
    catalog: { ...DEFAULT_SETTINGS.catalog, ...o(partial.catalog) },
  }
}

/** Fields that must never reach the public website. */
function stripPrivate(p: Property): Property {
  return { ...p, private_notes: null, owner_client_id: null }
}

const isUuid = (s: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s)

/* ------------------------------------------------------------------ */
/* Demo mode: everything in localStorage, seeded with sample data        */
/* ------------------------------------------------------------------ */
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
      if (localStorage.getItem('shi:seeded')) return
      const { seedData } = await import('./seed')
      const s = seedData()
      for (const [t, rows] of Object.entries(s)) this.write(t, rows as unknown[])
      localStorage.setItem('shi:seeded', '1')
    } catch {
      /* private browsing: run without persistence */
    }
  }
  async resetDemo() {
    for (const t of Object.keys(TABLE)) localStorage.removeItem(this.key(t))
    localStorage.removeItem('shi:settings')
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
    if (i >= 0) rows[i] = { ...rows[i], ...row }
    else rows.unshift(row)
    this.write(table, rows)
    return row
  }
  async remove(table: TableName, id: string): Promise<void> {
    await this.ready
    this.write(
      table,
      this.read<Row>(table).filter((r) => r.id !== id),
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
    const { data, error } = await this.sb.from('re_public_properties').select('*').order('featured', { ascending: false }).order('created_at', { ascending: false })
    if (error) throw error
    return ((data ?? []) as Property[]).map(stripPrivate)
  }
  async publicProperty(refOrId: string): Promise<Property | null> {
    const q = this.sb.from('re_public_properties').select('*')
    const { data, error } = await (isUuid(refOrId) ? q.eq('id', refOrId) : q.eq('ref', refOrId)).maybeSingle()
    if (error) throw error
    return data ? stripPrivate(data as Property) : null
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
