/**
 * Central feature registry. The Help Center renders one tutorial card per
 * entry, so registering a feature (or a new sub-agent) here is all it takes
 * to document it. Text comes from `help.f.<id>.*` in the locale files; the
 * English `fallback` keeps a freshly registered entry readable before it has
 * been translated.
 */
import {
  ArrowLeftRight,
  Bot,
  Camera,
  CloudSun,
  Coins,
  Languages,
  ListChecks,
  Map,
  Music2,
  Palette,
  Quote,
  Radar,
  Scooter,
  ScanLine,
  ShieldAlert,
  Siren,
  SquareParking,
  TramFront,
  Vault,
  WifiOff,
  type LucideIcon,
} from 'lucide-react'
import type { AgentName } from '@/agents/protocol'
import type { Screen, Tab } from '@/lib/ui'

export type FeatureGroup = 'today' | 'explore' | 'money' | 'talk' | 'safety' | 'tools' | 'agents'
export type DemoId =
  | 'weather'
  | 'quote'
  | 'feed'
  | 'parking'
  | 'transit'
  | 'map'
  | 'numpad'
  | 'waveform'
  | 'coverflow'
  | 'camera'
  | 'scanner'
  | 'checklist'
  | 'vault'
  | 'sos'
  | 'offline'
  | 'theme'
  | 'agent'

export type OpenTarget = { tab: Tab; mapMode?: 'places' | 'parking'; mapFilter?: string } | { screen: Screen } | { overlay: 'sos' | 'camera' | 'scanner' }

export interface FeatureEntry {
  id: string
  group: FeatureGroup
  Icon: LucideIcon
  color: string
  agent?: AgentName
  demo?: DemoId
  open?: OpenTarget
  offline?: boolean
  fallback: { title: string; summary: string; steps: [string, string, string] }
}

export const FEATURE_GROUPS: FeatureGroup[] = ['today', 'explore', 'money', 'talk', 'safety', 'tools', 'agents']

export const featuresRegistry: FeatureEntry[] = [
  {
    id: 'weather',
    group: 'today',
    Icon: CloudSun,
    color: '#ffb347',
    demo: 'weather',
    open: { tab: 'home' },
    offline: true,
    fallback: { title: 'Live weather & local time', summary: 'Weather, forecast and local time for where you are or where you are going.', steps: ['Allow location or tap the place name to search.', 'The card glows with the conditions: sun, rain, storm.', 'Swipe the forecast row for the next days.'] },
  },
  {
    id: 'daily',
    group: 'today',
    Icon: Quote,
    color: '#ff6b4a',
    demo: 'quote',
    open: { tab: 'home' },
    offline: true,
    fallback: { title: 'Backpack Daily', summary: 'A new quote every day: funny, motivating, adventurous or witty.', steps: ['One quote per day, the same for everyone.', 'Tap shuffle for another.', 'Share your favourite.'] },
  },
  {
    id: 'feed',
    group: 'today',
    Icon: Bot,
    color: '#ffb347',
    demo: 'feed',
    open: { tab: 'home' },
    fallback: { title: 'Agent feed', summary: 'Your four sub-agents post what matters right now.', steps: ['Suggestions, alerts and info appear as they happen.', 'Tap the action to act on one.', 'Swipe a card left to dismiss it.'] },
  },
  {
    id: 'map',
    group: 'explore',
    Icon: Map,
    color: '#6cb6ff',
    agent: 'scout',
    demo: 'map',
    open: { tab: 'map', mapMode: 'places' },
    fallback: { title: 'Map & nearby scout', summary: 'A dark map of ATMs, hostels, food, e-scooters & bikes, pharmacies, gas stations and more.', steps: ['Pick a category or search.', 'Scout ranks results by time, weather, rating and distance.', 'Tap a place for walking, transit or driving directions.'] },
  },
  {
    id: 'sharing',
    group: 'explore',
    Icon: Scooter,
    color: '#4fd1c5',
    agent: 'scout',
    open: { tab: 'map', mapMode: 'places', mapFilter: 'sharing' },
    fallback: { title: 'E-scooter & bike sharing', summary: 'Rentable e-scooters, e-bikes, bikes and mopeds from Lime, Voi, Bolt, Dott, nextbike and others, where the city has them.', steps: ['In Explore, pick the “Scooters & bikes” chip.', 'Vehicles show per operator; red areas are no-parking zones.', 'Tap “Open app” to rent in the operator’s app.'] },
  },
  {
    id: 'parking',
    group: 'explore',
    Icon: SquareParking,
    color: '#4f8cff',
    agent: 'scout',
    demo: 'parking',
    open: { tab: 'map', mapMode: 'parking' },
    fallback: { title: 'Parking finder', summary: 'Garages, underground and street parking with rates, rules and live spaces.', steps: ['Set how long you will stay.', 'See price, free periods, time limits and warnings per lot.', 'Open directions in Google Maps, Apple Maps or Waze.'] },
  },
  {
    id: 'transit',
    group: 'explore',
    Icon: TramFront,
    color: '#3fa34d',
    demo: 'transit',
    open: { tab: 'transit' },
    fallback: { title: 'Public transit', summary: 'Live departures and routes for trains, S-Bahn, U-Bahn, trams, buses and ferries.', steps: ['Departures shows the stations around you.', 'Delays, platform changes and cancellations are highlighted.', 'Route plans a trip. Save it to see the next live connections at a glance; remove it with the bin icon.'] },
  },
  {
    id: 'converter',
    group: 'money',
    Icon: ArrowLeftRight,
    color: '#5fd39a',
    agent: 'budget',
    demo: 'numpad',
    open: { tab: 'convert' },
    offline: true,
    fallback: { title: 'Currency converter', summary: 'One-handed converter with tip, tax and bill splitting that works offline.', steps: ['Type the price on the numpad.', 'Add a tip or tax, or split between people.', 'Check whether a price is fair for the country.'] },
  },
  {
    id: 'scanner',
    group: 'money',
    Icon: ScanLine,
    color: '#5fd39a',
    agent: 'budget',
    demo: 'scanner',
    open: { overlay: 'scanner' },
    fallback: { title: 'Price scanner', summary: 'Photograph a menu or price tag and see prices in your currency.', steps: ['Take or pick a photo.', 'Text is read on your device.', 'Prices are converted and flagged if they look steep.'] },
  },
  {
    id: 'expenses',
    group: 'money',
    Icon: Coins,
    color: '#5fd39a',
    agent: 'budget',
    demo: 'numpad',
    open: { screen: 'vault' },
    offline: true,
    fallback: { title: 'Expense tracker', summary: 'Log spending per country; categories are filled in for you.', steps: ['Enter amount and what it was for.', 'BudgetAgent picks the category.', 'See totals and daily averages per country.'] },
  },
  {
    id: 'translator',
    group: 'talk',
    Icon: Languages,
    color: '#6cb6ff',
    agent: 'translate',
    demo: 'waveform',
    open: { screen: 'translate' },
    offline: true,
    fallback: { title: 'Voice translator', summary: 'Speak, translate, play it aloud, or show it full screen to a local.', steps: ['Tap the mic and talk, or type.', 'Switch to “They talk” for the reply.', 'The phrasebook works with no signal.'] },
  },
  {
    id: 'audio',
    group: 'talk',
    Icon: Music2,
    color: '#1db954',
    demo: 'coverflow',
    open: { screen: 'audio' },
    fallback: { title: 'Audio Scout', summary: 'Identify the song that is playing and browse it in a 3D cover flow.', steps: ['Tap the green button and hold the phone near the music.', 'Swipe the covers to browse more by the artist.', 'Play a 30-second preview or open it in Spotify.'] },
  },
  {
    id: 'sos',
    group: 'safety',
    Icon: Siren,
    color: '#ff4d5e',
    agent: 'safety',
    demo: 'sos',
    open: { overlay: 'sos' },
    offline: true,
    fallback: { title: 'Emergency SOS', summary: 'Local emergency numbers, nearest hospitals and your embassy in one tap.', steps: ['Tap SOS in the header.', 'Tap a number to call; share your location.', 'Medical phrases are shown in the local language.'] },
  },
  {
    id: 'camera',
    group: 'tools',
    Icon: Camera,
    color: '#5fd39a',
    demo: 'camera',
    open: { overlay: 'camera' },
    fallback: { title: 'Quick-snap camera', summary: 'Instant camera with torch and grid; save straight to your photos.', steps: ['Open from the dashboard or the Kit button.', 'Tap the shutter; flip or use the torch.', 'Save to Photos via your phone’s share sheet, or scan prices.'] },
  },
  {
    id: 'checklist',
    group: 'tools',
    Icon: ListChecks,
    color: '#ff6b4a',
    demo: 'checklist',
    open: { screen: 'checklist' },
    offline: true,
    fallback: { title: 'Travel checklists', summary: 'Sights, packing, shopping, documents, health and car prep, with progress.', steps: ['Open a category.', 'Tick items off; the bar fills up.', 'Add your own items or reset for the next trip.'] },
  },
  {
    id: 'vault',
    group: 'tools',
    Icon: Vault,
    color: '#b38cff',
    demo: 'vault',
    open: { screen: 'vault' },
    offline: true,
    fallback: { title: 'Document vault', summary: 'Passport, visa and booking copies, encrypted on your device.', steps: ['Create a passphrase.', 'Add photos or PDFs.', 'The vault locks itself when you leave the app.'] },
  },
  {
    id: 'offline',
    group: 'tools',
    Icon: WifiOff,
    color: '#8b949e',
    demo: 'offline',
    offline: true,
    fallback: { title: 'Works offline', summary: 'Install Backpack and the essentials keep working without signal.', steps: ['Add Backpack to your home screen.', 'Rates, phrasebook, SOS and the vault are saved on the device.', 'A banner tells you when you are offline.'] },
  },
  {
    id: 'personalize',
    group: 'tools',
    Icon: Palette,
    color: '#ffb347',
    demo: 'theme',
    open: { screen: 'settings' },
    offline: true,
    fallback: { title: 'Language & theme', summary: 'English, Deutsch, Türkçe or Русский, in dark or light mode.', steps: ['Tap the Kit button → Settings.', 'Pick your language.', 'Choose dark, light or follow the system.'] },
  },
  {
    id: 'scoutAgent',
    group: 'agents',
    Icon: Radar,
    color: '#ffb347',
    agent: 'scout',
    demo: 'agent',
    fallback: { title: 'ScoutAgent', summary: 'Watches location, time and weather; finds places and parking that fit the moment.', steps: ['Rescans when you move or the weather changes.', 'Ranks by rating, distance, open hours and conditions.', 'In road-trip mode it also analyses parking.'] },
  },
  {
    id: 'translateAgent',
    group: 'agents',
    Icon: Languages,
    color: '#6cb6ff',
    agent: 'translate',
    demo: 'agent',
    fallback: { title: 'TranslateAgent', summary: 'Detects languages, rewrites idioms, and remembers translations for offline use.', steps: ['Matches the offline phrasebook first.', 'Then saved translations, then the internet.', 'Switches language when you cross a border.'] },
  },
  {
    id: 'budgetAgent',
    group: 'agents',
    Icon: Coins,
    color: '#5fd39a',
    agent: 'budget',
    demo: 'agent',
    fallback: { title: 'BudgetAgent', summary: 'Keeps exchange rates fresh, prices parking against your budget, flags rip-offs.', steps: ['Caches rates for offline use.', 'Converts parking costs and checks your daily budget.', 'Warns about surcharge hours.'] },
  },
  {
    id: 'safetyAgent',
    group: 'agents',
    Icon: ShieldAlert,
    color: '#ff4d5e',
    agent: 'safety',
    demo: 'agent',
    fallback: { title: 'SafetyAgent', summary: 'Knows which country you are in: emergency numbers, hospitals, road and parking rules.', steps: ['Detects borders, even offline from the last fix.', 'Updates SOS numbers and finds hospitals.', 'Explains tolls, vignettes and parking zones.'] },
  },
]
