import { motion } from 'framer-motion'
import { useEffect, useState } from 'react'
import { Emblem } from './Emblem'
import { agents } from '@/agents/host'

const STEPS = ['Packing your gear', 'Waking up agents', 'Reading the sky', 'Ready']

/**
 * Boot screen. Stays up for the logo animation (≈1.9 s) and until the agents
 * report in, capped so a slow worker never blocks the app.
 */
export function SplashScreen({ onDone }: { onDone: () => void }) {
  const [step, setStep] = useState(0)

  useEffect(() => {
    const started = Date.now()
    const timers = [setTimeout(() => setStep(1), 550), setTimeout(() => setStep(2), 1150)]
    let finished = false
    const finish = () => {
      if (finished) return
      finished = true
      setStep(3)
      setTimeout(onDone, 380)
    }
    const check = () => {
      const s = agents.getSnapshot().statuses
      const ready = Object.values(s).every((v) => v !== 'booting')
      const elapsed = Date.now() - started
      if ((ready && elapsed > 1900) || elapsed > 3500) finish()
    }
    const id = setInterval(check, 120)
    return () => {
      timers.forEach(clearTimeout)
      clearInterval(id)
    }
  }, [onDone])

  return (
    <motion.div
      className="fixed inset-0 z-[100] grid place-items-center bg-ink-900"
      initial={{ opacity: 1 }}
      exit={{ opacity: 0, scale: 1.04, filter: 'blur(6px)' }}
      transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
    >
      <div
        className="pointer-events-none absolute inset-0"
        style={{ background: 'radial-gradient(60% 40% at 50% 42%, rgba(255,107,74,0.14), transparent 70%)' }}
      />
      <div className="relative flex flex-col items-center">
        <motion.div
          className="text-fog-100"
          initial={{ opacity: 0, y: 12, scale: 0.92 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
        >
          <Emblem size={112} animate />
        </motion.div>
        <motion.h1
          className="mt-7 text-[28px] font-semibold tracking-[-0.02em] text-fog-50"
          initial={{ opacity: 0, y: 8, letterSpacing: '0.12em' }}
          animate={{ opacity: 1, y: 0, letterSpacing: '-0.02em' }}
          transition={{ delay: 1.15, duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
        >
          Backpack
        </motion.h1>
        <motion.div className="mt-6 h-[3px] w-28 overflow-hidden rounded-full bg-ink-700" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.4 }}>
          <motion.div
            className="h-full rounded-full bg-ember-500"
            initial={{ width: '0%' }}
            animate={{ width: `${((step + 1) / STEPS.length) * 100}%` }}
            transition={{ duration: 0.5, ease: 'easeOut' }}
          />
        </motion.div>
        <motion.p key={step} className="mt-3 font-mono text-[11px] tracking-wide text-fog-500" initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }}>
          {STEPS[step]}
        </motion.p>
      </div>
    </motion.div>
  )
}
