/**
 * Offline country dataset used by SafetyAgent, BudgetAgent and TranslateAgent.
 * Emergency numbers: [police, ambulance, fire]. `general` is the universal line
 * where one exists. Verify locally on arrival: numbers change.
 */
export type CountryNote = 'eu112' | 'greenAngels' | 'nhs111' | 'gendarmerie' | 'mobile112' | 'japanHotline' | 'touristPolice' | 'fallback112'

export interface Country {
  code: string
  name: string
  police: string
  ambulance: string
  fire: string
  general?: string
  tourist?: string
  lang: string
  currency: string
  /** Locale key under `sos.note.*`. */
  note?: CountryNote
}

type Row = [code: string, name: string, police: string, ambulance: string, fire: string, lang: string, currency: string, extra?: Partial<Country>]



const EU112 = { general: '112', note: 'eu112' as const }

const ROWS: Row[] = [
  ['US', 'United States', '911', '911', '911', 'en', 'USD'],
  ['CA', 'Canada', '911', '911', '911', 'en', 'CAD'],
  ['MX', 'Mexico', '911', '911', '911', 'es', 'MXN', { tourist: '078', note: 'greenAngels' }],
  ['GB', 'United Kingdom', '999', '999', '999', 'en', 'GBP', { general: '112', note: 'nhs111' }],
  ['IE', 'Ireland', '112', '112', '112', 'en', 'EUR', EU112],
  ['FR', 'France', '17', '15', '18', 'fr', 'EUR', EU112],
  ['DE', 'Germany', '110', '112', '112', 'de', 'EUR', EU112],
  ['ES', 'Spain', '091', '061', '080', 'es', 'EUR', EU112],
  ['IT', 'Italy', '113', '118', '115', 'it', 'EUR', EU112],
  ['PT', 'Portugal', '112', '112', '112', 'pt', 'EUR', EU112],
  ['NL', 'Netherlands', '112', '112', '112', 'nl', 'EUR', EU112],
  ['BE', 'Belgium', '101', '112', '112', 'fr', 'EUR', EU112],
  ['CH', 'Switzerland', '117', '144', '118', 'de', 'CHF', { general: '112' }],
  ['AT', 'Austria', '133', '144', '122', 'de', 'EUR', EU112],
  ['GR', 'Greece', '100', '166', '199', 'el', 'EUR', { ...EU112, tourist: '1571' }],
  ['TR', 'Türkiye', '112', '112', '112', 'tr', 'TRY', { general: '112' }],
  ['PL', 'Poland', '997', '999', '998', 'pl', 'PLN', EU112],
  ['CZ', 'Czechia', '158', '155', '150', 'cs', 'CZK', EU112],
  ['SK', 'Slovakia', '158', '155', '150', 'sk', 'EUR', EU112],
  ['HU', 'Hungary', '107', '104', '105', 'hu', 'HUF', EU112],
  ['HR', 'Croatia', '192', '194', '193', 'hr', 'EUR', EU112],
  ['SI', 'Slovenia', '113', '112', '112', 'sl', 'EUR', EU112],
  ['RO', 'Romania', '112', '112', '112', 'ro', 'RON', EU112],
  ['BG', 'Bulgaria', '112', '112', '112', 'bg', 'BGN', EU112],
  ['RS', 'Serbia', '192', '194', '193', 'sr', 'RSD'],
  ['SE', 'Sweden', '112', '112', '112', 'sv', 'SEK', EU112],
  ['NO', 'Norway', '112', '113', '110', 'no', 'NOK'],
  ['DK', 'Denmark', '112', '112', '112', 'da', 'DKK', EU112],
  ['FI', 'Finland', '112', '112', '112', 'fi', 'EUR', EU112],
  ['IS', 'Iceland', '112', '112', '112', 'is', 'ISK'],
  ['EE', 'Estonia', '112', '112', '112', 'et', 'EUR', EU112],
  ['LV', 'Latvia', '112', '112', '112', 'lv', 'EUR', EU112],
  ['LT', 'Lithuania', '112', '112', '112', 'lt', 'EUR', EU112],
  ['RU', 'Russia', '102', '103', '101', 'ru', 'RUB', { general: '112' }],
  ['UA', 'Ukraine', '102', '103', '101', 'uk', 'UAH', { general: '112' }],
  ['GE', 'Georgia', '112', '112', '112', 'ka', 'GEL', { general: '112' }],
  ['AM', 'Armenia', '102', '103', '101', 'hy', 'AMD', { general: '112' }],
  ['IL', 'Israel', '100', '101', '102', 'he', 'ILS'],
  ['JO', 'Jordan', '911', '911', '911', 'ar', 'JOD'],
  ['AE', 'United Arab Emirates', '999', '998', '997', 'ar', 'AED'],
  ['SA', 'Saudi Arabia', '999', '997', '998', 'ar', 'SAR', { general: '911' }],
  ['QA', 'Qatar', '999', '999', '999', 'ar', 'QAR'],
  ['OM', 'Oman', '9999', '9999', '9999', 'ar', 'OMR'],
  ['EG', 'Egypt', '122', '123', '180', 'ar', 'EGP', { tourist: '126' }],
  ['MA', 'Morocco', '19', '15', '15', 'ar', 'MAD', { note: 'gendarmerie' }],
  ['TN', 'Tunisia', '197', '190', '198', 'ar', 'TND'],
  ['ZA', 'South Africa', '10111', '10177', '10177', 'en', 'ZAR', { general: '112', note: 'mobile112' }],
  ['KE', 'Kenya', '999', '999', '999', 'sw', 'KES', { general: '112' }],
  ['TZ', 'Tanzania', '112', '112', '112', 'sw', 'TZS'],
  ['UG', 'Uganda', '999', '999', '999', 'en', 'UGX', { general: '112' }],
  ['NG', 'Nigeria', '112', '112', '112', 'en', 'NGN'],
  ['GH', 'Ghana', '191', '193', '192', 'en', 'GHS', { general: '112' }],
  ['ET', 'Ethiopia', '991', '907', '939', 'am', 'ETB'],
  ['IN', 'India', '100', '108', '101', 'hi', 'INR', { general: '112', tourist: '1363' }],
  ['NP', 'Nepal', '100', '102', '101', 'ne', 'NPR', { tourist: '1144' }],
  ['LK', 'Sri Lanka', '119', '1990', '110', 'si', 'LKR', { tourist: '1912' }],
  ['BD', 'Bangladesh', '999', '999', '999', 'bn', 'BDT'],
  ['PK', 'Pakistan', '15', '1122', '16', 'ur', 'PKR'],
  ['MV', 'Maldives', '119', '102', '118', 'dv', 'MVR'],
  ['CN', 'China', '110', '120', '119', 'zh', 'CNY'],
  ['HK', 'Hong Kong', '999', '999', '999', 'zh', 'HKD', { general: '112' }],
  ['TW', 'Taiwan', '110', '119', '119', 'zh', 'TWD'],
  ['JP', 'Japan', '110', '119', '119', 'ja', 'JPY', { note: 'japanHotline' }],
  ['KR', 'South Korea', '112', '119', '119', 'ko', 'KRW', { tourist: '1330' }],
  ['MN', 'Mongolia', '102', '103', '101', 'mn', 'MNT'],
  ['TH', 'Thailand', '191', '1669', '199', 'th', 'THB', { tourist: '1155', note: 'touristPolice' }],
  ['VN', 'Vietnam', '113', '115', '114', 'vi', 'VND'],
  ['LA', 'Laos', '1191', '1195', '1190', 'lo', 'LAK'],
  ['KH', 'Cambodia', '117', '119', '118', 'km', 'KHR'],
  ['MM', 'Myanmar', '199', '192', '191', 'my', 'MMK'],
  ['MY', 'Malaysia', '999', '999', '994', 'ms', 'MYR', { general: '112' }],
  ['SG', 'Singapore', '999', '995', '995', 'en', 'SGD'],
  ['ID', 'Indonesia', '110', '118', '113', 'id', 'IDR', { general: '112' }],
  ['PH', 'Philippines', '911', '911', '911', 'tl', 'PHP'],
  ['AU', 'Australia', '000', '000', '000', 'en', 'AUD', { general: '112', note: 'mobile112' }],
  ['NZ', 'New Zealand', '111', '111', '111', 'en', 'NZD'],
  ['FJ', 'Fiji', '917', '911', '910', 'en', 'FJD'],
  ['BR', 'Brazil', '190', '192', '193', 'pt', 'BRL'],
  ['AR', 'Argentina', '911', '107', '100', 'es', 'ARS'],
  ['CL', 'Chile', '133', '131', '132', 'es', 'CLP'],
  ['PE', 'Peru', '105', '106', '116', 'es', 'PEN'],
  ['CO', 'Colombia', '123', '123', '123', 'es', 'COP'],
  ['EC', 'Ecuador', '911', '911', '911', 'es', 'USD'],
  ['BO', 'Bolivia', '110', '118', '119', 'es', 'BOB'],
  ['UY', 'Uruguay', '911', '911', '911', 'es', 'UYU'],
  ['CR', 'Costa Rica', '911', '911', '911', 'es', 'CRC'],
  ['PA', 'Panama', '104', '911', '103', 'es', 'PAB', { general: '911' }],
  ['GT', 'Guatemala', '110', '128', '122', 'es', 'GTQ'],
  ['CU', 'Cuba', '106', '104', '105', 'es', 'CUP'],
  ['DO', 'Dominican Republic', '911', '911', '911', 'es', 'DOP'],
  ['JM', 'Jamaica', '119', '110', '110', 'en', 'JMD'],
]

export const COUNTRIES: Record<string, Country> = Object.fromEntries(
  ROWS.map(([code, name, police, ambulance, fire, lang, currency, extra]) => [
    code,
    { code, name, police, ambulance, fire, lang, currency, ...extra },
  ]),
)

export const FALLBACK_COUNTRY: Country = {
  code: 'XX',
  name: 'Unknown location',
  police: '112',
  ambulance: '112',
  fire: '112',
  general: '112',
  lang: 'en',
  currency: 'USD',
  note: 'fallback112',
}

export const getCountry = (code?: string | null) => (code && COUNTRIES[code.toUpperCase()]) || null

export function flag(code: string) {
  if (!/^[A-Z]{2}$/i.test(code)) return '🏳️'
  return String.fromCodePoint(...[...code.toUpperCase()].map((c) => 0x1f1a5 + c.charCodeAt(0)))
}

/** Offline fallback: IANA zone → country, used when reverse geocoding is unavailable. */
export const TZ_COUNTRY: Record<string, string> = {
  'America/New_York': 'US', 'America/Chicago': 'US', 'America/Denver': 'US', 'America/Los_Angeles': 'US', 'America/Phoenix': 'US',
  'America/Anchorage': 'US', 'Pacific/Honolulu': 'US', 'America/Toronto': 'CA', 'America/Vancouver': 'CA', 'America/Mexico_City': 'MX',
  'America/Cancun': 'MX', 'Europe/London': 'GB', 'Europe/Dublin': 'IE', 'Europe/Paris': 'FR', 'Europe/Berlin': 'DE', 'Europe/Madrid': 'ES',
  'Europe/Rome': 'IT', 'Europe/Lisbon': 'PT', 'Europe/Amsterdam': 'NL', 'Europe/Brussels': 'BE', 'Europe/Zurich': 'CH', 'Europe/Vienna': 'AT',
  'Europe/Athens': 'GR', 'Europe/Istanbul': 'TR', 'Europe/Warsaw': 'PL', 'Europe/Prague': 'CZ', 'Europe/Bratislava': 'SK', 'Europe/Budapest': 'HU',
  'Europe/Zagreb': 'HR', 'Europe/Ljubljana': 'SI', 'Europe/Bucharest': 'RO', 'Europe/Sofia': 'BG', 'Europe/Belgrade': 'RS', 'Europe/Stockholm': 'SE',
  'Europe/Oslo': 'NO', 'Europe/Copenhagen': 'DK', 'Europe/Helsinki': 'FI', 'Atlantic/Reykjavik': 'IS', 'Europe/Tallinn': 'EE', 'Europe/Riga': 'LV',
  'Europe/Vilnius': 'LT', 'Europe/Moscow': 'RU', 'Europe/Kyiv': 'UA', 'Europe/Kiev': 'UA', 'Asia/Tbilisi': 'GE', 'Asia/Yerevan': 'AM',
  'Asia/Jerusalem': 'IL', 'Asia/Amman': 'JO', 'Asia/Dubai': 'AE', 'Asia/Riyadh': 'SA', 'Asia/Qatar': 'QA', 'Asia/Muscat': 'OM',
  'Africa/Cairo': 'EG', 'Africa/Casablanca': 'MA', 'Africa/Tunis': 'TN', 'Africa/Johannesburg': 'ZA', 'Africa/Nairobi': 'KE',
  'Africa/Dar_es_Salaam': 'TZ', 'Africa/Kampala': 'UG', 'Africa/Lagos': 'NG', 'Africa/Accra': 'GH', 'Africa/Addis_Ababa': 'ET',
  'Asia/Kolkata': 'IN', 'Asia/Calcutta': 'IN', 'Asia/Kathmandu': 'NP', 'Asia/Colombo': 'LK', 'Asia/Dhaka': 'BD', 'Asia/Karachi': 'PK',
  'Indian/Maldives': 'MV', 'Asia/Shanghai': 'CN', 'Asia/Hong_Kong': 'HK', 'Asia/Taipei': 'TW', 'Asia/Tokyo': 'JP', 'Asia/Seoul': 'KR',
  'Asia/Ulaanbaatar': 'MN', 'Asia/Bangkok': 'TH', 'Asia/Ho_Chi_Minh': 'VN', 'Asia/Saigon': 'VN', 'Asia/Vientiane': 'LA',
  'Asia/Phnom_Penh': 'KH', 'Asia/Yangon': 'MM', 'Asia/Rangoon': 'MM', 'Asia/Kuala_Lumpur': 'MY', 'Asia/Singapore': 'SG',
  'Asia/Jakarta': 'ID', 'Asia/Makassar': 'ID', 'Asia/Manila': 'PH', 'Australia/Sydney': 'AU', 'Australia/Melbourne': 'AU',
  'Australia/Brisbane': 'AU', 'Australia/Perth': 'AU', 'Australia/Adelaide': 'AU', 'Pacific/Auckland': 'NZ', 'Pacific/Fiji': 'FJ',
  'America/Sao_Paulo': 'BR', 'America/Argentina/Buenos_Aires': 'AR', 'America/Buenos_Aires': 'AR', 'America/Santiago': 'CL',
  'America/Lima': 'PE', 'America/Bogota': 'CO', 'America/Guayaquil': 'EC', 'America/La_Paz': 'BO', 'America/Montevideo': 'UY',
  'America/Costa_Rica': 'CR', 'America/Panama': 'PA', 'America/Guatemala': 'GT', 'America/Havana': 'CU', 'America/Santo_Domingo': 'DO',
  'America/Jamaica': 'JM',
}
