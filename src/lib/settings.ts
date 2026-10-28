import { createStore } from './store'

export interface Settings {
  homeCurrency: string
  homeCountry: string
  units: 'metric' | 'imperial'
  haptics: boolean
  scoutRadius: 500 | 1000
  /** Keys pasted in-app override build-time env keys. Stored on this device only. */
  googleMapsKey: string
  openWeatherKey: string
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
    homeCurrency: guessCurrency(),
    homeCountry: guessCountry(),
    units: 'metric',
    haptics: true,
    scoutRadius: 1000,
    googleMapsKey: '',
    openWeatherKey: '',
    translateEndpoint: '',
    speechLang: 'en',
    targetLang: 'th',
  },
  'backpack:settings',
)

export const keys = {
  googleMaps: () => settings.get().googleMapsKey || import.meta.env.VITE_GOOGLE_MAPS_KEY || '',
  openWeather: () => settings.get().openWeatherKey || import.meta.env.VITE_OPENWEATHER_KEY || '',
  oxr: () => import.meta.env.VITE_OXR_APP_ID || '',
  translateEndpoint: () => settings.get().translateEndpoint || import.meta.env.VITE_TRANSLATE_ENDPOINT || '',
}
