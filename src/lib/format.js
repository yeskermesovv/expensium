import { CURRENCIES } from './parse.js'

export function formatMoney(amount, currency = 'RUB') {
  if (amount === null || amount === undefined) return '—'
  const symbol = CURRENCIES[currency]?.symbol || currency
  const rounded = Math.round(amount * 100) / 100
  const text = rounded
    .toLocaleString('ru-RU', { minimumFractionDigits: 0, maximumFractionDigits: 2 })
  return `${text} ${symbol}`
}

const MONTHS = [
  'января', 'февраля', 'марта', 'апреля', 'мая', 'июня',
  'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря',
]

export const dayKey = (date) => {
  const d = new Date(date)
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`
}

export function formatDay(date, now = new Date()) {
  const d = new Date(date)
  if (dayKey(d) === dayKey(now)) return 'Сегодня'
  const yesterday = new Date(now)
  yesterday.setDate(yesterday.getDate() - 1)
  if (dayKey(d) === dayKey(yesterday)) return 'Вчера'
  const sameYear = d.getFullYear() === now.getFullYear()
  return `${d.getDate()} ${MONTHS[d.getMonth()]}${sameYear ? '' : ' ' + d.getFullYear()}`
}

export const formatTime = (date) =>
  new Date(date).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })

/** Значение для <input type="datetime-local"> в местном времени. */
export function toLocalInput(date) {
  const d = new Date(date)
  const pad = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}
