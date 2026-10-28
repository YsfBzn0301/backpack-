import { Camera, Languages, SquareParking, Siren } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Pressable } from '@/components/ui/Pressable'
import { openParking, openScreen, ui } from '@/lib/ui'

export function QuickActions() {
  const { t } = useTranslation()
  const items = [
    { id: 'camera', Icon: Camera, onClick: () => ui.set({ cameraOpen: true }), tone: 'text-moss-400 bg-moss-400/10' },
    { id: 'sos', Icon: Siren, onClick: () => ui.set({ sosOpen: true }), tone: 'text-alert-500 bg-alert-500/10', heavy: true },
    { id: 'translate', Icon: Languages, onClick: () => openScreen('translate'), tone: 'text-sky-glow bg-sky-glow/10' },
    { id: 'parking', Icon: SquareParking, onClick: openParking, tone: 'text-amber-glow bg-amber-glow/10' },
  ] as const
  return (
    <div className="grid grid-cols-4 gap-2">
      {items.map(({ id, Icon, onClick, tone, ...rest }) => (
        <Pressable key={id} haptics={'heavy' in rest ? 'heavy' : 'tap'} onClick={onClick} className="card flex flex-col items-center gap-2 px-1 py-3 text-center">
          <span className={`grid h-10 w-10 place-items-center rounded-2xl ${tone}`}>
            <Icon size={19} />
          </span>
          <span className="w-full truncate text-[12px] leading-tight font-medium text-fog-50">{t(`quick.${id}`)}</span>
        </Pressable>
      ))}
    </div>
  )
}
