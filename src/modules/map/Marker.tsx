import { motion } from 'framer-motion'
import type { Place } from '@/agents/protocol'
import { KIND_STYLE } from './kindStyle'

export function PlaceMarker({ place, selected, pick, onClick }: { place: Place; selected: boolean; pick?: boolean; onClick: () => void }) {
  const { color, Icon } = KIND_STYLE[place.kind]
  return (
    <motion.button
      onClick={(e) => {
        e.stopPropagation()
        onClick()
      }}
      initial={{ scale: 0, opacity: 0 }}
      animate={{ scale: selected ? 1.25 : 1, opacity: 1 }}
      transition={{ type: 'spring', stiffness: 500, damping: 26 }}
      className="relative -translate-x-1/2 -translate-y-full"
      style={{ zIndex: selected ? 20 : pick ? 10 : 1 }}
      aria-label={place.name}
    >
      <span
        className="grid h-8 w-8 place-items-center rounded-full rounded-br-none border-2 text-ink-900 shadow-lg"
        style={{ background: color, borderColor: selected ? '#f3f6f9' : '#0d1117', transform: 'rotate(45deg)' }}
      >
        <Icon size={15} strokeWidth={2.4} style={{ transform: 'rotate(-45deg)' }} />
      </span>
      {pick && <span className="absolute -top-1 -right-1 h-3 w-3 rounded-full border-2 border-ink-900 bg-ember-500" />}
    </motion.button>
  )
}

export function UserDot({ heading }: { heading?: number | null }) {
  return (
    <span className="relative block -translate-x-1/2 -translate-y-1/2">
      <span className="absolute -inset-3 animate-ping rounded-full bg-sky-glow/30" />
      <span className="relative block h-4 w-4 rounded-full border-[3px] border-fog-50 bg-sky-glow shadow-[0_0_0_6px_rgba(108,182,255,0.18)]" />
      {heading != null && <span className="absolute -top-3 left-1/2 h-0 w-0 -translate-x-1/2 border-x-4 border-b-6 border-x-transparent border-b-sky-glow" style={{ transform: `rotate(${heading}deg)` }} />}
    </span>
  )
}
