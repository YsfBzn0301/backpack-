export interface Currency {
  code: string
  name: string
  region: string
}

export const CURRENCIES: Currency[] = [
  { code: 'USD', name: 'US Dollar', region: 'US' },
  { code: 'EUR', name: 'Euro', region: 'EU' },
  { code: 'GBP', name: 'British Pound', region: 'GB' },
  { code: 'JPY', name: 'Japanese Yen', region: 'JP' },
  { code: 'AUD', name: 'Australian Dollar', region: 'AU' },
  { code: 'CAD', name: 'Canadian Dollar', region: 'CA' },
  { code: 'CHF', name: 'Swiss Franc', region: 'CH' },
  { code: 'CNY', name: 'Chinese Yuan', region: 'CN' },
  { code: 'HKD', name: 'Hong Kong Dollar', region: 'HK' },
  { code: 'NZD', name: 'New Zealand Dollar', region: 'NZ' },
  { code: 'SGD', name: 'Singapore Dollar', region: 'SG' },
  { code: 'THB', name: 'Thai Baht', region: 'TH' },
  { code: 'VND', name: 'Vietnamese Dong', region: 'VN' },
  { code: 'IDR', name: 'Indonesian Rupiah', region: 'ID' },
  { code: 'MYR', name: 'Malaysian Ringgit', region: 'MY' },
  { code: 'PHP', name: 'Philippine Peso', region: 'PH' },
  { code: 'KHR', name: 'Cambodian Riel', region: 'KH' },
  { code: 'LAK', name: 'Lao Kip', region: 'LA' },
  { code: 'MMK', name: 'Myanmar Kyat', region: 'MM' },
  { code: 'KRW', name: 'South Korean Won', region: 'KR' },
  { code: 'TWD', name: 'Taiwan Dollar', region: 'TW' },
  { code: 'INR', name: 'Indian Rupee', region: 'IN' },
  { code: 'NPR', name: 'Nepalese Rupee', region: 'NP' },
  { code: 'LKR', name: 'Sri Lankan Rupee', region: 'LK' },
  { code: 'PKR', name: 'Pakistani Rupee', region: 'PK' },
  { code: 'BDT', name: 'Bangladeshi Taka', region: 'BD' },
  { code: 'AED', name: 'UAE Dirham', region: 'AE' },
  { code: 'SAR', name: 'Saudi Riyal', region: 'SA' },
  { code: 'QAR', name: 'Qatari Riyal', region: 'QA' },
  { code: 'ILS', name: 'Israeli Shekel', region: 'IL' },
  { code: 'JOD', name: 'Jordanian Dinar', region: 'JO' },
  { code: 'TRY', name: 'Turkish Lira', region: 'TR' },
  { code: 'EGP', name: 'Egyptian Pound', region: 'EG' },
  { code: 'MAD', name: 'Moroccan Dirham', region: 'MA' },
  { code: 'ZAR', name: 'South African Rand', region: 'ZA' },
  { code: 'KES', name: 'Kenyan Shilling', region: 'KE' },
  { code: 'TZS', name: 'Tanzanian Shilling', region: 'TZ' },
  { code: 'NGN', name: 'Nigerian Naira', region: 'NG' },
  { code: 'GHS', name: 'Ghanaian Cedi', region: 'GH' },
  { code: 'SEK', name: 'Swedish Krona', region: 'SE' },
  { code: 'NOK', name: 'Norwegian Krone', region: 'NO' },
  { code: 'DKK', name: 'Danish Krone', region: 'DK' },
  { code: 'ISK', name: 'Icelandic Króna', region: 'IS' },
  { code: 'PLN', name: 'Polish Złoty', region: 'PL' },
  { code: 'CZK', name: 'Czech Koruna', region: 'CZ' },
  { code: 'HUF', name: 'Hungarian Forint', region: 'HU' },
  { code: 'RON', name: 'Romanian Leu', region: 'RO' },
  { code: 'BGN', name: 'Bulgarian Lev', region: 'BG' },
  { code: 'RSD', name: 'Serbian Dinar', region: 'RS' },
  { code: 'GEL', name: 'Georgian Lari', region: 'GE' },
  { code: 'RUB', name: 'Russian Ruble', region: 'RU' },
  { code: 'UAH', name: 'Ukrainian Hryvnia', region: 'UA' },
  { code: 'MXN', name: 'Mexican Peso', region: 'MX' },
  { code: 'BRL', name: 'Brazilian Real', region: 'BR' },
  { code: 'ARS', name: 'Argentine Peso', region: 'AR' },
  { code: 'CLP', name: 'Chilean Peso', region: 'CL' },
  { code: 'COP', name: 'Colombian Peso', region: 'CO' },
  { code: 'PEN', name: 'Peruvian Sol', region: 'PE' },
  { code: 'BOB', name: 'Bolivian Boliviano', region: 'BO' },
  { code: 'CRC', name: 'Costa Rican Colón', region: 'CR' },
  { code: 'GTQ', name: 'Guatemalan Quetzal', region: 'GT' },
  { code: 'DOP', name: 'Dominican Peso', region: 'DO' },
  { code: 'FJD', name: 'Fijian Dollar', region: 'FJ' },
]

export const CURRENCY_BY_CODE = Object.fromEntries(CURRENCIES.map((c) => [c.code, c]))

/**
 * Seed rates (per 1 USD) so conversion works on first launch with no network.
 * Approximate; replaced by live rates on the first successful sync.
 */
export const SEED_RATES: Record<string, number> = {
  USD: 1, EUR: 0.92, GBP: 0.78, JPY: 150, AUD: 1.52, CAD: 1.37, CHF: 0.87, CNY: 7.2, HKD: 7.8, NZD: 1.66, SGD: 1.33,
  THB: 35.5, VND: 25300, IDR: 16000, MYR: 4.6, PHP: 57, KHR: 4100, LAK: 21500, MMK: 2100, KRW: 1370, TWD: 32, INR: 84,
  NPR: 134, LKR: 300, PKR: 280, BDT: 120, AED: 3.67, SAR: 3.75, QAR: 3.64, ILS: 3.7, JOD: 0.71, TRY: 34, EGP: 49,
  MAD: 9.9, ZAR: 18, KES: 129, TZS: 2650, NGN: 1600, GHS: 15.5, SEK: 10.6, NOK: 10.9, DKK: 6.9, ISK: 137, PLN: 3.95,
  CZK: 23, HUF: 365, RON: 4.6, BGN: 1.8, RSD: 108, GEL: 2.7, RUB: 95, UAH: 41, MXN: 19.5, BRL: 5.6, ARS: 980, CLP: 940,
  COP: 4200, PEN: 3.75, BOB: 6.9, CRC: 515, GTQ: 7.75, DOP: 60, FJD: 2.25,
}
