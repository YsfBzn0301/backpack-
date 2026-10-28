import { useEffect, useSyncExternalStore } from 'react'
import { settings } from './settings'

export type ThemePref = 'system' | 'dark' | 'light'
export type Theme = 'dark' | 'light'

const media = typeof window !== 'undefined' ? window.matchMedia('(prefers-color-scheme: light)') : null
const subscribeMedia = (cb: () => void) => {
  media?.addEventListener('change', cb)
  return () => media?.removeEventListener('change', cb)
}

export const resolveTheme = (pref: ThemePref): Theme => (pref === 'system' ? (media?.matches ? 'light' : 'dark') : pref)

/** Current resolved theme (follows the OS when set to "system"). */
export function useTheme(): Theme {
  const pref = settings.use((s) => s.theme)
  const systemLight = useSyncExternalStore(subscribeMedia, () => media?.matches ?? false)
  return pref === 'system' ? (systemLight ? 'light' : 'dark') : pref
}

function apply(theme: Theme) {
  const root = document.documentElement
  if (root.dataset.theme === theme) return
  const run = () => {
    root.dataset.theme = theme
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', theme === 'light' ? '#f4f4f0' : '#0d1117')
  }
  // Crossfade where the View Transitions API exists; instant otherwise.
  const doc = document as Document & { startViewTransition?: (cb: () => void) => unknown }
  if (root.dataset.theme && doc.startViewTransition && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) doc.startViewTransition(run)
  else run()
}

/** Mount once: keeps <html data-theme> in sync with the preference. */
export function useThemeEngine() {
  const theme = useTheme()
  useEffect(() => apply(theme), [theme])
  return theme
}

/** Set the theme before first paint to avoid a flash. */
export function applyInitialTheme() {
  apply(resolveTheme(settings.get().theme))
}
