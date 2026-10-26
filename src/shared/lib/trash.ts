import { repo, TABLE, type Row, type TableName } from './repo'

/*
 * Trash: the database copies every deleted record into re_trash (trigger re_to_trash);
 * the demo does the same in its local store. Records stay 30 days and can be restored.
 */

export interface TrashItem {
  id: string
  table_name: string
  row_id: string
  label: string | null
  data: Record<string, unknown>
  deleted_by: string | null
  created_at: string
}

export const TRASH_DAYS = 30

/** Tables whose deleted rows go to the trash. */
export const TRASHABLE: TableName[] = ['properties', 'clients', 'leads', 'appointments', 'tasks', 'calls', 'deals', 'brokers', 'mandates', 'documents']

export function tableOf(dbName: string): TableName | null {
  return (Object.keys(TABLE) as TableName[]).find((k) => TABLE[k] === dbName) ?? null
}

/** Days left before an item is removed for good. */
export function daysLeft(item: Pick<TrashItem, 'created_at'>, now: Date = new Date()): number {
  return Math.max(0, TRASH_DAYS - Math.floor((now.getTime() - new Date(item.created_at).getTime()) / 86_400_000))
}

/**
 * Put a record back where it was, with the records deleted together with it
 * (its mandates, documents… removed in the same few seconds). Returns the tables touched.
 */
export async function restoreItem(item: TrashItem, all: TrashItem[]): Promise<TableName[]> {
  const table = tableOf(item.table_name)
  if (!table) throw new Error('unknown_table')
  await repo.upsert(table, item.data as unknown as Row)
  await repo.remove('trash', item.id)
  const touched = new Set<TableName>([table])
  const at = Date.parse(item.created_at)
  const related = all.filter(
    (x) =>
      x.id !== item.id &&
      Math.abs(Date.parse(x.created_at) - at) < 10_000 &&
      (x.data.property_id === item.row_id || x.data.client_id === item.row_id || x.data.owner_client_id === item.row_id),
  )
  for (const x of related) {
    const t = tableOf(x.table_name)
    if (!t) continue
    try {
      await repo.upsert(t, x.data as unknown as Row)
      await repo.remove('trash', x.id)
      touched.add(t)
    } catch {
      /* a related record that cannot come back stays in the trash */
    }
  }
  return [...touched]
}

/** Latest trash item of a deleted record (for «undo»). */
export async function findDeleted(table: TableName, id: string): Promise<{ item: TrashItem; all: TrashItem[] } | null> {
  const all = await repo.list<TrashItem>('trash')
  const item = all.filter((x) => x.table_name === TABLE[table] && x.row_id === id).sort((a, b) => b.created_at.localeCompare(a.created_at))[0]
  return item ? { item, all } : null
}

/** Remove an item for good (and its private file, for a document). */
export async function purgeItem(item: TrashItem): Promise<void> {
  await repo.remove('trash', item.id)
  if (item.table_name === TABLE.documents && typeof item.data.path === 'string') {
    try {
      await repo.deleteDocumentFile(item.data.path)
    } catch {
      /* already gone */
    }
  }
}
