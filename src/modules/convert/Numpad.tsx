import { Delete } from 'lucide-react'
import { Pressable } from '@/components/ui/Pressable'

const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '.', '0', 'del'] as const

export function Numpad({ onKey, onClear }: { onKey: (k: string) => void; onClear: () => void }) {
  return (
    <div className="grid grid-cols-3 gap-2" data-no-swipe>
      {KEYS.map((k) => (
        <Pressable
          key={k}
          haptics="tap"
          scale={0.92}
          onClick={() => onKey(k)}
          onContextMenu={(e) => {
            if (k === 'del') {
              e.preventDefault()
              onClear()
            }
          }}
          className="tabular h-14 rounded-2xl bg-ink-800 text-2xl font-light text-fog-50 hairline border active:bg-ink-700"
          aria-label={k === 'del' ? 'Delete' : k}
        >
          {k === 'del' ? <Delete size={22} className="mx-auto text-fog-300" /> : k}
        </Pressable>
      ))}
    </div>
  )
}
