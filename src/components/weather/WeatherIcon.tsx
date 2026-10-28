import { Cloud, CloudDrizzle, CloudFog, CloudLightning, CloudMoon, CloudRain, CloudSun, Moon, Snowflake, Sun } from 'lucide-react'
import type { WeatherKind } from '@/agents/protocol'

export function WeatherIcon({ kind, isDay = true, size = 20, className }: { kind: WeatherKind; isDay?: boolean; size?: number; className?: string }) {
  const p = { size, className, strokeWidth: 1.75 }
  switch (kind) {
    case 'clear':
      return isDay ? <Sun {...p} /> : <Moon {...p} />
    case 'clouds':
      return isDay ? <CloudSun {...p} /> : <CloudMoon {...p} />
    case 'rain':
      return <CloudRain {...p} />
    case 'drizzle':
      return <CloudDrizzle {...p} />
    case 'thunder':
      return <CloudLightning {...p} />
    case 'snow':
      return <Snowflake {...p} />
    case 'mist':
      return <CloudFog {...p} />
    default:
      return <Cloud {...p} />
  }
}

/** Accent colour per condition, used for glows and highlights. */
export function weatherAccent(kind?: WeatherKind, isDay = true) {
  if (!kind) return '#ff6b4a'
  if (kind === 'clear') return isDay ? '#ffb347' : '#8fa8ff'
  if (kind === 'rain' || kind === 'drizzle') return '#6cb6ff'
  if (kind === 'thunder') return '#b38cff'
  if (kind === 'snow') return '#cfe6ff'
  if (kind === 'mist') return '#9fb2c4'
  return isDay ? '#ffc58a' : '#7d8ca8'
}
