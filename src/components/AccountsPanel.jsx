import { useState } from 'react'
import { CURRENCIES } from '../lib/parse.js'
import { formatMoney } from '../lib/format.js'
import { MAIN_ACCOUNT_ID, accountBalance } from '../lib/accounts.js'

/** Управление счетами в настройках: добавить, переименовать, удалить. */
export default function AccountsPanel({ accounts, entries, onChange, onAdd, onRemove }) {
  const [openId, setOpenId] = useState(null)

  return (
    <div className="accounts">
      <span className="accounts__label">Счета</span>

      {accounts.map((account) => {
        const open = openId === account.id
        return (
          <div key={account.id} className={`account ${open ? 'account--open' : ''}`}>
            <button
              type="button"
              className="account__head"
              onClick={() => setOpenId(open ? null : account.id)}
            >
              <span className="account__title">{account.title}</span>
              <span className="account__sum">
                {formatMoney(accountBalance(account, entries), account.currency)}
              </span>
              <span className="account__chevron">{open ? '▴' : '▾'}</span>
            </button>

            {open && (
              <div className="account__body">
                <label className="field">
                  <span>Название</span>
                  <input
                    type="text"
                    value={account.title}
                    onChange={(e) => onChange({ ...account, title: e.target.value })}
                  />
                </label>

                <div className="field field--split">
                  <label>
                    <span>Валюта</span>
                    <select
                      value={account.currency}
                      onChange={(e) => onChange({ ...account, currency: e.target.value })}
                    >
                      {Object.values(CURRENCIES).map((c) => (
                        <option key={c.code} value={c.code}>{c.symbol} {c.code}</option>
                      ))}
                    </select>
                  </label>
                  <label>
                    <span>Было на счёте</span>
                    <input
                      type="number"
                      inputMode="decimal"
                      placeholder="0"
                      value={account.openingBalance || ''}
                      onChange={(e) =>
                        onChange({ ...account, openingBalance: Number(e.target.value) || 0 })
                      }
                    />
                  </label>
                </div>

                {/* Основной счёт удалить нельзя: на него переезжают записи с остальных */}
                {account.id !== MAIN_ACCOUNT_ID && (
                  <button
                    type="button"
                    className="btn btn--ghost btn--danger"
                    onClick={() => {
                      if (!confirm(`Удалить счёт «${account.title}»? Записи переедут на основной.`)) return
                      setOpenId(null)
                      onRemove(account.id)
                    }}
                  >
                    Удалить счёт
                  </button>
                )}
              </div>
            )}
          </div>
        )
      })}

      <button type="button" className="btn btn--ghost" onClick={onAdd}>
        + Добавить счёт
      </button>
    </div>
  )
}
