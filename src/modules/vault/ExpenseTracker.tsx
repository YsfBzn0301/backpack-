import { AnimatePresence, motion } from 'framer-motion'
import { Plus, Trash2 } from 'lucide-react'
import { useMemo, useState } from 'react'
import { agents, useAgentState } from '@/agents/host'
import type { ExpenseCategory } from '@/agents/budget.worker'
import type { SafetyState } from '@/agents/safety.worker'
import { addExpense, expenses, removeExpense } from '@/lib/expenses'
import { useExchangeRates } from '@/hooks/useExchangeRates'
import { settings } from '@/lib/settings'
import { formatMoney, uid } from '@/lib/format'
import { flag, getCountry } from '@/data/countries'
import { haptic } from '@/lib/haptics'
import { SectionTitle } from '@/components/ui/SectionTitle'

const CAT_META: Record<ExpenseCategory, { label: string; color: string }> = {
  food: { label: 'Food & drink', color: '#ffb347' },
  transport: { label: 'Transport', color: '#8fa8ff' },
  stay: { label: 'Stay', color: '#b38cff' },
  activities: { label: 'Activities', color: '#5fd39a' },
  shopping: { label: 'Shopping', color: '#e57bb8' },
  health: { label: 'Health', color: '#ff4d5e' },
  connectivity: { label: 'SIM & data', color: '#6cb6ff' },
  other: { label: 'Other', color: '#8b949e' },
}

export function ExpenseTracker() {
  const { items } = expenses.use()
  const home = settings.use((s) => s.homeCurrency)
  const { convert, localCurrency } = useExchangeRates()
  const safety = useAgentState<SafetyState>('safety')
  const country = safety?.country.code ?? 'XX'
  const [amount, setAmount] = useState('')
  const [note, setNote] = useState('')
  const [currency, setCurrency] = useState<string | null>(null)
  const cur = currency ?? localCurrency ?? home

  const add = async () => {
    const value = parseFloat(amount.replace(',', '.'))
    if (!value || value <= 0) return
    const category = await agents.run<ExpenseCategory>('budget', 'categorize', { text: note }).catch(() => 'other' as const)
    addExpense({ id: uid(), amount: value, currency: cur, note: note.trim() || CAT_META[category].label, category, country, ts: Date.now() })
    setAmount('')
    setNote('')
    haptic('success')
  }

  const byCountry = useMemo(() => {
    const groups = new Map<string, { total: number; days: Set<string>; cats: Map<ExpenseCategory, number> }>()
    for (const e of items) {
      const g = groups.get(e.country) ?? { total: 0, days: new Set(), cats: new Map() }
      const v = convert(e.amount, e.currency, home)
      if (Number.isFinite(v)) {
        g.total += v
        g.cats.set(e.category, (g.cats.get(e.category) ?? 0) + v)
      }
      g.days.add(new Date(e.ts).toDateString())
      groups.set(e.country, g)
    }
    return [...groups.entries()].sort((a, b) => b[1].total - a[1].total)
  }, [items, convert, home])

  return (
    <div className="space-y-4">
      <section className="card p-3">
        <div className="flex gap-2">
          <input
            inputMode="decimal"
            value={amount}
            onChange={(e) => setAmount(e.target.value.replace(/[^\d.,]/g, ''))}
            placeholder="0"
            className="tabular w-28 rounded-xl bg-ink-900 px-3 py-2.5 text-lg outline-none hairline border focus:border-ember-500/40"
          />
          <select value={cur} onChange={(e) => setCurrency(e.target.value)} className="rounded-xl bg-ink-900 px-2 font-mono text-sm outline-none hairline border">
            {[...new Set([localCurrency, home, 'USD', 'EUR'].filter(Boolean) as string[])].map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
          <input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && add()}
            placeholder="What for?"
            className="min-w-0 flex-1 rounded-xl bg-ink-900 px-3 py-2.5 text-sm outline-none hairline border focus:border-ember-500/40"
          />
        </div>
        <button onClick={add} disabled={!amount} className="mt-2 flex w-full items-center justify-center gap-1.5 rounded-xl bg-fog-100 py-2.5 text-sm font-semibold text-ink-900 disabled:opacity-40">
          <Plus size={15} /> Log expense
        </button>
        <p className="mt-2 text-[11px] text-fog-500">BudgetAgent files it by category and country: {getCountry(country)?.name ?? 'unknown location'}.</p>
      </section>

      {byCountry.map(([code, g]) => {
        const max = Math.max(...g.cats.values())
        return (
          <section key={code} className="card p-4">
            <div className="flex items-end justify-between">
              <div>
                <div className="text-xs text-fog-500">
                  {code !== 'XX' && flag(code)} {getCountry(code)?.name ?? 'Unknown'}
                </div>
                <div className="tabular text-2xl font-light text-fog-50">{formatMoney(g.total, home)}</div>
              </div>
              <div className="text-right text-xs text-fog-500">
                <div className="tabular text-fog-300">{formatMoney(g.total / g.days.size, home)}</div>
                per day · {g.days.size} {g.days.size === 1 ? 'day' : 'days'}
              </div>
            </div>
            <div className="mt-3 space-y-1.5">
              {[...g.cats.entries()]
                .sort((a, b) => b[1] - a[1])
                .map(([cat, v]) => (
                  <div key={cat} className="flex items-center gap-2 text-xs">
                    <span className="w-24 shrink-0 text-fog-400">{CAT_META[cat].label}</span>
                    <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/5">
                      <motion.div className="h-full rounded-full" style={{ background: CAT_META[cat].color }} initial={{ width: 0 }} animate={{ width: `${(v / max) * 100}%` }} />
                    </div>
                    <span className="tabular w-20 shrink-0 text-right text-fog-300">{formatMoney(v, home)}</span>
                  </div>
                ))}
            </div>
          </section>
        )
      })}

      {items.length > 0 && (
        <section>
          <SectionTitle>Recent</SectionTitle>
          <ul className="card divide-y divide-white/5">
            <AnimatePresence initial={false}>
              {items.slice(0, 30).map((e) => (
                <motion.li key={e.id} layout initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="flex items-center gap-3 px-4 py-2.5">
                  <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: CAT_META[e.category].color }} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm text-fog-100">{e.note}</span>
                    <span className="block text-[11px] text-fog-500">
                      {new Date(e.ts).toLocaleDateString([], { month: 'short', day: 'numeric' })} · {CAT_META[e.category].label}
                    </span>
                  </span>
                  <span className="tabular text-right text-sm">
                    <span className="block text-fog-100">{formatMoney(e.amount, e.currency)}</span>
                    {e.currency !== home && <span className="block text-[11px] text-fog-500">{formatMoney(convert(e.amount, e.currency, home), home)}</span>}
                  </span>
                  <button onClick={() => removeExpense(e.id)} className="text-fog-500 hover:text-alert-500" aria-label="Delete expense">
                    <Trash2 size={14} />
                  </button>
                </motion.li>
              ))}
            </AnimatePresence>
          </ul>
        </section>
      )}
    </div>
  )
}
