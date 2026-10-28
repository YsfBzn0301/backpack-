/** First-time user experience: a 3-slide tour shown once, on first launch only. */
import { AnimatePresence, motion } from 'framer-motion'
import { ArrowRight, MapPin, Monitor, Moon, Sun, WifiOff } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Emblem } from '@/components/Emblem'
import { AGENT_COLOR, AGENT_NAMES } from '@/agents/host'
import { UI_LANGS } from '@/i18n'
import { requestLocation } from '@/lib/location'
import { settings, type UiLang } from '@/lib/settings'
import { ui } from '@/lib/ui'
import { haptic } from '@/lib/haptics'

const KEY = 'bp:tour-done'
export const tourDone = () => {
  try {
    return localStorage.getItem(KEY) === '1'
  } catch {
    return true
  }
}
const markDone = () => {
  try {
    localStorage.setItem(KEY, '1')
  } catch {
    /* private mode: it will show again, which is acceptable */
  }
}

export function QuickTour() {
  const { t } = useTranslation()
  const open = ui.use((s) => s.tourOpen)
  const s = settings.use()
  const [i, setI] = useState(0)
  const [dir, setDir] = useState(1)

  const finish = () => {
    markDone()
    haptic('success')
    ui.set({ tourOpen: false })
    setI(0)
  }
  const go = (n: number) => {
    setDir(n > i ? 1 : -1)
    setI(n)
    haptic('select')
  }

  const slides = [
    <div key="0" className="flex flex-col items-center text-center">
      <div className="text-fog-100">
        <Emblem size={96} animate />
      </div>
      <h2 className="mt-8 text-2xl font-semibold tracking-tight text-fog-50">{t('tour.s1.title')}</h2>
      <p className="mt-3 max-w-xs text-sm leading-relaxed text-fog-400">{t('tour.s1.body')}</p>
    </div>,
    <div key="1" className="flex flex-col items-center text-center">
      <div className="relative h-36 w-36">
        {AGENT_NAMES.map((a, k) => {
          const angle = (k / 4) * Math.PI * 2 - Math.PI / 2
          return (
            <motion.div
              key={a}
              className="absolute flex flex-col items-center"
              style={{ left: `${50 + Math.cos(angle) * 40}%`, top: `${50 + Math.sin(angle) * 40}%`, translateX: '-50%', translateY: '-50%' }}
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ delay: 0.15 + k * 0.12, type: 'spring' }}
            >
              <span className="h-4 w-4 rounded-full shadow-[0_0_20px_currentColor]" style={{ background: AGENT_COLOR[a], color: AGENT_COLOR[a] }} />
              <span className="mt-1 text-[10px] font-medium text-fog-300">{t(`agents.name.${a}`)}</span>
            </motion.div>
          )
        })}
        <span className="absolute inset-[38%] rounded-full border border-veil/20" />
      </div>
      <h2 className="mt-6 text-2xl font-semibold tracking-tight text-fog-50">{t('tour.s2.title')}</h2>
      <p className="mt-3 max-w-xs text-sm leading-relaxed text-fog-400">{t('tour.s2.body')}</p>
    </div>,
    <div key="2" className="flex w-full flex-col items-center text-center">
      <span className="grid h-16 w-16 place-items-center rounded-3xl bg-amber-glow/15 text-amber-glow">
        <WifiOff size={28} />
      </span>
      <h2 className="mt-6 text-2xl font-semibold tracking-tight text-fog-50">{t('tour.s3.title')}</h2>
      <p className="mt-3 max-w-xs text-sm leading-relaxed text-fog-400">{t('tour.s3.body')}</p>
      <div className="mt-6 grid w-full max-w-xs grid-cols-4 gap-1.5">
        {UI_LANGS.map((l) => (
          <button key={l.code} onClick={() => settings.set({ uiLang: l.code as UiLang })} className={`rounded-xl py-2 text-xs font-semibold ${s.uiLang === l.code ? 'bg-fog-100 text-ink-900' : 'bg-veil/[0.06] text-fog-300'}`}>
            {l.native}
          </button>
        ))}
      </div>
      <div className="mt-2 grid w-full max-w-xs grid-cols-3 gap-1.5">
        {(
          [
            ['system', Monitor],
            ['dark', Moon],
            ['light', Sun],
          ] as const
        ).map(([id, Icon]) => (
          <button key={id} onClick={() => settings.set({ theme: id })} className={`flex items-center justify-center gap-1.5 rounded-xl py-2 text-xs font-medium ${s.theme === id ? 'bg-fog-100 text-ink-900' : 'bg-veil/[0.06] text-fog-300'}`}>
            <Icon size={13} /> {t(`settings.themeOpt.${id}`)}
          </button>
        ))}
      </div>
      <button onClick={() => requestLocation()} className="mt-2 flex w-full max-w-xs items-center justify-center gap-2 rounded-xl bg-veil/[0.06] py-2.5 text-xs font-medium text-fog-100">
        <MapPin size={13} className="text-ember-500" /> {t('tour.allowLocation')}
      </button>
    </div>,
  ]

  return (
    <AnimatePresence>
      {open && (
        <motion.div className="fixed inset-0 z-[90] flex flex-col bg-ink-900" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} data-no-swipe role="dialog" aria-modal aria-label={t('tour.label')}>
          <div className="pointer-events-none absolute inset-0" style={{ background: 'radial-gradient(70% 45% at 50% 35%, rgba(255,107,74,0.12), transparent 70%)' }} />
          <div className="safe-top relative flex justify-end px-5">
            {i < 2 && (
              <button onClick={finish} className="py-2 text-sm text-fog-500">
                {t('tour.skip')}
              </button>
            )}
          </div>
          <motion.div
            className="relative flex flex-1 items-center justify-center overflow-hidden px-8"
            drag="x"
            dragConstraints={{ left: 0, right: 0 }}
            dragElastic={0.2}
            onDragEnd={(_, info) => {
              if (info.offset.x < -60 && i < 2) go(i + 1)
              if (info.offset.x > 60 && i > 0) go(i - 1)
            }}
          >
            <AnimatePresence mode="wait" custom={dir}>
              <motion.div key={i} custom={dir} initial={{ opacity: 0, x: dir * 50 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: dir * -50 }} transition={{ type: 'spring', stiffness: 360, damping: 34 }} className="w-full">
                {slides[i]}
              </motion.div>
            </AnimatePresence>
          </motion.div>
          <div className="safe-bottom relative flex items-center justify-between px-6 pb-4">
            <div className="flex gap-1.5">
              {[0, 1, 2].map((k) => (
                <button key={k} onClick={() => go(k)} aria-label={`${k + 1}`} className={`h-1.5 rounded-full transition-all ${k === i ? 'w-6 bg-ember-500' : 'w-1.5 bg-veil/25'}`} />
              ))}
            </div>
            <motion.button whileTap={{ scale: 0.95 }} onClick={() => (i < 2 ? go(i + 1) : finish())} className="flex items-center gap-2 rounded-full bg-fog-100 px-5 py-3 text-sm font-semibold text-ink-900">
              {i < 2 ? t('tour.next') : t('tour.start')} <ArrowRight size={16} />
            </motion.button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
