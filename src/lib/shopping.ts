import type { RealtimeChannel } from '@supabase/supabase-js'
import { requireSession, supabase } from './supabase'
import type { ShoppingItem, ShoppingList } from '../types'

function client() {
  if (!supabase) throw new Error('Add Supabase credentials to .env.local before using shared lists.')
  return supabase
}

export async function getLists(): Promise<ShoppingList[]> {
  await requireSession()
  const { data, error } = await client().from('list_members').select('role, shopping_lists(*)').order('created_at', { foreignTable: 'shopping_lists', ascending: false })
  if (error) throw error
  return (data ?? []).map((member) => ({ ...(member.shopping_lists as unknown as Omit<ShoppingList, 'role'>), role: member.role }))
}

export async function createList(name: string) {
  await requireSession()
  const { data, error } = await client().rpc('create_shopping_list', { list_name: name.trim() })
  if (error) throw error
  const created = Array.isArray(data) ? data[0] : data
  if (!created?.id || !created.invite_token) throw new Error('The list was created, but its share link could not be generated.')
  return created as { id: string; invite_token: string }
}

export async function joinList(inviteToken: string) {
  await requireSession()
  const { data, error } = await client().rpc('join_list_by_invite', { invite_token: inviteToken })
  if (error) throw error
  return data as string
}

export async function getList(id: string): Promise<ShoppingList> {
  const { data, error } = await client().rpc('get_shopping_list', { target_list_id: id })
  if (error) throw error
  const list = Array.isArray(data) ? data[0] : data
  if (!list) throw new Error('You do not have access to this list.')
  return list as ShoppingList
}

export async function getItems(listId: string): Promise<ShoppingItem[]> {
  const { data, error } = await client().from('shopping_items').select('*').eq('list_id', listId).order('is_bought').order('created_at')
  if (error) throw error
  return data ?? []
}

export async function addItem(listId: string, name: string, quantity: string, displayName: string) {
  const { error } = await client().from('shopping_items').insert({ list_id: listId, name: name.trim(), quantity: quantity.trim() || null, created_by_name: displayName.trim() || null })
  if (error) throw error
}

export async function updateItem(id: string, patch: Partial<Pick<ShoppingItem, 'is_bought' | 'name' | 'quantity'>>) {
  const { error } = await client().from('shopping_items').update(patch).eq('id', id)
  if (error) throw error
}

export async function deleteItem(id: string) {
  const { error } = await client().from('shopping_items').delete().eq('id', id)
  if (error) throw error
}

export async function clearBought(listId: string) {
  const { error } = await client().from('shopping_items').delete().eq('list_id', listId).eq('is_bought', true)
  if (error) throw error
}

export async function renameList(id: string, name: string) {
  const { error } = await client().from('shopping_lists').update({ name: name.trim() }).eq('id', id)
  if (error) throw error
}

export async function deleteList(id: string) {
  const { error } = await client().from('shopping_lists').delete().eq('id', id)
  if (error) throw error
}

export function subscribeToList(listId: string, callback: () => void): RealtimeChannel {
  return client().channel(`shopping-list:${listId}`).on('postgres_changes', { event: '*', schema: 'public', table: 'shopping_items', filter: `list_id=eq.${listId}` }, callback).on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'shopping_lists', filter: `id=eq.${listId}` }, callback).subscribe()
}

export async function getListInvite(listId: string) {
  const { data, error } = await client().rpc('get_list_invite', { target_list_id: listId })
  if (error) throw error
  if (!data) throw new Error('Only the list owner can share an edit link.')
  return data as string
}
