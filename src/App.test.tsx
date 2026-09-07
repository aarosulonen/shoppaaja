import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Session } from '@supabase/supabase-js'
import App from './App'

const mocks = vi.hoisted(() => ({
  getSession: vi.fn(), subscribeToAuth: vi.fn(), signInWithGoogle: vi.fn(), signOut: vi.fn(),
  getLists: vi.fn(), getList: vi.fn(), getItems: vi.fn(), joinList: vi.fn(), subscribeToList: vi.fn(),
  unsubscribe: vi.fn(), authUnsubscribe: vi.fn()
}))
vi.mock('./lib/supabase', () => ({ isSupabaseConfigured: true }))
vi.mock('./lib/auth', async (importOriginal) => ({
  ...await importOriginal<typeof import('./lib/auth')>(),
  getSession: mocks.getSession, subscribeToAuth: mocks.subscribeToAuth,
  signInWithGoogle: mocks.signInWithGoogle, signOut: mocks.signOut
}))
vi.mock('./lib/shopping', () => ({ ...mocks }))
const session = { user: { id: 'user-a', email: 'a@example.com', is_anonymous: false } } as Session
let authChanged: (session: Session | null) => void
beforeEach(() => {
  vi.clearAllMocks()
  window.history.replaceState({}, '', '/')
  sessionStorage.clear()
  mocks.getSession.mockResolvedValue(session)
  mocks.getLists.mockResolvedValue([])
  mocks.getList.mockResolvedValue({ id: 'list-a', name: 'Groceries', role: 'editor' })
  mocks.getItems.mockResolvedValue([])
  mocks.joinList.mockResolvedValue('list-a')
  mocks.signInWithGoogle.mockResolvedValue(undefined)
  mocks.signOut.mockResolvedValue(undefined)
  mocks.subscribeToAuth.mockImplementation((callback) => { authChanged = callback; return mocks.authUnsubscribe })
  mocks.subscribeToList.mockReturnValue({ unsubscribe: mocks.unsubscribe })
})

describe('authenticated app', () => {
  it('waits for the session before loading lists', async () => {
    let resolve!: (value: Session) => void
    mocks.getSession.mockReturnValue(new Promise((done) => { resolve = done }))
    render(<App />)
    expect(screen.getByRole('status')).toBeInTheDocument()
    expect(mocks.getLists).not.toHaveBeenCalled()
    await act(async () => resolve(session))
    expect(await screen.findByRole('heading', { name: 'Your lists' })).toBeInTheDocument()
  })

  it('offers login and reports provider errors without loading lists', async () => {
    mocks.getSession.mockResolvedValue(null)
    mocks.signInWithGoogle.mockRejectedValue(new Error('Google unavailable'))
    render(<App />)
    fireEvent.click(await screen.findByRole('button', { name: 'Continue with Google' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Google unavailable')
    expect(mocks.getLists).not.toHaveBeenCalled()
  })

  it('clears the previous account view on account change and sign-out', async () => {
    mocks.getLists.mockResolvedValueOnce([{ id: 'list-a', name: 'Private groceries', role: 'owner' }])
    render(<App />)
    await screen.findByText('Private groceries')
    act(() => authChanged({ user: { id: 'user-b', email: 'b@example.com' } } as Session))
    await screen.findByText('Your first list starts here')
    expect(screen.queryByText('Private groceries')).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Sign out' }))
    await screen.findByRole('button', { name: 'Continue with Google' })
    expect(mocks.signOut).toHaveBeenCalledOnce()
    expect(screen.queryByRole('heading', { name: 'Your lists' })).not.toBeInTheDocument()
  })

  it('restores an invitation after OAuth, joins, and cleans subscriptions', async () => {
    sessionStorage.setItem('gather-auth-return', JSON.stringify({ path: '/lists/list-a', invite: 'token' }))
    const view = render(<App />)
    await screen.findByRole('heading', { name: 'Groceries' })
    expect(mocks.joinList).toHaveBeenCalledWith('token')
    expect(window.location.pathname).toBe('/lists/list-a')
    expect(window.location.hash).toBe('')
    act(() => authChanged(null))
    expect(mocks.unsubscribe).toHaveBeenCalled()
    view.unmount()
    expect(mocks.authUnsubscribe).toHaveBeenCalled()
  })

  it('refreshes lists on focus and reconnection', async () => {
    render(<App />)
    await screen.findByRole('heading', { name: 'Your lists' })
    await waitFor(() => expect(mocks.getLists).toHaveBeenCalledTimes(1))
    fireEvent.focus(window)
    await waitFor(() => expect(mocks.getLists).toHaveBeenCalledTimes(2))
    fireEvent.online(window)
    await waitFor(() => expect(mocks.getLists).toHaveBeenCalledTimes(3))
  })

  it('shows OAuth cancellation and preserves the invitation for retry', async () => {
    mocks.getSession.mockResolvedValue(null)
    sessionStorage.setItem('gather-auth-return', JSON.stringify({ path: '/lists/list-a', invite: 'token' }))
    window.history.replaceState({}, '', '/#error=access_denied&error_description=Login+cancelled')
    render(<App />)
    expect(await screen.findByRole('alert')).toHaveTextContent('Login cancelled')
    expect(window.location.pathname).toBe('/lists/list-a')
    expect(window.location.hash).toBe('#invite=token')
    expect(mocks.joinList).not.toHaveBeenCalled()
  })

  it('does not navigate when an invitation finishes after sign-out', async () => {
    let resolve!: (value: string) => void
    mocks.joinList.mockReturnValue(new Promise((done) => { resolve = done }))
    window.history.replaceState({}, '', '/lists/list-a#invite=token')
    render(<App />)
    await waitFor(() => expect(mocks.joinList).toHaveBeenCalled())
    fireEvent.click(screen.getByRole('button', { name: 'Sign out' }))
    await screen.findByRole('button', { name: 'Continue with Google' })
    await act(async () => resolve('list-b'))
    expect(window.location.pathname).toBe('/')
    expect(mocks.getItems).not.toHaveBeenCalled()
  })

  it('shows invalid invitations without subscribing to a list', async () => {
    mocks.joinList.mockRejectedValue(new Error('Invalid or expired invite link'))
    window.history.replaceState({}, '', '/lists/list-a#invite=invalid')
    render(<App />)
    await screen.findByText('Invalid or expired invite link')
    expect(mocks.subscribeToList).not.toHaveBeenCalled()
  })
})
