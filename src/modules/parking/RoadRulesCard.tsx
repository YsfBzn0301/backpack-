import { AnimatePresence, motion } from 'framer-motion'
import { ChevronDown, Gauge, Route } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { getRoadRules, type ZoneColor } from '@/data/roadRules'
import { countryName } from '@/i18n/format'

const ZONE_HEX: Record<ZoneColor, string> = {
  blue: '#3b82f6',
  white: '#f3f4f6',
  yellow: '#facc15',
  green: '#22c55e',
  red: '#ef4444',
  orange: '#fb923c',
  purple: '#a855f7',
}

/** SafetyAgent's local driving & parking rules for the current country. */
export function RoadRulesCard({ country }: { country: string }) {
  const { t } = useTranslation()
  const rules = getRoadRules(country)
  const [open, setOpen] = useState(false)
  if (!rules) return null
  const [u, r, m] = rules.speed
  const unit = rules.unit === 'mph' ? 'mph' : 'km/h'
  return (
    <section className="card overflow-hidden">
      <button onClick={() => setOpen((o) => !o)} className="flex w-full items-center gap-3 p-4 text-left" aria-expanded={open}>
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-alert-500/10 text-alert-500">
          <Route size={17} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-medium text-fog-50">{t('road.title', { country: countryName(country) })}</span>
          <span className="block truncate text-xs text-fog-500">
            {t(`road.toll.${rules.toll}`)} · {t(`road.side.${rules.drive}`)}
          </span>
        </span>
        <ChevronDown size={16} className={`shrink-0 text-fog-500 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
            <div className="space-y-3 px-4 pb-4">
              <div className="grid grid-cols-3 gap-2 text-center">
                {[
                  [t('road.urban'), u],
                  [t('road.rural'), r],
                  [t('road.motorway'), m],
                ].map(([label, v]) => (
                  <div key={label as string} className="rounded-xl bg-veil/[0.04] px-2 py-2">
                    <Gauge size={13} className="mx-auto text-fog-500" />
                    <div className="tabular mt-0.5 text-base font-semibold text-fog-50">{v ?? t('road.noLimit')}</div>
                    <div className="text-[10px] text-fog-500">
                      {label} {v != null && `· ${unit}`}
                    </div>
                  </div>
                ))}
              </div>
              {rules.zones.length > 0 && (
                <div>
                  <div className="mb-1.5 text-[11px] font-medium text-fog-500">{t('road.zones')}</div>
                  <ul className="space-y-1">
                    {rules.zones.map(([color, meaning]) => (
                      <li key={color + meaning} className="flex items-center gap-2 text-xs text-fog-300">
                        <span className="h-1.5 w-7 shrink-0 rounded-full ring-1 ring-veil/20" style={{ background: ZONE_HEX[color] }} />
                        <span className="font-medium text-fog-100">{t(`road.color.${color}`)}</span>
                        <span className="text-fog-500">·</span> {t(`road.meaning.${meaning}`)}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              <ul className="space-y-1.5">
                {rules.notes.map((n) => (
                  <li key={n} className="flex gap-2 text-xs leading-relaxed text-fog-300">
                    <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-fog-500" />
                    {t(`road.note.${n}`)}
                  </li>
                ))}
              </ul>
              <p className="text-[10px] text-fog-500">{t('road.disclaimer')}</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  )
}
