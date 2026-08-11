import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import App from './App'

vi.mock('./lib/shopping', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./lib/shopping')>()
  return { ...actual, getLists: vi.fn().mockResolvedValue([]) }
})

describe('App dashboard', () => {
  it('shows the list creation interface', () => {
    render(<App />)
    expect(screen.getByRole('heading', { name: 'Your lists' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Create' })).toBeInTheDocument()
  })
})
