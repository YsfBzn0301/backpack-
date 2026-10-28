import { motion } from 'framer-motion'
import { ArrowLeftRight, Compass, LayoutGrid, Map, TramFront } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { goTab, ui, type Tab } from '@/lib/ui'
import { haptic } from '@/lib/haptics'

const ITEMS: { id: Tab; Icon: typeof Compass }[] = [
  { id: 'home', Icon: Compass },
  { id: 'map', Icon: Map },
  { id: 'transit', Icon: TramFront },
  { id: 'convert', Icon: ArrowLeftRight },
  { id: 'kit', Icon: LayoutGrid },
]

export function TabBar() {
  const { t } = useTranslation()
  const tab = ui.use((s) => s.tab)
  const screen = ui.use((s) => s.screen)
  return (
    <nav className="safe-bottom fixed inset-x-0 bottom-0 z-40 px-3 pt-2" data-no-swipe aria-label={t('tabs.label')}>
      <div className="pointer-events-none absolute inset-x-0 bottom-0 -z-10 h-32 bg-gradient-to-t from-ink-900 via-ink-900/85 to-transparent" />
      <div className="glass-strong mx-auto flex max-w-xl items-stretch justify-between rounded-[1.6rem] p-1.5 shadow-[0_20px_50px_-20px_rgba(0,0,0,0.5)]">
        {ITEMS.map(({ id, Icon }) => {
          // Sub-screens live under Kit.
          const active = screen ? id === 'kit' : tab === id
          return (
            <motion.button
              key={id}
              whileTap={{ scale: 0.9 }}
              onClick={() => {
                haptic('select')
                goTab(id)
              }}
              className="relative flex flex-1 flex-col items-center gap-0.5 rounded-[1.2rem] py-2"
              aria-current={active ? 'page' : undefined}
            >
              {active && <motion.span layoutId="tab-pill" className="absolute inset-0 rounded-[1.2rem] bg-veil/[0.07]" transition={{ type: 'spring', stiffness: 520, damping: 40 }} />}
              <Icon size={21} strokeWidth={active ? 2.2 : 1.7} className={`relative transition-colors ${active ? 'text-ember-500' : 'text-fog-400'}`} />
              <span className={`relative text-[10px] font-medium tracking-wide transition-colors ${active ? 'text-fog-50' : 'text-fog-500'}`}>{t(`tabs.${id}`)}</span>
            </motion.button>
          )
        })}
      </div>
    </nav>
  )
}
