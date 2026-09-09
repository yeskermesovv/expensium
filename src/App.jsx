import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import MicButton from './components/MicButton.jsx'
import EntryList from './components/EntryList.jsx'
import EntryEditor from './components/EntryEditor.jsx'
import Stats from './components/Stats.jsx'
import { useSpeech } from './hooks/useSpeech.js'
import { parseSpeech, CURRENCIES } from './lib/parse.js'
import {
  loadEntries, saveEntries, loadSettings, saveSettings, newId, downloadCsv, touch, alive,
  tourSeen, markTourSeen,
} from './lib/storage.js'
import { formatMoney } from './lib/format.js'
import { useCloud } from './hooks/useCloud.js'
import CloudPanel from './components/CloudPanel.jsx'
import Tutorial from './components/Tutorial.jsx'

const PERIODS = [
  { id: 'day', title: 'День' },
  { id: 'week', title: 'Неделя' },
  { id: 'month', title: 'Месяц' },
  { id: 'all', title: 'Всё' },
]

function periodStart(period, now = new Date()) {
  const d = new Date(now)
  d.setHours(0, 0, 0, 0)
  if (period === 'day') return d
  if (period === 'week') {
    const weekday = (d.getDay() + 6) % 7 // неделя начинается с понедельника
    d.setDate(d.getDate() - weekday)
    return d
  }
  if (period === 'month') {
    d.setDate(1)
    return d
  }
  return new Date(0)
}

export default function App() {
  const [entries, setEntries] = useState(loadEntries)
  const [settings, setSettings] = useState(loadSettings)
  const [period, setPeriod] = useState('month')
  const [editing, setEditing] = useState(null)
  const [toast, setToast] = useState(null)
  const [showSettings, setShowSettings] = useState(false)
  const [manual, setManual] = useState('')
  const [heard, setHeard] = useState(null)
  // Тур показываем один раз новичку: если записей ещё нет и его не закрывали
  const [showTutorial, setShowTutorial] = useState(() => !tourSeen() && entries.length === 0)
  const toastTimer = useRef(null)

  useEffect(() => saveEntries(entries), [entries])
  useEffect(() => saveSettings(settings), [settings])

  const closeTutorial = useCallback(() => {
    setShowTutorial(false)
    markTourSeen()
  }, [])

  const flash = useCallback((message, undo) => {
    clearTimeout(toastTimer.current)
    setToast({ message, undo })
    toastTimer.current = setTimeout(() => setToast(null), 6000)
  }, [])

  // Общая точка входа: и для речи, и для текста, набранного руками.
  const addFromText = useCallback((text) => {
    const parsed = parseSpeech(text, { defaultCurrency: settings.currency, lang: settings.lang })
    if (!parsed.length) return
    setHeard(text.trim())
    const now = new Date().toISOString()
    const created = parsed.map((p) => ({ ...p, id: newId(), createdAt: now, updatedAt: now }))
    setEntries((prev) => [...created, ...prev])

    const needsAmount = created.find((e) => e.amount === null)
    if (needsAmount) {
      setEditing(needsAmount)
      flash('Не расслышал сумму — впишите её вручную')
      return
    }
    const total = created.reduce((sum, e) => sum + e.amount, 0)
    const label = created.length > 1
      ? `Записал ${created.length} траты на ${formatMoney(total, created[0].currency)}`
      : `Записал ${formatMoney(created[0].amount, created[0].currency)} · ${created[0].title || ''}`
    // Отмена помечает записи удалёнными, а не выкидывает: иначе удаление
    // не доедет до других устройств
    flash(label, () =>
      setEntries((prev) =>
        prev.map((e) => (created.some((c) => c.id === e.id) ? touch({ ...e, deleted: true }) : e)),
      ),
    )
  }, [settings.currency, settings.lang, flash])

  const speech = useSpeech({ lang: settings.lang, onResult: addFromText })

  const visible = useMemo(() => {
    const from = periodStart(period)
    return alive(entries)
      .filter((e) => new Date(e.date) >= from)
      .sort((a, b) => new Date(b.date) - new Date(a.date))
  }, [entries, period])

  const saveEntry = (updated) => {
    setEntries((prev) => prev.map((e) => (e.id === updated.id ? touch(updated) : e)))
    setEditing(null)
  }

  const setDeleted = (id, deleted) =>
    setEntries((prev) => prev.map((e) => (e.id === id ? touch({ ...e, deleted }) : e)))

  const deleteEntry = (id) => {
    setDeleted(id, true)
    setEditing(null)
    flash('Запись удалена', () => setDeleted(id, false))
  }

  // Слитые с облаком записи кладём в состояние, только если они правда изменились:
  // иначе новая ссылка на массив запускала бы синхронизацию по кругу
  const applyMerged = useCallback((merged) => {
    setEntries((prev) => {
      const sign = (list) => list.map((e) => e.id + e.updatedAt).sort().join('|')
      return sign(prev) === sign(merged) ? prev : merged
    })
  }, [])

  const cloud = useCloud({ entries, onMerged: applyMerged })

  return (
    <div className="app">
      <header className="head">
        <div className="head__row">
          <h1 className="head__title">Голосовые траты</h1>
          <button className="icon-btn" onClick={() => setShowSettings((v) => !v)} aria-label="Настройки">
            ⚙
          </button>
        </div>
        <nav className="tabs">
          {PERIODS.map((p) => (
            <button
              key={p.id}
              className={`tab ${period === p.id ? 'tab--on' : ''}`}
              onClick={() => setPeriod(p.id)}
            >
              {p.title}
            </button>
          ))}
        </nav>
      </header>

      {showSettings && (
        <section className="settings">
          <CloudPanel cloud={cloud} onSync={cloud.syncNow} />
          <label className="field">
            <span>Валюта по умолчанию</span>
            <select
              value={settings.currency}
              onChange={(e) => setSettings((s) => ({ ...s, currency: e.target.value }))}
            >
              {Object.values(CURRENCIES).map((c) => (
                <option key={c.code} value={c.code}>{c.symbol} {c.code}</option>
              ))}
            </select>
          </label>
          <label className="field">
            <span>Язык распознавания</span>
            <select
              value={settings.lang}
              onChange={(e) => setSettings((s) => ({ ...s, lang: e.target.value }))}
            >
              <option value="ru-RU">Русский</option>
              <option value="kk-KZ">Қазақша</option>
              <option value="en-US">English</option>
            </select>
          </label>
          <label className="field">
            <span>Бюджет на месяц</span>
            <input
              type="number"
              inputMode="decimal"
              placeholder="не задан"
              value={settings.monthlyBudget ?? ''}
              onChange={(e) =>
                setSettings((s) => ({ ...s, monthlyBudget: e.target.value ? Number(e.target.value) : null }))
              }
            />
          </label>
          <div className="settings__actions">
            <button
              className="btn btn--ghost"
              onClick={() => {
                // Панель настроек закрываем: она сдвигает интерфейс, на который показывает тур
                setShowSettings(false)
                setShowTutorial(true)
              }}
            >
              Как это работает
            </button>
            <button className="btn btn--ghost" onClick={() => downloadCsv(alive(entries))}>
              Выгрузить CSV
            </button>
            <button
              className="btn btn--ghost btn--danger"
              onClick={() => {
                if (!confirm('Удалить все записи без возможности вернуть?')) return
                setEntries((prev) => prev.map((e) => touch({ ...e, deleted: true })))
              }}
            >
              Очистить всё
            </button>
          </div>
        </section>
      )}

      <main className="content">
        <Stats
          entries={visible}
          currency={settings.currency}
          budget={settings.monthlyBudget}
          period={period}
        />
        <EntryList entries={visible} onEdit={setEditing} onDelete={deleteEntry} />
      </main>

      <footer className="recorder">
        {speech.error && <p className="recorder__error">{speech.error}</p>}
        {!speech.supported && (
          <p className="recorder__error">
            Этот браузер не умеет распознавать речь. Откройте приложение в Chrome или введите трату текстом.
          </p>
        )}

        {/* Показываем расслышанную фразу: так видно, если распознавание ошиблось */}
        <p className="recorder__live">
          {speech.listening
            ? speech.interim || 'Слушаю… скажите сумму и на что потратили'
            : heard
              ? `Услышал: «${heard}»`
              : 'Нажмите на микрофон и говорите'}
        </p>

        <div className="recorder__row">
          <form
            className="manual"
            onSubmit={(e) => {
              e.preventDefault()
              if (!manual.trim()) return
              addFromText(manual)
              setManual('')
            }}
          >
            <input
              value={manual}
              onChange={(e) => setManual(e.target.value)}
              placeholder="или напишите: 1500 на кофе"
            />
            <button type="submit" className="btn btn--ghost">Добавить</button>
          </form>

          <MicButton
            listening={speech.listening}
            disabled={!speech.supported}
            onClick={speech.toggle}
          />
        </div>
      </footer>

      {toast && (
        <div className="toast">
          <span>{toast.message}</span>
          {toast.undo && (
            <button
              onClick={() => {
                toast.undo()
                setToast(null)
              }}
            >
              Отменить
            </button>
          )}
        </div>
      )}

      {editing && (
        <EntryEditor
          entry={editing}
          onSave={saveEntry}
          onDelete={deleteEntry}
          onClose={() => setEditing(null)}
        />
      )}

      {showTutorial && <Tutorial onClose={closeTutorial} />}
    </div>
  )
}
