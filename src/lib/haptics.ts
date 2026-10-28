import { settings } from './settings'

type Pattern = 'tap' | 'select' | 'success' | 'warn' | 'heavy'
const PATTERNS: Record<Pattern, number | number[]> = {
  tap: 8,
  select: 12,
  success: [10, 40, 18],
  warn: [24, 60, 24],
  heavy: [40, 30, 60],
}

export function haptic(kind: Pattern = 'tap') {
  if (!settings.get().haptics) return
  // Browsers block vibration before the first user gesture and log a warning.
  if (navigator.userActivation && !navigator.userActivation.hasBeenActive) return
  try {
    navigator.vibrate?.(PATTERNS[kind])
  } catch {
    /* not supported (iOS Safari): silent no-op */
  }
}
