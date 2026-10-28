import { useSyncExternalStore } from 'react'

/** Tiny observable store. Enough for app-wide state without another dependency. */
export function createStore<T>(initial: T, persistKey?: string) {
  let state = initial
  if (persistKey) {
    try {
      const raw = localStorage.getItem(persistKey)
      if (raw) state = { ...initial, ...JSON.parse(raw) }
    } catch {
      /* storage unavailable: run in-memory */
    }
  }
  const listeners = new Set<() => void>()
  const get = () => state
  const set = (next: Partial<T> | ((s: T) => Partial<T>)) => {
    const patch = typeof next === 'function' ? next(state) : next
    state = { ...state, ...patch }
    if (persistKey) {
      try {
        localStorage.setItem(persistKey, JSON.stringify(state))
      } catch {
        /* ignore quota / private mode */
      }
    }
    listeners.forEach((l) => l())
  }
  const subscribe = (l: () => void) => {
    listeners.add(l)
    return () => listeners.delete(l)
  }
  function useStore(): T
  function useStore<S>(selector: (s: T) => S): S
  function useStore<S>(selector?: (s: T) => S) {
    return useSyncExternalStore(subscribe, () => (selector ? selector(state) : state))
  }
  return { get, set, subscribe, use: useStore }
}
