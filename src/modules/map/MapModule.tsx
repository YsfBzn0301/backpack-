import { AnimatePresence, motion } from 'framer-motion'
import { Car, Crosshair, Loader2, LocateFixed, Navigation, Phone, Search, Sparkles, Star, TrainFront, X } from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import { useEffect, useMemo, useState } from 'react'
import { agents } from '@/agents/host'
import type { Place, PlaceKind } from '@/agents/protocol'
import type { RankedPlace } from '@/agents/scout.worker'
import { activeCoords, location } from '@/lib/location'
import { settings } from '@/lib/settings'
import { ui } from '@/lib/ui'
import { haptic } from '@/lib/haptics'
import { directionsUrl, distance, formatDistance, walkMinutes } from '@/lib/geo'
import { googleTextSearch, KIND_META, nearby } from '@/services/places'
import { useMapsLoader } from '@/hooks/useMapsLoader'
import { useOnline } from '@/hooks/useOnline'
import { Pressable } from '@/components/ui/Pressable'
import { GoogleMapView } from './GoogleMapView'
import { TileMap, type Overlay } from './TileMap'
import { PlaceMarker, UserDot } from './Marker'
import { KIND_STYLE } from './kindStyle'

const FILTERS: { id: 'scout' | PlaceKind; label: string }[] = [
  { id: 'scout', label: 'Near me' },
  { id: 'atm', label: 'ATM' },
  { id: 'hostel', label: 'Hostel' },
  { id: 'street_food', label: 'Street food' },
  { id: 'pharmacy', label: 'Pharmacy' },
  { id: 'bus', label: 'Bus terminal' },
  { id: 'cafe', label: 'Café' },
  { id: 'hospital', label: 'Hospital' },
]

const SCOUT_KINDS: PlaceKind[] = ['street_food', 'restaurant', 'cafe', 'convenience', 'atm']

export function MapModule() {
  const loc = location.use()
  const { coords, source } = activeCoords(loc)
  const radius = settings.use((s) => s.scoutRadius)
  const mapsState = useMapsLoader()
  const online = useOnline()
  const focus = ui.use((s) => s.mapFocus)
  const [filter, setFilter] = useState<'scout' | PlaceKind>('scout')
  const [selected, setSelected] = useState<Place | null>(null)
  const [query, setQuery] = useState('')
  const [searchResults, setSearchResults] = useState<Place[] | null>(null)
  const [searching, setSearching] = useState(false)
  const [recenter, setRecenter] = useState('init')

  const kinds = filter === 'scout' ? SCOUT_KINDS : [filter]
  const lat3 = coords ? coords.lat.toFixed(3) : null
  const lng3 = coords ? coords.lng.toFixed(3) : null

  const places = useQuery({
    queryKey: ['places', lat3, lng3, radius, kinds.join(','), mapsState === 'ready'],
    queryFn: async () => {
      const raw = await nearby({ lat: coords!.lat, lng: coords!.lng, radius, kinds, limit: 40 })
      // ScoutAgent ranks the results using time, weather and distance.
      return agents.run<RankedPlace[]>('scout', 'rank', { places: raw }).catch(() => raw as RankedPlace[])
    },
    enabled: Boolean(coords) && mapsState !== 'loading',
    staleTime: 5 * 60_000,
    gcTime: 24 * 3600_000,
    retry: 1,
  })

  useEffect(() => {
    if (!focus) return
    setSelected({ id: `focus-${focus.lat}`, name: focus.name ?? 'Selected place', lat: focus.lat, lng: focus.lng, kind: 'restaurant', source: 'osm' })
    ui.set({ mapFocus: null })
  }, [focus])

  const runSearch = async () => {
    const q = query.trim()
    if (!q || !coords) return
    setSearching(true)
    try {
      if (mapsState === 'ready') setSearchResults(await googleTextSearch(q, coords))
      else {
        const d = 0.08
        const url = `https://nominatim.openstreetmap.org/search?format=jsonv2&limit=12&q=${encodeURIComponent(q)}&viewbox=${coords.lng - d},${coords.lat + d},${coords.lng + d},${coords.lat - d}&bounded=1`
        const rows: { place_id: number; name: string; display_name: string; lat: string; lon: string }[] = await (await fetch(url)).json()
        setSearchResults(
          rows.map((r) => ({ id: `nom-${r.place_id}`, name: r.name || r.display_name.split(',')[0], address: r.display_name, lat: +r.lat, lng: +r.lon, kind: 'restaurant', source: 'osm' })),
        )
      }
    } catch {
      setSearchResults([])
    } finally {
      setSearching(false)
    }
  }

  const list: RankedPlace[] = useMemo(() => {
    const base = (searchResults ?? places.data ?? []) as RankedPlace[]
    if (!coords) return base
    return base.map((p) => ({ ...p, distance: p.distance ?? distance(coords, p) }))
  }, [searchResults, places.data, coords])

  const topPick = filter === 'scout' && !searchResults ? list[0] : undefined

  const overlays: Overlay[] = useMemo(() => {
    const o: Overlay[] = list.slice(0, 40).map((p) => ({
      key: p.id,
      lat: p.lat,
      lng: p.lng,
      node: <PlaceMarker place={p} selected={selected?.id === p.id} pick={topPick?.id === p.id} onClick={() => { haptic('select'); setSelected(p) }} />,
    }))
    if (selected && !list.some((p) => p.id === selected.id)) o.push({ key: selected.id, lat: selected.lat, lng: selected.lng, node: <PlaceMarker place={selected} selected onClick={() => {}} /> })
    if (loc.gps) o.push({ key: 'me', lat: loc.gps.lat, lng: loc.gps.lng, node: <UserDot /> })
    return o
  }, [list, selected, topPick?.id, loc.gps])

  if (!coords) {
    return (
      <div className="card mt-6 flex flex-col items-center p-8 text-center">
        <span className="grid h-14 w-14 place-items-center rounded-2xl bg-ember-500/15 text-ember-500">
          <Crosshair size={26} />
        </span>
        <h2 className="mt-4 text-lg font-medium">Scout needs a starting point</h2>
        <p className="mt-1 text-sm text-fog-400">
          {loc.gpsStatus === 'denied' ? 'Location access is blocked. Enable it in browser settings, or search a destination.' : 'Allow location access or search a destination to scan what is around.'}
        </p>
        <button onClick={() => ui.set({ searchOpen: true })} className="mt-5 rounded-full bg-fog-100 px-5 py-2 text-sm font-medium text-ink-900">
          Search a destination
        </button>
      </div>
    )
  }

  const center = selected ?? coords
  const MapView = mapsState === 'ready' ? GoogleMapView : TileMap

  return (
    <div className="space-y-3">
      <form
        onSubmit={(e) => {
          e.preventDefault()
          runSearch()
        }}
        className="glass flex items-center gap-2 rounded-2xl px-3.5 py-2.5"
      >
        <Search size={17} className="text-fog-500" />
        <input
          value={query}
          onChange={(e) => {
            setQuery(e.target.value)
            if (!e.target.value) setSearchResults(null)
          }}
          placeholder={mapsState === 'ready' ? 'Search Google Places nearby' : 'Search places nearby'}
          className="min-w-0 flex-1 bg-transparent text-[15px] outline-none placeholder:text-fog-500"
          enterKeyHint="search"
        />
        {searching ? (
          <Loader2 size={16} className="animate-spin text-fog-500" />
        ) : searchResults ? (
          <button type="button" onClick={() => { setQuery(''); setSearchResults(null) }} aria-label="Clear search">
            <X size={16} className="text-fog-400" />
          </button>
        ) : null}
      </form>

      <div className="no-scrollbar -mx-4 flex gap-1.5 overflow-x-auto px-4" data-no-swipe>
        {FILTERS.map((f) => {
          const active = filter === f.id && !searchResults
          const color = f.id === 'scout' ? '#ff6b4a' : KIND_STYLE[f.id].color
          return (
            <Pressable
              key={f.id}
              haptics="select"
              onClick={() => {
                setFilter(f.id)
                setSearchResults(null)
                setSelected(null)
              }}
              className={`flex shrink-0 items-center gap-1.5 rounded-full px-3.5 py-2 text-xs font-medium ${active ? 'bg-fog-100 text-ink-900' : 'bg-ink-800 text-fog-300 hairline border'}`}
            >
              {f.id === 'scout' ? <Sparkles size={13} style={{ color: active ? undefined : color }} /> : <span className="h-2 w-2 rounded-full" style={{ background: color }} />}
              {f.label}
            </Pressable>
          )
        })}
      </div>

      <div className="card relative h-[46dvh] min-h-[280px] overflow-hidden p-0">
        <MapView
          center={center}
          overlays={overlays}
          radius={{ ...coords, meters: radius }}
          recenterKey={`${recenter}-${selected?.id ?? ''}`}
          onBackgroundClick={() => setSelected(null)}
        />
        <div className="absolute bottom-3 left-3 flex gap-2">
          <Pressable
            onClick={() => {
              setSelected(null)
              setRecenter(String(Date.now()))
            }}
            className="glass grid h-10 w-10 place-items-center rounded-xl text-fog-100"
            aria-label="Recenter"
          >
            <LocateFixed size={18} />
          </Pressable>
          <div className="glass flex items-center rounded-xl p-1 text-[11px] font-medium">
            {([500, 1000] as const).map((r) => (
              <button
                key={r}
                onClick={() => {
                  haptic('select')
                  settings.set({ scoutRadius: r })
                }}
                className={`rounded-lg px-2.5 py-1.5 ${radius === r ? 'bg-fog-100 text-ink-900' : 'text-fog-300'}`}
              >
                {r === 500 ? '500 m' : '1 km'}
              </button>
            ))}
          </div>
        </div>
        {source === 'search' && (
          <div className="glass absolute top-3 left-3 rounded-full px-3 py-1 text-[11px] text-amber-glow">Previewing {loc.searched?.name}</div>
        )}
        {mapsState === 'error' && <div className="glass absolute top-3 left-3 rounded-full px-3 py-1 text-[11px] text-fog-300">Google Maps failed to load · using OpenStreetMap</div>}
      </div>

      <AnimatePresence mode="wait">
        {selected ? (
          <PlaceDetail key={selected.id} place={selected} origin={coords} onClose={() => setSelected(null)} />
        ) : (
          <motion.section key="list" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            {places.isLoading && !searchResults ? (
              <div className="space-y-2">
                {[0, 1, 2].map((i) => (
                  <div key={i} className="card h-16 animate-pulse" />
                ))}
              </div>
            ) : places.isError && !searchResults ? (
              <p className="card p-4 text-sm text-fog-400">{online ? 'Could not load nearby places right now. Pull back in a moment.' : 'Nearby search needs a connection. Your last results reappear when cached.'}</p>
            ) : list.length === 0 ? (
              <p className="card p-4 text-sm text-fog-400">Nothing found within {formatDistance(radius)}. Try 1 km or another category.</p>
            ) : (
              <ul className="space-y-1.5">
                {list.slice(0, 15).map((p, i) => (
                  <PlaceRow key={p.id} place={p} pick={i === 0 && Boolean(topPick)} onClick={() => setSelected(p)} />
                ))}
              </ul>
            )}
            <p className="mt-2 px-1 text-[10px] text-fog-500">
              {mapsState === 'ready' ? 'Places by Google' : 'Places from OpenStreetMap contributors'} · ranked by ScoutAgent for time, weather, rating and distance
            </p>
          </motion.section>
        )}
      </AnimatePresence>
    </div>
  )
}

function PlaceRow({ place: p, pick, onClick }: { place: RankedPlace; pick: boolean; onClick: () => void }) {
  const { color, Icon } = KIND_STYLE[p.kind]
  return (
    <li>
      <button onClick={onClick} className={`card flex w-full items-center gap-3 p-3 text-left ${pick ? 'ring-1 ring-ember-500/40' : ''}`}>
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl" style={{ background: `${color}1f`, color }}>
          <Icon size={18} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-2">
            <span className="truncate text-sm font-medium text-fog-50">{p.name}</span>
            {pick && <span className="shrink-0 rounded-full bg-ember-500/15 px-1.5 py-px text-[10px] font-medium text-ember-400">Scout pick</span>}
          </span>
          <span className="block truncate text-xs text-fog-500">{p.reason ?? `${KIND_META[p.kind].label} · ${formatDistance(p.distance)}`}</span>
        </span>
        {p.rating && (
          <span className="flex shrink-0 items-center gap-0.5 text-xs text-amber-glow">
            <Star size={12} fill="currentColor" />
            {p.rating.toFixed(1)}
          </span>
        )}
      </button>
    </li>
  )
}

function PlaceDetail({ place: p, origin, onClose }: { place: Place; origin: { lat: number; lng: number }; onClose: () => void }) {
  const d = distance(origin, p)
  const units = settings.use((s) => s.units)
  const placeId = p.source === 'google' ? p.id : undefined
  const nav = (mode: 'walking' | 'transit' | 'driving') => {
    haptic('select')
    // dir_action=navigate starts turn-by-turn on mobile Google Maps.
    window.open(`${directionsUrl(p, mode, placeId)}&dir_action=navigate`, '_blank', 'noopener')
  }
  return (
    <motion.section initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 8 }} className="card p-4" data-no-swipe>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-[11px] text-fog-500">{KIND_META[p.kind].label}</div>
          <h3 className="text-lg leading-tight font-medium text-fog-50">{p.name}</h3>
          {p.address && <p className="mt-1 text-xs text-fog-400">{p.address}</p>}
          <p className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-fog-300">
            <span>
              {formatDistance(d, units)} · {walkMinutes(d)} min walk
            </span>
            {p.rating && (
              <span className="flex items-center gap-0.5 text-amber-glow">
                <Star size={11} fill="currentColor" /> {p.rating.toFixed(1)} {p.ratingCount ? <span className="text-fog-500">({p.ratingCount})</span> : null}
              </span>
            )}
            {p.openNow != null && <span className={p.openNow ? 'text-moss-400' : 'text-alert-500'}>{p.openNow ? 'Open now' : 'Closed'}</span>}
          </p>
        </div>
        <button onClick={onClose} className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-white/5 text-fog-400" aria-label="Close">
          <X size={15} />
        </button>
      </div>
      <div className="mt-4 grid grid-cols-[1fr_auto_auto] gap-2">
        <Pressable onClick={() => nav('walking')} className="flex items-center justify-center gap-2 rounded-full bg-ember-500 py-2.5 text-sm font-semibold text-ink-900">
          <Navigation size={16} /> Walk there
        </Pressable>
        <Pressable onClick={() => nav('transit')} className="grid h-10 w-11 place-items-center rounded-full bg-white/[0.06]" aria-label="Transit directions">
          <TrainFront size={17} />
        </Pressable>
        <Pressable onClick={() => nav('driving')} className="grid h-10 w-11 place-items-center rounded-full bg-white/[0.06]" aria-label="Driving directions">
          <Car size={17} />
        </Pressable>
      </div>
      {p.phone && (
        <a href={`tel:${p.phone}`} className="mt-2 flex items-center justify-center gap-2 rounded-full bg-white/[0.04] py-2 text-sm text-fog-300">
          <Phone size={14} /> {p.phone}
        </a>
      )}
    </motion.section>
  )
}
