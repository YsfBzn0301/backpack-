/**
 * Weather. OpenWeatherMap (current + 5-day/3-hour forecast) when a key is set,
 * otherwise Open-Meteo, which needs no key. Both normalise to `Weather`.
 */
import type { WeatherKind } from '@/agents/protocol'
import { keys } from '@/lib/settings'

export interface DailyForecast {
  date: string
  min: number
  max: number
  kind: WeatherKind
  pop: number
}

export interface Weather {
  tempC: number
  feelsC: number
  humidity: number
  windKph: number
  kind: WeatherKind
  description: string
  isDay: boolean
  utcOffsetSec: number
  city?: string
  countryCode?: string
  daily: DailyForecast[]
  provider: 'openweathermap' | 'open-meteo'
  fetchedAt: number
}

const owmKind = (id: number): WeatherKind =>
  id < 300 ? 'thunder' : id < 400 ? 'drizzle' : id < 600 ? 'rain' : id < 700 ? 'snow' : id < 800 ? 'mist' : id === 800 ? 'clear' : 'clouds'

const wmoKind = (code: number): WeatherKind =>
  code === 0 || code === 1 ? 'clear' : code <= 3 ? 'clouds' : code <= 48 ? 'mist' : code <= 57 ? 'drizzle' : code <= 67 || (code >= 80 && code <= 82) ? 'rain' : code <= 77 || code === 85 || code === 86 ? 'snow' : 'thunder'

const WMO_TEXT: Record<number, string> = {
  0: 'clear sky', 1: 'mainly clear', 2: 'partly cloudy', 3: 'overcast', 45: 'fog', 48: 'freezing fog', 51: 'light drizzle', 53: 'drizzle',
  55: 'heavy drizzle', 56: 'freezing drizzle', 57: 'freezing drizzle', 61: 'light rain', 63: 'rain', 65: 'heavy rain', 66: 'freezing rain',
  67: 'freezing rain', 71: 'light snow', 73: 'snow', 75: 'heavy snow', 77: 'snow grains', 80: 'rain showers', 81: 'rain showers',
  82: 'violent showers', 85: 'snow showers', 86: 'snow showers', 95: 'thunderstorm', 96: 'thunderstorm with hail', 99: 'thunderstorm with hail',
}

async function getJson<T>(url: string): Promise<T> {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`weather ${res.status}`)
  return res.json()
}

export async function fetchWeather(lat: number, lng: number): Promise<Weather> {
  const key = keys.openWeather()
  if (key) {
    try {
      return await openWeather(lat, lng, key)
    } catch {
      /* fall through to Open-Meteo */
    }
  }
  return openMeteo(lat, lng)
}

async function openWeather(lat: number, lng: number, key: string): Promise<Weather> {
  const base = 'https://api.openweathermap.org/data/2.5'
  const q = `lat=${lat}&lon=${lng}&units=metric&appid=${key}`
  type Cur = { weather: { id: number; description: string; icon: string }[]; main: { temp: number; feels_like: number; humidity: number }; wind: { speed: number }; timezone: number; name: string; sys: { country: string; sunrise: number; sunset: number }; dt: number }
  type Fc = { list: { dt: number; main: { temp_min: number; temp_max: number }; weather: { id: number }[]; pop: number }[]; city: { timezone: number } }
  const [cur, fc] = await Promise.all([getJson<Cur>(`${base}/weather?${q}`), getJson<Fc>(`${base}/forecast?${q}`)])

  const days = new Map<string, { min: number; max: number; ids: number[]; pop: number }>()
  for (const item of fc.list) {
    const local = new Date((item.dt + fc.city.timezone) * 1000)
    const date = local.toISOString().slice(0, 10)
    const d = days.get(date) ?? { min: Infinity, max: -Infinity, ids: [], pop: 0 }
    d.min = Math.min(d.min, item.main.temp_min)
    d.max = Math.max(d.max, item.main.temp_max)
    d.ids.push(item.weather[0]?.id ?? 800)
    d.pop = Math.max(d.pop, item.pop)
    days.set(date, d)
  }
  const daily = [...days.entries()].slice(0, 6).map(([date, d]) => {
    // Use the most "severe" condition of the day: storms > rain > clouds.
    const id = d.ids.reduce((a, b) => (owmSeverity(b) > owmSeverity(a) ? b : a), 800)
    return { date, min: d.min, max: d.max, kind: owmKind(id), pop: Math.round(d.pop * 100) }
  })
  const w = cur.weather[0]
  return {
    tempC: cur.main.temp,
    feelsC: cur.main.feels_like,
    humidity: cur.main.humidity,
    windKph: cur.wind.speed * 3.6,
    kind: owmKind(w?.id ?? 800),
    description: w?.description ?? '',
    isDay: w?.icon?.endsWith('d') ?? (cur.dt > cur.sys.sunrise && cur.dt < cur.sys.sunset),
    utcOffsetSec: cur.timezone,
    city: cur.name || undefined,
    countryCode: cur.sys.country || undefined,
    daily,
    provider: 'openweathermap',
    fetchedAt: Date.now(),
  }
}
const owmSeverity = (id: number) => (id < 300 ? 5 : id < 600 ? 4 : id < 700 ? 3 : id < 800 ? 2 : id === 800 ? 0 : 1)

async function openMeteo(lat: number, lng: number): Promise<Weather> {
  type R = {
    utc_offset_seconds: number
    current: { temperature_2m: number; apparent_temperature: number; relative_humidity_2m: number; wind_speed_10m: number; weather_code: number; is_day: number }
    daily: { time: string[]; weather_code: number[]; temperature_2m_max: number[]; temperature_2m_min: number[]; precipitation_probability_max: (number | null)[] }
  }
  const url =
    `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}` +
    '&current=temperature_2m,apparent_temperature,relative_humidity_2m,wind_speed_10m,weather_code,is_day' +
    '&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max&timezone=auto&forecast_days=6'
  const r = await getJson<R>(url)
  return {
    tempC: r.current.temperature_2m,
    feelsC: r.current.apparent_temperature,
    humidity: r.current.relative_humidity_2m,
    windKph: r.current.wind_speed_10m,
    kind: wmoKind(r.current.weather_code),
    description: WMO_TEXT[r.current.weather_code] ?? '',
    isDay: r.current.is_day === 1,
    utcOffsetSec: r.utc_offset_seconds,
    daily: r.daily.time.map((date, i) => ({
      date,
      min: r.daily.temperature_2m_min[i],
      max: r.daily.temperature_2m_max[i],
      kind: wmoKind(r.daily.weather_code[i]),
      pop: r.daily.precipitation_probability_max[i] ?? 0,
    })),
    provider: 'open-meteo',
    fetchedAt: Date.now(),
  }
}
