import { AnimatePresence, motion } from 'framer-motion'
import { Car, Crosshair, Loader2, LocateFixed, Navigation, Phone, Search, Sparkles, Star, TrainFront, X } from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import { lazy, Suspense, useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { agents } from '@/agents/host'
import type { Place, PlaceKind } from '@/agents/protocol'
import type { RankedPlace } from '@/agents/scout.worker'
import { activeCoords, location } from '@/lib/location'
import { settings } from '@/lib/settings'
import { ui } from '@/lib/ui'
import { haptic } from '@/lib/haptics'
import { directionsUrl, distance, walkMinutes } from '@/lib/geo'
import { cap, fmtDistance } from '@/i18n/format'
import { googleTextSearch, nearby } from '@/services/places'
import { useMapsLoader } from '@/hooks/useMapsLoader'
import { useOnline } from '@/hooks/useOnline'
import { Pressable } from '@/components/ui/Pressable'
import { Segmented } from '@/components/ui/Segmented'
import { MapView } from './MapView'
import type { Overlay } from './TileMap'
import { PlaceMarker, UserDot } from './Marker'
import { KIND_STYLE } from './kindStyle'

const ParkingScout = lazy(() => import('@/modules/parking/ParkingScout').then((m) => ({ default: m.ParkingScout })))

type Filter = 'scout' | 'atm' | 'hostel' | 'food' | 'pharmacy' | 'fuel' | 'bus' | 'cafe' | 'hospital' | 'parking'
const FILTERS: Filter[] = ['scout', 'atm', 'hostel', 'food', 'pharmacy', 'fuel', 'parking', 'bus', 'cafe', 'hospital']
const FILTER_KINDS: Record<Exclude<Filter, 'parking'>, PlaceKind[]> = {
  scout: ['street_food', 'restaurant', 'cafe', 'convenience', 'atm'],
  atm: ['atm'],
  hostel: ['hostel'],
  food: ['street_food', 'restaurant'],
  pharmacy: ['pharmacy'],
  fuel: ['fuel'],
  bus: ['bus'],
  cafe: ['cafe'],
  hospital: ['hospital'],
}
const FILTER_COLOR: Record<Filter, string> = {
  scout: '#ff6b4a',
  atm: KIND_STYLE.atm.color,
  hostel: KIND_STYLE.hostel.color,
  food: KIND_STYLE.street_food.color,
  pharmacy: KIND_STYLE.pharmacy.color,
  fuel: KIND_STYLE.fuel.color,
  parking: KIND_STYLE.parking.color,
  bus: KIND_STYLE.bus.color,
  cafe: KIND_STYLE.cafe.color,
  hospital: KIND_STYLE.hospital.color,
}
export const RADII = [500, 1000, 5000] as const

export function RadiusToggle() {
  const radius = settings.use((s) => s.scoutRadius)
  return (
    <div className="glass flex items-center rounded-xl p-1 text-[11px] font-medium">
      {RADII.map((r) => (
        <button
          key={r}
          onClick={() => {
            haptic('select')
            settings.set({ scoutRadius: r })
          }}
          className={`rounded-lg px-2.5 py-1.5 ${radius === r ? 'bg-fog-100 text-ink-900' : 'text-fog-300'}`}
        >
          {fmtDistance(r)}
        </button>
      ))}
    </div>
  )
}

export function NeedLocation() {
  const { t } = useTranslation()
  const status = location.use((s) => s.gpsStatus)
  return (
    <div className="card mt-2 flex flex-col items-center p-8 text-center">
      <span className="grid h-14 w-14 place-items-center rounded-2xl bg-ember-500/15 text-ember-500">
        <Crosshair size={26} />
      </span>
      <h2 className="mt-4 text-lg font-medium">{t('map.needStartTitle')}</h2>
      <p className="mt-1 text-sm text-fog-400">{status === 'denied' ? t('map.needStartDenied') : t('map.needStartBody')}</p>
      <button onClick={() => ui.set({ searchOpen: true })} className="mt-5 rounded-full bg-fog-100 px-5 py-2 text-sm font-medium text-ink-900">
        {t('permission.search')}
      </button>
    </div>
  )
}

/** Explore tab: places around you, or the parking finder. */
export function MapModule() {
  const { t } = useTranslation()
  const mode = ui.use((s) => s.mapMode)
  return (
    <div className="space-y-3">
      <Segmented
        stretch
        value={mode}
        onChange={(v) => ui.set({ mapMode: v })}
        options={[
          { value: 'places', label: t('map.modePlaces') },
          { value: 'parking', label: t('map.modeParking') },
        ]}
      />
      {mode === 'places' ? (
        <PlacesView />
      ) : (
        <Suspense fallback={<div className="card h-[46dvh] animate-pulse" />}>
          <ParkingScout />
        </Suspense>
      )}
    </div>
  )
}

function PlacesView() {
  const { t } = useTranslation()
  const loc = location.use()
  const { coords, source } = activeCoords(loc)
  const radius = settings.use((s) => s.scoutRadius)
  const mapsState = useMapsLoader()
  const online = useOnline()
  const focus = ui.use((s) => s.mapFocus)
  const [filter, setFilter] = useState<Exclude<Filter, 'parking'>>('scout')
  const [selected, setSelected] = useState<Place | null>(null)
  const [query, setQuery] = useState('')
  const [searchResults, setSearchResults] = useState<Place[] | null>(null)
  const [searching, setSearching] = useState(false)
  const [recenter, setRecenter] = useState('init')

  const kinds = FILTER_KINDS[filter]
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
    setSelected({ id: `focus-${focus.lat}`, name: focus.name ?? '', lat: focus.lat, lng: focus.lng, kind: 'restaurant', source: 'osm' })
    ui.set({ mapFocus: null })
  }, [focus])

  const runSearch = async () => {
    const q = query.trim()
    if (!q || !coords) return
    setSearching(true)
    try {
      if (mapsState === 'ready') setSearchResults(await googleTextSearch(q, coords))
      else {
        const d = radius >= 5000 ? 0.15 : 0.08
        const url = `https://nominatim.openstreetmap.org/search?format=jsonv2&limit=12&q=${encodeURIComponent(q)}&viewbox=${coords.lng - d},${coords.lat + d},${coords.lng + d},${coords.lat - d}&bounded=1&accept-language=${settings.get().uiLang}`
        const rows: { place_id: number; name: string; display_name: string; lat: string; lon: string }[] = await (await fetch(url)).json()
        setSearchResults(rows.map((r) => ({ id: `nom-${r.place_id}`, name: r.name || r.display_name.split(',')[0], address: r.display_name, lat: +r.lat, lng: +r.lon, kind: 'restaurant', source: 'osm' })))
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
      node: (
        <PlaceMarker
          place={p}
          selected={selected?.id === p.id}
          pick={topPick?.id === p.id}
          onClick={() => {
            haptic('select')
            setSelected(p)
          }}
        />
      ),
    }))
    if (selected && !list.some((p) => p.id === selected.id)) o.push({ key: selected.id, lat: selected.lat, lng: selected.lng, node: <PlaceMarker place={selected} selected onClick={() => {}} /> })
    if (loc.gps) o.push({ key: 'me', lat: loc.gps.lat, lng: loc.gps.lng, node: <UserDot /> })
    return o
  }, [list, selected, topPick?.id, loc.gps])

  if (!coords) return <NeedLocation />

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
          placeholder={mapsState === 'ready' ? t('map.searchGoogle') : t('map.search')}
          className="min-w-0 flex-1 bg-transparent text-[15px] outline-none placeholder:text-fog-500"
          enterKeyHint="search"
        />
        {searching ? (
          <Loader2 size={16} className="animate-spin text-fog-500" />
        ) : searchResults ? (
          <button
            type="button"
            onClick={() => {
              setQuery('')
              setSearchResults(null)
            }}
            aria-label={t('common.clear')}
          >
            <X size={16} className="text-fog-400" />
          </button>
        ) : null}
      </form>

      <div className="no-scrollbar -mx-4 flex gap-1.5 overflow-x-auto px-4" data-no-swipe>
        {FILTERS.map((f) => {
          const active = filter === f && !searchResults
          return (
            <Pressable
              key={f}
              haptics="select"
              onClick={() => {
                if (f === 'parking') return ui.set({ mapMode: 'parking' })
                setFilter(f)
                setSearchResults(null)
                setSelected(null)
              }}
              className={`flex shrink-0 items-center gap-1.5 rounded-full px-3.5 py-2 text-xs font-medium ${active ? 'bg-fog-100 text-ink-900' : 'bg-ink-800 text-fog-300 hairline border'}`}
            >
              {f === 'scout' ? <Sparkles size={13} style={{ color: active ? undefined : FILTER_COLOR[f] }} /> : <span className="h-2 w-2 rounded-full" style={{ background: FILTER_COLOR[f] }} />}
              {t(`map.filter.${f}`)}
            </Pressable>
          )
        })}
      </div>

      <div className="card relative h-[46dvh] min-h-[280px] overflow-hidden p-0">
        <MapView center={selected ?? coords} overlays={overlays} radius={{ ...coords, meters: radius }} recenterKey={`${recenter}-${selected?.id ?? ''}-${radius}`} onBackgroundClick={() => setSelected(null)} />
        <div className="absolute bottom-3 left-3 flex gap-2">
          <Pressable
            onClick={() => {
              setSelected(null)
              setRecenter(String(Date.now()))
            }}
            className="glass grid h-10 w-10 place-items-center rounded-xl text-fog-100"
            aria-label={t('map.recenter')}
          >
            <LocateFixed size={18} />
          </Pressable>
          <RadiusToggle />
        </div>
        {source === 'search' && <div className="glass absolute top-3 left-3 rounded-full px-3 py-1 text-[11px] text-amber-glow">{t('map.previewing', { place: loc.searched?.name })}</div>}
        {mapsState === 'error' && <div className="glass absolute top-3 left-3 rounded-full px-3 py-1 text-[11px] text-fog-300">{t('map.googleFailed')}</div>}
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
              <p className="card p-4 text-sm text-fog-400">{online ? t('map.loadFailed') : t('map.needsConnection')}</p>
            ) : list.length === 0 ? (
              <p className="card p-4 text-sm text-fog-400">{t('map.nothing', { radius: fmtDistance(radius) })}</p>
            ) : (
              <ul className="space-y-1.5">
                {list.slice(0, 15).map((p, i) => (
                  <PlaceRow key={p.id} place={p} pick={i === 0 && Boolean(topPick)} onClick={() => setSelected(p)} />
                ))}
              </ul>
            )}
            <p className="mt-2 px-1 text-[10px] text-fog-500">{mapsState === 'ready' ? t('map.creditGoogle') : t('map.creditOsm')}</p>
          </motion.section>
        )}
      </AnimatePresence>
    </div>
  )
}

function PlaceRow({ place: p, pick, onClick }: { place: RankedPlace; pick: boolean; onClick: () => void }) {
  const { t } = useTranslation()
  const { color, Icon } = KIND_STYLE[p.kind]
  return (
    <li>
      <button onClick={onClick} className={`card flex w-full items-center gap-3 p-3 text-left ${pick ? 'ring-1 ring-ember-500/40' : ''}`}>
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl" style={{ background: `${color}1f`, color }}>
          <Icon size={18} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-2">
            <span className="truncate text-sm font-medium text-fog-50">{p.name || cap(t(`kind.${p.kind}`))}</span>
            {pick && <span className="shrink-0 rounded-full bg-ember-500/15 px-1.5 py-px text-[10px] font-medium text-ember-400">{t('map.scoutPick')}</span>}
          </span>
          <span className="block truncate text-xs text-fog-500">
            {cap(t(`kind.${p.kind}`))} · {fmtDistance(p.distance)} · {t('map.minWalk', { n: walkMinutes(p.distance) })}
            {p.openNow ? ` · ${t('map.openNow')}` : ''}
          </span>
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
  const { t } = useTranslation()
  const d = distance(origin, p)
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
          <div className="text-[11px] text-fog-500">{cap(t(`kind.${p.kind}`))}</div>
          <h3 className="text-lg leading-tight font-medium text-fog-50">{p.name || cap(t(`kind.${p.kind}`))}</h3>
          {p.address && <p className="mt-1 text-xs text-fog-400">{p.address}</p>}
          <p className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-fog-300">
            <span>
              {fmtDistance(d)} · {t('map.minWalk', { n: walkMinutes(d) })}
            </span>
            {p.rating && (
              <span className="flex items-center gap-0.5 text-amber-glow">
                <Star size={11} fill="currentColor" /> {p.rating.toFixed(1)} {p.ratingCount ? <span className="text-fog-500">({p.ratingCount})</span> : null}
              </span>
            )}
            {p.openNow != null && <span className={p.openNow ? 'text-moss-400' : 'text-alert-500'}>{p.openNow ? t('map.openNow') : t('map.closed')}</span>}
          </p>
        </div>
        <button onClick={onClose} className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-veil/5 text-fog-400" aria-label={t('common.close')}>
          <X size={15} />
        </button>
      </div>
      <div className="mt-4 grid grid-cols-[1fr_auto_auto] gap-2">
        <Pressable onClick={() => nav('walking')} className="flex items-center justify-center gap-2 rounded-full bg-ember-500 py-2.5 text-sm font-semibold text-onaccent">
          <Navigation size={16} /> {t('map.walkThere')}
        </Pressable>
        <Pressable onClick={() => nav('transit')} className="grid h-10 w-11 place-items-center rounded-full bg-veil/[0.06]" aria-label={t('map.transitDirections')}>
          <TrainFront size={17} />
        </Pressable>
        <Pressable onClick={() => nav('driving')} className="grid h-10 w-11 place-items-center rounded-full bg-veil/[0.06]" aria-label={t('map.drivingDirections')}>
          <Car size={17} />
        </Pressable>
      </div>
      {p.phone && (
        <a href={`tel:${p.phone}`} className="mt-2 flex items-center justify-center gap-2 rounded-full bg-veil/[0.04] py-2 text-sm text-fog-300">
          <Phone size={14} /> {p.phone}
        </a>
      )}
    </motion.section>
  )
}
