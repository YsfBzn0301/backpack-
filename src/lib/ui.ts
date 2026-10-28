import { createStore } from './store'

export type Tab = 'home' | 'map' | 'convert' | 'translate' | 'vault'
export const TABS: Tab[] = ['home', 'map', 'convert', 'translate', 'vault']

const params = new URLSearchParams(typeof window !== 'undefined' ? window.location.search : '')
const initialTab = (TABS as string[]).includes(params.get('tab') ?? '') ? (params.get('tab') as Tab) : 'home'

export const ui = createStore({
  tab: initialTab as Tab,
  prevTab: initialTab as Tab,
  sosOpen: params.get('sos') === '1',
  scannerOpen: false,
  searchOpen: false,
  /** Set by other modules to hand off a place to the map. */
  mapFocus: null as null | { lat: number; lng: number; name?: string },
})

export function goTab(tab: Tab) {
  const cur = ui.get().tab
  if (cur === tab) return
  ui.set({ tab, prevTab: cur })
}
