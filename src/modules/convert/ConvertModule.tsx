import { AnimatePresence, motion } from 'framer-motion'
import { ArrowDownUp, ChevronDown, Minus, Plus, RefreshCw, Users } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { agents, useAgentState } from '@/agents/host'
import type { PriceCheck } from '@/agents/budget.worker'
import type { SafetyState } from '@/agents/safety.worker'
import { useExchangeRates } from '@/hooks/useExchangeRates'
import { CURRENCY_BY_CODE } from '@/data/currencies'
import { flag } from '@/data/countries'
import { createStore } from '@/lib/store'
import { settings } from '@/lib/settings'
import { formatMoney, formatNumber, relativeTime } from '@/lib/format'
import { haptic } from '@/lib/haptics'
import { Pressable } from '@/components/ui/Pressable'
import { SectionTitle } from '@/components/ui/SectionTitle'
import { CurrencyPicker } from './CurrencyPicker'
import { Numpad } from './Numpad'

const pair = createStore({ from: '', to: '', userPicked: false }, 'backpack:fx-pair')

const TIPS = [0, 10, 15, 20]

export function ConvertModule() {
  const { fx, convert, syncing, refresh, localCurrency, error } = useExchangeRates()
  const home = settings.use((s) => s.homeCurrency)
  const p = pair.use()
  const safety = useAgentState<SafetyState>('safety')
  const from = p.from || localCurrency || (home === 'EUR' ? 'USD' : 'EUR')
  const to = p.to || home
  const [raw, setRaw] = useState('100')
  const [tip, setTip] = useState(0)
  const [tax, setTax] = useState(false)
  const [people, setPeople] = useState(1)
  const [picking, setPicking] = useState<null | 'from' | 'to'>(null)
  const [item, setItem] = useState('')
  const [check, setCheck] = useState<PriceCheck | null>(null)

  // Follow the local currency when the country changes, unless the user chose a pair.
  useEffect(() => {
    if (localCurrency && !p.userPicked && localCurrency !== home && p.from !== localCurrency) pair.set({ from: localCurrency, to: home })
  }, [localCurrency, home, p.userPicked, p.from])

  const amount = parseFloat(raw) || 0
  const gross = amount * (tax ? 1.07 : 1) * (1 + tip / 100)
  const each = gross / people
  const converted = convert(each, from, to)

  const onKey = (k: string) => {
    setCheck(null)
    setRaw((r) => {
      if (k === 'del') return r.length > 1 ? r.slice(0, -1) : '0'
      if (k === '.') return r.includes('.') ? r : r + '.'
      if (r.replace('.', '').length >= 10) return r
      if (r === '0') return k
      const [, dec] = r.split('.')
      if (dec && dec.length >= 2) return r
      return r + k
    })
  }

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement)?.tagName === 'INPUT') return
      if (/^[0-9.]$/.test(e.key)) onKey(e.key)
      else if (e.key === 'Backspace') onKey('del')
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

  const swap = () => {
    haptic('select')
    pair.set({ from: to, to: from, userPicked: true })
  }

  const reference = useMemo(() => {
    const unit = convert(1, from, 'USD')
    // Pick steps that are natural for the source currency's magnitude.
    const base = unit < 0.002 ? 10000 : unit < 0.02 ? 1000 : unit < 0.2 ? 100 : 1
    return [1, 5, 10, 50, 100].map((m) => m * base)
  }, [from, convert])

  const runCheck = async () => {
    if (!item.trim() || !amount) return
    const res = await agents.run<PriceCheck>('budget', 'check', { text: item, amount, currency: from, country: safety?.country.code })
    setCheck(res)
    haptic(res.verdict === 'steep' || res.verdict === 'high' ? 'warn' : 'success')
  }

  const fresh = Date.now() - fx.fetchedAt < 24 * 3600_000

  return (
    <div className="space-y-4">
      <section className="card p-4">
        <CurrencyRow code={from} onPick={() => setPicking('from')} value={formatNumber(amount, 2)} big label="You pay" />
        <div className="relative my-1 flex items-center">
          <div className="h-px flex-1 bg-white/5" />
          <Pressable onClick={swap} className="mx-2 grid h-9 w-9 place-items-center rounded-full bg-ink-700 text-fog-100" aria-label="Swap currencies">
            <ArrowDownUp size={16} />
          </Pressable>
          <div className="h-px flex-1 bg-white/5" />
        </div>
        <CurrencyRow code={to} onPick={() => setPicking('to')} value={Number.isFinite(converted) ? formatNumber(converted, converted > 1000 ? 0 : 2) : '—'} label={people > 1 ? `Each of ${people}` : 'You get'} accent />
        <div className="mt-3 flex items-center justify-between text-[11px] text-fog-500">
          <span>
            1 {from} = {formatNumber(convert(1, from, to), 4)} {to}
          </span>
          <button onClick={() => refresh()} className="flex items-center gap-1 hover:text-fog-300">
            <RefreshCw size={11} className={syncing ? 'animate-spin' : ''} />
            {fx.source === 'seed' ? 'Approximate offline rates' : `${fresh ? 'Live' : 'Cached'} · ${relativeTime(fx.fetchedAt)}`}
          </button>
        </div>
        {error && fx.source === 'seed' && <p className="mt-1 text-[11px] text-amber-glow">Could not reach the rate provider. Using built-in approximate rates.</p>}
      </section>

      <div className="no-scrollbar flex items-center gap-2 overflow-x-auto" data-no-swipe>
        {TIPS.map((t) => (
          <Chip key={t} active={tip === t} onClick={() => setTip(t)}>
            {t === 0 ? 'No tip' : `+${t}%`}
          </Chip>
        ))}
        <Chip active={tax} onClick={() => setTax((v) => !v)}>
          +7% tax
        </Chip>
        <div className="ml-auto flex shrink-0 items-center gap-1 rounded-full bg-ink-800 p-1 hairline border">
          <button onClick={() => setPeople((n) => Math.max(1, n - 1))} className="grid h-7 w-7 place-items-center rounded-full text-fog-300 hover:bg-white/5" aria-label="Fewer people">
            <Minus size={14} />
          </button>
          <span className="tabular flex items-center gap-1 px-1 text-xs text-fog-100">
            <Users size={12} /> {people}
          </span>
          <button onClick={() => setPeople((n) => Math.min(20, n + 1))} className="grid h-7 w-7 place-items-center rounded-full text-fog-300 hover:bg-white/5" aria-label="More people">
            <Plus size={14} />
          </button>
        </div>
      </div>

      <AnimatePresence>
        {(tip > 0 || tax || people > 1) && (
          <motion.p initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="px-1 text-xs text-fog-400">
            Total {formatMoney(gross, from)} ({formatMoney(convert(gross, from, to), to)})
            {people > 1 && ` · split ${people} ways`}
          </motion.p>
        )}
      </AnimatePresence>

      <Numpad onKey={onKey} onClear={() => setRaw('0')} />

      <section className="card p-4">
        <SectionTitle>Is this a fair price?</SectionTitle>
        <div className="flex gap-2">
          <input
            value={item}
            onChange={(e) => {
              setItem(e.target.value)
              setCheck(null)
            }}
            onKeyDown={(e) => e.key === 'Enter' && runCheck()}
            placeholder={`What costs ${formatMoney(amount, from)}? e.g. "coffee", "taxi 3 km"`}
            className="min-w-0 flex-1 rounded-xl bg-ink-900 px-3 py-2.5 text-sm outline-none hairline border placeholder:text-fog-500 focus:border-ember-500/40"
          />
          <button onClick={runCheck} className="shrink-0 rounded-xl bg-fog-100 px-4 text-sm font-medium text-ink-900 disabled:opacity-40" disabled={!item.trim()}>
            Check
          </button>
        </div>
        <AnimatePresence>
          {check && (
            <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="mt-3 flex items-start gap-3 rounded-xl bg-white/[0.03] p-3">
              <span
                className={`mt-0.5 rounded-full px-2 py-0.5 text-[10px] font-semibold tracking-wide uppercase ${
                  check.verdict === 'steep' ? 'bg-alert-500/20 text-alert-500' : check.verdict === 'high' ? 'bg-amber-glow/20 text-amber-glow' : check.verdict === 'unknown' ? 'bg-white/10 text-fog-400' : 'bg-moss-400/15 text-moss-400'
                }`}
              >
                {check.verdict}
              </span>
              <div className="text-xs leading-relaxed text-fog-300">
                {check.message}
                {check.typicalLocal != null && (
                  <span className="block text-fog-500">
                    Typical {check.itemLabel?.toLowerCase()}: about {formatMoney(check.typicalLocal, from)}
                  </span>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </section>

      <section>
        <SectionTitle>Quick reference</SectionTitle>
        <div className="card divide-y divide-white/5">
          {reference.map((v) => (
            <button key={v} onClick={() => setRaw(String(v))} className="tabular flex w-full items-center justify-between px-4 py-2.5 text-sm hover:bg-white/[0.02]">
              <span className="text-fog-300">{formatMoney(v, from)}</span>
              <span className="font-medium text-fog-50">{formatMoney(convert(v, from, to), to)}</span>
            </button>
          ))}
        </div>
      </section>

      <CurrencyPicker
        open={picking !== null}
        onClose={() => setPicking(null)}
        highlight={[localCurrency, home].filter(Boolean) as string[]}
        onPick={(code) => pair.set(picking === 'from' ? { from: code, to, userPicked: true } : { from, to: code, userPicked: true })}
      />
    </div>
  )
}

function CurrencyRow({ code, value, onPick, label, big, accent }: { code: string; value: string; onPick: () => void; label: string; big?: boolean; accent?: boolean }) {
  const c = CURRENCY_BY_CODE[code]
  return (
    <div className="flex items-center justify-between gap-3 py-1">
      <button onClick={onPick} className="flex shrink-0 items-center gap-2 rounded-full bg-white/[0.05] py-1.5 pr-2.5 pl-2 hover:bg-white/10">
        <span className="text-lg leading-none">{c?.region === 'EU' ? '🇪🇺' : flag(c?.region ?? '')}</span>
        <span className="font-mono text-sm font-medium">{code}</span>
        <ChevronDown size={14} className="text-fog-500" />
      </button>
      <div className="min-w-0 text-right">
        <div className="text-[11px] text-fog-500">{label}</div>
        <motion.div
          key={value}
          initial={{ opacity: 0.4, y: 3 }}
          animate={{ opacity: 1, y: 0 }}
          className={`tabular truncate font-light tracking-tight ${big ? 'text-4xl text-fog-50' : 'text-3xl'} ${accent ? 'text-ember-400' : ''}`}
        >
          {value}
        </motion.div>
      </div>
    </div>
  )
}

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <Pressable
      haptics="select"
      onClick={onClick}
      className={`shrink-0 rounded-full px-3.5 py-2 text-xs font-medium transition-colors ${active ? 'bg-ember-500 text-ink-900' : 'bg-ink-800 text-fog-300 hairline border'}`}
    >
      {children}
    </Pressable>
  )
}
