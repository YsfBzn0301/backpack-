import { useEffect } from 'react'
import { location, requestLocation } from '@/lib/location'
import { distance } from '@/lib/geo'

/**
 * Watches GPS and writes into the shared location store. Mount once (the
 * agent bridge does). Ignores jitter under 25 m so agents aren't woken for
 * every fix. Restarts when `requestLocation()` is called, and retries on its
 * own when the browser permission flips back to "granted".
 */
export function useGeolocation() {
  const retry = location.use((s) => s.retry)

  useEffect(() => {
    if (!('geolocation' in navigator)) {
      location.set({ gpsStatus: 'unavailable' })
      return
    }
    location.set((s) => ({ gpsStatus: s.gps && s.gpsStatus === 'ok' ? 'ok' : 'locating' }))
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
  }, [retry])

  useEffect(() => {
    let status: PermissionStatus | null = null
    const onChange = () => status?.state === 'granted' && location.get().gpsStatus !== 'ok' && requestLocation()
    navigator.permissions
      ?.query({ name: 'geolocation' as PermissionName })
      .then((s) => {
        status = s
        s.addEventListener('change', onChange)
      })
      .catch(() => {})
    return () => status?.removeEventListener('change', onChange)
  }, [])
}
