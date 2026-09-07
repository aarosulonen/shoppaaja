import { beforeEach, describe, expect, it, vi } from 'vitest'
import { finishAuthRedirect, getSession, signInWithGoogle, signOut, subscribeToAuth } from './auth'
import { requireSession } from './supabase'

const auth = vi.hoisted(() => {
  vi.stubEnv('VITE_SUPABASE_URL', 'https://test.supabase.co')
  vi.stubEnv('VITE_SUPABASE_ANON_KEY', 'test-publishable-key')
  return { getSession: vi.fn(), signOut: vi.fn(), signInWithOAuth: vi.fn(), onAuthStateChange: vi.fn() }
})
vi.mock('@supabase/supabase-js', () => ({ createClient: () => ({ auth }) }))

beforeEach(() => {
  vi.clearAllMocks()
  sessionStorage.clear()
  window.history.replaceState({}, '', '/')
  auth.getSession.mockResolvedValue({ data: { session: null }, error: null })
  auth.signOut.mockResolvedValue({ error: null })
  auth.signInWithOAuth.mockResolvedValue({ error: null })
})

describe('Google authentication', () => {
  it('rejects guest sessions and clears them before Google sign-in', async () => {
    auth.getSession.mockResolvedValue({ data: { session: { user: { is_anonymous: true } } }, error: null })
    expect(await getSession()).toBeNull()
    await expect(requireSession()).rejects.toThrow('Sign in with Google')
    await signInWithGoogle()
    expect(auth.signOut).toHaveBeenCalledWith({ scope: 'local' })
    expect(auth.signInWithOAuth).toHaveBeenCalledWith({ provider: 'google', options: { redirectTo: `${window.location.origin}/` } })
    expect(auth.signOut.mock.invocationCallOrder[0]).toBeLessThan(auth.signInWithOAuth.mock.invocationCallOrder[0])
  })

  it('rejects missing sessions without creating a guest', async () => {
    await expect(requireSession()).rejects.toThrow('Sign in with Google')
  })

  it('preserves invite navigation and removes OAuth tokens', async () => {
    window.history.replaceState({}, '', '/lists/abc#invite=secret')
    await signInWithGoogle()
    window.history.replaceState({}, '', '/#access_token=token&refresh_token=refresh')
    finishAuthRedirect(true)
    expect(window.location.pathname + window.location.hash).toBe('/lists/abc#invite=secret')
    expect(sessionStorage.getItem('gather-auth-return')).toBeNull()
  })

  it('does not restore external redirect paths', () => {
    sessionStorage.setItem('gather-auth-return', JSON.stringify({ path: '//evil.example' }))
    finishAuthRedirect(true)
    expect(window.location.pathname).toBe('/')
  })

  it('surfaces sign-out failures', async () => {
    auth.signOut.mockResolvedValue({ error: new Error('Sign-out failed') })
    await expect(signOut()).rejects.toThrow('Sign-out failed')
  })

  it('filters anonymous auth events and unsubscribes', () => {
    const unsubscribe = vi.fn()
    auth.onAuthStateChange.mockReturnValue({ data: { subscription: { unsubscribe } } })
    const callback = vi.fn()
    const cleanup = subscribeToAuth(callback)
    auth.onAuthStateChange.mock.calls[0][0]('SIGNED_IN', { user: { is_anonymous: true } })
    expect(callback).toHaveBeenCalledWith(null)
    cleanup()
    expect(unsubscribe).toHaveBeenCalledOnce()
  })
})
