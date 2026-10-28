import { motion } from 'framer-motion'
import { LocateOff, RotateCw, Search } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { location, requestLocation } from '@/lib/location'
import { ui } from '@/lib/ui'
import { haptic } from '@/lib/haptics'

/** Shown instead of the weather card when location is off or blocked. */
export function LocationPermissionCard() {
  const { t } = useTranslation()
  const status = location.use((s) => s.gpsStatus)
  const busy = status === 'locating'
  return (
    <motion.section initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="card relative overflow-hidden p-5" role="alert">
      <div className="pointer-events-none absolute -top-16 -right-10 h-44 w-44 rounded-full bg-amber-glow/20 blur-3xl" />
      <div className="relative">
        <span className="grid h-11 w-11 place-items-center rounded-2xl bg-amber-glow/15 text-amber-glow">
          <LocateOff size={20} />
        </span>
        <h2 className="mt-4 text-[17px] font-semibold text-fog-50">{t('permission.title')}</h2>
        <p className="mt-1.5 text-sm leading-relaxed text-fog-400">{t('permission.body')}</p>
        {status === 'denied' && <p className="mt-2 text-xs leading-relaxed text-fog-500">{t('permission.blockedHint')}</p>}
        <div className="mt-4 flex flex-wrap gap-2">
          <button
            onClick={() => {
              haptic('select')
              requestLocation()
            }}
            disabled={busy}
            className="flex items-center gap-2 rounded-full bg-fog-100 px-4 py-2.5 text-sm font-semibold text-ink-900 disabled:opacity-60"
          >
            <RotateCw size={15} className={busy ? 'animate-spin' : ''} /> {busy ? t('permission.locating') : t('permission.retry')}
          </button>
          <button onClick={() => ui.set({ searchOpen: true })} className="flex items-center gap-2 rounded-full bg-veil/[0.06] px-4 py-2.5 text-sm font-medium text-fog-100">
            <Search size={15} /> {t('permission.search')}
          </button>
        </div>
      </div>
    </motion.section>
  )
}
