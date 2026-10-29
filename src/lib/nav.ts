/**
 * Pure navigation helpers (no DOM, no store) so they can be unit-tested.
 * The bottom bar has four anchor tabs; the Kit is a floating button + sheet.
 */
export type Tab = 'home' | 'map' | 'transit' | 'convert'
export const TABS: readonly Tab[] = ['home', 'map', 'transit', 'convert']
/** Former fifth tab. `?tab=kit` and goTab('kit') open the Kit sheet instead. */
export type LegacyTab = 'kit'

export const isTab = (v: unknown): v is Tab => typeof v === 'string' && (TABS as readonly string[]).includes(v)

/** Resolve a `?tab=` value: a known tab, or the legacy Kit tab as an open sheet. */
export function resolveTabParam(v: string | null | undefined): { tab: Tab; kit: boolean } {
  if (v === 'kit') return { tab: 'home', kit: true }
  return { tab: isTab(v) ? v : 'home', kit: false }
}

/** Tab reached by a horizontal swipe (dx < 0 = swipe left = next), or null at the ends. */
export function swipeTarget(tab: Tab, dx: number): Tab | null {
  const i = TABS.indexOf(tab) + (dx < 0 ? 1 : -1)
  return i >= 0 && i < TABS.length ? TABS[i] : null
}
