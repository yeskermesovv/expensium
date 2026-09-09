import { useCallback, useEffect, useLayoutEffect, useState } from 'react'

// Шаги тура. target — селектор элемента, который подсвечиваем;
// null означает экран по центру, без привязки к интерфейсу.
const STEPS = [
  {
    target: null,
    title: 'Траты голосом',
    text: 'Тут не нужно заполнять форму. Скажите вслух, сколько и на что потратили, остальное приложение сделает само. Покажу за минуту.',
  },
  {
    target: '.mic',
    title: 'Главная кнопка',
    text: 'Нажмите и скажите обычную фразу: «кофе 2500» или «вчера три тысячи на аптеку». Сумма, категория и дата разберутся сами.',
  },
  {
    target: '.recorder__live',
    title: 'Что услышало приложение',
    text: 'Здесь появляется расслышанная фраза. Если распознало не то, сразу видно — можно поправить запись или сказать заново.',
  },
  {
    target: '.manual',
    title: 'Можно и текстом',
    text: 'В шумном месте или когда говорить неудобно, напишите то же самое руками. Разбирается по тем же правилам.',
  },
  {
    target: '.content',
    title: 'Список и итоги',
    text: 'Сверху суммы за период и разбивка по категориям, ниже сами записи. Тапните по записи, чтобы поправить сумму или категорию.',
  },
  {
    target: '.tabs',
    title: 'Период',
    text: 'День, неделя, месяц или всё время. Переключение меняет и итоги, и список.',
  },
  {
    target: '.icon-btn',
    title: 'Настройки',
    text: 'Валюта, язык распознавания, бюджет на месяц, выгрузка в CSV и вход через Google для синхронизации между устройствами.',
  },
  {
    target: null,
    title: 'Готово',
    text: 'Нажмите микрофон и скажите первую трату. Повторить обучение можно в настройках.',
  },
]

const TIP_WIDTH = 300
const GAP = 12

// Прямоугольник элемента и место для подсказки: над элементом, если тот
// в нижней половине экрана, иначе под ним. По горизонтали держим в пределах окна.
function measure(selector) {
  const el = selector ? document.querySelector(selector) : null
  if (!el) return null

  const r = el.getBoundingClientRect()
  if (r.width === 0 && r.height === 0) return null

  const vw = window.innerWidth
  const vh = window.innerHeight
  const width = Math.min(TIP_WIDTH, vw - GAP * 2)
  const above = r.top + r.height / 2 > vh / 2

  return {
    hole: { top: r.top, left: r.left, width: r.width, height: r.height },
    tip: {
      width,
      left: Math.min(Math.max(r.left, GAP), vw - width - GAP),
      ...(above ? { bottom: vh - r.top + GAP } : { top: r.bottom + GAP }),
    },
  }
}

export default function Tutorial({ onClose }) {
  const [step, setStep] = useState(0)
  const [spot, setSpot] = useState(null)

  const current = STEPS[step]
  const last = step === STEPS.length - 1

  // Позицию считаем после отрисовки и пересчитываем при скролле и повороте экрана
  useLayoutEffect(() => {
    const update = () => setSpot(measure(current.target))
    update()
    window.addEventListener('resize', update)
    window.addEventListener('scroll', update, true)
    return () => {
      window.removeEventListener('resize', update)
      window.removeEventListener('scroll', update, true)
    }
  }, [current.target])

  const next = useCallback(() => {
    if (last) onClose()
    else setStep((s) => s + 1)
  }, [last, onClose])

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') onClose()
      if (e.key === 'ArrowRight' || e.key === 'Enter') next()
      if (e.key === 'ArrowLeft') setStep((s) => Math.max(0, s - 1))
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [next, onClose])

  const controls = (
    <div className="tour__controls">
      <button className="tour__skip" onClick={onClose}>
        {last ? 'Закрыть' : 'Пропустить'}
      </button>
      <span className="tour__dots" aria-hidden="true">
        {STEPS.map((s, i) => (
          <i key={s.title} className={`tour__dot ${i === step ? 'tour__dot--on' : ''}`} />
        ))}
      </span>
      <button className="tour__next" onClick={next}>
        {last ? 'Начать' : 'Дальше'}
      </button>
    </div>
  )

  return (
    <div className="tour" role="dialog" aria-modal="true" aria-label="Обучение">
      {spot ? (
        <>
          {/* Затемнение всего экрана делает тень этого блока, поэтому дырка
              совпадает с элементом до пикселя и не требует четырёх накладок */}
          <div
            className="tour__hole"
            style={{
              top: spot.hole.top,
              left: spot.hole.left,
              width: spot.hole.width,
              height: spot.hole.height,
            }}
          />
          <div className="tour__tip" style={spot.tip}>
            <h3 className="tour__title">{current.title}</h3>
            <p className="tour__text">{current.text}</p>
            {controls}
          </div>
        </>
      ) : (
        <div className="tour__center">
          <div className="tour__tip tour__tip--wide">
            <h3 className="tour__title">{current.title}</h3>
            <p className="tour__text">{current.text}</p>
            {controls}
          </div>
        </div>
      )}
    </div>
  )
}
