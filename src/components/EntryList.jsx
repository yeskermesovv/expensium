import { categoryOf } from '../lib/categories.js'
import { formatDay, formatMoney, formatTime, dayKey } from '../lib/format.js'

/** Итог дня считаем по каждой валюте отдельно: складывать их нельзя. */
function spentByCurrency(day) {
  const totals = new Map()
  for (const e of day) {
    if (e.type !== 'expense' || !e.amount) continue
    totals.set(e.currency, (totals.get(e.currency) || 0) + e.amount)
  }
  return [...totals.entries()]
}

function groupByDay(entries) {
  const groups = new Map()
  for (const entry of entries) {
    const key = dayKey(entry.date)
    if (!groups.has(key)) groups.set(key, [])
    groups.get(key).push(entry)
  }
  return [...groups.values()]
}

export default function EntryList({ entries, onEdit, onDelete }) {
  if (!entries.length) {
    return (
      <div className="empty">
        <p className="empty__title">Пока пусто</p>
        <p>Нажмите на микрофон и скажите, например: «потратил тысячу двести тенге на кофе».</p>
      </div>
    )
  }

  const days = groupByDay(entries)

  return (
    <div className="list">
      {days.map((day) => {
        const spent = spentByCurrency(day)
        return (
          <section key={dayKey(day[0].date)} className="day">
            <header className="day__head">
              <h3>{formatDay(day[0].date)}</h3>
              <span>{spent.map(([code, sum]) => formatMoney(sum, code)).join(' · ')}</span>
            </header>
            {day.map((entry) => {
              const cat = categoryOf(entry.categoryId)
              return (
                <article
                  key={entry.id}
                  className={`entry ${entry.amount === null ? 'entry--incomplete' : ''}`}
                  onClick={() => onEdit(entry)}
                >
                  <span className="entry__icon" style={{ background: cat.color + '22', color: cat.color }}>
                    {cat.icon}
                  </span>
                  <span className="entry__body">
                    <span className="entry__title">{entry.title || cat.title}</span>
                    <span className="entry__meta">
                      {cat.title} · {formatTime(entry.date)}
                      {entry.amount === null && ' · нужна сумма'}
                    </span>
                  </span>
                  <span className={`entry__amount ${entry.type === 'income' ? 'entry__amount--in' : ''}`}>
                    {entry.amount === null
                      ? '—'
                      : (entry.type === 'income' ? '+' : '−') + formatMoney(entry.amount, entry.currency)}
                  </span>
                  <button
                    className="entry__del"
                    aria-label="Удалить"
                    onClick={(e) => {
                      e.stopPropagation()
                      onDelete(entry.id)
                    }}
                  >
                    ✕
                  </button>
                </article>
              )
            })}
          </section>
        )
      })}
    </div>
  )
}
