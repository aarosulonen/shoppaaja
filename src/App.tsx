import { useEffect, useMemo, useState } from 'react'
import type { FormEvent, ReactNode } from 'react'
import { addItem, clearBought, createList, deleteItem, deleteList, getItems, getList, getLists, joinList, renameList, subscribeToList, updateItem } from './lib/shopping'
import { isSupabaseConfigured, supabase } from './lib/supabase'
import type { ShoppingItem, ShoppingList } from './types'

const displayNameKey = 'gather-display-name'

function readInvite() {
  return new URLSearchParams(window.location.hash.slice(1)).get('invite')
}

function listIdFromPath() {
  const match = window.location.pathname.match(/^\/lists\/([^/]+)$/)
  return match?.[1] ?? null
}

function go(path: string) {
  window.history.pushState({}, '', path)
  window.dispatchEvent(new PopStateEvent('popstate'))
}

export default function App() {
  const [path, setPath] = useState(window.location.pathname)
  useEffect(() => {
    const onPop = () => setPath(window.location.pathname)
    window.addEventListener('popstate', onPop)
    return () => window.removeEventListener('popstate', onPop)
  }, [])

  if (!isSupabaseConfigured) return <SetupNotice />
  return listIdFromPath() ? <ListView key={path} listId={listIdFromPath()!} /> : <Dashboard />
}

function SetupNotice() {
  return <main className="setup"><div className="brand-mark">✓</div><h1>Gather</h1><p>Shared shopping lists, ready when you are.</p><div className="notice"><strong>One small setup step</strong><br />Copy <code>.env.example</code> to <code>.env.local</code> and add your Supabase project URL and anon key.</div></main>
}

function Dashboard() {
  const [lists, setLists] = useState<ShoppingList[]>([])
  const [name, setName] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const load = () => getLists().then(setLists).catch((e: Error) => setError(e.message)).finally(() => setLoading(false))
  useEffect(() => { load() }, [])

  async function submit(event: FormEvent) {
    event.preventDefault(); if (!name.trim()) return
    try { const list = await createList(name); go(`/lists/${list.id}#invite=${list.invite_token}`) } catch (e) { setError((e as Error).message) }
  }
  return <main className="page dashboard"><header><div><span className="eyebrow">GATHER</span><h1>Your lists</h1></div></header><form className="new-list" onSubmit={submit}><label htmlFor="list-name">New list</label><div><input id="list-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Weeknight groceries" maxLength={80} autoFocus /><button type="submit">Create</button></div></form>{error && <p className="error" role="alert">{error}</p>}{loading ? <p className="muted">Loading your lists…</p> : lists.length ? <section className="list-grid" aria-label="Shopping lists">{lists.map((list) => <button className="list-card" key={list.id} onClick={() => go(`/lists/${list.id}`)}><span>{list.role === 'owner' ? 'Owner' : 'Shared with you'}</span><strong>{list.name}</strong><small>Open list <b>→</b></small></button>)}</section> : <section className="empty"><div>🛒</div><h2>Your first list starts here</h2><p>Create one for home, a trip, or whatever is next.</p></section>}</main>
}

function ListView({ listId }: { listId: string }) {
  const [list, setList] = useState<ShoppingList | null>(null)
  const [items, setItems] = useState<ShoppingItem[]>([])
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [displayName, setDisplayName] = useState(() => localStorage.getItem(displayNameKey) ?? '')
  const [name, setName] = useState('')
  const [quantity, setQuantity] = useState('')
  const load = async () => { try { const [nextList, nextItems] = await Promise.all([getList(listId), getItems(listId)]); setList(nextList); setItems(nextItems) } catch (e) { setError((e as Error).message) } finally { setLoading(false) } }
  useEffect(() => { const invite = readInvite(); (async () => { try { if (invite) { const joinedId = await joinList(invite); window.history.replaceState({}, '', `/lists/${joinedId}`) } await load() } catch (e) { setError((e as Error).message); setLoading(false) } })() }, [listId])
  useEffect(() => { const channel = subscribeToList(listId, load); return () => { channel.unsubscribe() } }, [listId])
  useEffect(() => { localStorage.setItem(displayNameKey, displayName) }, [displayName])
  const active = useMemo(() => items.filter((item) => !item.is_bought), [items])
  const bought = useMemo(() => items.filter((item) => item.is_bought), [items])

  async function add(event: FormEvent) { event.preventDefault(); if (!name.trim()) return; try { await addItem(listId, name, quantity, displayName); setName(''); setQuantity('') } catch (e) { setError((e as Error).message) } }
  async function share() { const { data, error: invokeError } = await supabase!.rpc('get_list_invite', { target_list_id: listId }); if (invokeError) return setError(invokeError.message); await navigator.clipboard.writeText(`${window.location.origin}/lists/${listId}#invite=${data}`); alert('Edit link copied to your clipboard.') }
  async function editList() { if (!list) return; const next = window.prompt('List name', list.name); if (next?.trim()) { await renameList(list.id, next); load() } }
  async function removeList() { if (!list || !window.confirm(`Delete “${list.name}”? This cannot be undone.`)) return; await deleteList(list.id); go('/') }
  async function removeItem(id: string) {
    try {
      await deleteItem(id)
      await load()
    } catch (e) {
      setError((e as Error).message)
    }
  }
  async function removeBought() {
    if (!window.confirm('Clear all bought items?')) return
    try {
      await clearBought(listId)
      await load()
    } catch (e) {
      setError((e as Error).message)
    }
  }
  if (loading) return <main className="page"><p className="muted">Opening list…</p></main>
  if (!list) return <main className="page"><button className="back" onClick={() => go('/')}>← All lists</button><h1>We couldn’t open this list</h1><p className="error">{error || 'The link may be invalid or you may not have access.'}</p></main>
  return <main className="page"><header className="list-header"><button className="back" onClick={() => go('/')}>← Lists</button><div className="title-row"><div><span className="eyebrow">{navigator.onLine ? 'LIVE · SHARED' : 'OFFLINE'}</span><h1>{list.name}</h1></div><button className="icon-button" aria-label="Share edit link" onClick={share}>↗</button></div>{list.role === 'owner' && <div className="owner-actions"><button onClick={editList}>Rename</button><button onClick={removeList}>Delete list</button></div>}</header>{!navigator.onLine && <p className="notice">You can view this list offline. Reconnect to make changes.</p>}<label className="name-field">Your name <input value={displayName} onChange={(e) => setDisplayName(e.target.value)} placeholder="Optional" maxLength={40} /></label><form className="add-item" onSubmit={add}><input aria-label="Item name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Add an item" maxLength={120} autoFocus /><input aria-label="Quantity" value={quantity} onChange={(e) => setQuantity(e.target.value)} placeholder="Qty" maxLength={30} /><button type="submit" aria-label="Add item">+</button></form>{error && <p className="error" role="alert">{error}</p>}<ItemSection title="To buy" items={active} onToggle={(item) => updateItem(item.id, { is_bought: !item.is_bought })} onDelete={removeItem} empty="Nothing on the list yet." />{bought.length > 0 && <ItemSection title="Bought" items={bought} onToggle={(item) => updateItem(item.id, { is_bought: !item.is_bought })} onDelete={removeItem} action={<button className="text-button" onClick={removeBought}>Clear all</button>} />}</main>
}

function ItemSection({ title, items, onToggle, onDelete, empty, action }: { title: string; items: ShoppingItem[]; onToggle: (item: ShoppingItem) => Promise<void>; onDelete: (id: string) => Promise<void>; empty?: string; action?: ReactNode }) {
  return <section className={title === 'Bought' ? 'items bought' : 'items'}><div className="section-title"><h2>{title} <span>{items.length}</span></h2>{action}</div>{items.length ? <ul>{items.map((item) => <li key={item.id}><button className={item.is_bought ? 'check checked' : 'check'} aria-label={`Mark ${item.name} as ${item.is_bought ? 'not bought' : 'bought'}`} onClick={() => onToggle(item)}>{item.is_bought ? '✓' : ''}</button><div><strong>{item.name}</strong>{item.quantity && <span>{item.quantity}</span>}{item.created_by_name && <small>Added by {item.created_by_name}</small>}</div><button className="delete-item" aria-label={`Delete ${item.name}`} onClick={() => onDelete(item.id)}>×</button></li>)}</ul> : <p className="empty-items">{empty}</p>}</section>
}
