/**
 * Navigation state. Five root tabs, sub-screens (opened from Kit and quick
 * actions), overlays, and a real /help route. Screens and help push browser
 * history so the system back button behaves like a native app.
 */
import { createStore } from './store'

export type Tab = 'home' | 'map' | 'transit' | 'convert' | 'kit'
export const TABS: Tab[] = ['home', 'map', 'transit', 'convert', 'kit']
export type Screen = 'translate' | 'audio' | 'checklist' | 'vault' | 'settings'
export const SCREENS: Screen[] = ['translate', 'audio', 'checklist', 'vault', 'settings']

const params = new URLSearchParams(typeof window !== 'undefined' ? window.location.search : '')
const pick = <T extends string>(v: string | null, list: readonly T[]) => (v && (list as readonly string[]).includes(v) ? (v as T) : null)
const initialTab = pick(params.get('tab'), TABS) ?? 'home'
const action = params.get('action')

export const ui = createStore({
  tab: initialTab as Tab,
  prevTab: initialTab as Tab,
  screen: pick(params.get('screen'), SCREENS) as Screen | null,
  helpOpen: typeof window !== 'undefined' && window.location.pathname.replace(/\/$/, '') === '/help',
  helpFocus: null as string | null,
  sosOpen: params.get('sos') === '1',
  scannerOpen: false,
  cameraOpen: action === 'camera',
  searchOpen: false,
  tourOpen: false,
  mapMode: (params.get('mode') === 'parking' || action === 'parking' ? 'parking' : 'places') as 'places' | 'parking',
  /** Hand-offs between modules. */
  mapFocus: null as null | { lat: number; lng: number; name?: string },
  scanFile: null as File | null,
})

const push = (state: object, url: string) => {
  try {
    history.pushState(state, '', url)
  } catch {
    /* sandboxed iframes */
  }
}

export function goTab(tab: Tab) {
  const s = ui.get()
  if (s.screen) closeScreen()
  if (s.tab === tab) return
  ui.set({ tab, prevTab: s.tab })
}

export function openScreen(screen: Screen) {
  if (ui.get().screen === screen) return
  push({ screen }, `/?screen=${screen}`)
  ui.set({ screen })
}

export function closeScreen() {
  if (history.state?.screen) history.back()
  else ui.set({ screen: null })
}

export function openHelp(focus?: string) {
  push({ help: true }, '/help')
  ui.set({ helpOpen: true, helpFocus: focus ?? null })
}

export function closeHelp() {
  if (history.state?.help) history.back()
  else {
    push({}, '/')
    ui.set({ helpOpen: false })
  }
}

export function openParking() {
  goTab('map')
  ui.set({ mapMode: 'parking' })
}

if (typeof window !== 'undefined') {
  window.addEventListener('popstate', (e) => {
    const st = (e.state ?? {}) as { screen?: Screen; help?: boolean }
    ui.set({
      screen: st.screen ?? null,
      helpOpen: Boolean(st.help) || window.location.pathname.replace(/\/$/, '') === '/help',
    })
  })
}
