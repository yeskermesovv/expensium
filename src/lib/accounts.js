// Счета: кошелёк, карта, накопления. Записи ссылаются на счёт по id.

/**
 * Счёт по умолчанию. Идентификатор именно постоянная строка, а не сгенерированный
 * ключ: записи, созданные до появления счетов, получают его на каждом устройстве
 * отдельно, и все эти устройства должны сойтись на одном и том же счёте.
 */
export const MAIN_ACCOUNT_ID = 'main'

export const mainAccount = (currency = 'KZT') => ({
  id: MAIN_ACCOUNT_ID,
  title: 'Основной',
  currency,
  openingBalance: 0,
})

/** Пока пользователь не завёл счета сам, он живёт на одном подразумеваемом. */
export const accountsOrDefault = (accounts, currency) =>
  accounts.length ? accounts : [mainAccount(currency)]

/** Счёт по id. Если такого больше нет, показываем первый из списка. */
export function accountOf(accounts, id) {
  return accounts.find((a) => a.id === id) || accounts[0] || mainAccount()
}

/**
 * Остаток на счёте: сколько лежало до первой записи, плюс доходы, минус расходы.
 * Считаются только записи в валюте счёта — складывать тенге с долларами нельзя.
 */
export function accountBalance(account, entries) {
  const own = entries.filter((e) => e.accountId === account.id && e.currency === account.currency)
  return own.reduce(
    (sum, e) => (e.amount ? sum + (e.type === 'income' ? e.amount : -e.amount) : sum),
    account.openingBalance || 0,
  )
}

/** Суммы записей в чужих для счёта валютах: их выносим отдельной строкой. */
export function foreignTotals(account, entries) {
  const totals = new Map()
  for (const e of entries) {
    if (e.accountId !== account.id || e.currency === account.currency || !e.amount) continue
    const delta = e.type === 'income' ? e.amount : -e.amount
    totals.set(e.currency, (totals.get(e.currency) || 0) + delta)
  }
  return [...totals.entries()]
}
