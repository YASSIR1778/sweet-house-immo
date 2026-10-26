import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { DEFAULT_SETTINGS } from './config'
import { DEFAULT_NETWORK } from './fee-defaults'
import { repo, type Row, type TableName } from './repo'
import type { NetworkSettings, Property, Settings } from './types'

export function useTable<T extends Row>(table: TableName, opts?: { enabled?: boolean; refetchInterval?: number }) {
  return useQuery({
    queryKey: [table],
    queryFn: () => repo.list<T>(table),
    enabled: opts?.enabled ?? true,
    staleTime: 15_000,
    refetchInterval: opts?.refetchInterval,
  })
}

export function useUpsert<T extends Row>(table: TableName, also: TableName[] = []) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (row: T) => repo.upsert<T>(table, row),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: [table] })
      for (const t of also) void qc.invalidateQueries({ queryKey: [t] })
      if (table === 'properties') {
        void qc.invalidateQueries({ queryKey: ['price_history'] })
        void qc.invalidateQueries({ queryKey: ['public-properties'] })
        void qc.invalidateQueries({ queryKey: ['public-property'] })
      }
    },
  })
}

export function useRemove(table: TableName) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => repo.remove(table, id),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: [table] })
      if (table === 'properties') {
        void qc.invalidateQueries({ queryKey: ['public-properties'] })
        void qc.invalidateQueries({ queryKey: ['public-property'] })
      }
    },
  })
}

export function useSettings() {
  return useQuery({ queryKey: ['settings'], queryFn: () => repo.getSettings(), placeholderData: DEFAULT_SETTINGS, staleTime: 60_000 })
}

/** Internal commission-sharing rules (team only), over the customary defaults. */
export function useNetwork(enabled = true) {
  return useQuery({
    queryKey: ['private', 'network'],
    queryFn: async () => ({ ...DEFAULT_NETWORK, ...((await repo.getPrivate<Partial<NetworkSettings>>('network')) ?? {}) }) as NetworkSettings,
    placeholderData: DEFAULT_NETWORK,
    staleTime: 60_000,
    enabled,
  })
}

export function useSaveNetwork() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (value: NetworkSettings) => repo.savePrivate('network', value),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['private', 'network'] })
    },
  })
}

export function useSaveSettings() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ key, value }: { key: keyof Settings; value: Settings[keyof Settings] }) => repo.saveSettings(key, value as never),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['settings'] })
    },
  })
}

export function usePublicProperties() {
  return useQuery({ queryKey: ['public-properties'], queryFn: () => repo.publicProperties(), staleTime: 60_000 })
}

export function usePublicProperty(ref: string | undefined) {
  return useQuery({ queryKey: ['public-property', ref], queryFn: () => repo.publicProperty(ref!), enabled: Boolean(ref), staleTime: 60_000 })
}

/** Matching score between a client's wishes and a property (0..100). */
export function matchScore(
  p: Property,
  wants: { purpose?: string | null; types?: string[]; neighborhoods?: string[]; min?: number | null; max?: number | null; rooms?: number | null },
): number {
  if (wants.purpose && p.purpose !== wants.purpose) return 0
  let score = 20
  if (wants.types?.length) score += wants.types.includes(p.type) ? 25 : -40
  else score += 10
  if (wants.neighborhoods?.length) score += wants.neighborhoods.includes(p.neighborhood) ? 25 : -15
  else score += 10
  if (wants.max != null) {
    if (p.price <= wants.max) score += 20
    else if (p.price <= wants.max * 1.1) score += 8
    else score -= 30
  } else score += 10
  if (wants.min != null && p.price < wants.min * 0.7) score -= 10
  if (wants.rooms != null && p.rooms != null) score += p.rooms >= wants.rooms ? 10 : -10
  return Math.max(0, Math.min(100, score))
}
