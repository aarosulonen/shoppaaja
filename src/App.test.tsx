import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import App from './App'

const shoppingMocks = vi.hoisted(() => ({
  addItem: vi.fn().mockResolvedValue(undefined),
  clearBought: vi.fn().mockResolvedValue(undefined),
  createList: vi.fn().mockResolvedValue({ id: 'list-1', invite_token: 'invite' }),
  deleteItem: vi.fn().mockResolvedValue(undefined),
  deleteList: vi.fn().mockResolvedValue(undefined),
  getItems: vi.fn().mockResolvedValue([]),
  getList: vi.fn().mockResolvedValue({ id: 'list-1', name: 'Groceries', created_at: '', updated_at: '', role: 'owner' }),
  getLists: vi.fn().mockResolvedValue([]),
  joinList: vi.fn().mockResolvedValue('list-1'),
  renameList: vi.fn().mockResolvedValue(undefined),
  subscribeToList: vi.fn(() => ({ unsubscribe: vi.fn() })),
  updateItem: vi.fn().mockResolvedValue(undefined)
}))

vi.mock('./lib/shopping', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./lib/shopping')>()
  return { ...actual, ...shoppingMocks }
})

vi.mock('./lib/supabase', () => ({
  isSupabaseConfigured: true,
  supabase: null
}))

describe('App dashboard', () => {
  beforeEach(() => {
    window.history.replaceState({}, '', '/')
    shoppingMocks.getLists.mockResolvedValue([])
    shoppingMocks.getList.mockResolvedValue({ id: 'list-1', name: 'Groceries', created_at: '', updated_at: '', role: 'owner' })
    shoppingMocks.getItems.mockResolvedValue([])
  })

  it('shows the list creation interface', () => {
    render(<App />)
    expect(screen.getByRole('heading', { name: 'Your lists' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Create' })).toBeInTheDocument()
  })

  it('refreshes list items after deleting an item', async () => {
    shoppingMocks.getItems
      .mockResolvedValueOnce([{ id: 'item-1', list_id: 'list-1', name: 'Milk', quantity: null, is_bought: false, created_at: '', updated_at: '', created_by_name: null }])
      .mockResolvedValueOnce([])
    window.history.replaceState({}, '', '/lists/list-1')

    render(<App />)
    const deleteButton = await screen.findByRole('button', { name: 'Delete Milk' })
    await userEvent.click(deleteButton)

    await waitFor(() => {
      expect(shoppingMocks.deleteItem).toHaveBeenCalledWith('item-1')
      expect(shoppingMocks.getItems).toHaveBeenCalledTimes(2)
    })
  })
})
