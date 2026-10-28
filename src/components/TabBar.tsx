import { motion } from 'framer-motion'
import { ArrowLeftRight, Compass, Languages, Map, Vault } from 'lucide-react'
import { goTab, ui, type Tab } from '@/lib/ui'
import { haptic } from '@/lib/haptics'

const ITEMS: { id: Tab; label: string; Icon: typeof Compass }[] = [
  { id: 'home', label: 'Today', Icon: Compass },
  { id: 'map', label: 'Nearby', Icon: Map },
  { id: 'convert', label: 'Money', Icon: ArrowLeftRight },
  { id: 'translate', label: 'Speak', Icon: Languages },
  { id: 'vault', label: 'Vault', Icon: Vault },
]

export function TabBar() {
  const tab = ui.use((s) => s.tab)
  return (
    <nav className="safe-bottom fixed inset-x-0 bottom-0 z-40 px-3 pt-2" data-no-swipe>
      <div className="pointer-events-none absolute inset-x-0 bottom-0 -z-10 h-32 bg-gradient-to-t from-ink-900 via-ink-900/85 to-transparent" />
      <div className="glass-strong mx-auto flex max-w-xl items-stretch justify-between rounded-[1.6rem] p-1.5 shadow-[0_20px_50px_-20px_rgba(0,0,0,0.9)]">
        {ITEMS.map(({ id, label, Icon }) => {
          const active = tab === id
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
              {active && (
                <motion.span
                  layoutId="tab-pill"
                  className="absolute inset-0 rounded-[1.2rem] bg-white/[0.07]"
                  transition={{ type: 'spring', stiffness: 520, damping: 40 }}
                />
              )}
              <Icon size={21} strokeWidth={active ? 2.2 : 1.7} className={`relative transition-colors ${active ? 'text-ember-500' : 'text-fog-400'}`} />
              <span className={`relative text-[10px] font-medium tracking-wide transition-colors ${active ? 'text-fog-50' : 'text-fog-500'}`}>{label}</span>
            </motion.button>
          )
        })}
      </div>
    </nav>
  )
}
