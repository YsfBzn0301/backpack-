/**
 * Message protocol shared by the main-thread AgentHost and the agent Web Workers.
 *
 * Agents never touch the DOM. They receive a shared AgentContext, run tasks on
 * request, publish state and insights, and call "tools" that the host fulfils
 * (anything that needs window-only APIs, such as the Google Places SDK).
 */
export type AgentName = 'scout' | 'translate' | 'budget' | 'safety'

/**
 * Agents never produce finished sentences. They emit translation keys plus
 * typed variables; the UI renders them in the current language and units.
 */
export type MsgVar =
  | string
  | number
  | Msg
  | { t: 'time'; ts: number; off: number }
  | { t: 'dist'; m: number }
  | { t: 'money'; amount: number; cur: string }
  | { t: 'country'; code: string }
  | { t: 'lang'; code: string }
  | { t: 'temp'; c: number }
  | { t: 'dur'; min: number }
  /** An opening_hours-style window, shown with localised weekday names. */
  | { t: 'hours'; spec: string }
  | { t: 'list'; items: MsgVar[] }
export interface Msg {
  k: string
  v?: Record<string, MsgVar>
}
export const msg = (k: string, v?: Record<string, MsgVar>): Msg => (v ? { k, v } : { k })

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
  weather?: { tempC: number; kind: WeatherKind; description: string; wmo?: number; humidity: number; isDay: boolean }
  /** UTC offset of the context location, seconds. */
  utcOffsetSec: number
  online: boolean
  homeCurrency: string
  homeCountry: string
  radius: number
  /** UI language; agents only use it for things like translator defaults. */
  lang: string
  /** Road-trip mode: Scout also scouts parking, Budget watches parking costs. */
  driving: boolean
  vehicleHeightM: number
  parkingBudgetDaily: number
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
  | 'fuel'
  | 'parking'

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
  label: Msg
  type: 'tab' | 'screen' | 'sos' | 'directions' | 'place' | 'parking'
  payload?: unknown
}

export interface Insight {
  id: string
  agent: AgentName
  kind: 'suggestion' | 'alert' | 'info' | 'deal'
  title: Msg
  body: Msg
  /** 0 = low … 3 = urgent */
  priority: 0 | 1 | 2 | 3
  ts: number
  /** Milliseconds until the insight goes stale. */
  ttl?: number
  /** Insights sharing a key replace each other. */
  key: string
  action?: InsightAction
}

export type ParkingType = 'garage' | 'underground' | 'surface' | 'street' | 'rooftop' | 'unknown'

/** A time window in opening_hours syntax subset, e.g. "Mo-Sa 18:00-08:00; Su". */
export type HoursSpec = string

export interface ParkingRate {
  amount: number
  currency: string
  /** Billing unit in minutes (60 = hourly, 1440 = daily, 0 = flat fee). */
  unitMin: number
  /** Only applies inside this window. */
  when?: HoursSpec
}

export interface ParkingLot {
  id: string
  name: string
  lat: number
  lng: number
  source: 'osm' | 'google' | 'parkendd' | 'custom'
  type: ParkingType
  /** true paid, false free, null unknown. */
  fee: boolean | null
  rates: ParkingRate[]
  freeWhen?: HoursSpec
  paidWhen?: HoursSpec
  freeFirstMin?: number
  maxStayMin?: number
  maxStayWhen?: HoursSpec
  disc?: boolean
  capacity?: number
  /** Live free spaces (where a real-time source exists). */
  free?: number
  liveAt?: number
  state?: 'open' | 'closed' | 'unknown'
  ev?: number | boolean
  disabled?: number | boolean
  maxHeightM?: number
  payment: ('app' | 'machine' | 'cash' | 'card' | 'coins' | 'contactless')[]
  hours?: HoursSpec
  customersOnly?: boolean
  operator?: string
  website?: string
  address?: string
}

export interface ToolCalls {
  'places.nearby': { args: { lat: number; lng: number; radius: number; kinds: PlaceKind[]; limit?: number }; result: Place[] }
  'parking.nearby': { args: { lat: number; lng: number; radius: number; country?: string }; result: ParkingLot[] }
  /** Ask another agent to run a task; the host routes it. */
  'agent.run': { args: { agent: AgentName; task: string; payload?: unknown }; result: unknown }
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
