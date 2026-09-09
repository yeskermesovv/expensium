import { useEffect, useState } from 'react'
import { CATEGORIES } from '../lib/categories.js'
import { CURRENCIES } from '../lib/parse.js'
import { toLocalInput } from '../lib/format.js'

/** Ручная правка записи: сумма, категория, дата. Открывается по тапу на запись. */
export default function EntryEditor({ entry, onSave, onDelete, onClose }) {
  const [draft, setDraft] = useState(entry)

  useEffect(() => setDraft(entry), [entry])
  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  if (!draft) return null

  const set = (patch) => setDraft((d) => ({ ...d, ...patch }))

  const submit = (e) => {
    e.preventDefault()
    const amount = draft.amount === '' || draft.amount === null ? null : Number(draft.amount)
    onSave({ ...draft, amount: Number.isFinite(amount) ? amount : null })
  }

  return (
    <div className="sheet__backdrop" onClick={onClose}>
      <form className="sheet" onClick={(e) => e.stopPropagation()} onSubmit={submit}>
        <div className="sheet__grip" />
        <h2 className="sheet__title">Запись</h2>

        {draft.note && <p className="sheet__note">«{draft.note}»</p>}

        <label className="field">
          <span>Сумма</span>
          <div className="field__row">
            <input
              type="number"
              step="0.01"
              inputMode="decimal"
              autoFocus={draft.amount === null}
              value={draft.amount ?? ''}
              onChange={(e) => set({ amount: e.target.value })}
            />
            <select value={draft.currency} onChange={(e) => set({ currency: e.target.value })}>
              {Object.values(CURRENCIES).map((c) => (
                <option key={c.code} value={c.code}>{c.symbol} {c.code}</option>
              ))}
            </select>
          </div>
        </label>

        <label className="field">
          <span>Описание</span>
          <input
            type="text"
            value={draft.title ?? ''}
            placeholder="На что потрачено"
            onChange={(e) => set({ title: e.target.value })}
          />
        </label>

        <div className="field">
          <span>Категория</span>
          <div className="chips">
            {CATEGORIES.map((cat) => (
              <button
                key={cat.id}
                type="button"
                className={`chip ${draft.categoryId === cat.id ? 'chip--on' : ''}`}
                style={draft.categoryId === cat.id ? { borderColor: cat.color, color: cat.color } : undefined}
                onClick={() => set({ categoryId: cat.id })}
              >
                {cat.icon} {cat.title}
              </button>
            ))}
          </div>
        </div>

        <div className="field field--split">
          <label>
            <span>Тип</span>
            <select value={draft.type} onChange={(e) => set({ type: e.target.value })}>
              <option value="expense">Расход</option>
              <option value="income">Доход</option>
            </select>
          </label>
          <label>
            <span>Когда</span>
            <input
              type="datetime-local"
              value={toLocalInput(draft.date)}
              onChange={(e) => set({ date: new Date(e.target.value).toISOString() })}
            />
          </label>
        </div>

        <div className="sheet__actions">
          <button type="button" className="btn btn--ghost btn--danger" onClick={() => onDelete(draft.id)}>
            Удалить
          </button>
          <button type="button" className="btn btn--ghost" onClick={onClose}>Отмена</button>
          <button type="submit" className="btn btn--primary">Сохранить</button>
        </div>
      </form>
    </div>
  )
}
