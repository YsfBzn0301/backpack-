/** Tiny looping demos for the Help Center cards. Each is self-contained. */
import { AnimatePresence, motion } from 'framer-motion'
import { Check, CloudRain, Lock, Moon, Sun, Unlock, WifiOff } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { DemoId } from './featuresRegistry'
import { AGENT_COLOR, AGENT_NAMES } from '@/agents/host'
import { QUOTES } from '@/data/quotes'
import { settings } from '@/lib/settings'

function useTick(ms: number, n: number) {
  const [i, setI] = useState(0)
  useEffect(() => {
    const id = setInterval(() => setI((x) => (x + 1) % n), ms)
    return () => clearInterval(id)
  }, [ms, n])
  return i
}

const Frame = ({ children }: { children: React.ReactNode }) => (
  <div className="relative grid h-24 place-items-center overflow-hidden rounded-xl bg-ink-900/70 hairline border" aria-hidden>
    {children}
  </div>
)

function Weather() {
  return (
    <Frame>
      <div className="absolute inset-0">
        {Array.from({ length: 14 }).map((_, i) => (
          <span key={i} className="absolute top-0 w-px bg-sky-glow/50" style={{ left: `${(i * 37) % 100}%`, height: 10, animation: `rain-fall ${0.7 + (i % 4) * 0.15}s linear ${-i * 0.2}s infinite` }} />
        ))}
      </div>
      <div className="relative flex items-center gap-3">
        <CloudRain className="text-sky-glow" size={26} />
        <span className="text-3xl font-light text-fog-50">18°</span>
      </div>
    </Frame>
  )
}

function QuoteDemo() {
  const lang = settings.use((st) => st.uiLang)
  const lines = ['live', 'moments', 'wander'].map((id) => `“${QUOTES.find((q) => q.id === id)!.text[lang]}”`)
  const i = useTick(2200, lines.length)
  return (
    <Frame>
      <AnimatePresence mode="wait">
        <motion.p key={i} initial={{ opacity: 0, y: 6, filter: 'blur(4px)' }} animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }} exit={{ opacity: 0 }} className="px-4 text-center text-sm text-fog-100">
          {lines[i]}
        </motion.p>
      </AnimatePresence>
    </Frame>
  )
}

function Feed() {
  const i = useTick(1600, 4)
  return (
    <Frame>
      <div className="w-4/5 space-y-1.5">
        {[0, 1].map((k) => {
          const a = AGENT_NAMES[(i + k) % 4]
          return (
            <motion.div key={`${i}-${k}`} initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: k * 0.1 }} className="flex items-center gap-2 rounded-lg bg-veil/[0.05] px-2 py-1.5">
              <span className="h-2 w-2 rounded-full" style={{ background: AGENT_COLOR[a] }} />
              <span className="h-1.5 flex-1 rounded-full bg-veil/15" />
            </motion.div>
          )
        })}
      </div>
    </Frame>
  )
}

function Parking() {
  const free = [42, 41, 39, 40, 37][useTick(900, 5)]
  return (
    <Frame>
      <div className="flex items-center gap-3">
        <span className="grid h-10 w-10 place-items-center rounded-xl bg-[#4f8cff] text-lg font-bold text-white">P</span>
        <div>
          <motion.div key={free} initial={{ opacity: 0.4, y: -3 }} animate={{ opacity: 1, y: 0 }} className="tabular text-sm font-semibold text-moss-400">
            {free} / 120
          </motion.div>
          <div className="h-1.5 w-24 overflow-hidden rounded-full bg-veil/10">
            <motion.div className="h-full rounded-full bg-moss-400" animate={{ width: `${(1 - free / 120) * 100}%` }} />
          </div>
        </div>
      </div>
    </Frame>
  )
}

function Transit() {
  const delay = [0, 0, 2, 4, 4][useTick(800, 5)]
  return (
    <Frame>
      <div className="flex items-center gap-2.5">
        <span className="tabular text-sm text-fog-50">14:32</span>
        <span className={`tabular w-7 text-xs font-semibold ${delay ? 'text-amber-glow' : 'text-moss-400'}`}>{delay ? `+${delay}` : '•'}</span>
        <span className="rounded-md bg-[#3fa34d] px-1.5 py-0.5 text-[11px] font-bold text-white">S1</span>
        <span className="text-xs text-fog-300">→ Airport</span>
      </div>
    </Frame>
  )
}

function MapDemo() {
  return (
    <Frame>
      {[
        [30, 40, '#ffb347'],
        [55, 30, '#5fd39a'],
        [70, 60, '#4fd1c5'],
        [42, 65, '#ff876b'],
      ].map(([x, y, c], i) => (
        <motion.span
          key={i}
          className="absolute h-4 w-4 rounded-full rounded-br-none border-2 border-ink-900"
          style={{ left: `${x}%`, top: `${y}%`, background: c as string, rotate: 45 }}
          animate={{ y: [-14, 0, 0], opacity: [0, 1, 1] }}
          transition={{ duration: 2.4, delay: i * 0.25, repeat: Infinity, times: [0, 0.2, 1] }}
        />
      ))}
      <span className="absolute h-3 w-3 rounded-full border-2 border-fog-50 bg-sky-glow" style={{ left: '48%', top: '48%' }} />
    </Frame>
  )
}

function Numpad() {
  const steps = ['1', '18', '180', '180']
  const i = useTick(700, steps.length)
  const v = +steps[i]
  return (
    <Frame>
      <div className="text-center">
        <div className="tabular text-2xl font-light text-fog-50">฿{steps[i]}</div>
        <div className="tabular text-sm text-ember-400">≈ €{(v / 38.5).toFixed(2)}</div>
      </div>
    </Frame>
  )
}

function Wave({ color = '#6cb6ff' }: { color?: string }) {
  return (
    <Frame>
      <div className="flex h-10 items-center gap-1">
        {Array.from({ length: 18 }).map((_, i) => (
          <motion.span key={i} className="w-1.5 rounded-full" style={{ background: color }} animate={{ height: [6, 10 + ((i * 7) % 26), 6] }} transition={{ duration: 0.9, repeat: Infinity, delay: i * 0.05 }} />
        ))}
      </div>
    </Frame>
  )
}

function CoverFlow() {
  const i = useTick(1300, 4)
  const colors = ['#ff6b4a', '#6cb6ff', '#1db954', '#b38cff']
  return (
    <Frame>
      <div className="relative h-16 w-full" style={{ perspective: 400 }}>
        {colors.map((c, k) => {
          const d = k - i
          return (
            <motion.span
              key={k}
              className="absolute top-0 left-1/2 -ml-8 h-16 w-16 rounded-md shadow-lg"
              style={{ background: `linear-gradient(135deg, ${c}, #0d1117)`, zIndex: 10 - Math.abs(d) }}
              animate={{ x: d === 0 ? 0 : Math.sign(d) * (48 + (Math.abs(d) - 1) * 18), rotateY: -Math.max(-1, Math.min(1, d)) * 55, scale: d === 0 ? 1 : 0.85, opacity: Math.abs(d) > 2 ? 0 : 1 }}
              transition={{ type: 'spring', stiffness: 200, damping: 24 }}
            />
          )
        })}
      </div>
    </Frame>
  )
}

function CameraDemo() {
  const i = useTick(1800, 2)
  return (
    <Frame>
      <div className="h-12 w-12 rounded-full border-4 border-fog-100 p-1">
        <motion.div className="h-full w-full rounded-full bg-fog-100" animate={i ? { scale: [1, 0.8, 1] } : {}} transition={{ duration: 0.3 }} />
      </div>
      <AnimatePresence>{i === 1 && <motion.div key="f" className="absolute inset-0 bg-white" initial={{ opacity: 0.7 }} animate={{ opacity: 0 }} transition={{ duration: 0.4 }} />}</AnimatePresence>
    </Frame>
  )
}

function Scanner() {
  return (
    <Frame>
      <div className="space-y-1.5 text-[11px] text-fog-300">
        <div className="flex w-32 justify-between">
          <span>Pad Thai</span>
          <span className="tabular">120</span>
        </div>
        <div className="flex w-32 justify-between">
          <span>Mango rice</span>
          <span className="tabular">90</span>
        </div>
      </div>
      <motion.span className="absolute inset-x-6 h-0.5 bg-moss-400 shadow-[0_0_10px_#5fd39a]" animate={{ top: ['20%', '80%', '20%'] }} transition={{ duration: 2.2, repeat: Infinity }} />
    </Frame>
  )
}

function Checklist() {
  const i = useTick(700, 5)
  return (
    <Frame>
      <div className="w-36 space-y-1.5">
        {[0, 1, 2].map((k) => (
          <div key={k} className="flex items-center gap-2">
            <span className={`grid h-4 w-4 place-items-center rounded border ${k < i ? 'border-ember-500 bg-ember-500 text-ink-900' : 'border-fog-500'}`}>{k < i && <Check size={10} strokeWidth={3} />}</span>
            <span className={`h-1.5 flex-1 rounded-full ${k < i ? 'bg-veil/10' : 'bg-veil/20'}`} />
          </div>
        ))}
        <div className="h-1 overflow-hidden rounded-full bg-veil/10">
          <motion.div className="h-full bg-ember-500" animate={{ width: `${(Math.min(i, 3) / 3) * 100}%` }} />
        </div>
      </div>
    </Frame>
  )
}

function VaultDemo() {
  const i = useTick(1400, 2)
  return (
    <Frame>
      <motion.div key={i} initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className={i ? 'text-moss-400' : 'text-[#b38cff]'}>
        {i ? <Unlock size={30} /> : <Lock size={30} />}
      </motion.div>
    </Frame>
  )
}

function Sos() {
  return (
    <Frame>
      <div className="flex gap-2">
        {['112', '191', '1669'].map((n, i) => (
          <motion.span key={n} className="tabular rounded-lg bg-alert-500/15 px-2.5 py-1.5 text-sm font-semibold text-alert-500" animate={{ scale: [1, 1.08, 1] }} transition={{ duration: 1.4, delay: i * 0.2, repeat: Infinity }}>
            {n}
          </motion.span>
        ))}
      </div>
    </Frame>
  )
}

function Offline() {
  const { t } = useTranslation()
  return (
    <Frame>
      <motion.div className="flex items-center gap-2 rounded-full bg-ink-700 px-3 py-1.5 text-[11px] text-fog-100 ring-1 ring-amber-glow/40" animate={{ y: [-30, 0, 0, -30] }} transition={{ duration: 3, repeat: Infinity, times: [0, 0.15, 0.85, 1] }}>
        <WifiOff size={12} className="text-amber-glow" /> {t('common.offline')}
      </motion.div>
    </Frame>
  )
}

function Theme() {
  const i = useTick(1500, 2)
  return (
    <Frame>
      <motion.div className="flex h-14 w-24 items-center justify-center rounded-xl" animate={{ background: i ? '#f4f4f0' : '#161b22', color: i ? '#0d1117' : '#e6edf3' }} transition={{ duration: 0.5 }}>
        {i ? <Sun size={20} /> : <Moon size={20} />}
      </motion.div>
    </Frame>
  )
}

function Agent({ color }: { color: string }) {
  return (
    <Frame>
      <div className="relative h-16 w-16">
        <span className="absolute inset-5 rounded-full" style={{ background: color }} />
        <motion.span className="absolute inset-0 rounded-full border" style={{ borderColor: color }} animate={{ scale: [0.6, 1.2], opacity: [0.8, 0] }} transition={{ duration: 1.6, repeat: Infinity }} />
        <motion.span className="absolute inset-0 rounded-full border" style={{ borderColor: color }} animate={{ scale: [0.6, 1.2], opacity: [0.8, 0] }} transition={{ duration: 1.6, delay: 0.8, repeat: Infinity }} />
      </div>
    </Frame>
  )
}

export function HelpDemo({ id, color }: { id?: DemoId; color: string }) {
  switch (id) {
    case 'weather':
      return <Weather />
    case 'quote':
      return <QuoteDemo />
    case 'feed':
      return <Feed />
    case 'parking':
      return <Parking />
    case 'transit':
      return <Transit />
    case 'map':
      return <MapDemo />
    case 'numpad':
      return <Numpad />
    case 'waveform':
      return <Wave />
    case 'coverflow':
      return <CoverFlow />
    case 'camera':
      return <CameraDemo />
    case 'scanner':
      return <Scanner />
    case 'checklist':
      return <Checklist />
    case 'vault':
      return <VaultDemo />
    case 'sos':
      return <Sos />
    case 'offline':
      return <Offline />
    case 'theme':
      return <Theme />
    case 'agent':
    default:
      return <Agent color={color} />
  }
}
