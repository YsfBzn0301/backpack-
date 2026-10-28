import { createStore as idbStore, get, set } from 'idb-keyval'
import { createStore } from './store'
import type { ExpenseCategory } from '@/agents/budget.worker'

export interface Expense {
  id: string
  amount: number
  currency: string
  note: string
  category: ExpenseCategory
  country: string
  ts: number
}

const db = idbStore('backpack-expenses', 'kv')
export const expenses = createStore<{ items: Expense[]; loaded: boolean }>({ items: [], loaded: false })

get<Expense[]>('items', db)
  .then((items) => expenses.set({ items: items ?? [], loaded: true }))
  .catch(() => expenses.set({ loaded: true }))

const save = () => set('items', expenses.get().items, db).catch(() => {})

export function addExpense(e: Expense) {
  expenses.set((s) => ({ items: [e, ...s.items] }))
  save()
}

export function removeExpense(id: string) {
  expenses.set((s) => ({ items: s.items.filter((x) => x.id !== id) }))
  save()
}
