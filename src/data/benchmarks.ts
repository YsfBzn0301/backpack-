/**
 * Rough everyday prices in USD, used by BudgetAgent to flag tourist pricing.
 * These are ballpark street-level figures, not authoritative data.
 */
export type BenchItem = 'coffee' | 'beer' | 'streetFood' | 'meal' | 'water' | 'taxiKm' | 'dorm' | 'sim'

export const BENCH_LABELS: Record<BenchItem, string> = {
  coffee: 'Coffee',
  beer: 'Local beer',
  streetFood: 'Street food dish',
  meal: 'Sit-down meal',
  water: 'Water 1.5L',
  taxiKm: 'Taxi per km',
  dorm: 'Hostel dorm bed',
  sim: 'Tourist SIM',
}

type Bench = Record<BenchItem, number>
const tier = (k: number): Bench => ({
  coffee: 3.5 * k, beer: 5 * k, streetFood: 6 * k, meal: 18 * k, water: 1.5 * k, taxiKm: 1.8 * k, dorm: 35 * k, sim: 25 * k,
})

export const BENCHMARKS: Record<string, Bench> = {
  TH: { coffee: 1.6, beer: 2.2, streetFood: 1.6, meal: 6, water: 0.5, taxiKm: 0.4, dorm: 9, sim: 9 },
  VN: { coffee: 1.2, beer: 1, streetFood: 1.6, meal: 5, water: 0.5, taxiKm: 0.5, dorm: 7, sim: 7 },
  LA: { coffee: 1.5, beer: 1.2, streetFood: 1.8, meal: 5, water: 0.4, taxiKm: 0.8, dorm: 7, sim: 6 },
  KH: { coffee: 1.8, beer: 1, streetFood: 2, meal: 6, water: 0.5, taxiKm: 0.8, dorm: 7, sim: 5 },
  ID: { coffee: 1.8, beer: 2.5, streetFood: 1.5, meal: 5, water: 0.4, taxiKm: 0.4, dorm: 8, sim: 6 },
  MY: { coffee: 2.5, beer: 4.5, streetFood: 2, meal: 6, water: 0.6, taxiKm: 0.4, dorm: 9, sim: 7 },
  PH: { coffee: 2.2, beer: 1.4, streetFood: 2, meal: 6, water: 0.6, taxiKm: 0.5, dorm: 10, sim: 6 },
  IN: { coffee: 1.2, beer: 2.5, streetFood: 0.8, meal: 4, water: 0.3, taxiKm: 0.3, dorm: 6, sim: 4 },
  NP: { coffee: 1.5, beer: 3, streetFood: 1.2, meal: 4, water: 0.4, taxiKm: 0.6, dorm: 6, sim: 4 },
  LK: { coffee: 1.5, beer: 2.5, streetFood: 1.5, meal: 5, water: 0.4, taxiKm: 0.5, dorm: 8, sim: 5 },
  JP: { coffee: 3.5, beer: 4, streetFood: 5, meal: 10, water: 0.9, taxiKm: 3, dorm: 25, sim: 20 },
  KR: { coffee: 3.8, beer: 3.5, streetFood: 4, meal: 9, water: 1, taxiKm: 1, dorm: 20, sim: 20 },
  CN: { coffee: 3.5, beer: 1.5, streetFood: 2, meal: 6, water: 0.5, taxiKm: 0.4, dorm: 12, sim: 15 },
  MX: { coffee: 2.2, beer: 2, streetFood: 1.5, meal: 9, water: 0.8, taxiKm: 0.8, dorm: 14, sim: 10 },
  CO: { coffee: 1.2, beer: 1.2, streetFood: 2, meal: 6, water: 0.6, taxiKm: 0.5, dorm: 11, sim: 6 },
  PE: { coffee: 2, beer: 2, streetFood: 2, meal: 6, water: 0.7, taxiKm: 0.6, dorm: 10, sim: 6 },
  BR: { coffee: 1.5, beer: 1.5, streetFood: 2.5, meal: 8, water: 0.6, taxiKm: 0.7, dorm: 12, sim: 8 },
  AR: { coffee: 2, beer: 2, streetFood: 3, meal: 10, water: 0.8, taxiKm: 0.6, dorm: 12, sim: 6 },
  TR: { coffee: 2, beer: 3.5, streetFood: 2.5, meal: 9, water: 0.4, taxiKm: 0.6, dorm: 14, sim: 18 },
  MA: { coffee: 1.5, beer: 3.5, streetFood: 2, meal: 7, water: 0.6, taxiKm: 0.6, dorm: 10, sim: 3 },
  EG: { coffee: 1.2, beer: 1.6, streetFood: 1, meal: 5, water: 0.3, taxiKm: 0.3, dorm: 8, sim: 4 },
  GE: { coffee: 2, beer: 2, streetFood: 2.5, meal: 8, water: 0.5, taxiKm: 0.5, dorm: 10, sim: 5 },
  PT: { coffee: 1.2, beer: 2.5, streetFood: 5, meal: 14, water: 0.8, taxiKm: 1, dorm: 25, sim: 15 },
  ES: { coffee: 1.8, beer: 3, streetFood: 6, meal: 16, water: 1, taxiKm: 1.3, dorm: 30, sim: 15 },
  IT: { coffee: 1.4, beer: 5, streetFood: 6, meal: 20, water: 0.9, taxiKm: 1.8, dorm: 35, sim: 15 },
  FR: { coffee: 2.5, beer: 7, streetFood: 8, meal: 22, water: 1, taxiKm: 2, dorm: 38, sim: 20 },
  DE: { coffee: 3.5, beer: 5, streetFood: 5, meal: 18, water: 0.8, taxiKm: 2.4, dorm: 30, sim: 15 },
  GB: { coffee: 4, beer: 7, streetFood: 9, meal: 22, water: 1.2, taxiKm: 2.5, dorm: 35, sim: 15 },
  US: { coffee: 4.5, beer: 7, streetFood: 10, meal: 22, water: 2, taxiKm: 2, dorm: 45, sim: 35 },
  AU: { coffee: 3.5, beer: 7, streetFood: 10, meal: 20, water: 2, taxiKm: 1.5, dorm: 30, sim: 20 },
  CH: tier(2),
  IS: tier(2),
  NO: tier(1.8),
}

export const benchmarkFor = (country?: string | null): Bench => (country && BENCHMARKS[country]) || tier(1)

/** Words that map a free-text expense / price to a benchmark item. */
export const BENCH_KEYWORDS: Record<BenchItem, RegExp> = {
  coffee: /coffee|latte|espresso|cappuccino|americano|flat white|cafe/i,
  beer: /beer|lager|ale|pint|bia|chang|singha|bintang/i,
  streetFood: /street|noodle|pad thai|pho|satay|taco|kebab|dumpling|snack|bao|empanada/i,
  meal: /dinner|lunch|restaurant|meal|breakfast|brunch|set menu/i,
  water: /water/i,
  taxiKm: /taxi|grab|uber|tuk|cab|bolt|ride/i,
  dorm: /hostel|dorm|bed|guesthouse|hotel|room|night/i,
  sim: /sim|esim|data|mobile plan/i,
}
