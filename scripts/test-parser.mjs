// Проверка разбора фраз: node scripts/test-parser.mjs
import { parseSpeech, parseOne } from '../src/lib/parse.js'

const NOW = new Date('2026-09-09T15:00:00')
const opts = { now: NOW }
const KK = { lang: 'kk-KZ' } // казахские числительные включаются вместе с языком

const cases = [
  ['потратил 500 рублей на кофе', { amount: 500, categoryId: 'cafe', currency: 'RUB' }],
  ['пятьсот рублей такси', { amount: 500, categoryId: 'transport' }],
  ['тысяча двести на продукты', { amount: 1200, categoryId: 'products' }],
  ['две тысячи пятьсот за аренду', { amount: 2500, categoryId: 'home' }],
  ['полторы тысячи в аптеке', { amount: 1500, categoryId: 'health' }],
  ['сто двадцать три рубля', { amount: 123, categoryId: 'other' }],
  ['1 500 на бензин', { amount: 1500, categoryId: 'transport' }],
  ['500к на квартиру', { amount: 500000, categoryId: 'home' }],
  ['двадцать пять тысяч триста за ноутбук', { amount: 25300, categoryId: 'tech' }],
  ['20 долларов на подписку', { amount: 20, currency: 'USD', categoryId: 'connection' }],
  ['15 евро кино', { amount: 15, currency: 'EUR', categoryId: 'fun' }],
  ['получил зарплату 90 тысяч', { amount: 90000, type: 'income', title: 'Зарплату' }],
  ['вернули 300 рублей кэшбэка', { amount: 300, type: 'income' }],
  ['стрижка 800', { amount: 800, categoryId: 'beauty' }],
  ['корм коту 450 рублей', { amount: 450, categoryId: 'pets' }],
  ['без суммы просто такси', { amount: null, categoryId: 'transport' }],
  ['девяносто девять рублей подписка', { amount: 99, categoryId: 'connection' }],
  ['1500', { amount: 1500 }],
  ['3 тыс на курсы английского', { amount: 3000, categoryId: 'education' }],

  // Разделитель тысяч от распознавания речи: это не дробь
  ['кафе 2,500', { amount: 2500, categoryId: 'cafe' }],
  ['такси 2.500', { amount: 2500, categoryId: 'transport' }],
  ['продукты 2, 500', { amount: 2500, categoryId: 'products' }],
  ['аренда 1.000.000 тенге', { amount: 1000000, currency: 'KZT', categoryId: 'home' }],
  ['бензин 12 500 тг', { amount: 12500, currency: 'KZT', categoryId: 'transport' }],
  ['кофе 1,5 доллара', { amount: 1.5, currency: 'USD', categoryId: 'cafe' }],
  ['такси 10,50', { amount: 10.5, categoryId: 'transport' }],

  // Тенге и казахская речь
  ['1500 тенге на кофе', { amount: 1500, currency: 'KZT', categoryId: 'cafe' }],
  ['потратил пять тысяч на продукты', { amount: 5000, currency: 'KZT', categoryId: 'products' }],
  ['такси 2500 тг', { amount: 2500, currency: 'KZT', categoryId: 'transport' }],
  ['он потратил тысячу тенге', { amount: 1000, currency: 'KZT' }],
  ['екі мың теңге такси', { amount: 2000, currency: 'KZT', categoryId: 'transport' }, KK],
  ['жүз мың теңге пәтер', { amount: 100000, currency: 'KZT', categoryId: 'home' }, KK],
  ['екі жүз елу теңге нан', { amount: 250, currency: 'KZT', categoryId: 'products' }, KK],
  ['он бес мың теңге дәріхана', { amount: 15000, categoryId: 'health' }, KK],
  ['кеше алты мың теңге жұмсадым', { amount: 6000, currency: 'KZT' }, KK],
]

let failed = 0
for (const [text, want, extra] of cases) {
  const got = parseOne(text, { ...opts, ...extra })
  const bad = Object.entries(want).filter(([k, v]) => got[k] !== v)
  if (bad.length) {
    failed++
    console.log(`FAIL  "${text}"`)
    for (const [k, v] of bad) console.log(`        ${k}: ждали ${v}, получили ${got[k]}`)
  } else {
    console.log(`ok    "${text}" -> ${got.amount} ${got.currency} / ${got.categoryId} / ${got.title || '-'}`)
  }
}

// Даты
const yest = parseOne('вчера 300 рублей на обед', opts)
const yestDay = new Date(yest.date).getDate()
if (yestDay !== 8) { failed++; console.log(`FAIL  дата "вчера": ждали 8, получили ${yestDay}`) }
else console.log('ok    "вчера" -> 8 сентября')

const kk = parseOne('кеше алты мың теңге', { ...opts, lang: 'kk-KZ' })
const kkDay = new Date(kk.date).getDate()
if (kkDay !== 8) { failed++; console.log(`FAIL  дата "кеше": ждали 8, получили ${kkDay}`) }
else console.log('ok    "кеше" -> 8 сентября')

// Несколько трат в одной фразе
const notSplit = parseSpeech('кафе 2, 500', opts)
if (notSplit.length !== 1 || notSplit[0].amount !== 2500) {
  failed++
  console.log('FAIL  "кафе 2, 500" развалилось на части:', JSON.stringify(notSplit.map((m) => m.amount)))
} else {
  console.log('ok    "кафе 2, 500" остаётся одной записью на 2500')
}

const multi = parseSpeech('кофе двести рублей и такси четыреста', opts)
if (multi.length !== 2 || multi[0].amount !== 200 || multi[1].amount !== 400) {
  failed++
  console.log('FAIL  две траты в одной фразе:', JSON.stringify(multi.map((m) => [m.amount, m.categoryId])))
} else {
  console.log('ok    "кофе 200 и такси 400" -> две записи')
}

const single = parseSpeech('тысяча двести на продукты', opts)
if (single.length !== 1) { failed++; console.log('FAIL  одна фраза разбилась на несколько') }
else console.log('ok    одиночная фраза остаётся одной записью')

console.log(failed ? `\n${failed} провалено` : '\nвсе проверки прошли')
process.exit(failed ? 1 : 0)
