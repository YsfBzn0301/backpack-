import type { UseQueryResult } from '@tanstack/react-query'
import type { Weather } from '@/services/weather'
import { WeatherCard } from '@/components/weather/WeatherCard'
import { KeyHelp } from '@/components/KeyHelp'
import { location } from '@/lib/location'
import { ui } from '@/lib/ui'
import { AgentTicker, InsightList } from './AgentFeed'
import { BackpackDailyQuote } from './BackpackDailyQuote'
import { LocationPermissionCard } from './LocationPermissionCard'
import { QuickActions } from './QuickActions'
import { ScoutPicks } from './ScoutPicks'

export function HomeModule({ weather, placeName }: { weather: UseQueryResult<Weather>; placeName: string }) {
  const gpsStatus = location.use((s) => s.gpsStatus)
  const searched = location.use((s) => s.searched)
  // No GPS and nothing searched: explain instead of showing an empty card.
  const blocked = !searched && (gpsStatus === 'denied' || gpsStatus === 'unavailable') && !weather.data
  return (
    <div className="space-y-5">
      {blocked ? <LocationPermissionCard /> : <WeatherCard query={weather} placeName={placeName} onLocate={() => ui.set({ searchOpen: true })} />}
      {!blocked && <KeyHelp service="openweather" variant="compact" />}
      <BackpackDailyQuote />
      <QuickActions />
      <AgentTicker />
      <ScoutPicks />
      <InsightList />
    </div>
  )
}
