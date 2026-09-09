// Всё хранится в localStorage этого устройства. Никакого сервера.

const ENTRIES_KEY = 'voice-expenses:entries:v1'
const SETTINGS_KEY = 'voice-expenses:settings:v1'

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

export const loadEntries = () => read(ENTRIES_KEY, [])
export const saveEntries = (entries) => write(ENTRIES_KEY, entries)
export const loadSettings = () => ({ ...DEFAULT_SETTINGS, ...read(SETTINGS_KEY, {}) })
export const saveSettings = (settings) => write(SETTINGS_KEY, settings)

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
