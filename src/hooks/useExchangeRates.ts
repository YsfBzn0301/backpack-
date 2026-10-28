import { useCallback } from 'react'
import { agents, useAgentState } from '@/agents/host'
import type { BudgetState, RatesSnapshot } from '@/agents/budget.worker'
import { SEED_RATES } from '@/data/currencies'

const SEED: RatesSnapshot = { base: 'USD', rates: SEED_RATES, fetchedAt: 0, source: 'seed' }

/** FX rates owned by BudgetAgent (cached in IndexedDB inside the worker). */
export function useExchangeRates() {
  const state = useAgentState<BudgetState>('budget')
  const fx = state?.fx ?? SEED
  const convert = useCallback(
    (amount: number, from: string, to: string) => {
      const a = fx.rates[from]
      const b = fx.rates[to]
      return a && b ? (amount / a) * b : NaN
    },
    [fx],
  )
  return {
    fx,
    convert,
    syncing: state?.syncing ?? false,
    error: state?.lastError ?? null,
    localCurrency: state?.localCurrency ?? null,
    refresh: () => agents.run('budget', 'sync'),
  }
}
