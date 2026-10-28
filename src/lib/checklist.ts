/**
 * Categorised travel checklists in IndexedDB. Seeded items store a locale key
 * (not text) so they follow the UI language until the user edits them.
 */
import { createStore as idbStore, get, set } from 'idb-keyval'
import { createStore } from './store'
import { uid } from './format'

export type ChecklistCategory = 'activities' | 'packing' | 'shopping' | 'documents' | 'health' | 'car'
export const CHECKLIST_CATEGORIES: ChecklistCategory[] = ['activities', 'packing', 'shopping', 'documents', 'health', 'car']

export const SEEDS: Record<ChecklistCategory, string[]> = {
  activities: ['topSights', 'localDish', 'walkingTour', 'sunsetSpot', 'market'],
  packing: ['adapter', 'powerBank', 'towel', 'padlock', 'rainJacket', 'bottle', 'earplugs'],
  shopping: ['simCard', 'sunscreen', 'snacks', 'souvenirs'],
  documents: ['passport', 'visa', 'insurance', 'bookings', 'copies', 'licence', 'cards'],
  health: ['meds', 'firstAid', 'repellent', 'rehydration', 'vaccines'],
  car: ['idp', 'vignette', 'warningKit', 'parkingDisc', 'offlineMaps', 'carDocs', 'transitApp'],
}

export interface ChecklistItem {
  id: string
  cat: ChecklistCategory
  /** Locale key under checklist.seed.* for built-in items. */
  seed?: string
  text?: string
  done: boolean
}

const db = idbStore('backpack-checklist', 'kv')
const seedAll = (): ChecklistItem[] =>
  CHECKLIST_CATEGORIES.flatMap((cat) => SEEDS[cat].map((seed) => ({ id: uid(), cat, seed, done: false })))

export const checklist = createStore<{ items: ChecklistItem[]; loaded: boolean }>({ items: [], loaded: false })

get<ChecklistItem[]>('items', db)
  .then((items) => checklist.set({ items: items ?? seedAll(), loaded: true }))
  .catch(() => checklist.set({ items: seedAll(), loaded: true }))

const save = () => set('items', checklist.get().items, db).catch(() => {})
const update = (fn: (items: ChecklistItem[]) => ChecklistItem[]) => {
  checklist.set((s) => ({ items: fn(s.items) }))
  save()
}

export const toggleItem = (id: string) => update((items) => items.map((i) => (i.id === id ? { ...i, done: !i.done } : i)))
export const addItem = (cat: ChecklistCategory, text: string) => update((items) => [...items, { id: uid(), cat, text, done: false }])
export const removeItem = (id: string) => update((items) => items.filter((i) => i.id !== id))
export const resetCategory = (cat: ChecklistCategory) => update((items) => items.map((i) => (i.cat === cat ? { ...i, done: false } : i)))
export const restoreDefaults = () => update(() => seedAll())
