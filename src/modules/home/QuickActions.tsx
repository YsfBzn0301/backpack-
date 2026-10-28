import { Languages, ScanLine, Siren } from 'lucide-react'
import { Pressable } from '@/components/ui/Pressable'
import { goTab, ui } from '@/lib/ui'

export function QuickActions() {
  const items = [
    { label: 'Scan price', sub: 'Camera OCR', Icon: ScanLine, onClick: () => ui.set({ scannerOpen: true }), tone: 'text-moss-400 bg-moss-400/10' },
    { label: 'Translate', sub: 'Tap & talk', Icon: Languages, onClick: () => goTab('translate'), tone: 'text-sky-glow bg-sky-glow/10' },
    { label: 'SOS', sub: 'Local numbers', Icon: Siren, onClick: () => ui.set({ sosOpen: true }), tone: 'text-alert-500 bg-alert-500/10', heavy: true },
  ]
  return (
    <div className="grid grid-cols-3 gap-2">
      {items.map(({ label, sub, Icon, onClick, tone, heavy }) => (
        <Pressable key={label} haptics={heavy ? 'heavy' : 'tap'} onClick={onClick} className="card flex flex-col items-start gap-3 p-3.5 text-left">
          <span className={`grid h-9 w-9 place-items-center rounded-xl ${tone}`}>
            <Icon size={18} />
          </span>
          <span>
            <span className="block text-sm font-medium text-fog-50">{label}</span>
            <span className="block text-[11px] text-fog-500">{sub}</span>
          </span>
        </Pressable>
      ))}
    </div>
  )
}
