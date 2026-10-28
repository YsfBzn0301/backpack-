import { useQuery } from '@tanstack/react-query'
import { fetchWeather } from '@/services/weather'
import type { Coords } from '@/agents/protocol'
import { keys } from '@/lib/settings'

export function useWeather(coords: Coords | null) {
  // Round to ~1 km so small GPS moves reuse the cached forecast.
  const lat = coords ? Math.round(coords.lat * 100) / 100 : null
  const lng = coords ? Math.round(coords.lng * 100) / 100 : null
  return useQuery({
    queryKey: ['weather', lat, lng, Boolean(keys.openWeather())],
    queryFn: () => fetchWeather(lat!, lng!),
    enabled: lat != null && lng != null,
    staleTime: 15 * 60_000,
    gcTime: 24 * 3600_000,
    refetchInterval: 20 * 60_000,
    retry: 1,
    networkMode: 'offlineFirst',
  })
}
