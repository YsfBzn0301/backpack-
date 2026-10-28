# Backpack

An offline-first travel companion PWA for independent travellers: live weather and local time, a nearby scout, a one-handed currency converter, a voice translator with an offline phrasebook, a local SOS panel, and an encrypted document vault.

Built with React 19, Vite, Tailwind CSS v4, Framer Motion, TanStack Query and `vite-plugin-pwa`. Four specialised **sub-agents** run in Web Workers so the UI never blocks.

## Quick start

```bash
npm install
npm run dev        # http://localhost:5173
npm run build      # type-check + production build with service worker
npm run preview    # serve the production build (needed to test offline / install)
```

No API keys are required. Without keys, Backpack uses free keyless providers:

| Feature | With a key | Without a key |
| --- | --- | --- |
| Weather + 5-day forecast | OpenWeatherMap | Open-Meteo |
| Destination search | OpenWeather Geocoding | Open-Meteo Geocoding |
| Map | Google Maps JS (dark-styled) | Built-in tile map on CARTO dark tiles / OpenStreetMap |
| Nearby places | Google Places (New) | OpenStreetMap via Overpass |
| Exchange rates | Open Exchange Rates (`VITE_OXR_APP_ID`) | ExchangeRate-API open endpoint |
| Translation | Your own endpoint (`VITE_TRANSLATE_ENDPOINT`) | MyMemory |
| Country detection | — | BigDataCloud reverse geocoding, then cached / time-zone fallback |

Copy `.env.example` to `.env.local` to set keys at build time, or paste them in the app under **Vault → Settings** (stored on the device only).

A translation endpoint receives `POST {text, from, to, hint}` and should return `{translation}`. That is the hook for an LLM backend.

## Sub-agent architecture

```
          ┌────────────── main thread ──────────────┐
 GPS ───▶ │ useAgentBridge → AgentContext            │
 weather  │      │ (location, local time, weather,   │
 online   │      ▼  country, settings)               │
          │  AgentHost ── event bus ──▶ React UI      │
          │   ▲   │  insights · state · status        │
          │   │   └─ tools: places.nearby (Google SDK │
          │   │            or Overpass)               │
          └───┼──────────────────────────────────────┘
   postMessage│  (src/agents/protocol.ts)
     ┌────────┴──────┬───────────────┬───────────────┐
 ScoutAgent    TranslateAgent    BudgetAgent     SafetyAgent
 (worker)        (worker)         (worker)        (worker)
```

- **ScoutAgent** (`scout.worker.ts`) turns local time, temperature and weather into intents (lunch, cold drinks and AC, somewhere dry, late night…). It rescans when you move 150 m, the weather changes or 10 minutes pass, ranks places by rating, review count, distance and open-now, and posts suggestions such as *"It's 1:00 PM and 33°C: get out of the heat. Closest convenience store 60 m away."*
- **TranslateAgent** (`translate.worker.ts`) detects the language from script and stopwords, rewrites English idioms into plain meaning, matches the offline phrasebook with fuzzy matching (tolerant of speech-to-text mistakes), then checks its IndexedDB translation memory before going online. It romanizes Korean, Japanese kana, Cyrillic and Greek. When you cross a border it switches the target language.
- **BudgetAgent** (`budget.worker.ts`) syncs FX rates every 12 hours into IndexedDB (and ships seed rates so it works on first launch with no network). It converts, splits bills with tip and tax, sorts expenses into categories, pulls prices out of OCR text, and compares prices with regional benchmarks (*"211% above the usual coffee price in Thailand"*).
- **SafetyAgent** (`safety.worker.ts`) resolves the current country (reverse geocode → weather hint → last known → device time zone), swaps in local emergency numbers, raises a "Welcome to …" alert on border crossings, keeps the nearest hospitals and pharmacies fresh, posts heat, storm and late-night advisories, and finds your embassy.

Agents never touch the DOM. Anything that needs window-only APIs (the Google Places SDK) is requested as a **tool call** that the host fulfils. Agents only emit insights; they don't control UI state.

## Modules

- **Today:** weather card with condition-matched ambience (rain, snow, sun glow, stars, fog, lightning), live agent ticker, quick actions (price scanner, translator, SOS), Scout picks and the agent feed (swipe a card left to dismiss).
- **Nearby:** dark map, category filters (ATM, hostel, street food, pharmacy, bus terminal…), 500 m / 1 km radius, Scout-ranked "Near me" list, and one-tap walking, transit and driving directions (opens Google Maps turn-by-turn on mobile).
- **Money:** one-handed numpad (keyboard works too), swap, tip chips (+10/15/20%), +7% tax, split between up to 20 people, a "fair price?" check and a quick-reference table.
- **Speak:** speech-to-text with a live mic waveform, "I talk / They talk" conversation modes, text-to-speech, a full-screen "show to a local" card, and a phrasebook in 14 languages covering basics, food, medical, transport and bargaining.
- **Vault:** encrypted documents (AES-GCM 256, key from a PBKDF2 passphrase, file names encrypted too, auto-locks after 5 minutes idle or when you leave the app), expense tracker per country, packing checklist, settings.
- **SOS** (header button, also the `?sos=1` shortcut): local police, ambulance and fire numbers as tap-to-call buttons, tourist police, share-my-location, nearest medical help, medical phrases in the local language, embassy finder.
- **Price scanner:** camera or photo → on-device OCR (Tesseract.js, loaded on first use) → BudgetAgent extracts, converts and flags prices.

## Offline behaviour

The service worker precaches the app shell and fonts. At runtime it caches map tiles (30 days), weather (network-first), the Google Maps SDK and the OCR model. The TanStack Query cache (weather, places) is persisted to IndexedDB. With no connection, these still work: cached weather and local time, FX conversion, phrasebook and saved translations, SOS numbers for the last known country, the vault, expenses and packing. A banner shows the connection state.

## Project layout

```
src/
  agents/      protocol, worker runtime, AgentHost, the four agent workers, romanization
  services/    weather, geocoding, places (Google / Overpass), Maps loader
  hooks/       useAgentBridge, useGeolocation, useWeather, useExchangeRates, useSpeech…
  modules/     home, map, convert, translate, vault, sos, scanner
  components/  splash, header, tab bar, offline banner, weather, ui primitives
  data/        countries & emergency numbers, currencies, phrasebook, languages, price benchmarks
  lib/         stores, settings, crypto, vault, geo, haptics, formatting
```

## Caveats

- Emergency numbers and price benchmarks are bundled reference data. Check emergency numbers locally on arrival.
- Speech recognition depends on the browser (Chrome, Edge, Safari). Firefox falls back to typing. Text-to-speech needs a voice installed for the target language; full-screen mode covers the gap.
- `navigator.vibrate` is ignored on iOS Safari, so haptics are silently skipped there.
- OCR downloads about 4 MB of model data the first time it is used, then it is cached for offline use.
- Regenerate the PNG icons from `public/icons/icon.svg` with `npm run icons` (needs Playwright).
