/**
 * Message protocol shared by the main-thread AgentHost and the agent Web Workers.
 *
 * Agents never touch the DOM. They receive a shared AgentContext, run tasks on
 * request, publish state and insights, and call "tools" that the host fulfils
 * (anything that needs window-only APIs, such as the Google Places SDK).
 */
export type AgentName = 'scout' | 'translate' | 'budget' | 'safety'

export type WeatherKind = 'clear' | 'clouds' | 'rain' | 'drizzle' | 'thunder' | 'snow' | 'mist'

export interface Coords {
  lat: number
  lng: number
  accuracy?: number
}

export interface AgentContext {
  coords: Coords | null
  /** Where coords came from: live GPS or a destination the user searched. */
  source: 'gps' | 'search' | 'none'
  placeName?: string
  /** Country hint from weather / search. SafetyAgent reads this as a fallback. */
  countryHint?: string
  /** Country resolved by SafetyAgent. Other agents should prefer this. */
  country?: string
  weather?: { tempC: number; kind: WeatherKind; description: string; humidity: number; isDay: boolean }
  /** UTC offset of the context location, seconds. */
  utcOffsetSec: number
  online: boolean
  homeCurrency: string
  homeCountry: string
  radius: number
  now: number
}

export type PlaceKind =
  | 'atm'
  | 'hostel'
  | 'street_food'
  | 'restaurant'
  | 'cafe'
  | 'convenience'
  | 'bar'
  | 'pharmacy'
  | 'hospital'
  | 'bus'
  | 'embassy'
  | 'police'

export interface Place {
  id: string
  name: string
  lat: number
  lng: number
  kind: PlaceKind
  rating?: number
  ratingCount?: number
  openNow?: boolean
  address?: string
  phone?: string
  source: 'google' | 'osm'
}

export interface InsightAction {
  label: string
  type: 'tab' | 'sos' | 'directions' | 'place'
  payload?: unknown
}

export interface Insight {
  id: string
  agent: AgentName
  kind: 'suggestion' | 'alert' | 'info' | 'deal'
  title: string
  body: string
  /** 0 = low … 3 = urgent */
  priority: 0 | 1 | 2 | 3
  ts: number
  /** Milliseconds until the insight goes stale. */
  ttl?: number
  /** Insights sharing a key replace each other. */
  key: string
  action?: InsightAction
}

export interface ToolCalls {
  'places.nearby': { args: { lat: number; lng: number; radius: number; kinds: PlaceKind[]; limit?: number }; result: Place[] }
}
export type ToolName = keyof ToolCalls

export type HostMessage =
  | { type: 'context'; context: AgentContext }
  | { type: 'task'; id: string; task: string; payload: unknown }
  | { type: 'tool-result'; id: string; ok: true; result: unknown }
  | { type: 'tool-result'; id: string; ok: false; error: string }

export type AgentStatus = 'booting' | 'idle' | 'thinking' | 'error'

export type WorkerMessage =
  | { type: 'ready' }
  | { type: 'status'; status: AgentStatus; detail?: string }
  | { type: 'insight'; insight: Insight }
  | { type: 'retract'; key: string }
  | { type: 'state'; state: unknown }
  | { type: 'result'; id: string; ok: true; result: unknown }
  | { type: 'result'; id: string; ok: false; error: string }
  | { type: 'tool'; id: string; tool: ToolName; args: unknown }
