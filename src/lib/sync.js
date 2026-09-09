// Синхронизация с Supabase поверх локального хранилища.
// Локальные записи остаются главными: облако только догоняет их и отдаёт то,
// что записано на других устройствах. Побеждает более поздняя правка.

import { supabase } from './supabase.js'

const TABLE = 'entries'
const TOMBSTONE_TTL_DAYS = 90

const toRow = (entry, userId) => ({
  id: entry.id,
  user_id: userId,
  amount: entry.amount,
  currency: entry.currency,
  type: entry.type,
  category_id: entry.categoryId,
  title: entry.title,
  note: entry.note,
  date: entry.date,
  created_at: entry.createdAt ?? entry.date,
  updated_at: entry.updatedAt,
  deleted: Boolean(entry.deleted),
})

const fromRow = (row) => ({
  id: row.id,
  amount: row.amount === null ? null : Number(row.amount),
  currency: row.currency,
  type: row.type,
  categoryId: row.category_id,
  title: row.title,
  note: row.note,
  date: row.date,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
  deleted: Boolean(row.deleted),
})

/** Удалённые записи храним ограниченное время: они нужны только чтобы удаление доехало. */
function dropOldTombstones(entries, now = Date.now()) {
  const ttl = TOMBSTONE_TTL_DAYS * 24 * 60 * 60 * 1000
  return entries.filter((e) => !e.deleted || now - new Date(e.updatedAt).getTime() < ttl)
}

/** Сливает два списка по id: у каждой записи выигрывает более поздняя правка. */
export function mergeEntries(local, remote) {
  const byId = new Map()
  for (const entry of [...local, ...remote]) {
    const known = byId.get(entry.id)
    if (!known || new Date(entry.updatedAt) > new Date(known.updatedAt)) {
      byId.set(entry.id, entry)
    }
  }
  return dropOldTombstones([...byId.values()])
}

/**
 * Отправляет изменённое с прошлого раза и забирает чужие правки.
 * Возвращает объединённый список и отметку времени для следующего раза.
 */
export async function syncEntries(localEntries, { userId, lastSyncAt }) {
  if (!supabase) throw new Error('Облако не настроено')

  const changed = lastSyncAt
    ? localEntries.filter((e) => e.updatedAt > lastSyncAt)
    : localEntries

  if (changed.length) {
    const { error } = await supabase
      .from(TABLE)
      .upsert(changed.map((e) => toRow(e, userId)), { onConflict: 'id' })
    if (error) throw error
  }

  let query = supabase.from(TABLE).select('*')
  if (lastSyncAt) query = query.gt('updated_at', lastSyncAt)
  const { data, error } = await query
  if (error) throw error

  return {
    entries: mergeEntries(localEntries, (data ?? []).map(fromRow)),
    syncedAt: new Date().toISOString(),
    pushed: changed.length,
    pulled: data?.length ?? 0,
  }
}
