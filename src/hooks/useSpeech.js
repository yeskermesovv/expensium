import { useCallback, useEffect, useRef, useState } from 'react'

const SpeechRecognition =
  typeof window !== 'undefined' &&
  (window.SpeechRecognition || window.webkitSpeechRecognition)

/**
 * Диктофон на Web Speech API: распознаёт речь прямо в браузере, без сервера.
 * onResult вызывается с окончательной фразой.
 */
export function useSpeech({ lang = 'ru-RU', onResult } = {}) {
  const [listening, setListening] = useState(false)
  const [interim, setInterim] = useState('')
  const [error, setError] = useState(null)
  const recRef = useRef(null)
  const startedRef = useRef(false)
  const onResultRef = useRef(onResult)
  onResultRef.current = onResult

  useEffect(() => {
    if (!SpeechRecognition) return
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
      setListening(false)
      setInterim('')
    }

    recRef.current = rec
    return () => {
      rec.onresult = rec.onerror = rec.onend = null
      try { rec.abort() } catch {}
    }
  }, [lang])

  const start = useCallback(() => {
    const rec = recRef.current
    if (!rec) return
    setError(null)
    setInterim('')
    try {
      rec.start()
      startedRef.current = true
      setListening(true)
    } catch {
      // start() на уже запущенном распознавании кидает ошибку — просто игнорируем
    }
  }, [])

  const stop = useCallback(() => {
    try { recRef.current?.stop() } catch {}
    setListening(false)
  }, [])

  const toggle = useCallback(() => {
    if (listening) stop()
    else start()
  }, [listening, start, stop])

  return { supported: Boolean(SpeechRecognition), listening, interim, error, start, stop, toggle, setError }
}
