import { motion } from 'framer-motion'
import { Camera, CircleHelp, Languages, ListChecks, Music2, ScanLine, Settings, Vault } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Pressable } from '@/components/ui/Pressable'
import { Sheet } from '@/components/ui/Sheet'
import { checklist } from '@/lib/checklist'
import { closeKit, openHelp, openScreen, ui } from '@/lib/ui'

type ToolId = 'translate' | 'audio' | 'camera' | 'scanner' | 'checklist' | 'vault' | 'settings' | 'help'
type Tool = { id: ToolId; Icon: typeof Camera; color: string; open: () => void; badge?: string }

/** Overlays without their own history entry: close the sheet first, then show them. */
const overlay = (patch: Partial<ReturnType<typeof ui.get>>) => () => {
  closeKit()
  ui.set(patch)
}

/** The toolbox: everything that isn't a root tab, in a sheet over the current tab. */
export function KitSheet() {
  const { t } = useTranslation()
  const open = ui.use((s) => s.kitOpen)
  const items = checklist.use((s) => s.items)
  const done = items.filter((i) => i.done).length

  // Screens and help replace the sheet's history entry themselves (see ui.ts).
  const tools: Tool[] = [
    { id: 'translate', Icon: Languages, color: '#6cb6ff', open: () => openScreen('translate') },
    { id: 'audio', Icon: Music2, color: '#1db954', open: () => openScreen('audio') },
    { id: 'camera', Icon: Camera, color: '#5fd39a', open: overlay({ cameraOpen: true }) },
    { id: 'scanner', Icon: ScanLine, color: '#5fd39a', open: overlay({ scannerOpen: true }) },
    { id: 'checklist', Icon: ListChecks, color: '#ff6b4a', open: () => openScreen('checklist'), badge: items.length ? `${done}/${items.length}` : undefined },
    { id: 'vault', Icon: Vault, color: '#b38cff', open: () => openScreen('vault') },
  ]
  const more: Tool[] = [
    { id: 'settings', Icon: Settings, color: '#8b949e', open: () => openScreen('settings') },
    { id: 'help', Icon: CircleHelp, color: '#ffb347', open: () => openHelp() },
  ]

  const enter = (i: number) => ({
    initial: { opacity: 0, y: 12 },
    animate: { opacity: 1, y: 0 },
    transition: { delay: 0.04 + i * 0.03, type: 'spring' as const, stiffness: 460, damping: 34 },
  })

  return (
    <Sheet
      open={open}
      onClose={closeKit}
      label={t('titles.kit')}
      title={
        <div>
          <h2 className="text-xl font-semibold tracking-tight text-fog-50">{t('titles.kit')}</h2>
          <p className="text-xs text-fog-500">{t('kit.subtitle')}</p>
        </div>
      }
    >
      <div className="grid grid-cols-2 gap-2" data-testid="kit-grid">
        {tools.map(({ id, Icon, color, open: go, badge }, i) => (
          <motion.div key={id} {...enter(i)}>
            <Pressable haptics="select" onClick={go} className="card relative flex h-full w-full flex-col items-start gap-4 p-4 text-left" data-kit-tool={id}>
              <span className="grid h-11 w-11 place-items-center rounded-2xl" style={{ background: `${color}1f`, color }}>
                <Icon size={21} />
              </span>
              {badge && <span className="tabular absolute top-4 right-4 rounded-full bg-veil/[0.06] px-2 py-0.5 text-[10px] text-fog-400">{badge}</span>}
              <span className="block w-full min-w-0">
                <span className="block truncate text-[15px] font-semibold text-fog-50">{t(`kit.${id}.title`)}</span>
                <span className="line-clamp-2 block text-xs text-fog-500">{t(`kit.${id}.sub`)}</span>
              </span>
            </Pressable>
          </motion.div>
        ))}
      </div>
      <div className="mt-2 grid grid-cols-2 gap-2">
        {more.map(({ id, Icon, color, open: go }, i) => (
          <motion.div key={id} {...enter(tools.length + i)}>
            <Pressable haptics="select" onClick={go} className="card flex w-full items-center gap-2.5 p-3 text-left" data-kit-tool={id}>
              <span className="grid h-8 w-8 shrink-0 place-items-center rounded-xl" style={{ background: `${color}1f`, color }}>
                <Icon size={17} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[14px] font-semibold text-fog-50">{t(`kit.${id}.title`)}</span>
                <span className="block truncate text-[11px] text-fog-500">{t(`kit.${id}.sub`)}</span>
              </span>
            </Pressable>
          </motion.div>
        ))}
      </div>
    </Sheet>
  )
}
