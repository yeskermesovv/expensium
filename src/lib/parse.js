// Превращает фразу из диктофона в запись о трате.
// "вчера потратил тысячу двести на такси" -> 1200 ₸, транспорт, вчера.

import { readNumber, isNumberWord } from './numbers.js'
import { guessCategory } from './categories.js'

export const CURRENCIES = {
  KZT: { code: 'KZT', symbol: '₸', words: ['тенге', 'теңге', 'тг', 'тнг', 'kzt', '₸'] },
  RUB: { code: 'RUB', symbol: '₽', words: ['руб', 'рубл', 'рублей', 'рубля', 'р', 'рэ', 'деревянных', '₽'] },
  USD: { code: 'USD', symbol: '$', words: ['доллар', 'долларов', 'доллара', 'бакс', 'баксов', 'usd', '$'] },
  EUR: { code: 'EUR', symbol: '€', words: ['евро', 'eur', '€'] },
  UAH: { code: 'UAH', symbol: '₴', words: ['гривен', 'гривны', 'гривна', 'грн', '₴'] },
  GEL: { code: 'GEL', symbol: '₾', words: ['лари', 'gel'] },
  AMD: { code: 'AMD', symbol: '֏', words: ['драм', 'драмов', 'amd'] },
  TRY: { code: 'TRY', symbol: '₺', words: ['лир', 'лиры', 'лир', 'try'] },
}

const CURRENCY_BY_WORD = {}
for (const cur of Object.values(CURRENCIES)) {
  for (const w of cur.words) CURRENCY_BY_WORD[w] = cur.code
}

// Глаголы дохода выбрасываются из описания, существительные остаются:
// «получил зарплату» -> описание «Зарплата».
const INCOME_VERBS = [
  'получил', 'получила', 'заработал', 'заработала', 'вернули', 'пришло',
  'пришли', 'продал', 'продала', 'подарили', 'начислили',
  'түсті', 'аудардық',
]

const INCOME_NOUNS = [
  'зарплат', 'аванс', 'премия', 'премию', 'доход', 'возврат', 'кэшбэк',
  'кешбэк', 'выплат', 'подработк',
  'жалақы', 'айлық', 'табыс', 'сыйақы',
]

const INCOME_WORDS = [...INCOME_VERBS, ...INCOME_NOUNS]

const NOISE_WORDS = [
  'потратил', 'потратила', 'потрачено', 'трата', 'купил', 'купила', 'отдал',
  'отдала', 'заплатил', 'заплатила', 'оплатил', 'оплатила', 'ушло', 'взял',
  'взяла', 'на', 'за', 'в', 'по', 'это', 'ещё', 'еще', 'мне', 'я', 'себе',
  'он', 'она', 'они', 'мы',
  'примерно', 'около', 'где-то', 'всего', 'сегодня', 'позавчера', 'вчера',
  'жұмсадым', 'жумсадым', 'төледім', 'толедим', 'алдым', 'сатып', 'бүгін',
  'бугин', 'кеше', 'үшін', 'ушин', 'мен',
  ...INCOME_VERBS,
]

const SPLIT_RE = /\s+(?:и|плюс|а также|потом)\s+|[,;]\s+/

// "1 500", "2,500", "1.000.000" -> одно число. Распознавание речи любит
// вставлять разделитель тысяч, а из-за него сумма читалась как дробь.
export function joinDigitGroups(text) {
  return text.replace(/(\d)(?:[\s  ]|[.,][\s  ]?)(?=\d{3}\b)/g, '$1')
}

function normalize(text) {
  return joinDigitGroups(text.toLowerCase().replace(/ё/g, 'е'))
    .replace(/[.!?]+$/g, '')
    .trim()
}

// \p{L} вместо диапазона а-я: иначе казахские ә, ө, ұ, ү, қ, ғ, ң, і
// считались бы разделителями и рвали слова на части.
function tokenize(text) {
  return text.split(/[^\p{L}\p{N}$€₽₸₴₾֏.,-]+/u).filter(Boolean)
}

function detectCurrency(tokens) {
  for (const t of tokens) {
    const bare = t.replace(/[.,]/g, '')
    if (CURRENCY_BY_WORD[bare]) return CURRENCY_BY_WORD[bare]
    for (const [word, code] of Object.entries(CURRENCY_BY_WORD)) {
      if (word.length > 2 && bare.startsWith(word)) return code
    }
  }
  return null
}

function detectDate(text, now = new Date()) {
  const d = new Date(now)
  d.setHours(12, 0, 0, 0)
  if (/позавчера|алдыңғы күні|алдынгы куни/.test(text)) d.setDate(d.getDate() - 2)
  else if (/вчера|кеше/.test(text)) d.setDate(d.getDate() - 1)
  else {
    const ago = text.match(/(\d+)\s+дн(?:я|ей|ь)\s+назад/)
    if (ago) d.setDate(d.getDate() - parseInt(ago[1], 10))
    else if (/на прошлой неделе/.test(text)) d.setDate(d.getDate() - 7)
    else return new Date(now)
  }
  return d
}

/** Ищет сумму. Приоритет у числа, рядом с которым названа валюта. */
function findAmount(tokens, opts) {
  const found = []
  let i = 0
  while (i < tokens.length) {
    if (isNumberWord(tokens[i], opts)) {
      const num = readNumber(tokens, i, opts)
      if (num && num.value > 0) {
        const after = tokens[num.next]
        const nearCurrency = after ? Boolean(detectCurrency([after])) : false
        found.push({ value: num.value, from: i, to: num.next, nearCurrency })
        i = num.next
        continue
      }
    }
    i++
  }
  if (!found.length) return null
  return found.find((f) => f.nearCurrency) || found[0]
}

function buildTitle(tokens, amount, opts) {
  const skip = new Set()
  if (amount) for (let i = amount.from; i < amount.to; i++) skip.add(i)
  const words = tokens.filter((t, i) => {
    if (skip.has(i)) return false
    if (detectCurrency([t])) return false
    if (NOISE_WORDS.some((w) => t === w || (w.length > 3 && t.startsWith(w)))) return false
    if (isNumberWord(t, opts)) return false
    return t.length > 1
  })
  const title = words.join(' ').trim()
  return title.charAt(0).toUpperCase() + title.slice(1)
}

/** Разбирает одну фразу без разделителей. */
export function parseOne(rawText, { defaultCurrency = 'KZT', now = new Date(), lang = 'ru-RU' } = {}) {
  const text = normalize(rawText)
  const tokens = tokenize(text)
  const numberOpts = { kazakh: lang.startsWith('kk') }
  const amount = findAmount(tokens, numberOpts)
  const isIncome = INCOME_WORDS.some((w) => text.includes(w))

  return {
    amount: amount ? Math.round(amount.value * 100) / 100 : null,
    currency: detectCurrency(tokens) || defaultCurrency,
    type: isIncome ? 'income' : 'expense',
    categoryId: guessCategory(text),
    title: buildTitle(tokens, amount, numberOpts) || null,
    note: rawText.trim(),
    date: detectDate(text, now).toISOString(),
  }
}

/**
 * Разбирает всю реплику. Если в ней несколько трат
 * ("кофе двести и такси четыреста"), вернёт несколько записей.
 */
export function parseSpeech(rawText, options = {}) {
  const text = rawText.trim()
  if (!text) return []

  const parts = joinDigitGroups(text).split(SPLIT_RE).map((p) => p.trim()).filter(Boolean)
  if (parts.length > 1) {
    const withAmount = parts.filter((p) => {
      const r = parseOne(p, options)
      return r.amount !== null
    })
    if (withAmount.length > 1) {
      return withAmount.map((p) => parseOne(p, options))
    }
  }
  return [parseOne(text, options)]
}
