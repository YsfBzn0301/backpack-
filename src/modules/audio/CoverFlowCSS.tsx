import { motion } from 'framer-motion'
import type { Track } from '@/services/audio'

/** Framer Motion 3D fallback for devices without WebGL. */
export function CoverFlowCSS({ tracks, active, onChange }: { tracks: Track[]; active: number; onChange: (i: number) => void }) {
  return (
    <motion.div
      className="relative h-64 w-full overflow-hidden"
      style={{ perspective: 900 }}
      data-no-swipe
      onPanEnd={(_, info) => {
        if (Math.abs(info.offset.x) < 40) return
        onChange(Math.max(0, Math.min(tracks.length - 1, active + (info.offset.x < 0 ? 1 : -1))))
      }}
    >
      {tracks.map((t, i) => {
        const d = i - active
        const a = Math.abs(d)
        if (a > 3) return null
        return (
          <motion.button
            key={t.id}
            onClick={() => onChange(i)}
            className="absolute top-6 left-1/2 h-40 w-40 -ml-20 overflow-hidden rounded-xl shadow-2xl"
            animate={{ x: a < 1 ? d * 130 : Math.sign(d) * (130 + (a - 1) * 48), z: -Math.min(a, 1) * 120, rotateY: -Math.max(-1, Math.min(1, d)) * 60, opacity: a > 2.5 ? 0 : 1 }}
            transition={{ type: 'spring', stiffness: 260, damping: 30 }}
            style={{ zIndex: 10 - a, transformStyle: 'preserve-3d', WebkitBoxReflect: 'below 4px linear-gradient(transparent 60%, rgba(255,255,255,0.25))' } as React.CSSProperties}
          >
            {t.artwork ? <img src={t.artwork} alt="" className="h-full w-full object-cover" draggable={false} /> : <div className="grid h-full w-full place-items-center bg-ink-700 text-4xl text-fog-300">♪</div>}
          </motion.button>
        )
      })}
    </motion.div>
  )
}
