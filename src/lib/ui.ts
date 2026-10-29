/**
 * Navigation state. Four root tabs, the Kit sheet (floating button), sub-screens
 * (opened from the Kit and quick actions), overlays, and a real /help route.
 * The Kit sheet, screens and help push browser history so the system back
 * button behaves like a native app (and closes the Kit sheet first).
 */
import { createStore } from './store'
import { resolveTabParam, type LegacyTab, type Tab } from './nav'

export { TABS, type Tab } from './nav'
export type Screen = 'translate' | 'audio' | 'checklist' | 'vault' | 'settings'
export const SCREENS: Screen[] = ['translate', 'audio', 'checklist', 'vault', 'settings']

const params = new URLSearchParams(typeof window !== 'undefined' ? window.location.search : '')
const pick = <T extends string>(v: string | null, list: readonly T[]) => (v && (list as readonly string[]).includes(v) ? (v as T) : null)
const { tab: initialTab, kit: initialKit } = resolveTabParam(params.get('tab'))
const action = params.get('action')

/** App base path, e.g. '/' locally or '/backpack-/' on GitHub Pages. */
const BASE = import.meta.env.BASE_URL
const isHelpPath = () => window.location.pathname.replace(/\/$/, '') === `${BASE}help`

export const ui = createStore({
  tab: initialTab as Tab,
  prevTab: initialTab as Tab,
  screen: pick(params.get('screen'), SCREENS) as Screen | null,
  /** Kit sheet (all tools). Opened by the floating Kit button, ?tab=kit or goTab('kit'). */
  kitOpen: initialKit,
  helpOpen: typeof window !== 'undefined' && isHelpPath(),
  helpFocus: null as string | null,
  /** Settings field to scroll to when Settings opens, e.g. 'audd'. */
  settingsFocus: null as string | null,
  sosOpen: params.get('sos') === '1',
  scannerOpen: false,
  cameraOpen: action === 'camera',
  searchOpen: false,
  tourOpen: false,
  mapMode: (params.get('mode') === 'parking' || action === 'parking' ? 'parking' : 'places') as 'places' | 'parking',
  /** Hand-offs between modules. */
  mapFocus: null as null | { lat: number; lng: number; name?: string },
  /** Explore chip to select when the map opens, e.g. 'sharing'. */
  mapFilter: null as null | string,
  scanFile: null as File | null,
})

const kitInHistory = () => typeof history !== 'undefined' && Boolean(history.state?.kit)

/**
 * Push a history entry. When the Kit sheet's own entry is on top, replace it
 * instead: picking a tool swaps the sheet for that tool, and Back then returns
 * to where the sheet was opened (no stale "sheet" step, no popstate race).
 */
const push = (state: object, url: string) => {
  try {
    if (kitInHistory()) history.replaceState(state, '', url)
    else history.pushState(state, '', url)
  } catch {
    /* sandboxed iframes */
  }
}

/** Switch root tab. The legacy 'kit' tab opens the Kit sheet instead. */
export function goTab(tab: Tab | LegacyTab) {
  if (tab === 'kit') return openKit()
  const s = ui.get()
  if (s.kitOpen && kitInHistory()) {
    // Leave the sheet's entry, and the screen entry under it in one traversal.
    ui.set({ kitOpen: false, screen: null })
    history.go(history.state?.screen ? -2 : -1)
  } else {
    if (s.kitOpen) ui.set({ kitOpen: false })
    if (s.screen) closeScreen()
  }
  if (s.tab === tab) return
  ui.set({ tab, prevTab: s.tab })
}

export function openKit() {
  if (ui.get().kitOpen) return
  try {
    // Keep the current entry's state (e.g. an open screen) underneath the sheet.
    history.pushState({ ...(history.state ?? {}), kit: true }, '', window.location.href)
  } catch {
    /* sandboxed iframes */
  }
  ui.set({ kitOpen: true })
}

export function closeKit() {
  if (!ui.get().kitOpen) return
  ui.set({ kitOpen: false })
  if (kitInHistory()) history.back()
}

export function openScreen(screen: Screen) {
  const s = ui.get()
  if (s.screen === screen && !s.kitOpen) return
  push({ screen }, `${BASE}?screen=${screen}`)
  ui.set({ screen, kitOpen: false })
}

/** Open Settings, optionally scrolled to a field (e.g. 'audd' for the AudD key). */
export function openSettings(focus?: string) {
  ui.set({ settingsFocus: focus ?? null })
  openScreen('settings')
}

export function closeScreen() {
  if (history.state?.screen) history.back()
  else ui.set({ screen: null })
}

export function openHelp(focus?: string) {
  push({ help: true }, `${BASE}help`)
  ui.set({ helpOpen: true, helpFocus: focus ?? null, kitOpen: false })
}

export function closeHelp() {
  if (history.state?.help) history.back()
  else {
    push({}, BASE)
    ui.set({ helpOpen: false })
  }
}

export function openParking() {
  goTab('map')
  ui.set({ mapMode: 'parking' })
}

if (typeof window !== 'undefined') {
  window.addEventListener('popstate', (e) => {
    const st = (e.state ?? {}) as { screen?: Screen; help?: boolean; kit?: boolean }
    ui.set({
      kitOpen: Boolean(st.kit),
      screen: st.screen ?? null,
      helpOpen: Boolean(st.help) || isHelpPath(),
    })
  })

  // Legacy ?tab=kit deep link: drop it from the URL and give the sheet its own
  // history entry, so Back closes the sheet instead of leaving the app.
  if (initialKit) {
    try {
      const url = new URL(window.location.href)
      url.searchParams.delete('tab')
      history.replaceState({}, '', url.pathname + url.search + url.hash)
      history.pushState({ kit: true }, '', url.pathname + url.search + url.hash)
    } catch {
      /* sandboxed iframes */
    }
  }
}
