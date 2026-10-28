import { motion } from 'framer-motion'
import { ChevronDown, CircleHelp, Navigation, Siren } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useAgentState } from '@/agents/host'
import type { SafetyState } from '@/agents/safety.worker'
import { flag } from '@/data/countries'
import { location } from '@/lib/location'
import { openHelp, ui } from '@/lib/ui'
import { timeAtOffset } from '@/lib/format'
import { fmtClock } from '@/i18n/format'
import { useNow } from '@/hooks/useNow'
import { Pressable } from './ui/Pressable'

export function Header({ utcOffsetSec, placeName }: { utcOffsetSec?: number; placeName: string }) {
  const { t } = useTranslation()
  const safety = useAgentState<SafetyState>('safety')
  const searched = location.use((s) => s.searched)
  const gpsStatus = location.use((s) => s.gpsStatus)
  const now = useNow(15_000)
  const local = utcOffsetSec != null ? timeAtOffset(utcOffsetSec, now) : now
  const code = searched?.countryCode ?? (safety?.country.code !== 'XX' ? safety?.country.code : undefined)

  return (
    <header className="safe-top sticky top-0 z-30 px-4 pb-2">
      <div className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-full bg-gradient-to-b from-ink-900 via-ink-900/90 to-transparent" />
      <div className="glass flex items-center gap-1.5 rounded-full py-1.5 pr-1.5 pl-1.5">
        <button
          onClick={() => ui.set({ searchOpen: true })}
          className="flex min-w-0 flex-1 items-center gap-1.5 rounded-full px-2.5 py-1 text-left hover:bg-veil/5"
          aria-label={t('header.changeLocation')}
        >
          {code ? <span className="text-sm leading-none">{flag(code)}</span> : <Navigation size={13} className="text-fog-500" />}
          <span className="truncate text-sm font-medium text-fog-100">{placeName}</span>
          {searched ? (
            <span className="shrink-0 rounded-full bg-amber-glow/15 px-1.5 py-px text-[10px] font-medium text-amber-glow">{t('header.preview')}</span>
          ) : gpsStatus === 'ok' ? (
            <motion.span className="h-1.5 w-1.5 shrink-0 rounded-full bg-moss-400" animate={{ opacity: [1, 0.35, 1] }} transition={{ duration: 2.4, repeat: Infinity }} />
          ) : null}
          <ChevronDown size={14} className="shrink-0 text-fog-500" />
        </button>
        <span className="tabular shrink-0 px-1 font-mono text-[13px] text-fog-300">{fmtClock(local)}</span>
        <Pressable onClick={() => openHelp()} className="grid h-8 w-8 shrink-0 place-items-center rounded-full text-fog-400 hover:bg-veil/5 hover:text-fog-100" aria-label={t('header.help')}>
          <CircleHelp size={18} />
        </Pressable>
        <Pressable
          haptics="heavy"
          onClick={() => ui.set({ sosOpen: true })}
          className="flex shrink-0 items-center gap-1 rounded-full bg-alert-500/15 px-3 py-1.5 text-xs font-semibold tracking-wide text-alert-500"
          aria-label={t('header.sosLabel')}
        >
          <Siren size={14} /> {t('header.sos')}
        </Pressable>
      </div>
    </header>
  )
}
