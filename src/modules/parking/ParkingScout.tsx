/**
 * Smart Parking & Garage Finder.
 *
 * Pipeline: host fetches lots (OSM + ParkenDD live + Google + custom) →
 * ScoutAgent analyses status & warnings for the planned stay → BudgetAgent
 * prices each lot in home currency against the daily parking budget.
 */
import { motion } from 'framer-motion'
import {
  Accessibility,
  AlertTriangle,
  ArrowUpFromLine,
  Banknote,
  Car,
  ChevronRight,
  Clock,
  Coins,
  CreditCard,
  Globe,
  LocateFixed,
  Map as MapIcon,
  Minus,
  Nfc,
  Plus,
  Smartphone,
  Ticket,
  Zap,
} from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { agents, useAgentState } from '@/agents/host'
import type { ParkingLot } from '@/agents/protocol'
import type { ParkingAnalysis } from '@/agents/scout.worker'
import type { ParkingQuote } from '@/agents/budget.worker'
import type { SafetyState } from '@/agents/safety.worker'
import { activeCoords, location } from '@/lib/location'
import { settings } from '@/lib/settings'
import { createStore } from '@/lib/store'
import { haptic } from '@/lib/haptics'
import { walkMinutes } from '@/lib/geo'
import { fmtDistance, fmtDuration, fmtHoursSpec, fmtMoney, relativeTime } from '@/i18n/format'
import { useMsg } from '@/i18n/msg'
import { navLinks, parkingNearby } from '@/services/parking'
import { useOnline } from '@/hooks/useOnline'
import { Pressable } from '@/components/ui/Pressable'
import { Segmented } from '@/components/ui/Segmented'
import { Sheet } from '@/components/ui/Sheet'
import { MapView } from '@/modules/map/MapView'
import type { Overlay } from '@/modules/map/TileMap'
import { UserDot } from '@/modules/map/Marker'
import { NeedLocation, RadiusToggle } from '@/modules/map/MapModule'
import { RoadRulesCard } from './RoadRulesCard'
import { useScrollFade } from '@/hooks/useScrollFade'

type Filter = 'freeNow' | 'ev' | 'accessible' | 'covered' | 'live'
const STAYS = [30, 60, 120, 240, 480, 1440]

const prefs = createStore({ stayMin: 120, view: 'list' as 'list' | 'map', filters: [] as Filter[] }, 'backpack:parking-prefs')

interface Row {
  lot: ParkingLot
  a: ParkingAnalysis
  q?: ParkingQuote
}

export function ParkingScout() {
  const fadeRef = useScrollFade()
  const { t } = useTranslation()
  const loc = location.use()
  const { coords } = activeCoords(loc)
  const s = settings.use()
  const p = prefs.use()
  const online = useOnline()
  const safety = useAgentState<SafetyState>('safety')
  const country = safety?.country.code && safety.country.code !== 'XX' ? safety.country.code : (loc.searched?.countryCode ?? undefined)
  const [selected, setSelected] = useState<string | null>(null)
  const [recenter, setRecenter] = useState('0')

  const lat3 = coords?.lat.toFixed(3)
  const lng3 = coords?.lng.toFixed(3)
  const lots = useQuery({
    queryKey: ['parking', lat3, lng3, s.scoutRadius],
    queryFn: () => parkingNearby({ lat: coords!.lat, lng: coords!.lng, radius: s.scoutRadius, country }),
    enabled: Boolean(coords),
    staleTime: 3 * 60_000,
    gcTime: 24 * 3600_000,
    refetchInterval: 3 * 60_000, // live availability
    retry: 1,
  })

  const analysis = useQuery({
    queryKey: ['parking-analysis', lots.dataUpdatedAt, p.stayMin, s.vehicleHeightM, s.parkingBudgetDaily, s.homeCurrency],
    enabled: Boolean(lots.data?.length),
    queryFn: async () => {
      const list = lots.data!
      const analyses = await agents.run<ParkingAnalysis[]>('scout', 'parkingAnalyze', { lots: list, stayMin: p.stayMin })
      const quotes = await agents.run<ParkingQuote[]>('budget', 'parkingQuote', {
        items: analyses.map((a) => ({ id: a.id, estimate: a.estimate, rates: a.rates })),
        stayMin: p.stayMin,
      })
      const byId = new Map(list.map((l) => [l.id, l]))
      const qById = new Map(quotes.map((q) => [q.id, q]))
      return analyses.map((a) => ({ lot: byId.get(a.id)!, a, q: qById.get(a.id) })) as Row[]
    },
    gcTime: 0,
  })

  const rows = useMemo(() => {
    const has = (f: Filter) => p.filters.includes(f)
    return (analysis.data ?? []).filter(({ lot, a }) => {
      if (has('freeNow') && !(a.estimate.total === 0 || a.now.freeNow)) return false
      if (has('ev') && !lot.ev) return false
      if (has('accessible') && !lot.disabled) return false
      if (has('covered') && !(lot.type === 'garage' || lot.type === 'underground')) return false
      if (has('live') && lot.free == null) return false
      return true
    })
  }, [analysis.data, p.filters])

  const sel = rows.find((r) => r.lot.id === selected) ?? null

  const overlays: Overlay[] = useMemo(() => {
    const o: Overlay[] = rows.slice(0, 50).map((r) => ({ key: r.lot.id, lat: r.lot.lat, lng: r.lot.lng, node: <ParkingPin row={r} selected={r.lot.id === selected} onClick={() => setSelected(r.lot.id)} /> }))
    if (loc.gps) o.push({ key: 'me', lat: loc.gps.lat, lng: loc.gps.lng, node: <UserDot /> })
    return o
  }, [rows, selected, loc.gps])

  if (!coords) return <NeedLocation />

  const toggleFilter = (f: Filter) => prefs.set((st) => ({ filters: st.filters.includes(f) ? st.filters.filter((x) => x !== f) : [...st.filters, f] }))
  const stayIdx = Math.max(0, STAYS.indexOf(p.stayMin))
  const loading = lots.isLoading || (analysis.isLoading && Boolean(lots.data?.length))

  return (
    <div className="space-y-3">
      <section className="card p-3.5">
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="text-[11px] text-fog-500">{t('parking.stay')}</div>
            <div className="tabular text-lg font-medium text-fog-50">{fmtDuration(p.stayMin)}</div>
          </div>
          <div className="flex items-center gap-1 rounded-full bg-ink-900 p-1 hairline border">
            <button
              onClick={() => prefs.set({ stayMin: STAYS[Math.max(0, stayIdx - 1)] })}
              className="grid h-8 w-8 place-items-center rounded-full text-fog-300 hover:bg-veil/5 disabled:opacity-30"
              disabled={stayIdx === 0}
              aria-label={t('parking.shorter')}
            >
              <Minus size={15} />
            </button>
            <button
              onClick={() => prefs.set({ stayMin: STAYS[Math.min(STAYS.length - 1, stayIdx + 1)] })}
              className="grid h-8 w-8 place-items-center rounded-full text-fog-300 hover:bg-veil/5 disabled:opacity-30"
              disabled={stayIdx === STAYS.length - 1}
              aria-label={t('parking.longer')}
            >
              <Plus size={15} />
            </button>
          </div>
        </div>
        <div ref={fadeRef} className="scroll-fade no-scrollbar -mx-1 mt-3 flex gap-1.5 overflow-x-auto px-1" data-no-swipe>
          {(['freeNow', 'live', 'ev', 'accessible', 'covered'] as Filter[]).map((f) => (
            <Pressable
              key={f}
              haptics="select"
              onClick={() => toggleFilter(f)}
              className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-medium ${p.filters.includes(f) ? 'bg-fog-100 text-ink-900' : 'bg-veil/[0.05] text-fog-300'}`}
            >
              {t(`parking.filter.${f}`)}
            </Pressable>
          ))}
        </div>
        <div className="mt-3 flex items-center justify-between gap-2 border-t pt-3 hairline">
          <label className="flex items-center gap-2 text-xs text-fog-300">
            <Car size={14} className="text-fog-500" />
            {t('parking.driving')}
            <button
              role="switch"
              aria-checked={s.driving}
              onClick={() => settings.set({ driving: !s.driving })}
              className={`relative h-5 w-9 rounded-full transition-colors ${s.driving ? 'bg-ember-500' : 'bg-ink-600'}`}
            >
              <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-fog-50 shadow transition-all ${s.driving ? 'left-[18px]' : 'left-0.5'}`} />
            </button>
          </label>
          <span className="text-[11px] text-fog-500">
            {t('parking.budgetLine', { budget: fmtMoney(s.parkingBudgetDaily, s.homeCurrency), height: s.vehicleHeightM.toFixed(1) })}
          </span>
        </div>
      </section>

      <div className="flex items-center gap-2">
        <div className="flex-1">
          <Segmented
            stretch
            size="sm"
            value={p.view}
            onChange={(v) => prefs.set({ view: v })}
            options={[
              { value: 'list', label: t('parking.list') },
              { value: 'map', label: t('parking.map') },
            ]}
          />
        </div>
        <RadiusToggle />
      </div>

      {p.view === 'map' && (
        <div className="card relative h-[44dvh] min-h-[260px] overflow-hidden p-0">
          <MapView center={sel?.lot ?? coords} overlays={overlays} radius={{ ...coords, meters: s.scoutRadius }} recenterKey={`${recenter}-${selected}-${s.scoutRadius}`} onBackgroundClick={() => setSelected(null)} />
          <Pressable onClick={() => setRecenter(String(Date.now()))} className="glass absolute bottom-3 left-3 grid h-10 w-10 place-items-center rounded-xl text-fog-100" aria-label={t('map.recenter')}>
            <LocateFixed size={18} />
          </Pressable>
          <div className="glass absolute top-3 left-3 flex items-center gap-2 rounded-full px-3 py-1 text-[10px] text-fog-300">
            <Legend color="#5fd39a" label={t('parking.legendFree')} />
            <Legend color="#ffb347" label={t('parking.legendPaid')} />
            <Legend color="#ff4d5e" label={t('parking.legendBlocked')} />
          </div>
        </div>
      )}

      {loading ? (
        <div className="space-y-2">
          {[0, 1, 2].map((i) => (
            <div key={i} className="card h-28 animate-pulse" />
          ))}
        </div>
      ) : lots.isError ? (
        <p className="card p-4 text-sm text-fog-400">{online ? t('parking.loadFailed') : t('parking.offline')}</p>
      ) : !rows.length ? (
        <p className="card p-4 text-sm text-fog-400">{p.filters.length ? t('parking.noneFiltered') : t('parking.none', { radius: fmtDistance(s.scoutRadius) })}</p>
      ) : (
        <ul className="space-y-2">
          {rows.slice(0, 25).map((r, i) => (
            <ParkingCard key={r.lot.id} row={r} best={i === 0 && !r.a.blocked} onOpen={() => setSelected(r.lot.id)} />
          ))}
        </ul>
      )}

      {country && <RoadRulesCard country={country} />}
      <p className="px-1 text-[10px] leading-relaxed text-fog-500">{t('parking.disclaimer')}</p>

      <Sheet open={Boolean(sel) && p.view === 'list'} onClose={() => setSelected(null)} title={sel && <LotTitle row={sel} />}>
        {sel && <LotDetail row={sel} />}
      </Sheet>
      {p.view === 'map' && sel && (
        <div className="card p-4">
          <LotTitle row={sel} />
          <div className="mt-3">
            <LotDetail row={sel} />
          </div>
        </div>
      )}
    </div>
  )
}

const statusColor = (r: Row) => (r.a.blocked ? '#ff4d5e' : r.a.estimate.total === 0 || r.a.now.freeNow ? '#5fd39a' : r.lot.fee === null && !r.lot.rates.length ? '#8b949e' : '#ffb347')

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <span className="flex items-center gap-1">
      <span className="h-2 w-2 rounded-full" style={{ background: color }} />
      {label}
    </span>
  )
}

function ParkingPin({ row, selected, onClick }: { row: Row; selected: boolean; onClick: () => void }) {
  const c = statusColor(row)
  const { t } = useTranslation()
  const label = row.lot.free != null ? String(row.lot.free) : row.a.estimate.total === 0 ? t('parking.price.free') : row.q?.totalHome != null ? fmtMoney(row.q.totalHome, row.q.home, { compact: true }) : null
  return (
    <motion.button
      onClick={(e) => {
        e.stopPropagation()
        haptic('select')
        onClick()
      }}
      initial={{ scale: 0 }}
      animate={{ scale: selected ? 1.2 : 1 }}
      className="relative flex -translate-x-1/2 -translate-y-1/2 items-center gap-1 rounded-full border-2 py-0.5 pr-2 pl-0.5 shadow-lg"
      style={{ background: '#0d1117', borderColor: selected ? '#f3f6f9' : c, zIndex: selected ? 20 : 1 }}
      aria-label={row.lot.name || 'Parking'}
    >
      <span className="grid h-5 w-5 place-items-center rounded-full text-[11px] font-bold text-[#0d1117]" style={{ background: c }}>
        P
      </span>
      {label && <span className="tabular text-[10px] font-semibold text-[#f3f6f9]">{label}</span>}
    </motion.button>
  )
}

function LotTitle({ row }: { row: Row }) {
  const { t } = useTranslation()
  const { lot, a } = row
  return (
    <div className="min-w-0">
      <div className="text-[11px] text-fog-500">
        {t(`parking.type.${lot.type}`)} · {fmtDistance(a.distance)} · {t('map.minWalk', { n: walkMinutes(a.distance) })}
      </div>
      <h3 className="truncate text-[17px] leading-tight font-semibold text-fog-50">{lot.name || t(`parking.type.${lot.type}`)}</h3>
    </div>
  )
}

function Price({ row, big }: { row: Row; big?: boolean }) {
  const { t } = useTranslation()
  const { a, q } = row
  const local = a.estimate.total != null && a.estimate.currency && q && a.estimate.currency !== q.home ? fmtMoney(a.estimate.total, a.estimate.currency) : null
  return (
    <div className="shrink-0 text-right">
      <div className={`tabular font-semibold ${big ? 'text-xl' : 'text-base'} ${q?.verdict === 'over' ? 'text-amber-glow' : 'text-fog-50'}`}>
        {a.estimate.total === 0 ? t('parking.price.free') : q?.totalHome != null ? fmtMoney(q.totalHome, q.home) : '—'}
      </div>
      {local && <div className="tabular text-[11px] text-fog-500">{local}</div>}
      {q && <Verdict verdict={q.verdict} />}
    </div>
  )
}

function Verdict({ verdict }: { verdict: ParkingQuote['verdict'] }) {
  const { t } = useTranslation()
  const cls = verdict === 'free' ? 'bg-moss-400/15 text-moss-400' : verdict === 'within' ? 'bg-moss-400/10 text-moss-400' : verdict === 'over' ? 'bg-amber-glow/15 text-amber-glow' : 'bg-veil/[0.06] text-fog-500'
  return <span className={`mt-1 inline-block rounded-full px-1.5 py-px text-[10px] font-medium ${cls}`}>{t(`parking.verdict.${verdict}`)}</span>
}

function Availability({ lot }: { lot: ParkingLot }) {
  const { t } = useTranslation()
  if (lot.free == null) return lot.capacity ? <span className="text-[11px] text-fog-500">{t('parking.capacity', { n: lot.capacity })}</span> : null
  const pct = lot.capacity ? Math.min(1, lot.free / lot.capacity) : null
  const color = lot.free === 0 ? '#ff4d5e' : pct != null && pct < 0.15 ? '#ffb347' : '#5fd39a'
  return (
    <div className="flex min-w-0 flex-1 items-center gap-2">
      <span className="relative flex h-2 w-2 shrink-0">
        <span className="absolute inset-0 animate-ping rounded-full opacity-60" style={{ background: color }} />
        <span className="relative h-2 w-2 rounded-full" style={{ background: color }} />
      </span>
      <span className="tabular shrink-0 text-xs font-medium" style={{ color }}>
        {lot.free === 0 ? t('parking.full') : lot.capacity ? t('parking.freeOf', { n: lot.free, total: lot.capacity }) : t('parking.freeN', { n: lot.free })}
      </span>
      {pct != null && (
        <span className="h-1.5 min-w-8 flex-1 overflow-hidden rounded-full bg-veil/10">
          <span className="block h-full rounded-full" style={{ width: `${(1 - pct) * 100}%`, background: color }} />
        </span>
      )}
      {lot.liveAt && <span className="shrink-0 text-[10px] text-fog-500">{t('parking.live', { time: relativeTime(lot.liveAt) })}</span>}
    </div>
  )
}

function ParkingCard({ row, best, onOpen }: { row: Row; best: boolean; onOpen: () => void }) {
  const { t } = useTranslation()
  const render = useMsg()
  const { lot, a } = row
  const top = [...a.warnings, ...(row.q?.alerts ?? [])].slice(0, 2)
  return (
    <li>
      <button onClick={onOpen} className={`card w-full p-3.5 text-left transition-transform active:scale-[0.99] ${best ? 'ring-1 ring-ember-500/40' : ''} ${a.blocked ? 'opacity-70' : ''}`}>
        <div className="flex items-start gap-3">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl text-base font-bold" style={{ background: `${statusColor(row)}22`, color: statusColor(row) }}>
            P
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5">
              <span className="truncate text-sm font-medium text-fog-50">{lot.name || t(`parking.type.${lot.type}`)}</span>
              {best && <span className="shrink-0 rounded-full bg-ember-500/15 px-1.5 py-px text-[10px] font-medium text-ember-400">{t('parking.best')}</span>}
            </div>
            <div className="text-xs text-fog-500">
              {t(`parking.type.${lot.type}`)} · {fmtDistance(a.distance)}
              {a.rates.perHour != null && a.rates.currency ? ` · ${t('parking.perHour', { amount: fmtMoney(a.rates.perHour, a.rates.currency) })}` : ''}
            </div>
          </div>
          <Price row={row} />
        </div>
        <div className="mt-2.5 flex items-center gap-2">
          <Availability lot={lot} />
          <Tags lot={lot} compact />
        </div>
        {top.length > 0 && (
          <ul className="mt-2 space-y-0.5">
            {top.map((w, i) => (
              <li key={i} className="flex items-start gap-1.5 text-[11px] text-amber-glow">
                <AlertTriangle size={11} className="mt-0.5 shrink-0" /> {render(w)}
              </li>
            ))}
          </ul>
        )}
      </button>
    </li>
  )
}

function Tags({ lot, compact }: { lot: ParkingLot; compact?: boolean }) {
  const { t } = useTranslation()
  const tags: { key: string; Icon: typeof Zap; label: string }[] = []
  if (lot.ev) tags.push({ key: 'ev', Icon: Zap, label: typeof lot.ev === 'number' ? t('parking.tag.evN', { n: lot.ev }) : t('parking.tag.ev') })
  if (lot.disabled) tags.push({ key: 'dis', Icon: Accessibility, label: typeof lot.disabled === 'number' ? t('parking.tag.disabledN', { n: lot.disabled }) : t('parking.tag.disabled') })
  if (lot.maxHeightM) tags.push({ key: 'h', Icon: ArrowUpFromLine, label: t('parking.tag.height', { h: lot.maxHeightM.toFixed(2) }) })
  const PAY_ICON = { app: Smartphone, machine: Ticket, cash: Banknote, card: CreditCard, coins: Coins, contactless: Nfc }
  if (!compact) for (const p of lot.payment) tags.push({ key: p, Icon: PAY_ICON[p], label: t(`parking.pay.${p}`) })
  if (!tags.length) return null
  return (
    <div className={`flex flex-wrap gap-1 ${compact ? 'ml-auto shrink-0' : ''}`}>
      {tags.map(({ key, Icon, label }) => (
        <span key={key} className="flex items-center gap-1 rounded-full bg-veil/[0.06] px-2 py-0.5 text-[10px] text-fog-300" title={label}>
          <Icon size={11} />
          {!compact && label}
        </span>
      ))}
    </div>
  )
}

function LotDetail({ row }: { row: Row }) {
  const { t } = useTranslation()
  const render = useMsg()
  const { lot, a, q } = row
  const links = navLinks(lot)
  const cur = a.rates.currency
  const rateRows: [string, number | undefined, number | undefined][] = [
    [t('parking.rate.hour'), a.rates.perHour, q?.perHourHome],
    [t('parking.rate.day'), a.rates.perDay, q?.perDayHome],
    [t('parking.rate.flat'), a.rates.flat, q?.flatHome],
  ]
  const hasRates = rateRows.some(([, v]) => v != null)
  const conditions: string[] = []
  if (lot.fee === false && !lot.paidWhen) conditions.push(t('parking.cond.alwaysFree'))
  if (lot.freeFirstMin) conditions.push(t('parking.cond.freeFirst', { dur: fmtDuration(lot.freeFirstMin) }))
  if (lot.freeWhen) conditions.push(t('parking.cond.freeWhen', { when: fmtHoursSpec(lot.freeWhen) }))
  if (lot.paidWhen) conditions.push(t('parking.cond.paidWhen', { when: fmtHoursSpec(lot.paidWhen) }))
  if (lot.maxStayMin) conditions.push(t(lot.disc ? 'parking.cond.maxStayDisc' : 'parking.cond.maxStay', { dur: fmtDuration(lot.maxStayMin) }) + (lot.maxStayWhen ? ` (${fmtHoursSpec(lot.maxStayWhen)})` : ''))
  else if (lot.disc) conditions.push(t('parking.cond.disc'))
  for (const r of lot.rates.filter((r) => r.when)) conditions.push(`${fmtMoney(r.amount, r.currency)} / ${fmtDuration(r.unitMin || 60)} · ${fmtHoursSpec(r.when!)}`)

  return (
    <div className="space-y-4 pb-2">
      <div className="flex items-center justify-between gap-3 rounded-2xl bg-veil/[0.04] p-3">
        <div>
          <div className="text-[11px] text-fog-500">{t('parking.estimate', { dur: fmtDuration(a.estimate.freeMin + a.estimate.paidMin) })}</div>
          {a.estimate.dailyCapped && <div className="text-[11px] text-moss-400">{t('parking.dailyCap')}</div>}
          {a.estimate.total == null && <div className="text-[11px] text-fog-500">{t('parking.price.unknown')}</div>}
        </div>
        <Price row={row} big />
      </div>

      <div className="flex flex-wrap items-center gap-2 text-xs text-fog-300">
        <Clock size={13} className="text-fog-500" />
        {lot.hours ? fmtHoursSpec(lot.hours) : t('parking.hoursUnknown')}
        {a.now.open === true && <span className="text-moss-400">· {t('map.openNow')}</span>}
        {a.now.open === false && <span className="text-alert-500">· {t('map.closed')}</span>}
      </div>
      <Availability lot={lot} />

      {hasRates && (
        <div>
          <div className="mb-1.5 text-[11px] font-medium text-fog-500">{t('parking.rates')}</div>
          <div className="divide-y divide-veil/5 rounded-2xl bg-veil/[0.03]">
            {rateRows
              .filter(([, v]) => v != null)
              .map(([label, v, home]) => (
                <div key={label} className="tabular flex items-center justify-between px-3 py-2 text-sm">
                  <span className="text-fog-400">{label}</span>
                  <span className="text-right">
                    <span className="text-fog-50">{fmtMoney(v!, cur!)}</span>
                    {home != null && q && cur !== q.home && <span className="ml-2 text-xs text-fog-500">≈ {fmtMoney(home, q.home)}</span>}
                  </span>
                </div>
              ))}
          </div>
        </div>
      )}

      {conditions.length > 0 && (
        <div>
          <div className="mb-1.5 text-[11px] font-medium text-fog-500">{t('parking.conditions')}</div>
          <ul className="space-y-1">
            {conditions.map((c) => (
              <li key={c} className="flex gap-2 text-xs text-fog-300">
                <ChevronRight size={12} className="mt-0.5 shrink-0 text-fog-500" /> {c}
              </li>
            ))}
          </ul>
        </div>
      )}

      {(a.warnings.length > 0 || (q?.alerts.length ?? 0) > 0) && (
        <ul className="space-y-1 rounded-2xl bg-amber-glow/10 p-3">
          {[...a.warnings, ...(q?.alerts ?? [])].map((w, i) => (
            <li key={i} className="flex items-start gap-2 text-xs text-amber-glow">
              <AlertTriangle size={12} className="mt-0.5 shrink-0" /> {render(w)}
            </li>
          ))}
        </ul>
      )}

      <Tags lot={lot} />
      {lot.customersOnly && <p className="text-xs text-fog-400">{t('parking.customersOnly')}</p>}

      <div>
        <div className="mb-1.5 text-[11px] font-medium text-fog-500">{t('parking.navigate')}</div>
        <div className="grid grid-cols-3 gap-2">
          {(
            [
              ['google', 'Google Maps', links.google],
              ['apple', 'Apple Maps', links.apple],
              ['waze', 'Waze', links.waze],
            ] as const
          ).map(([id, label, href], i) => (
            <a
              key={id}
              href={href}
              target="_blank"
              rel="noopener"
              onClick={() => haptic('select')}
              className={`flex items-center justify-center gap-1.5 rounded-full py-2.5 text-xs font-semibold ${i === 0 ? 'bg-ember-500 text-onaccent' : 'bg-veil/[0.06] text-fog-100'}`}
            >
              {i === 0 && <MapIcon size={14} />}
              {label}
            </a>
          ))}
        </div>
      </div>
      {lot.website && (
        <a href={lot.website} target="_blank" rel="noopener" className="flex items-center gap-1.5 text-xs text-ember-400">
          <Globe size={12} /> {lot.operator ?? t('parking.website')}
        </a>
      )}
      <p className="text-[10px] text-fog-500">{t(`parking.source.${lot.source}`)}</p>
    </div>
  )
}
