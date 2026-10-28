import { createStore } from './store'

export type UiLang = 'en' | 'de' | 'tr' | 'ru'

export interface Settings {
  uiLang: UiLang
  theme: 'system' | 'dark' | 'light'
  /** Parking spend the user is happy with per day, in home currency. */
  parkingBudgetDaily: number
  /** Road-trip mode: parking scouting and road-rule alerts. */
  driving: boolean
  vehicleHeightM: number
  auddToken: string
  homeCurrency: string
  homeCountry: string
  units: 'metric' | 'imperial'
  haptics: boolean
  scoutRadius: 500 | 1000 | 5000
  /** Keys pasted in-app override build-time env keys. Stored on this device only. */
  googleMapsKey: string
  openWeatherKey: string
  oxrAppId: string
  translateEndpoint: string
  speechLang: string
  targetLang: string
}

const guessCurrency = () => {
  try {
    const region = new Intl.Locale(navigator.language).maximize().region
    return region ? (REGION_CURRENCY[region] ?? 'USD') : 'USD'
  } catch {
    return 'USD'
  }
}
const guessUiLang = (): UiLang => {
  try {
    for (const l of navigator.languages ?? [navigator.language]) {
      const base = l.slice(0, 2).toLowerCase()
      if (base === 'de' || base === 'tr' || base === 'ru' || base === 'en') return base
    }
  } catch {
    /* default below */
  }
  return 'en'
}
const guessCountry = () => {
  try {
    return new Intl.Locale(navigator.language).maximize().region ?? 'US'
  } catch {
    return 'US'
  }
}
const REGION_CURRENCY: Record<string, string> = {
  US: 'USD', GB: 'GBP', DE: 'EUR', FR: 'EUR', ES: 'EUR', IT: 'EUR', NL: 'EUR', IE: 'EUR', PT: 'EUR', AT: 'EUR', BE: 'EUR',
  FI: 'EUR', GR: 'EUR', CA: 'CAD', AU: 'AUD', NZ: 'NZD', JP: 'JPY', IN: 'INR', CH: 'CHF', SE: 'SEK', NO: 'NOK', DK: 'DKK',
  SG: 'SGD', BR: 'BRL', MX: 'MXN', ZA: 'ZAR', KR: 'KRW', TH: 'THB', ID: 'IDR', MY: 'MYR', PH: 'PHP', VN: 'VND', TR: 'TRY',
  PL: 'PLN', CZ: 'CZK', HU: 'HUF', IL: 'ILS', AE: 'AED', CN: 'CNY', HK: 'HKD', TW: 'TWD', AR: 'ARS', CL: 'CLP', CO: 'COP',
  PE: 'PEN', EG: 'EGP', MA: 'MAD', KE: 'KES', NG: 'NGN',
}

export const settings = createStore<Settings>(
  {
    uiLang: guessUiLang(),
    theme: 'system',
    parkingBudgetDaily: 25,
    driving: false,
    vehicleHeightM: 1.6,
    auddToken: '',
    homeCurrency: guessCurrency(),
    homeCountry: guessCountry(),
    units: 'metric',
    haptics: true,
    scoutRadius: 1000,
    googleMapsKey: '',
    openWeatherKey: '',
    oxrAppId: '',
    translateEndpoint: '',
    speechLang: guessUiLang(),
    targetLang: 'th',
  },
  'backpack:settings',
)

export const keys = {
  googleMaps: () => settings.get().googleMapsKey || import.meta.env.VITE_GOOGLE_MAPS_KEY || '',
  openWeather: () => settings.get().openWeatherKey || import.meta.env.VITE_OPENWEATHER_KEY || '',
  oxr: () => settings.get().oxrAppId || import.meta.env.VITE_OXR_APP_ID || '',
  translateEndpoint: () => settings.get().translateEndpoint || import.meta.env.VITE_TRANSLATE_ENDPOINT || '',
  audd: () => settings.get().auddToken || import.meta.env.VITE_AUDD_TOKEN || '',
  parking: () => import.meta.env.VITE_PARKING_ENDPOINT || '',
}
