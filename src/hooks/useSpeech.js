import { useCallback, useEffect, useRef, useState } from 'react'

const SpeechRecognition =
  typeof window !== 'undefined' &&
  (window.SpeechRecognition || window.webkitSpeechRecognition)

// Сколько ждём первых слов после возврата, прежде чем признать микрофон отключённым
const WAKE_TIMEOUT = 6000

const DEAD_MIC =
  'Не слышу звука. Похоже, iOS отключил микрофон, когда приложение сворачивали: ' +
  'смахните его в переключателе приложений и откройте заново.'

/**
 * Диктофон на Web Speech API. Само распознавание идёт не на устройстве:
 * браузер отправляет звук на серверы Google или Apple, поэтому без сети
 * оно отваливается с ошибкой network. Остальное приложение работает офлайн.
 * onResult вызывается с окончательной фразой.
 *
 * На iOS приложение с главного экрана, однажды включившее микрофон, после
 * сворачивания его теряет: распознавание запускается, но звука не получает,
 * и не помогает даже перезагрузка страницы, только перезапуск приложения.
 * В обычной вкладке Safari такого нет. Поэтому после возврата пробуем
 * разбудить микрофон, запросив его через getUserMedia на время записи,
 * а если слова так и не пошли — подсказываем перезапустить приложение.
 */
export function useSpeech({ lang = 'ru-RU', onResult } = {}) {
  const [listening, setListening] = useState(false)
  const [interim, setInterim] = useState('')
  const [error, setError] = useState(null)
  const recRef = useRef(null)
  const startedRef = useRef(false)
  // stale — микрофон включали, а потом приложение с главного экрана сворачивали
  const staleRef = useRef(false)
  // Будильник: поток getUserMedia, таймер ожидания первых слов и номер попытки,
  // по которому опоздавший поток понимает, что он уже не нужен
  const streamRef = useRef(null)
  const timerRef = useRef(null)
  const wakeIdRef = useRef(0)
  const onResultRef = useRef(onResult)
  onResultRef.current = onResult

  const unwake = useCallback(() => {
    wakeIdRef.current++
    clearTimeout(timerRef.current)
    streamRef.current?.getTracks().forEach((track) => track.stop())
    streamRef.current = null
  }, [])

  useEffect(() => {
    if (!SpeechRecognition) return
    const rec = new SpeechRecognition()
    rec.lang = lang
    rec.continuous = true
    rec.interimResults = true

    rec.onresult = (event) => {
      // Слова пошли — микрофон жив, ждать больше нечего
      if (staleRef.current) {
        staleRef.current = false
        clearTimeout(timerRef.current)
      }
      let live = ''
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i]
        if (result.isFinal) {
          const text = result[0].transcript.trim()
          if (text) onResultRef.current?.(text)
        } else {
          live += result[0].transcript
        }
      }
      setInterim(live)
    }

    rec.onerror = (event) => {
      const messages = {
        'not-allowed': 'Нет доступа к микрофону. Разрешите его в настройках браузера.',
        'service-not-allowed': 'Браузер запретил распознавание речи.',
        'no-speech': 'Ничего не расслышал, попробуйте ещё раз.',
        network: 'Распознаванию нужен интернет.',
        aborted: null,
      }
      const message = messages[event.error]
      // Пока пользователь сам не включил запись, молчим про ошибки микрофона
      if (startedRef.current && message !== null) {
        setError(message || `Ошибка распознавания: ${event.error}`)
      }
      setListening(false)
    }

    rec.onend = () => {
      unwake()
      setListening(false)
      setInterim('')
    }

    recRef.current = rec
    return () => {
      rec.onresult = rec.onerror = rec.onend = null
      try { rec.abort() } catch {}
    }
  }, [lang, unwake])

  // Приложение с главного экрана свернули — останавливаем запись и помечаем,
  // что микрофон после возврата придётся будить
  useEffect(() => {
    const onVisibility = () => {
      // navigator.standalone есть только в iOS: true у приложения с главного экрана
      if (document.visibilityState !== 'hidden' || navigator.standalone !== true) return
      try { recRef.current?.abort() } catch {}
      unwake()
      if (startedRef.current) staleRef.current = true
    }
    document.addEventListener('visibilitychange', onVisibility)
    return () => {
      document.removeEventListener('visibilitychange', onVisibility)
      unwake()
    }
  }, [unwake])

  // Держим микрофон открытым через getUserMedia, пока идёт запись: это может
  // заново включить звук, который iOS отключил. Не пошли слова — подсказываем
  const wake = useCallback(() => {
    const id = wakeIdRef.current
    navigator.mediaDevices?.getUserMedia({ audio: true })
      .then((stream) => {
        if (id === wakeIdRef.current) streamRef.current = stream
        else stream.getTracks().forEach((track) => track.stop())
      })
      .catch(() => {})
    timerRef.current = setTimeout(() => {
      try { recRef.current?.abort() } catch {}
      unwake()
      setListening(false)
      setError(DEAD_MIC)
    }, WAKE_TIMEOUT)
  }, [unwake])

  const start = useCallback(() => {
    const rec = recRef.current
    if (!rec) return
    setError(null)
    setInterim('')
    try {
      rec.start()
      startedRef.current = true
      setListening(true)
      if (staleRef.current) wake()
    } catch {
      // start() на уже запущенном распознавании кидает ошибку — просто игнорируем
    }
  }, [wake])

  const stop = useCallback(() => {
    try { recRef.current?.stop() } catch {}
    unwake()
    setListening(false)
  }, [unwake])

  const toggle = useCallback(() => {
    if (listening) stop()
    else start()
  }, [listening, start, stop])

  return { supported: Boolean(SpeechRecognition), listening, interim, error, start, stop, toggle, setError }
}
