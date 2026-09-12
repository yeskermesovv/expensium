// Всё хранится в localStorage этого устройства. Никакого сервера.

import { MAIN_ACCOUNT_ID, accountOf } from './accounts.js'

const ENTRIES_KEY = 'voice-expenses:entries:v1'
const ACCOUNTS_KEY = 'voice-expenses:accounts:v1'
const SETTINGS_KEY = 'voice-expenses:settings:v1'
const TOUR_KEY = 'voice-expenses:tour:v1'

export const DEFAULT_SETTINGS = {
  currency: 'KZT',
  lang: 'ru-RU',
  monthlyBudget: null,
  // Выбранный счёт намеренно не уезжает в облако: на телефоне и на ноутбуке
  // удобно держать открытыми разные счета
  activeAccountId: MAIN_ACCOUNT_ID,
}

function read(key, fallback) {
  try {
    const raw = localStorage.getItem(key)
    return raw ? JSON.parse(raw) : fallback
  } catch {
    return fallback
  }
}

function write(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch (e) {
    console.warn('не удалось сохранить', key, e)
  }
}

// Записям нужна отметка правки: по ней синхронизация решает, чья версия свежее.
// У записей, созданных до появления облака, её нет — проставляем при чтении.
// Счёт добираем так же: у записей старше счетов его нет, и хранилище мы
// не переписываем, иначе пришлось бы тронуть updatedAt и разослать всю историю.
export const loadEntries = () =>
  read(ENTRIES_KEY, []).map((e) => ({
    ...e,
    updatedAt: e.updatedAt ?? e.createdAt ?? e.date,
    accountId: e.accountId ?? MAIN_ACCOUNT_ID,
  }))

export const saveEntries = (entries) => write(ENTRIES_KEY, entries)

// Пустой список означает единственный подразумеваемый счёт: пока пользователь
// не завёл второй, счетов для него как бы и нет.
export const loadAccounts = () =>
  read(ACCOUNTS_KEY, []).map((a) => ({ ...a, openingBalance: a.openingBalance ?? 0 }))

export const saveAccounts = (accounts) => write(ACCOUNTS_KEY, accounts)

/** Отмечает запись изменённой прямо сейчас. */
export const touch = (entry) => ({ ...entry, updatedAt: new Date().toISOString() })

/** Живые записи: удалённые остаются как надгробия, чтобы удаление доехало. */
export const alive = (entries) => entries.filter((e) => !e.deleted)
export const loadSettings = () => ({ ...DEFAULT_SETTINGS, ...read(SETTINGS_KEY, {}) })
export const saveSettings = (settings) => write(SETTINGS_KEY, settings)

/** Обучающий тур показывается новичку один раз, дальше только по кнопке в настройках. */
export const tourSeen = () => read(TOUR_KEY, false) === true
export const markTourSeen = () => write(TOUR_KEY, true)

export function newId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8)
}

export function toCsv(entries, accounts = []) {
  const head = ['дата', 'счёт', 'тип', 'сумма', 'валюта', 'категория', 'описание', 'исходная фраза']
  const rows = entries.map((e) => [
    new Date(e.date).toLocaleString('ru-RU'),
    accountOf(accounts, e.accountId).title,
    e.type === 'income' ? 'доход' : 'расход',
    String(e.amount ?? ''),
    e.currency,
    e.categoryId,
    e.title ?? '',
    e.note ?? '',
  ])
  return [head, ...rows]
    .map((r) => r.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(';'))
    .join('\n')
}

export function downloadCsv(entries, accounts = []) {
  const blob = new Blob(['﻿' + toCsv(entries, accounts)], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `траты-${new Date().toISOString().slice(0, 10)}.csv`
  a.click()
  URL.revokeObjectURL(url)
}
