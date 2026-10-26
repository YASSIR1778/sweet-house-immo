import { createClient, type SupabaseClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
const key = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined

/** true when a real Supabase project is configured; false = demo mode. */
export const isConfigured = Boolean(url && key)

let client: SupabaseClient | null = null

export function getSupabase(): SupabaseClient {
  if (!client) {
    client = createClient(url ?? 'http://localhost', key ?? 'missing', {
      auth: { storageKey: 'shi-auth', persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
    })
  }
  return client
}

export const IMAGES_BUCKET = 'property-images'
