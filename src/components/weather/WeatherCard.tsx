import { motion } from 'framer-motion'
import { Droplets, MapPin, RefreshCw, Thermometer, Wind } from 'lucide-react'
import type { UseQueryResult } from '@tanstack/react-query'
import type { Weather } from '@/services/weather'
import { WeatherAmbience } from './WeatherAmbience'
import { WeatherIcon, weatherAccent } from './WeatherIcon'
import { formatClock, relativeTime, timeAtOffset } from '@/lib/format'
import { useNow } from '@/hooks/useNow'
import { settings } from '@/lib/settings'

const toUnit = (c: number, units: 'metric' | 'imperial') => Math.round(units === 'imperial' ? (c * 9) / 5 + 32 : c)

export function WeatherCard({ query, placeName, onLocate }: { query: UseQueryResult<Weather>; placeName: string; onLocate: () => void }) {
  const w = query.data
  const now = useNow(30_000)
  const units = settings.use((s) => s.units)
  const local = w ? timeAtOffset(w.utcOffsetSec, now) : now
  const accent = weatherAccent(w?.kind, w?.isDay ?? true)

  return (
    <motion.section layout className="card relative overflow-hidden p-5" style={{ boxShadow: `0 30px 60px -40px ${accent}66` }}>
      <WeatherAmbience kind={w?.kind} isDay={w?.isDay ?? true} />
      <div className="relative">
        <div className="flex items-start justify-between gap-3">
          <button onClick={onLocate} className="group flex min-w-0 items-center gap-1.5 text-left">
            <MapPin size={14} className="shrink-0 text-ember-500" />
            <span className="truncate text-sm font-medium text-fog-300 group-hover:text-fog-100">{placeName}</span>
          </button>
          <span className="tabular shrink-0 font-mono text-xs text-fog-400">{formatClock(local)} local</span>
        </div>

        {w ? (
          <>
            <div className="mt-4 flex items-end justify-between">
              <div>
                <div className="flex items-start">
                  <span className="tabular text-[64px] leading-none font-light tracking-[-0.04em] text-fog-50">{toUnit(w.tempC, units)}</span>
                  <span className="mt-2 text-2xl font-light text-fog-400">°{units === 'imperial' ? 'F' : 'C'}</span>
                </div>
                <p className="mt-2 text-sm capitalize text-fog-300">{w.description}</p>
              </div>
              <div className="mb-1 grid h-16 w-16 place-items-center rounded-2xl bg-white/[0.04]" style={{ color: accent }}>
                <WeatherIcon kind={w.kind} isDay={w.isDay} size={34} />
              </div>
            </div>
            <div className="mt-5 grid grid-cols-3 gap-2 text-xs">
              <Stat icon={<Droplets size={13} />} label="Humidity" value={`${Math.round(w.humidity)}%`} />
              <Stat icon={<Thermometer size={13} />} label="Feels" value={`${toUnit(w.feelsC, units)}°`} />
              <Stat icon={<Wind size={13} />} label="Wind" value={units === 'imperial' ? `${Math.round(w.windKph / 1.609)} mph` : `${Math.round(w.windKph)} km/h`} />
            </div>
            {w.daily.length > 1 && (
              <div className="no-scrollbar mt-4 -mx-1 flex gap-1 overflow-x-auto" data-no-swipe>
                {w.daily.slice(0, 6).map((d, i) => (
                  <div key={d.date} className="flex min-w-[52px] flex-1 flex-col items-center gap-1 rounded-xl px-1 py-2 text-[11px]">
                    <span className="text-fog-500">{i === 0 ? 'Today' : new Date(d.date + 'T12:00:00').toLocaleDateString([], { weekday: 'short' })}</span>
                    <WeatherIcon kind={d.kind} size={16} className="text-fog-300" />
                    <span className="tabular text-fog-100">{toUnit(d.max, units)}°</span>
                    <span className="tabular text-fog-500">{toUnit(d.min, units)}°</span>
                  </div>
                ))}
              </div>
            )}
            <div className="mt-3 flex items-center justify-between text-[10px] text-fog-500">
              <span>{w.provider === 'openweathermap' ? 'OpenWeatherMap' : 'Open-Meteo'} · updated {relativeTime(w.fetchedAt)}</span>
              <button onClick={() => query.refetch()} className="flex items-center gap-1 hover:text-fog-300" aria-label="Refresh weather">
                <RefreshCw size={11} className={query.isFetching ? 'animate-spin' : ''} />
              </button>
            </div>
          </>
        ) : (
          <WeatherPlaceholder loading={query.isLoading} error={query.isError} onLocate={onLocate} />
        )}
      </div>
    </motion.section>
  )
}

function Stat({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="rounded-xl bg-white/[0.035] px-3 py-2">
      <div className="flex items-center gap-1 text-fog-500">
        {icon}
        {label}
      </div>
      <div className="tabular mt-0.5 font-medium text-fog-100">{value}</div>
    </div>
  )
}

function WeatherPlaceholder({ loading, error, onLocate }: { loading: boolean; error: boolean; onLocate: () => void }) {
  if (loading)
    return (
      <div className="mt-4 space-y-3">
        <div className="h-14 w-32 animate-pulse rounded-xl bg-white/5" />
        <div className="h-4 w-40 animate-pulse rounded bg-white/5" />
        <div className="grid grid-cols-3 gap-2">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-12 animate-pulse rounded-xl bg-white/5" />
          ))}
        </div>
      </div>
    )
  return (
    <div className="mt-5">
      <p className="text-lg font-medium text-fog-100">{error ? 'Weather unavailable' : 'Where are you headed?'}</p>
      <p className="mt-1 text-sm text-fog-400">{error ? 'Showing nothing rather than stale guesses. Try again when you have signal.' : 'Share your location or search a destination to see local weather and time.'}</p>
      <button onClick={onLocate} className="mt-4 rounded-full bg-fog-100 px-4 py-2 text-sm font-medium text-ink-900">
        Choose location
      </button>
    </div>
  )
}
