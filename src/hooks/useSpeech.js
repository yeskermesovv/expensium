import { useCallback, useEffect, useRef, useState } from 'react'

const SpeechRecognition =
  typeof window !== 'undefined' &&
  (window.SpeechRecognition || window.webkitSpeechRecognition)

const ERROR_MESSAGES = {
  'not-allowed': 'Нет доступа к микрофону. Разрешите его в настройках браузера.',
  'service-not-allowed': 'Браузер запретил распознавание речи.',
  'audio-capture': 'Микрофон сейчас недоступен, попробуйте ещё раз.',
  'no-speech': 'Ничего не расслышал, попробуйте ещё раз.',
  network: 'Распознаванию нужен интернет.',
  aborted: null,
}

/**
 * Диктофон на Web Speech API. Само распознавание идёт не на устройстве:
 * браузер отправляет звук на серверы Google или Apple, поэтому без сети
 * оно отваливается с ошибкой network. Остальное приложение работает офлайн.
 * onResult вызывается с окончательной фразой.
 *
 * Распознаватель создаётся заново на каждый запуск: на iOS после сворачивания
 * приложения система отбирает у старого экземпляра аудиосессию, и он больше
 * не слышит микрофон, пока страницу не перезагрузят.
 */
export function useSpeech({ lang = 'ru-RU', onResult } = {}) {
  const [listening, setListening] = useState(false)
  const [interim, setInterim] = useState('')
  const [error, setError] = useState(null)
  const recRef = useRef(null)
  const onResultRef = useRef(onResult)
  onResultRef.current = onResult

  // Глушим текущий распознаватель и отцепляем обработчики,
  // чтобы его запоздалые события не сбили состояние следующего
  const release = useCallback(() => {
    const rec = recRef.current
    if (!rec) return
    recRef.current = null
    rec.onresult = rec.onerror = rec.onend = null
    try { rec.abort() } catch {}
    setListening(false)
    setInterim('')
  }, [])

  const start = useCallback(() => {
    if (!SpeechRecognition) return
    release()
    setError(null)

    const rec = new SpeechRecognition()
    rec.lang = lang
    rec.continuous = true
    rec.interimResults = true

    rec.onresult = (event) => {
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
      const message = ERROR_MESSAGES[event.error]
      if (message !== null) {
        setError(message || `Ошибка распознавания: ${event.error}`)
      }
    }

    rec.onend = () => {
      if (recRef.current === rec) recRef.current = null
      setListening(false)
      setInterim('')
    }

    recRef.current = rec
    try {
      rec.start()
      setListening(true)
    } catch {
      release()
      setError('Не удалось включить микрофон, попробуйте ещё раз.')
    }
  }, [lang, release])

  const stop = useCallback(() => {
    // stop, а не abort: пусть успеет прийти последняя фраза, onend приберёт остальное
    try { recRef.current?.stop() } catch {}
    setListening(false)
  }, [])

  const toggle = useCallback(() => {
    if (listening) stop()
    else start()
  }, [listening, start, stop])

  // Приложение свернули — отпускаем микрофон сами, не дожидаясь, пока iOS
  // оборвёт сессию и оставит распознаватель в подвешенном состоянии
  useEffect(() => {
    const onVisibility = () => {
      if (document.visibilityState === 'hidden') release()
    }
    document.addEventListener('visibilitychange', onVisibility)
    window.addEventListener('pagehide', release)
    return () => {
      document.removeEventListener('visibilitychange', onVisibility)
      window.removeEventListener('pagehide', release)
      release()
    }
  }, [release])

  return { supported: Boolean(SpeechRecognition), listening, interim, error, start, stop, toggle, setError }
}
