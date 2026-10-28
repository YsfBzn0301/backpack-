import { useCallback, useEffect } from 'react'
import { location } from '@/lib/location'
import { distance } from '@/lib/geo'

/**
 * Watches GPS and writes into the shared location store. Ignores jitter under
 * 25 m so agents aren't woken for every tiny fix.
 */
export function useGeolocation(enabled = true) {
  const state = location.use()

  const request = useCallback(() => {
    if (!('geolocation' in navigator)) {
      location.set({ gpsStatus: 'unavailable' })
      return () => {}
    }
    location.set((s) => ({ gpsStatus: s.gps ? s.gpsStatus : 'locating' }))
    const id = navigator.geolocation.watchPosition(
      (pos) => {
        const next = { lat: pos.coords.latitude, lng: pos.coords.longitude, accuracy: pos.coords.accuracy, at: Date.now() }
        const prev = location.get().gps
        if (prev && distance(prev, next) < 25 && Date.now() - prev.at < 5 * 60_000) {
          if (location.get().gpsStatus !== 'ok') location.set({ gpsStatus: 'ok' })
          return
        }
        location.set({ gps: next, gpsStatus: 'ok' })
      },
      (err) => location.set({ gpsStatus: err.code === err.PERMISSION_DENIED ? 'denied' : 'unavailable' }),
      { enableHighAccuracy: true, maximumAge: 30_000, timeout: 20_000 },
    )
    return () => navigator.geolocation.clearWatch(id)
  }, [])

  useEffect(() => {
    if (!enabled) return
    return request()
  }, [enabled, request])

  return { ...state, retry: request }
}
