import { useEffect, useRef, useState } from 'react'
import { Crosshair, Loader2, MapPin, Search } from 'lucide-react'
import { Sheet } from './ui/Sheet'
import { searchPlaces, type GeoResult } from '@/services/geocode'
import { location } from '@/lib/location'
import { ui } from '@/lib/ui'
import { flag } from '@/data/countries'
import { haptic } from '@/lib/haptics'
import { useGeolocation } from '@/hooks/useGeolocation'

export function LocationSearch() {
  const open = ui.use((s) => s.searchOpen)
  const close = () => ui.set({ searchOpen: false })
  const [q, setQ] = useState('')
  const [results, setResults] = useState<GeoResult[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const loc = location.use()
  const { retry } = useGeolocation(false)

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 250)
    else {
      setQ('')
      setResults([])
    }
  }, [open])

  useEffect(() => {
    if (q.trim().length < 2) {
      setResults([])
      return
    }
    const ctrl = new AbortController()
    const t = setTimeout(() => {
      setLoading(true)
      setError(null)
      searchPlaces(q, ctrl.signal)
        .then(setResults)
        .catch((e) => e.name !== 'AbortError' && setError(navigator.onLine ? 'Search failed. Try again.' : 'Destination search needs a connection.'))
        .finally(() => setLoading(false))
    }, 280)
    return () => {
      clearTimeout(t)
      ctrl.abort()
    }
  }, [q])

  const pick = (r: GeoResult) => {
    haptic('select')
    location.set({ searched: { name: r.name, region: r.region, country: r.country, countryCode: r.countryCode, lat: r.lat, lng: r.lng } })
    close()
  }

  const useGps = () => {
    haptic('select')
    location.set({ searched: null })
    if (!loc.gps) retry()
    close()
  }

  return (
    <Sheet open={open} onClose={close} title={<h2 className="text-lg font-semibold">Change location</h2>}>
      <label className="flex items-center gap-2 rounded-2xl bg-ink-900 px-4 py-3 hairline border focus-within:border-ember-500/50">
        <Search size={18} className="text-fog-500" />
        <input
          ref={inputRef}
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search a city or destination"
          className="w-full bg-transparent text-base text-fog-100 outline-none placeholder:text-fog-500"
          enterKeyHint="search"
        />
        {loading && <Loader2 size={16} className="animate-spin text-fog-500" />}
      </label>

      <button onClick={useGps} className="mt-3 flex w-full items-center gap-3 rounded-2xl px-3 py-3 text-left hover:bg-white/5">
        <span className="grid h-9 w-9 place-items-center rounded-full bg-ember-500/15 text-ember-500">
          <Crosshair size={18} />
        </span>
        <span>
          <span className="block text-sm font-medium">Use my current location</span>
          <span className="block text-xs text-fog-500">
            {loc.gpsStatus === 'denied' ? 'Location permission is blocked in your browser settings' : loc.gps ? 'GPS fix available' : 'Ask for GPS access'}
          </span>
        </span>
      </button>

      {error && <p className="mt-2 px-3 text-sm text-ember-400">{error}</p>}
      <ul className="mt-1">
        {results.map((r) => (
          <li key={r.id}>
            <button onClick={() => pick(r)} className="flex w-full items-center gap-3 rounded-2xl px-3 py-3 text-left hover:bg-white/5">
              <span className="grid h-9 w-9 place-items-center rounded-full bg-white/5 text-lg">{r.countryCode ? flag(r.countryCode) : <MapPin size={16} />}</span>
              <span className="min-w-0">
                <span className="block truncate text-sm font-medium">{r.name}</span>
                <span className="block truncate text-xs text-fog-500">{[r.region, r.country].filter(Boolean).join(', ')}</span>
              </span>
            </button>
          </li>
        ))}
      </ul>
      {!q && (
        <p className="px-3 pt-2 pb-4 text-xs leading-relaxed text-fog-500">
          Searching a destination previews its weather, local time, currency and emergency numbers. Switch back to GPS any time.
        </p>
      )}
    </Sheet>
  )
}
