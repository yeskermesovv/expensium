import { useEffect, useRef, useState } from 'react'

// Проверяем не чаще раза в минуту: возврат в приложение бывает частым
const MIN_PAUSE = 60_000

/** Имя файла сборки: у него в имени хэш, значит новая выкладка — новое имя. */
const buildName = (src) => (src ? src.split('/').pop() : null)

const buildInPage = () =>
  buildName(document.querySelector('script[type="module"][src]')?.getAttribute('src'))

const buildInHtml = (html) => buildName(html.match(/src="([^"]*index-[^"]+\.js)"/)?.[1])

/**
 * Замечает выложенную новую версию. На iOS приложение с главного экрана живёт
 * в памяти неделями: навигации не происходит, и обновление само не приезжает.
 * Поэтому при каждом возврате спрашиваем страницу заново и сверяем имя сборки.
 */
export function useUpdate() {
  const [ready, setReady] = useState(false)
  const checkedAt = useRef(0)

  useEffect(() => {
    if (!import.meta.env.PROD) return
    const mine = buildInPage()
    if (!mine) return

    let alive = true

    const check = async () => {
      if (document.hidden || Date.now() - checkedAt.current < MIN_PAUSE) return
      checkedAt.current = Date.now()
      try {
        // nocache в адресе: по нему воркер пропускает запрос мимо своего кэша
        const res = await fetch(`${import.meta.env.BASE_URL}index.html?nocache=${Date.now()}`, {
          cache: 'no-store',
        })
        if (!res.ok) return
        const theirs = buildInHtml(await res.text())
        if (alive && theirs && theirs !== mine) setReady(true)
      } catch {
        // нет сети — спросим при следующем возврате
      }
    }

    check()
    document.addEventListener('visibilitychange', check)
    window.addEventListener('focus', check)
    return () => {
      alive = false
      document.removeEventListener('visibilitychange', check)
      window.removeEventListener('focus', check)
    }
  }, [])

  return ready
}
