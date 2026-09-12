// Синхронизация с Supabase поверх локального хранилища.
// Локальные записи остаются главными: облако только догоняет их и отдаёт то,
// что записано на других устройствах. Побеждает более поздняя правка.

import { supabase } from './supabase.js'
import { MAIN_ACCOUNT_ID } from './accounts.js'

const ENTRIES = 'entries'
const ACCOUNTS = 'accounts'
const TOMBSTONE_TTL_DAYS = 90

const toRow = (entry, userId) => ({
  id: entry.id,
  user_id: userId,
  amount: entry.amount,
  currency: entry.currency,
  type: entry.type,
  category_id: entry.categoryId,
  account_id: entry.accountId ?? MAIN_ACCOUNT_ID,
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
  // Строку мог записать клиент, который про счета ещё не знает
  accountId: row.account_id ?? MAIN_ACCOUNT_ID,
  title: row.title,
  note: row.note,
  date: row.date,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
  deleted: Boolean(row.deleted),
})

const accountToRow = (account, userId) => ({
  id: account.id,
  user_id: userId,
  title: account.title,
  currency: account.currency,
  opening_balance: account.openingBalance ?? 0,
  updated_at: account.updatedAt,
  deleted: Boolean(account.deleted),
})

const accountFromRow = (row) => ({
  id: row.id,
  title: row.title,
  currency: row.currency,
  openingBalance: row.opening_balance === null ? 0 : Number(row.opening_balance),
  updatedAt: row.updated_at,
  deleted: Boolean(row.deleted),
})

/** Удалённые записи храним ограниченное время: они нужны только чтобы удаление доехало. */
function dropOldTombstones(items, now = Date.now()) {
  const ttl = TOMBSTONE_TTL_DAYS * 24 * 60 * 60 * 1000
  return items.filter((e) => !e.deleted || now - new Date(e.updatedAt).getTime() < ttl)
}

/** Сливает два списка по id: у каждого элемента выигрывает более поздняя правка. */
export function mergeById(local, remote) {
  const byId = new Map()
  for (const entry of [...local, ...remote]) {
    const known = byId.get(entry.id)
    if (!known || new Date(entry.updatedAt) > new Date(known.updatedAt)) {
      byId.set(entry.id, entry)
    }
  }
  return dropOldTombstones([...byId.values()])
}

/** Отправляет изменённое с прошлого раза и забирает чужие правки по одной таблице. */
async function syncTable(table, local, { userId, lastSyncAt, toRow: pack, fromRow: unpack }) {
  const changed = lastSyncAt ? local.filter((e) => e.updatedAt > lastSyncAt) : local

  if (changed.length) {
    const { error } = await supabase
      .from(table)
      .upsert(changed.map((e) => pack(e, userId)), { onConflict: 'id' })
    if (error) throw error
  }

  let query = supabase.from(table).select('*')
  if (lastSyncAt) query = query.gt('updated_at', lastSyncAt)
  const { data, error } = await query
  if (error) throw error

  return {
    merged: mergeById(local, (data ?? []).map(unpack)),
    pushed: changed.length,
    pulled: data?.length ?? 0,
  }
}

/**
 * Гоняет в облако записи и счета. Отметка времени одна на оба списка:
 * они меняются вместе, и разъезжаться им незачем.
 */
export async function syncAll(localEntries, localAccounts, { userId, lastSyncAt }) {
  if (!supabase) throw new Error('Облако не настроено')

  const entries = await syncTable(ENTRIES, localEntries, {
    userId, lastSyncAt, toRow, fromRow,
  })
  const accounts = await syncTable(ACCOUNTS, localAccounts, {
    userId, lastSyncAt, toRow: accountToRow, fromRow: accountFromRow,
  })

  return {
    entries: entries.merged,
    accounts: accounts.merged,
    syncedAt: new Date().toISOString(),
    pushed: entries.pushed + accounts.pushed,
    pulled: entries.pulled + accounts.pulled,
  }
}
