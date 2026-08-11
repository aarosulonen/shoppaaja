export type Role = 'owner' | 'editor'

export interface ShoppingList {
  id: string
  name: string
  created_at: string
  updated_at: string
  role: Role
}

export interface ShoppingItem {
  id: string
  list_id: string
  name: string
  quantity: string | null
  is_bought: boolean
  created_at: string
  updated_at: string
  created_by_name: string | null
}
