import type { Session } from '@supabase/supabase-js'
import { supabase } from './supabase'

const returnKey = 'gather-auth-return'

export function permanentSession(session: Session | null) {
  return session && !session.user.is_anonymous ? session : null
}

export async function getSession() {
  const { data, error } = await supabase!.auth.getSession()
  if (error) throw error
  return permanentSession(data.session)
}

export function subscribeToAuth(callback: (session: Session | null) => void) {
  const { data } = supabase!.auth.onAuthStateChange((_event, session) => callback(permanentSession(session)))
  return () => data.subscription.unsubscribe()
}

export async function signInWithGoogle() {
  // Keep invitations separate from the OAuth response fragment.
  const path = window.location.pathname
  const invite = new URLSearchParams(window.location.hash.slice(1)).get('invite')
  sessionStorage.setItem(returnKey, JSON.stringify({ path, invite }))
  const { data, error: sessionError } = await supabase!.auth.getSession()
  if (sessionError) throw sessionError
  if (data.session?.user.is_anonymous) await signOut()
  const { error } = await supabase!.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo: `${window.location.origin}/` }
  })
  if (error) throw error
}

export async function signOut() {
  const { error } = await supabase!.auth.signOut({ scope: 'local' })
  if (error) throw error
}

export function readOAuthError() {
  const hash = new URLSearchParams(window.location.hash.slice(1))
  const query = new URLSearchParams(window.location.search)
  return hash.get('error_description') || query.get('error_description') || hash.get('error') || query.get('error') || ''
}

export function finishAuthRedirect(signedIn: boolean) {
  const hash = new URLSearchParams(window.location.hash.slice(1))
  const query = new URLSearchParams(window.location.search)
  if (['access_token', 'refresh_token', 'error', 'error_description'].some((key) => hash.has(key))) {
    window.history.replaceState({}, '', window.location.pathname + window.location.search)
  }
  for (const key of ['code', 'error', 'error_description', 'error_code']) query.delete(key)
  const search = query.toString()
  window.history.replaceState({}, '', window.location.pathname + (search ? `?${search}` : '') + window.location.hash)
  const pending = sessionStorage.getItem(returnKey)
  if (!pending) return
  if (signedIn) sessionStorage.removeItem(returnKey)
  try {
    const { path, invite } = JSON.parse(pending)
    if (path !== '/' && !/^\/lists\/[^/?#]+$/.test(path)) return
    window.history.replaceState({}, '', path + (typeof invite === 'string' ? `#invite=${encodeURIComponent(invite)}` : ''))
  } catch { /* Ignore obsolete or invalid stored navigation. */ }
}
