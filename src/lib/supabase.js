// Клиент Supabase. Адрес проекта и публичный ключ подставляются при сборке.
// Публичный ключ не секрет: доступ к строкам ограничивает политика RLS,
// описанная в supabase/schema.sql.

import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

/** Без настроек приложение работает как раньше: только localStorage. */
export const isCloudConfigured = Boolean(url && anonKey)

export const supabase = isCloudConfigured
  ? createClient(url, anonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    })
  : null

export async function signInWithGoogle() {
  if (!supabase) return
  // Возвращаемся на ту же страницу: адрес нужно добавить в Redirect URLs проекта
  const redirectTo = window.location.origin + window.location.pathname
  const { error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo },
  })
  if (error) throw error
}

export async function signOut() {
  if (!supabase) return
  await supabase.auth.signOut()
}
