import { motion } from 'framer-motion'
import { useId } from 'react'
import { haptic } from '@/lib/haptics'

interface Props<T extends string> {
  value: T
  options: { value: T; label: string }[]
  onChange: (v: T) => void
  size?: 'sm' | 'md'
  /** Share the width equally instead of scrolling. */
  stretch?: boolean
}

export function Segmented<T extends string>({ value, options, onChange, size = 'md', stretch = false }: Props<T>) {
  const id = useId()
  return (
    <div className="no-scrollbar flex gap-1 overflow-x-auto rounded-full bg-ink-850 p-1 hairline border">
      {options.map((o) => (
        <button
          key={o.value}
          onClick={() => {
            haptic('select')
            onChange(o.value)
          }}
          className={`relative rounded-full font-medium transition-colors ${stretch ? 'flex-1 px-2' : 'shrink-0'} ${size === 'sm' ? `${stretch ? '' : 'px-3'} py-1.5 text-xs` : `${stretch ? '' : 'px-4'} py-2 text-sm`} ${value === o.value ? 'text-ink-900' : 'text-fog-400 hover:text-fog-100'}`}
        >
          {value === o.value && (
            <motion.span layoutId={`seg-${id}`} className="absolute inset-0 rounded-full bg-fog-100" transition={{ type: 'spring', stiffness: 500, damping: 38 }} />
          )}
          <span className="relative">{o.label}</span>
        </button>
      ))}
    </div>
  )
}
