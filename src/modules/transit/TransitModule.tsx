/**
 * Public transit (ÖPNV): live departure boards for nearby stations and a
 * journey planner, via HAFAS (DB). Google Transit covers everywhere else.
 */
import { AnimatePresence, motion } from 'framer-motion'
import { AlertTriangle, ArrowDownUp, ChevronDown, ExternalLink, Footprints, Loader2, MapPin, RefreshCw, Search, TramFront, X } from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useAgentState } from '@/agents/host'
import type { SafetyState } from '@/agents/safety.worker'
import { activeCoords, location } from '@/lib/location'
import { createStore } from '@/lib/store'
import { haptic } from '@/lib/haptics'
import { fmtClock, fmtDistance, fmtDuration, fmtMoney, relativeTime } from '@/i18n/format'
import { departures, googleJourneys, googleTransitUrl, HAFAS_EUROPE, journeys, nearbyStops, searchLocations, type Departure, type Journey, type Leg, type Line, type Mode, type Place, type Stop } from '@/services/transit'
import { useMapsLoader } from '@/hooks/useMapsLoader'
import { useOnline } from '@/hooks/useOnline'
import { Segmented } from '@/components/ui/Segmented'
import { Pressable } from '@/components/ui/Pressable'
import { NeedLocation } from '@/modules/map/MapModule'

const MODE_STYLE: Record<Mode, { bg: string; fg: string }> = {
  express: { bg: '#e6edf3', fg: '#0d1117' },
  regional: { bg: '#8b949e', fg: '#0d1117' },
  suburban: { bg: '#3fa34d', fg: '#ffffff' },
  subway: { bg: '#2f6fdb', fg: '#ffffff' },
  tram: { bg: '#d6382f', fg: '#ffffff' },
  bus: { bg: '#8e4fc2', fg: '#ffffff' },
  ferry: { bg: '#1f8fbf', fg: '#ffffff' },
  taxi: { bg: '#f2c14e', fg: '#0d1117' },
  walk: { bg: 'transparent', fg: 'inherit' },
  other: { bg: '#3a4350', fg: '#ffffff' },
}

const view = createStore({ tab: 'board' as 'board' | 'route', stopId: '' }, 'backpack:transit')

export function LineBadge({ line }: { line: Line }) {
  const s = MODE_STYLE[line.mode]
  return (
    <span className="inline-flex h-6 min-w-9 shrink-0 items-center justify-center rounded-md px-1.5 text-[11px] font-bold tracking-tight" style={{ background: s.bg, color: s.fg }}>
      {line.name.replace(/^(Bus|STR|Tram)\s+/i, '') || '?'}
    </span>
  )
}

function Delay({ min, cancelled }: { min: number | null; cancelled?: boolean }) {
  const { t } = useTranslation()
  if (cancelled) return <span className="text-[11px] font-semibold text-alert-500">{t('transit.cancelled')}</span>
  if (min == null) return null
  if (min <= 0) return <span className="text-[11px] font-medium text-moss-400">{t('transit.onTime')}</span>
  return <span className={`tabular text-[11px] font-semibold ${min >= 5 ? 'text-alert-500' : 'text-amber-glow'}`}>+{min}</span>
}

export function TransitModule() {
  const { t } = useTranslation()
  const v = view.use()
  return (
    <div className="space-y-3">
      <Segmented
        stretch
        value={v.tab}
        onChange={(tab) => view.set({ tab })}
        options={[
          { value: 'board', label: t('transit.departures') },
          { value: 'route', label: t('transit.route') },
        ]}
      />
      <AnimatePresence mode="wait">
        <motion.div key={v.tab} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
          {v.tab === 'board' ? <Board /> : <RoutePlanner />}
        </motion.div>
      </AnimatePresence>
    </div>
  )
}

function Board() {
  const { t } = useTranslation()
  const loc = location.use()
  const { coords } = activeCoords(loc)
  const v = view.use()
  const online = useOnline()
  const stops = useQuery({
    queryKey: ['transit-stops', coords?.lat.toFixed(3), coords?.lng.toFixed(3)],
    queryFn: ({ signal }) => nearbyStops(coords!.lat, coords!.lng, signal),
    enabled: Boolean(coords),
    staleTime: 10 * 60_000,
    gcTime: 7 * 86400_000,
    retry: 1,
  })
  const stopId = stops.data?.some((s) => s.id === v.stopId) ? v.stopId : stops.data?.[0]?.id
  const stop = stops.data?.find((s) => s.id === stopId)
  const board = useQuery({
    queryKey: ['transit-board', stopId],
    queryFn: ({ signal }) => departures(stopId!, signal),
    enabled: Boolean(stopId),
    refetchInterval: 30_000,
    staleTime: 20_000,
    gcTime: 86400_000,
    retry: 1,
  })

  if (!coords) return <NeedLocation />
  if (stops.isLoading) return <Skeleton />
  if (stops.isError || !stops.data?.length) return <Coverage error={stops.isError} offline={!online} />

  const disrupted = board.data?.list.filter((d) => d.cancelled || (d.delayMin ?? 0) >= 5).length ?? 0

  return (
    <div className="space-y-3">
      <div className="no-scrollbar -mx-4 flex gap-1.5 overflow-x-auto px-4" data-no-swipe>
        {stops.data.slice(0, 8).map((s) => (
          <StopChip key={s.id} stop={s} active={s.id === stopId} onClick={() => view.set({ stopId: s.id })} />
        ))}
      </div>

      <section className="card overflow-hidden">
        <header className="flex items-center justify-between gap-3 border-b px-4 py-3 hairline">
          <div className="min-w-0">
            <h2 className="truncate text-[15px] font-semibold text-fog-50">{stop?.name}</h2>
            <p className="text-[11px] text-fog-500">
              {stop?.distance != null && `${fmtDistance(stop.distance)} · `}
              {board.data ? t('transit.updated', { time: relativeTime(board.data.updatedAt) }) : t('common.loading')}
            </p>
          </div>
          <button onClick={() => board.refetch()} className="flex items-center gap-1.5 rounded-full bg-veil/[0.06] px-2.5 py-1 text-[11px] text-fog-300" aria-label={t('common.refresh')}>
            <span className="relative flex h-1.5 w-1.5">
              <span className="absolute inset-0 animate-ping rounded-full bg-moss-400 opacity-70" />
              <span className="relative h-1.5 w-1.5 rounded-full bg-moss-400" />
            </span>
            {t('common.live')}
            <RefreshCw size={11} className={board.isFetching ? 'animate-spin' : ''} />
          </button>
        </header>
        {disrupted > 0 && (
          <div className="flex items-center gap-2 bg-amber-glow/10 px-4 py-2 text-xs text-amber-glow">
            <AlertTriangle size={13} /> {t('transit.disrupted', { count: disrupted })}
          </div>
        )}
        {board.isLoading ? (
          <div className="p-4">
            <Loader2 size={16} className="animate-spin text-fog-500" />
          </div>
        ) : board.isError ? (
          <p className="p-4 text-sm text-fog-400">{t('transit.boardFailed')}</p>
        ) : !board.data?.list.length ? (
          <p className="p-4 text-sm text-fog-400">{t('transit.noDepartures')}</p>
        ) : (
          <ul className="divide-y divide-veil/5">
            {board.data.list.slice(0, 30).map((d) => (
              <DepartureRow key={d.id} d={d} />
            ))}
          </ul>
        )}
      </section>
      <p className="px-1 text-[10px] text-fog-500">{t('transit.credit')}</p>
    </div>
  )
}

function StopChip({ stop, active, onClick }: { stop: Stop; active: boolean; onClick: () => void }) {
  return (
    <Pressable haptics="select" onClick={onClick} className={`flex shrink-0 items-center gap-2 rounded-2xl px-3 py-2 text-left ${active ? 'bg-fog-100 text-ink-900' : 'bg-ink-800 text-fog-300 hairline border'}`}>
      <span className="flex -space-x-1">
        {[...new Set(stop.modes)].slice(0, 3).map((m) => (
          <span key={m} className="h-2.5 w-2.5 rounded-full ring-2 ring-ink-800" style={{ background: MODE_STYLE[m].bg === 'transparent' ? '#8b949e' : MODE_STYLE[m].bg }} />
        ))}
      </span>
      <span className="max-w-40 truncate text-xs font-medium">{stop.name}</span>
      {stop.distance != null && <span className={`text-[10px] ${active ? 'text-ink-600' : 'text-fog-500'}`}>{fmtDistance(stop.distance)}</span>}
    </Pressable>
  )
}

function DepartureRow({ d }: { d: Departure }) {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)
  const mins = Math.round(((d.when ?? d.plannedWhen) - Date.now()) / 60_000)
  const platformChanged = d.platform && d.plannedPlatform && d.platform !== d.plannedPlatform
  return (
    <li>
      <button onClick={() => d.remarks.length && setOpen((o) => !o)} className={`flex w-full items-center gap-3 px-4 py-2.5 text-left ${d.cancelled ? 'opacity-60' : ''}`}>
        <div className="w-[4.5rem] shrink-0">
          <div className={`tabular text-sm font-medium whitespace-nowrap text-fog-50 ${d.cancelled ? 'line-through' : ''}`}>{fmtClock(new Date(d.plannedWhen))}</div>
          <Delay min={d.delayMin} cancelled={d.cancelled} />
        </div>
        <LineBadge line={d.line} />
        <div className="min-w-0 flex-1">
          <div className={`truncate text-sm text-fog-100 ${d.cancelled ? 'line-through' : ''}`}>{d.direction}</div>
          {d.remarks.length > 0 && (
            <div className="flex items-center gap-1 truncate text-[11px] text-amber-glow">
              <AlertTriangle size={10} className="shrink-0" /> {d.remarks[0].text}
            </div>
          )}
        </div>
        <div className="shrink-0 text-right">
          <div className="tabular text-xs text-fog-300">{mins <= 0 ? t('transit.now') : t('transit.inMin', { n: mins })}</div>
          {d.platform && (
            <div className={`text-[10px] ${platformChanged ? 'font-semibold text-amber-glow' : 'text-fog-500'}`}>
              {t('transit.platform', { p: d.platform })}
              {platformChanged ? ' !' : ''}
            </div>
          )}
        </div>
      </button>
      <AnimatePresence>
        {open && (
          <motion.ul initial={{ height: 0 }} animate={{ height: 'auto' }} exit={{ height: 0 }} className="overflow-hidden px-4 pb-2">
            {d.remarks.map((r, i) => (
              <li key={i} className="rounded-lg bg-amber-glow/10 px-2.5 py-1.5 text-[11px] leading-relaxed text-fog-300">
                {r.text}
              </li>
            ))}
          </motion.ul>
        )}
      </AnimatePresence>
    </li>
  )
}

function PlaceInput({ label, value, onPick, near, allowHere }: { label: string; value: Place | null; onPick: (p: Place | null) => void; near?: { lat: number; lng: number }; allowHere?: boolean }) {
  const { t } = useTranslation()
  const [q, setQ] = useState('')
  const [results, setResults] = useState<Place[]>([])
  const [focus, setFocus] = useState(false)
  useEffect(() => {
    if (q.trim().length < 2) return setResults([])
    const ctrl = new AbortController()
    const timer = setTimeout(() => {
      searchLocations(q, near, ctrl.signal)
        .then(setResults)
        .catch(() => {})
    }, 250)
    return () => {
      clearTimeout(timer)
      ctrl.abort()
    }
  }, [q, near])
  return (
    <div className="relative">
      <label className="flex items-center gap-2 rounded-xl bg-ink-900 px-3 py-2.5 hairline border focus-within:border-ember-500/40">
        <span className="w-14 shrink-0 truncate text-[11px] text-fog-500">{label}</span>
        {value && !focus ? (
          <button className="flex min-w-0 flex-1 items-center gap-1.5 text-left text-sm text-fog-50" onClick={() => setFocus(true)}>
            {value.kind === 'stop' ? <TramFront size={13} className="shrink-0 text-fog-500" /> : <MapPin size={13} className="shrink-0 text-fog-500" />}
            <span className="truncate">{value.name}</span>
          </button>
        ) : (
          <input
            autoFocus={focus}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onFocus={() => setFocus(true)}
            onBlur={() => setTimeout(() => setFocus(false), 180)}
            placeholder={t('transit.searchStop')}
            className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-fog-500"
          />
        )}
        {value && (
          <button onClick={() => onPick(null)} aria-label={t('common.clear')}>
            <X size={14} className="text-fog-500" />
          </button>
        )}
      </label>
      {focus && (results.length > 0 || allowHere) && (
        <ul className="glass-strong absolute inset-x-0 top-full z-20 mt-1 max-h-64 overflow-y-auto rounded-xl py-1 shadow-xl">
          {allowHere && near && (
            <li>
              <button
                onMouseDown={() => onPick({ name: t('transit.myLocation'), lat: near.lat, lng: near.lng, kind: 'address' })}
                className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-ember-400 hover:bg-veil/5"
              >
                <MapPin size={13} /> {t('transit.myLocation')}
              </button>
            </li>
          )}
          {results.map((r, i) => (
            <li key={`${r.id ?? r.name}-${i}`}>
              <button
                onMouseDown={() => {
                  onPick(r)
                  setQ('')
                }}
                className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-veil/5"
              >
                {r.kind === 'stop' ? <TramFront size={13} className="shrink-0 text-fog-500" /> : <MapPin size={13} className="shrink-0 text-fog-500" />}
                <span className="truncate">{r.name}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

function RoutePlanner() {
  const { t } = useTranslation()
  const loc = location.use()
  const { coords } = activeCoords(loc)
  const safety = useAgentState<SafetyState>('safety')
  const country = safety?.country.code ?? 'XX'
  const maps = useMapsLoader()
  const [from, setFrom] = useState<Place | null>(null)
  const [to, setTo] = useState<Place | null>(null)
  const [when, setWhen] = useState<string>('')
  const [submitted, setSubmitted] = useState(0)
  const origin = from ?? (coords ? { name: t('transit.myLocation'), lat: coords.lat, lng: coords.lng, kind: 'address' as const } : null)
  // HAFAS for Europe; Google Directions elsewhere when a Maps key is loaded.
  const useGoogle = !HAFAS_EUROPE.has(country) && maps === 'ready'

  const results = useQuery({
    queryKey: ['transit-journeys', origin?.id ?? `${origin?.lat},${origin?.lng}`, to?.id ?? to?.name, when, submitted, useGoogle],
    enabled: Boolean(origin && to && submitted),
    queryFn: ({ signal }) => {
      const dep = when ? new Date(when) : new Date()
      return useGoogle && origin?.lat != null ? googleJourneys({ lat: origin.lat, lng: origin.lng! }, to!, dep) : journeys(origin!, to!, dep, signal)
    },
    staleTime: 60_000,
    retry: 0,
  })

  return (
    <div className="space-y-3">
      <section className="card space-y-2 p-3">
        <PlaceInput label={t('transit.from')} value={from} onPick={setFrom} near={coords ?? undefined} allowHere />
        <div className="relative">
          <PlaceInput label={t('transit.to')} value={to} onPick={setTo} near={coords ?? undefined} />
          <button
            onClick={() => {
              haptic('select')
              const f = from
              setFrom(to)
              setTo(f)
            }}
            className="absolute -top-5 right-10 grid h-8 w-8 place-items-center rounded-full bg-ink-700 text-fog-300 ring-4 ring-ink-800"
            aria-label={t('transit.swap')}
          >
            <ArrowDownUp size={14} />
          </button>
        </div>
        <div className="flex gap-2">
          <input
            type="datetime-local"
            value={when}
            onChange={(e) => setWhen(e.target.value)}
            className="min-w-0 flex-1 rounded-xl bg-ink-900 px-3 py-2 text-xs text-fog-300 outline-none hairline border"
            aria-label={t('transit.departAt')}
          />
          <button
            onClick={() => {
              haptic('select')
              setSubmitted(Date.now())
            }}
            disabled={!origin || !to}
            className="flex shrink-0 items-center gap-1.5 rounded-xl bg-fog-100 px-4 text-sm font-semibold text-ink-900 disabled:opacity-40"
          >
            <Search size={14} /> {t('transit.find')}
          </button>
        </div>
        {!when && <p className="px-1 text-[10px] text-fog-500">{t('transit.departNow')}</p>}
      </section>

      {results.isFetching ? (
        <Skeleton />
      ) : results.isError ? (
        <div className="card p-4 text-sm text-fog-400">
          {t('transit.routeFailed')}
          {to && (
            <a href={googleTransitUrl(origin, to)} target="_blank" rel="noopener" className="mt-3 flex items-center gap-1.5 text-ember-400">
              <ExternalLink size={13} /> {t('transit.openGoogle')}
            </a>
          )}
        </div>
      ) : results.data ? (
        results.data.length ? (
          <ul className="space-y-2">
            {results.data.map((j) => (
              <JourneyCard key={j.id} j={j} />
            ))}
          </ul>
        ) : (
          <p className="card p-4 text-sm text-fog-400">{t('transit.noRoutes')}</p>
        )
      ) : null}

      {to && (
        <a href={googleTransitUrl(origin, to)} target="_blank" rel="noopener" className="flex items-center justify-center gap-1.5 rounded-full bg-veil/[0.05] py-2.5 text-xs text-fog-300">
          <ExternalLink size={13} /> {t('transit.openGoogle')}
        </a>
      )}
      <p className="px-1 text-[10px] text-fog-500">{useGoogle ? t('transit.creditGoogle') : t('transit.credit')}</p>
    </div>
  )
}

function JourneyCard({ j }: { j: Journey }) {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)
  const rides = j.legs.filter((l) => !l.walking)
  const issues = j.legs.some((l) => l.cancelled) ? 'cancelled' : j.legs.some((l) => (l.departureDelayMin ?? 0) >= 5 || (l.arrivalDelayMin ?? 0) >= 5) ? 'delayed' : null
  const first = j.legs.find((l) => !l.walking) ?? j.legs[0]
  const last = [...j.legs].reverse().find((l) => !l.walking) ?? j.legs[j.legs.length - 1]
  const dur = Math.round((j.arrival - j.departure) / 60_000)
  return (
    <li className={`card overflow-hidden ${issues === 'cancelled' ? 'ring-1 ring-alert-500/40' : ''}`}>
      <button onClick={() => setOpen((o) => !o)} className="w-full p-3.5 text-left" aria-expanded={open}>
        <div className="flex items-center justify-between">
          <div className="tabular text-base font-semibold text-fog-50">
            {fmtClock(new Date(j.departure))} → {fmtClock(new Date(j.arrival))}
          </div>
          <div className="flex items-center gap-2 text-xs text-fog-400">
            {fmtDuration(dur)}
            <ChevronDown size={14} className={`transition-transform ${open ? 'rotate-180' : ''}`} />
          </div>
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-1">
          {rides.map((l, i) => (
            <span key={i} className="flex items-center gap-1">
              {l.line && <LineBadge line={l.line} />}
              {i < rides.length - 1 && <span className="text-fog-500">›</span>}
            </span>
          ))}
          {!rides.length && <Footprints size={14} className="text-fog-400" />}
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-fog-500">
          <span>{t('transit.transfers', { count: j.transfers })}</span>
          {first?.departurePlatform && <span>{t('transit.fromPlatform', { p: first.departurePlatform })}</span>}
          {j.price && <span>{fmtMoney(j.price.amount, j.price.currency)}</span>}
          {issues && (
            <span className={`flex items-center gap-1 font-medium ${issues === 'cancelled' ? 'text-alert-500' : 'text-amber-glow'}`}>
              <AlertTriangle size={11} /> {t(`transit.${issues}`)}
            </span>
          )}
          {last?.arrivalDelayMin != null && last.arrivalDelayMin > 0 && <span className="text-amber-glow">{t('transit.arrivesLate', { n: last.arrivalDelayMin })}</span>}
        </div>
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.ol initial={{ height: 0 }} animate={{ height: 'auto' }} exit={{ height: 0 }} className="overflow-hidden border-t hairline">
            {j.legs.map((l, i) => (
              <LegRow key={i} l={l} />
            ))}
          </motion.ol>
        )}
      </AnimatePresence>
    </li>
  )
}

function LegRow({ l }: { l: Leg }) {
  const { t } = useTranslation()
  if (l.walking)
    return (
      <li className="flex items-center gap-3 px-4 py-2 text-xs text-fog-500">
        <Footprints size={14} className="shrink-0" />
        {t('transit.walk', { dist: l.distance ? fmtDistance(l.distance) : '', dur: fmtDuration(Math.max(1, Math.round((l.arrival - l.departure) / 60_000))) })}
      </li>
    )
  return (
    <li className="px-4 py-2.5">
      <div className="flex items-center gap-2">
        {l.line && <LineBadge line={l.line} />}
        <span className="truncate text-xs text-fog-400">{l.direction}</span>
      </div>
      <div className="mt-1.5 grid grid-cols-[auto_1fr_auto] gap-x-3 gap-y-1 text-xs">
        <span className="tabular text-fog-50">{fmtClock(new Date(l.plannedDeparture))}</span>
        <span className="truncate text-fog-300">{l.origin}</span>
        <span className="flex items-center gap-2 text-fog-500">
          <Delay min={l.departureDelayMin} cancelled={l.cancelled} />
          {l.departurePlatform && t('transit.platform', { p: l.departurePlatform })}
        </span>
        <span className="tabular text-fog-50">{fmtClock(new Date(l.plannedArrival))}</span>
        <span className="truncate text-fog-300">{l.destination}</span>
        <span className="flex items-center gap-2 text-fog-500">
          <Delay min={l.arrivalDelayMin} />
          {l.arrivalPlatform && t('transit.platform', { p: l.arrivalPlatform })}
        </span>
      </div>
      {l.remarks.map((r, i) => (
        <p key={i} className="mt-1.5 rounded-lg bg-amber-glow/10 px-2 py-1 text-[11px] text-fog-300">
          {r.text}
        </p>
      ))}
    </li>
  )
}

function Skeleton() {
  return (
    <div className="space-y-2">
      {[0, 1, 2].map((i) => (
        <div key={i} className="card h-20 animate-pulse" />
      ))}
    </div>
  )
}

function Coverage({ error, offline }: { error: boolean; offline: boolean }) {
  const { t } = useTranslation()
  const loc = location.use()
  const { coords } = activeCoords(loc)
  const url = useMemo(() => (coords ? `https://www.google.com/maps/@${coords.lat},${coords.lng},15z/data=!5m1!1e2` : 'https://www.google.com/maps'), [coords])
  return (
    <div className="card p-5">
      <TramFront size={22} className="text-fog-500" />
      <p className="mt-3 text-sm text-fog-300">{offline ? t('transit.offline') : error ? t('transit.unavailable') : t('transit.noStops')}</p>
      <a href={url} target="_blank" rel="noopener" className="mt-3 inline-flex items-center gap-1.5 text-sm text-ember-400">
        <ExternalLink size={13} /> {t('transit.openGoogleLayer')}
      </a>
    </div>
  )
}
