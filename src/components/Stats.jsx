import { categoryOf } from '../lib/categories.js'
import { formatMoney } from '../lib/format.js'

/** Итоги за выбранный период и разбивка по категориям. */
export default function Stats({ entries, account, balance, foreign, budget, period }) {
  const currency = account.currency
  // Суммируем только свою валюту: сложить тенге с долларами нельзя,
  // остальное уходит отдельной строкой под итогами
  const own = entries.filter((e) => e.amount && e.currency === currency)
  const expenses = own.filter((e) => e.type === 'expense')
  const spent = expenses.reduce((sum, e) => sum + e.amount, 0)
  const earned = own.filter((e) => e.type === 'income').reduce((sum, e) => sum + e.amount, 0)

  const byCategory = new Map()
  for (const e of expenses) {
    byCategory.set(e.categoryId, (byCategory.get(e.categoryId) || 0) + e.amount)
  }
  const rows = [...byCategory.entries()].sort((a, b) => b[1] - a[1])
  const max = rows.length ? rows[0][1] : 0

  const budgetShare = budget && period === 'month' ? Math.min(spent / budget, 1) : null

  return (
    <div className="stats">
      <div className="stats__totals">
        <div className="total">
          <span className="total__label">Потрачено</span>
          <span className="total__value">{formatMoney(spent, currency)}</span>
        </div>
        <div className="total">
          <span className="total__label">Получено</span>
          <span className="total__value total__value--in">{formatMoney(earned, currency)}</span>
        </div>
        <div className="total">
          {/* Остаток берётся за всё время, поэтому период его не меняет */}
          <span className="total__label">Остаток</span>
          <span className={`total__value ${balance > 0 ? 'total__value--in' : balance < 0 ? 'total__value--out' : ''}`}>
            {formatMoney(balance, currency)}
          </span>
        </div>
        <div className="total">
          <span className="total__label">Записей</span>
          <span className="total__value">{entries.length}</span>
        </div>
      </div>

      {foreign.length > 0 && (
        <p className="stats__foreign">
          Ещё на счёте:{' '}
          {foreign.map(([code, sum]) => formatMoney(sum, code)).join(', ')}
        </p>
      )}

      {budgetShare !== null && (
        <div className="budget">
          <div className="budget__bar">
            <div
              className="budget__fill"
              style={{ width: `${budgetShare * 100}%`, background: budgetShare > 0.9 ? '#f87171' : '#4ade80' }}
            />
          </div>
          <span className="budget__text">
            {formatMoney(spent, currency)} из {formatMoney(budget, currency)} за месяц
          </span>
        </div>
      )}

      {rows.length > 0 && (
        <ul className="bars">
          {rows.map(([id, sum]) => {
            const cat = categoryOf(id)
            return (
              <li key={id} className="bar">
                <span className="bar__name">{cat.icon} {cat.title}</span>
                <span className="bar__track">
                  <span className="bar__fill" style={{ width: `${(sum / max) * 100}%`, background: cat.color }} />
                </span>
                <span className="bar__value">{formatMoney(sum, currency)}</span>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
