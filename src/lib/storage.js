// Всё хранится в localStorage этого устройства. Никакого сервера.

const ENTRIES_KEY = 'voice-expenses:entries:v1'
const SETTINGS_KEY = 'voice-expenses:settings:v1'
const TOUR_KEY = 'voice-expenses:tour:v1'

export const DEFAULT_SETTINGS = {
  currency: 'KZT',
  lang: 'ru-RU',
  monthlyBudget: null,
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
export const loadEntries = () =>
  read(ENTRIES_KEY, []).map((e) => ({ ...e, updatedAt: e.updatedAt ?? e.createdAt ?? e.date }))

export const saveEntries = (entries) => write(ENTRIES_KEY, entries)

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

export function toCsv(entries) {
  const head = ['дата', 'тип', 'сумма', 'валюта', 'категория', 'описание', 'исходная фраза']
  const rows = entries.map((e) => [
    new Date(e.date).toLocaleString('ru-RU'),
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

export function downloadCsv(entries) {
  const blob = new Blob(['﻿' + toCsv(entries)], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `траты-${new Date().toISOString().slice(0, 10)}.csv`
  a.click()
  URL.revokeObjectURL(url)
}
