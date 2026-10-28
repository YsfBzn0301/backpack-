import { keys } from '@/lib/settings'

let promise: Promise<typeof google> | null = null

export const hasMapsKey = () => Boolean(keys.googleMaps())
export const isMapsLoaded = () => typeof window !== 'undefined' && Boolean(window.google?.maps?.places)

/** Loads the Google Maps JS API once (maps + places). Rejects when no key is set or offline. */
export function loadGoogleMaps(): Promise<typeof google> {
  if (isMapsLoaded()) return Promise.resolve(window.google)
  if (promise) return promise
  const key = keys.googleMaps()
  if (!key) return Promise.reject(new Error('no-key'))
  promise = new Promise((resolve, reject) => {
    const cb = `__bpMaps${Date.now()}`
    ;(window as unknown as Record<string, () => void>)[cb] = () => {
      // The callback fires once the core API is ready; pull in Places too.
      google.maps
        .importLibrary('places')
        .then(() => resolve(window.google))
        .catch(reject)
    }
    const s = document.createElement('script')
    s.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(key)}&v=weekly&loading=async&libraries=places&callback=${cb}`
    s.async = true
    s.onerror = () => {
      promise = null
      reject(new Error('maps-load-failed'))
    }
    document.head.appendChild(s)
  })
  return promise
}
