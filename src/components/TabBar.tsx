import { motion } from 'framer-motion'
import { ArrowLeftRight, Compass, LayoutGrid, Map, TramFront } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { goTab, openKit, ui, type Tab } from '@/lib/ui'
import { haptic } from '@/lib/haptics'

const ITEMS: { id: Tab; Icon: typeof Compass }[] = [
  { id: 'home', Icon: Compass },
  { id: 'map', Icon: Map },
  { id: 'transit', Icon: TramFront },
  { id: 'convert', Icon: ArrowLeftRight },
]

/** Four anchor tabs plus the floating Kit button, which opens the Kit sheet. */
export function TabBar() {
  const { t } = useTranslation()
  const tab = ui.use((s) => s.tab)
  const screen = ui.use((s) => s.screen)
  const kitOpen = ui.use((s) => s.kitOpen)
  // Sub-screens (translate, vault, …) are Kit tools: the Kit button carries the "you are here".
  const inKit = kitOpen || Boolean(screen)
  return (
    <nav className="safe-bottom fixed inset-x-0 bottom-0 z-40 px-3 pt-2" data-no-swipe aria-label={t('tabs.label')}>
      <div className="pointer-events-none absolute inset-x-0 bottom-0 -z-10 h-32 bg-gradient-to-t from-ink-900 via-ink-900/85 to-transparent" />
      <div className="mx-auto flex max-w-xl items-center gap-2.5">
        <div className="glass-strong flex min-w-0 flex-1 items-stretch justify-between rounded-[1.6rem] p-1.5 shadow-[0_20px_50px_-20px_rgba(0,0,0,0.5)]">
          {ITEMS.map(({ id, Icon }) => {
            const active = !screen && tab === id
            return (
              <motion.button
                key={id}
                whileTap={{ scale: 0.9 }}
                onClick={() => {
                  haptic('select')
                  goTab(id)
                }}
                className="relative flex min-w-0 flex-1 flex-col items-center gap-0.5 rounded-[1.2rem] py-2"
                aria-current={active ? 'page' : undefined}
                data-tab={id}
              >
                {active && <motion.span layoutId="tab-pill" className="absolute inset-0 rounded-[1.2rem] bg-veil/[0.07]" transition={{ type: 'spring', stiffness: 520, damping: 40 }} />}
                <Icon size={21} strokeWidth={active ? 2.2 : 1.7} className={`relative transition-colors ${active ? 'text-ember-500' : 'text-fog-400'}`} />
                <span className={`relative max-w-full truncate text-[10px] font-medium tracking-wide transition-colors ${active ? 'text-fog-50' : 'text-fog-500'}`}>{t(`tabs.${id}`)}</span>
              </motion.button>
            )
          })}
        </div>
        <motion.button
          type="button"
          whileTap={{ scale: 0.9 }}
          whileHover={{ y: -2 }}
          transition={{ type: 'spring', stiffness: 520, damping: 30 }}
          onClick={() => {
            haptic('select')
            openKit()
          }}
          aria-label={t('kit.open')}
          aria-haspopup="dialog"
          aria-expanded={kitOpen}
          data-kit-fab
          className="relative grid h-[3.9rem] w-[3.9rem] shrink-0 place-items-center rounded-full bg-gradient-to-br from-ember-400 to-ember-500 text-white shadow-[0_14px_32px_-10px_rgba(255,107,74,0.75),inset_0_1px_0_rgba(255,255,255,0.35)] ring-1 ring-white/15 outline-none focus-visible:ring-2 focus-visible:ring-fog-50"
        >
          <span className="flex flex-col items-center gap-0.5">
            <LayoutGrid size={21} strokeWidth={2.2} />
            <span className="text-[10px] leading-none font-semibold tracking-wide">{t('tabs.kit')}</span>
          </span>
          {inKit && <span aria-hidden className="absolute -inset-1 rounded-full ring-2 ring-ember-400/45" />}
        </motion.button>
      </div>
    </nav>
  )
}
