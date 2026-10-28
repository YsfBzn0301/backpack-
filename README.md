# Backpack

An offline-first travel, road-trip and parking companion PWA. It covers weather and local time, nearby places, a parking finder with real rate breakdowns, live public transit, a one-handed currency converter, a voice translator, song recognition with a 3D cover flow, a quick-snap camera, categorized checklists, a local SOS panel and an encrypted document vault.

It is available in **English, Deutsch, Türkçe and Русский**, with dark and light themes. Four specialised **sub-agents** run in Web Workers so the UI never blocks.

Built with React 19, Vite 7, Tailwind CSS v4, Framer Motion, React Three Fiber, TanStack Query, i18next and `vite-plugin-pwa`.

## Quick start

```bash
npm install
npm run dev        # http://localhost:5173
npm test           # unit tests (parking model, opening hours, agents, locale completeness)
npm run build      # type-check + production build with service worker
npm run preview    # serve the production build (needed to test offline / install)
```

No API keys are required. Without keys, Backpack uses free, keyless providers:

| Feature | With a key | Without a key |
| --- | --- | --- |
| Weather + 5-day forecast | OpenWeatherMap (localized descriptions) | Open-Meteo |
| Destination search | OpenWeather Geocoding | Open-Meteo Geocoding |
| Map | Google Maps JS (dark or light style) | Built-in tile map on CARTO tiles / OpenStreetMap |
| Nearby places & parking lots | Google Places (New) + OpenStreetMap | OpenStreetMap via Overpass |
| Live parking availability | ParkenDD (keyless), or your own provider via `VITE_PARKING_ENDPOINT` | ParkenDD |
| Public transit | Deutsche Bahn HAFAS (keyless, `v6.db.transport.rest`); Google Directions transit with a Maps key | HAFAS + Google Maps deep links |
| Exchange rates | Open Exchange Rates (`VITE_OXR_APP_ID`) | ExchangeRate-API open endpoint |
| Translation | Your own endpoint (`VITE_TRANSLATE_ENDPOINT`) | MyMemory |
| Song recognition | AudD (`VITE_AUDD_TOKEN`) | Search only (iTunes Search, keyless) |
| Country detection | — | BigDataCloud reverse geocoding, then cached / time-zone fallback |

Copy `.env.example` to `.env.local` to set keys at build time, or paste them in the app under **Kit → Settings** (stored on the device only).

- **Translation endpoint:** receives `POST {text, from, to, hint}` and should return `{translation}`. This is the hook for an LLM backend.
- **Parking endpoint:** answers `GET ?lat&lng&radius` with `ParkingLot[]` (see `src/agents/protocol.ts`). Use it to plug in Parkopedia or a city feed through your own proxy.

> Spotify's Web API needs a client secret, which can't be shipped in a PWA. Spotify metadata and 30-second previews come through AudD, and the "Open in Spotify" deep links go to `open.spotify.com`, which opens the app on phones.

## Sub-agent architecture

```
          ┌──────────────── main thread ────────────────┐
 GPS ───▶ │ useAgentBridge → AgentContext                │
 weather  │   (location, local time, weather, country,   │
 settings │    language, driving mode, parking budget)   │
          │  AgentHost ── event bus ──▶ React UI          │
          │   ▲  │  insights (i18n keys) · state · status │
          │   │  └─ tools: places.nearby, parking.nearby, │
          │   │           agent.run (agent → agent)       │
          └───┼──────────────────────────────────────────┘
   postMessage│  (src/agents/protocol.ts)
     ┌────────┴──────┬───────────────┬───────────────┐
 ScoutAgent    TranslateAgent    BudgetAgent     SafetyAgent
```

- **ScoutAgent** reads local time, temperature and weather and turns them into intents (lunch, cold drinks and AC, somewhere dry…). It ranks nearby places by rating, distance and open-now. In road-trip mode it also scouts parking. For each lot and planned stay it works out whether the lot is open, free or paid now, when that changes, the max stay and parking-disc rules, closing times, height limits and live occupancy.
- **TranslateAgent** detects the language, rewrites idioms and matches the offline phrasebook. Then it checks its translation memory before going online. It romanizes Korean, kana, Greek and Cyrillic, and switches language at borders.
- **BudgetAgent** keeps FX rates cached offline. It converts prices and splits bills, sorts expenses into categories, reads prices from OCR text and compares them with regional benchmarks. Its `parkingQuote` task prices parking in your home currency, compares it with your daily parking budget and raises **surcharge-hour** alerts.
- **SafetyAgent** resolves the country, even offline. It swaps in emergency numbers, finds hospitals, pharmacies and your embassy, and in road-trip mode posts the country's **toll / vignette, speed limit and parking-zone rules**.

**Agents work together through the host.** Scout analyses a parking lot, then calls `agent.run` → BudgetAgent to price it and check your budget, and posts one combined suggestion.

**Agents emit no finished sentences.** Insights are translation keys plus typed variables (`time`, `dist`, `money`, `temp`, `dur`, `country`, `hours`…). The UI renders them in the current language, units and number format, so switching language re-translates the live feed instantly.

## Modules

| Tab / screen | What it does |
| --- | --- |
| **Today** | Weather with condition effects (or a location-off card with Retry), **Backpack Daily** quote, quick actions (Camera, SOS, Translator, Parking), agent ticker, Scout picks, agent feed |
| **Explore → Places** | Dark or light map with filters (ATM, Hostel, Food, Pharmacy, Gas station, Parking…), 500 m / 1 km / 5 km radius, Scout ranking, walking, transit and driving directions |
| **Explore → Parking** | Map and list of garages, underground, surface and street parking. Hourly, daily and flat rates in local and home currency; estimated cost for your stay; budget verdict; free windows ("free after 20:00"); free first minutes; max stay and parking disc; live free spaces; EV, accessible, height, payment-method and customers-only tags; local road and zone rules; one tap to Google Maps, Apple Maps or Waze |
| **Transit** | Nearby stations, live departure board (line badges by mode, platform changes, delays, cancellations, disruption notes), journey planner with legs, platforms and transfers, Google Transit fallback |
| **Money** | One-handed numpad, tip, tax and split, fair-price check, quick reference |
| **Kit → Speak** | Speech-to-text with live waveform, two-way conversation, text-to-speech, full-screen "show a local", phrasebook in 15 languages |
| **Kit → Audio Scout** | Tap to identify music (AudD), **3D cover flow** (React Three Fiber, with a CSS 3D fallback), 30-second preview with live waveform, Open in Spotify, history |
| **Kit → Camera** | Live viewfinder, flip, torch, grid, shutter flash. **Save to Photos** opens the OS share sheet (iOS "Save Image", Android "Save to gallery"); falls back to a download. "Scan prices" sends the photo to the OCR scanner |
| **Kit → Checklist** | Activities & Sights, Packing, Shopping, Documents & Visas, Health & Pharmacy, Car & Transit Prep, each with a progress bar, stored in IndexedDB |
| **Kit → Vault** | AES-GCM encrypted documents plus an expense tracker per country |
| **Kit → Settings** | Language, theme (system / dark / light), home base, road-trip mode, vehicle height, parking budget, API keys |
| **SOS** (header) | Local numbers, share location, nearest medical help, medical phrases, embassy finder |
| **`/help`** (`?` in the header) | Help Center generated from `src/help/featuresRegistry.ts` |

### Help Center & feature registry

`src/help/featuresRegistry.ts` is the single source of truth. Every feature and sub-agent is one entry: icon, group, demo, where "Try it" goes, and English fallback text. The Help Center renders a tutorial card per entry with a live micro-demo. **Registering a new entry is all it takes to document a feature.** It appears immediately using its English fallback, and translations go under `help.f.<id>.*`. A unit test checks that every registered feature is documented.

The **first-run tour** (3 slides: what it is, the agents, offline plus language, theme and location) shows only on the very first launch (`localStorage['bp:tour-done']`). It can be replayed from Settings or Help.

### Languages & themes

- Locale files live in `src/i18n/locales/{en,de,tr,ru}.ts`. Every locale is type-checked against English (`Messages`), so a missing key fails the build. A unit test also checks that interpolation variables match.
- English is bundled; other languages lazy-load (about 15 KB gzipped each) and are precached for offline switching.
- Dates, times, numbers, currencies, distances, country and language names all go through `Intl` in the current language.
- Themes are CSS tokens: dark "Tactical Outdoor" (`#0d1117`, coral `#ff6b4a`) and light "Crisp Sand" (`#f4f4f0`). "System" follows the OS live, and switching crossfades through the View Transitions API.

## Offline behaviour

The service worker precaches the app shell, fonts and language packs. At runtime it caches map tiles, weather, the Maps SDK and OCR model. The TanStack Query cache (weather, places, parking, transit boards) is persisted to IndexedDB. With no connection these keep working: cached weather, FX conversion, the phrasebook and saved translations, SOS for the last known country, checklists, the vault and expenses.

## Project layout

```
src/
  agents/       protocol, worker runtime, AgentHost, Scout/Translate/Budget/Safety workers
  services/     weather, geocoding, places, parking (+ OSM tag parser), transit (HAFAS), audio (AudD/iTunes)
  lib/          stores, settings, theme, navigation, opening-hours evaluator, parking cost model, crypto, vault, checklist
  modules/      home, map, parking, transit, convert, translate, audio, camera, checklist, vault, settings, sos, scanner, kit
  help/         featuresRegistry, Help Center, micro-demos, first-run tour
  i18n/         i18next setup, Intl formatters, agent-message renderer, locales
  data/         countries & emergency numbers, road rules, currencies, phrasebook, languages, quotes, price benchmarks
  __tests__/    vitest suites
```

## Caveats

- Parking rates, conditions and road rules come from OpenStreetMap tags and bundled reference data. Coverage varies by city and data can be stale. The UI says so and labels unknown prices "price not listed" instead of guessing. Live occupancy depends on a feed existing for that city (ParkenDD covers many German cities).
- Transit uses DB HAFAS: excellent for Germany, long-distance only elsewhere in Europe. Other regions need a Google Maps key for in-app transit routes, or use the Google Maps link.
- Browsers can't write directly to the camera roll. Saving goes through the share sheet or a download.
- Speech recognition depends on the browser (Chrome, Edge, Safari). `navigator.vibrate` is ignored on iOS.
- Emergency numbers are reference data. Check them locally on arrival.
