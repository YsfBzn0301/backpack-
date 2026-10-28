import { useEffect, useRef, useState } from 'react'
import { agents, useAgentState } from '@/agents/host'
import type { AgentContext } from '@/agents/protocol'
import type { SafetyState } from '@/agents/safety.worker'
import { activeCoords, location } from '@/lib/location'
import { keys, settings } from '@/lib/settings'
import { useGeolocation } from './useGeolocation'
import { useOnline } from './useOnline'
import { useWeather } from './useWeather'

/**
 * Builds the shared AgentContext from app state and broadcasts it whenever
 * something meaningful changes (and once a minute so time-based rules fire).
 */
export function useAgentBridge() {
  useGeolocation()
  const loc = location.use()
  const online = useOnline()
  const s = settings.use()
  const { coords, source } = activeCoords(loc)
  const weather = useWeather(coords)
  const safety = useAgentState<SafetyState>('safety')
  const [tick, setTick] = useState(0)
  const lastSent = useRef('')

  useEffect(() => {
    agents.start()
  }, [])

  // Keep agent configuration in sync with settings.
  useEffect(() => {
    agents.run('translate', 'configure', { endpoint: keys.translateEndpoint() }).catch(() => {})
  }, [s.translateEndpoint])
  useEffect(() => {
    agents.run('budget', 'configure', { oxrAppId: keys.oxr() }).catch(() => {})
  }, [])

  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 60_000)
    return () => clearInterval(id)
  }, [])

  const w = weather.data
  const resolved = safety?.country.code && safety.country.code !== 'XX' ? safety.country.code : undefined

  useEffect(() => {
    const ctx: AgentContext = {
      coords,
      source,
      placeName: loc.searched?.name ?? w?.city ?? safety?.city ?? undefined,
      countryHint: loc.searched?.countryCode ?? w?.countryCode,
      country: source === 'search' ? (loc.searched?.countryCode ?? resolved) : resolved,
      weather: w ? { tempC: w.tempC, kind: w.kind, description: w.description, humidity: w.humidity, isDay: w.isDay } : undefined,
      utcOffsetSec: w?.utcOffsetSec ?? -new Date().getTimezoneOffset() * 60,
      online,
      homeCurrency: s.homeCurrency,
      homeCountry: s.homeCountry,
      radius: s.scoutRadius,
      now: Date.now(),
    }
    // Skip re-broadcasting identical context (except the minute tick).
    const sig = JSON.stringify({ ...ctx, now: Math.floor(ctx.now / 60_000) })
    if (sig === lastSent.current) return
    lastSent.current = sig
    agents.setContext(ctx)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [coords?.lat, coords?.lng, source, w?.fetchedAt, online, s.homeCurrency, s.homeCountry, s.scoutRadius, resolved, tick, loc.searched?.name])

  return { coords, source, weather, online, gpsStatus: loc.gpsStatus }
}
