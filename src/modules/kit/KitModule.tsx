import { Camera, CircleHelp, Languages, ListChecks, Music2, ScanLine, Settings, Vault } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Pressable } from '@/components/ui/Pressable'
import { checklist } from '@/lib/checklist'
import { openHelp, openScreen, ui } from '@/lib/ui'

/** The toolbox: everything that isn't a root tab. */
export function KitModule() {
  const { t } = useTranslation()
  const items = checklist.use((s) => s.items)
  const done = items.filter((i) => i.done).length
  const tiles: { id: 'translate' | 'audio' | 'camera' | 'scanner' | 'checklist' | 'vault' | 'settings' | 'help'; Icon: typeof Camera; color: string; onClick: () => void; badge?: string }[] = [
    { id: 'translate', Icon: Languages, color: '#6cb6ff', onClick: () => openScreen('translate') },
    { id: 'audio', Icon: Music2, color: '#1db954', onClick: () => openScreen('audio') },
    { id: 'camera', Icon: Camera, color: '#5fd39a', onClick: () => ui.set({ cameraOpen: true }) },
    { id: 'scanner', Icon: ScanLine, color: '#5fd39a', onClick: () => ui.set({ scannerOpen: true }) },
    { id: 'checklist', Icon: ListChecks, color: '#ff6b4a', onClick: () => openScreen('checklist'), badge: items.length ? `${done}/${items.length}` : undefined },
    { id: 'vault', Icon: Vault, color: '#b38cff', onClick: () => openScreen('vault') },
    { id: 'settings', Icon: Settings, color: '#8b949e', onClick: () => openScreen('settings') },
    { id: 'help', Icon: CircleHelp, color: '#ffb347', onClick: () => openHelp() },
  ]
  return (
    <div className="grid grid-cols-2 gap-2">
      {tiles.map(({ id, Icon, color, onClick, badge }) => (
        <Pressable key={id} onClick={onClick} className="card relative flex flex-col items-start gap-6 p-4 text-left">
          <span className="grid h-11 w-11 place-items-center rounded-2xl" style={{ background: `${color}1f`, color }}>
            <Icon size={21} />
          </span>
          {badge && <span className="tabular absolute top-4 right-4 rounded-full bg-veil/[0.06] px-2 py-0.5 text-[10px] text-fog-400">{badge}</span>}
          <span>
            <span className="block text-[15px] font-semibold text-fog-50">{t(`kit.${id}.title`)}</span>
            <span className="block text-xs text-fog-500">{t(`kit.${id}.sub`)}</span>
          </span>
        </Pressable>
      ))}
    </div>
  )
}
