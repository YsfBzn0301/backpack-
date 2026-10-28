import type { UseQueryResult } from '@tanstack/react-query'
import type { Weather } from '@/services/weather'
import { WeatherCard } from '@/components/weather/WeatherCard'
import { ui } from '@/lib/ui'
import { AgentTicker, InsightList } from './AgentFeed'
import { QuickActions } from './QuickActions'
import { ScoutPicks } from './ScoutPicks'

export function HomeModule({ weather, placeName }: { weather: UseQueryResult<Weather>; placeName: string }) {
  return (
    <div className="space-y-5">
      <WeatherCard query={weather} placeName={placeName} onLocate={() => ui.set({ searchOpen: true })} />
      <AgentTicker />
      <QuickActions />
      <ScoutPicks />
      <InsightList />
    </div>
  )
}
