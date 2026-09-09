import { useCallback, useEffect, useRef, useState } from 'react'
import { supabase, isCloudConfigured, signInWithGoogle, signOut } from '../lib/supabase.js'
import { syncEntries } from '../lib/sync.js'

const syncKey = (userId) => `voice-expenses:synced-at:${userId}`
const PULL_INTERVAL = 60_000

/**
 * Держит сессию Google и синхронизацию с облаком.
 * Записи остаются в localStorage, поэтому без сети и без входа
 * приложение работает как обычно.
 */
export function useCloud({ entries, onMerged }) {
  const [user, setUser] = useState(null)
  const [status, setStatus] = useState(isCloudConfigured ? 'idle' : 'off')
  const [error, setError] = useState(null)

  const entriesRef = useRef(entries)
  entriesRef.current = entries
  const lastSyncRef = useRef(null)
  const runningRef = useRef(false)
  const onMergedRef = useRef(onMerged)
  onMergedRef.current = onMerged

  useEffect(() => {
    if (!supabase) return
    supabase.auth.getSession().then(({ data }) => setUser(data.session?.user ?? null))
    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
    })
    return () => data.subscription.unsubscribe()
  }, [])

  // У каждого аккаунта своя отметка последней синхронизации
  useEffect(() => {
    lastSyncRef.current = user ? localStorage.getItem(syncKey(user.id)) : null
  }, [user])

  const syncNow = useCallback(async () => {
    if (!supabase || !user || runningRef.current) return
    runningRef.current = true
    setStatus('syncing')
    setError(null)
    try {
      const result = await syncEntries(entriesRef.current, {
        userId: user.id,
        lastSyncAt: lastSyncRef.current,
      })
      lastSyncRef.current = result.syncedAt
      localStorage.setItem(syncKey(user.id), result.syncedAt)
      onMergedRef.current(result.entries)
      setStatus('ok')
    } catch (e) {
      const offline = !navigator.onLine
      setStatus(offline ? 'offline' : 'error')
      setError(
        offline
          ? 'Нет сети, записи уедут в облако позже'
          : 'Облако не отвечает. Возможно, проект Supabase уснул — разбудите его в панели',
      )
      console.warn('синхронизация не прошла', e)
    } finally {
      runningRef.current = false
    }
  }, [user])

  // Появились несинхронизированные правки — отправляем их с небольшой паузой
  useEffect(() => {
    if (!user) return
    const dirty = entries.some((e) => !lastSyncRef.current || e.updatedAt > lastSyncRef.current)
    if (!dirty) return
    const timer = setTimeout(syncNow, 1500)
    return () => clearTimeout(timer)
  }, [entries, user, syncNow])

  // Забираем чужие правки: при входе, по таймеру, при возврате в окно и при появлении сети
  useEffect(() => {
    if (!user) return
    syncNow()
    const timer = setInterval(syncNow, PULL_INTERVAL)
    window.addEventListener('online', syncNow)
    window.addEventListener('focus', syncNow)
    return () => {
      clearInterval(timer)
      window.removeEventListener('online', syncNow)
      window.removeEventListener('focus', syncNow)
    }
  }, [user, syncNow])

  const signIn = useCallback(async () => {
    try {
      await signInWithGoogle()
    } catch (e) {
      setStatus('error')
      setError('Не получилось открыть вход через Google')
      console.warn('вход не удался', e)
    }
  }, [])

  const leave = useCallback(async () => {
    await signOut()
    setStatus('idle')
    setError(null)
  }, [])

  return {
    configured: isCloudConfigured,
    user,
    status,
    error,
    signIn,
    signOut: leave,
    syncNow,
  }
}
