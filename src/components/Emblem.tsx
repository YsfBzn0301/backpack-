import { motion } from 'framer-motion'

/** Backpack + compass mark. `animate` draws the strokes and settles the needle. */
export function Emblem({ size = 96, animate = false }: { size?: number; animate?: boolean }) {
  const draw = (delay: number, duration = 0.9) =>
    animate
      ? { initial: { pathLength: 0, opacity: 0 }, animate: { pathLength: 1, opacity: 1 }, transition: { delay, duration, ease: [0.65, 0, 0.35, 1] as const } }
      : {}
  return (
    <svg width={size} height={size} viewBox="96 88 320 368" fill="none" aria-hidden>
      <g stroke="currentColor" strokeWidth={18} strokeLinecap="round" strokeLinejoin="round">
        <motion.path d="M222 150v-12a34 34 0 0 1 68 0v12" {...draw(0.05, 0.5)} />
        <motion.path d="M192 150h128a60 60 0 0 1 60 60v178a50 50 0 0 1-50 50H182a50 50 0 0 1-50-50V210a60 60 0 0 1 60-60z" {...draw(0.15, 1.1)} />
        <motion.path d="M132 226c40 34 208 34 248 0" strokeOpacity={0.5} {...draw(0.6, 0.6)} />
        <motion.path
          d="M132 300h-12a16 16 0 0 0-16 16v56a16 16 0 0 0 16 16h12M380 300h12a16 16 0 0 1 16 16v56a16 16 0 0 1-16 16h-12"
          strokeOpacity={0.5}
          {...draw(0.75, 0.6)}
        />
        <motion.circle cx={256} cy={338} r={52} stroke="var(--color-ember-500)" {...draw(0.55, 0.8)} />
      </g>
      <motion.g
        style={{ originX: '256px', originY: '338px', transformBox: 'view-box' }}
        initial={animate ? { rotate: -540, opacity: 0, scale: 0.6 } : false}
        animate={{ rotate: 0, opacity: 1, scale: 1 }}
        transition={{ delay: 0.9, duration: 1.1, ease: [0.16, 1, 0.3, 1] }}
      >
        <path d="M256 302l14 36h-28z" fill="var(--color-ember-500)" />
        <path d="M242 338h28l-14 36z" fill="currentColor" fillOpacity={0.55} />
      </motion.g>
    </svg>
  )
}
