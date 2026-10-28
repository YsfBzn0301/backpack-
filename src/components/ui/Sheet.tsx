import { AnimatePresence, motion, useDragControls, type PanInfo } from 'framer-motion'
import { X } from 'lucide-react'
import { useEffect, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { haptic } from '@/lib/haptics'

interface Props {
  open: boolean
  onClose: () => void
  title?: ReactNode
  children: ReactNode
  tone?: 'default' | 'alert'
  /** Max height as a fraction of the viewport. */
  height?: number
}

/** Bottom sheet with drag-to-dismiss from the handle. */
export function Sheet({ open, onClose, title, children, tone = 'default', height = 0.88 }: Props) {
  const { t } = useTranslation()
  const controls = useDragControls()

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  const onDragEnd = (_: unknown, info: PanInfo) => {
    if (info.offset.y > 120 || info.velocity.y > 600) {
      haptic('tap')
      onClose()
    }
  }

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-50" data-no-swipe>
          <motion.div
            className="absolute inset-0 bg-ink-950/70 backdrop-blur-[2px]"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />
          <motion.section
            role="dialog"
            aria-modal="true"
            className={`glass-strong absolute inset-x-0 bottom-0 mx-auto flex max-w-xl flex-col rounded-t-[1.75rem] safe-bottom ${tone === 'alert' ? 'shadow-[0_-20px_80px_-20px_rgba(255,77,94,0.45)]' : 'shadow-[0_-20px_60px_-30px_rgba(0,0,0,0.8)]'}`}
            style={{ maxHeight: `${height * 100}dvh` }}
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', stiffness: 380, damping: 38 }}
            drag="y"
            dragControls={controls}
            dragListener={false}
            dragConstraints={{ top: 0, bottom: 0 }}
            dragElastic={{ top: 0, bottom: 0.6 }}
            onDragEnd={onDragEnd}
          >
            <div className="flex cursor-grab touch-none items-center justify-between px-5 pt-3 pb-2" onPointerDown={(e) => controls.start(e)}>
              <div className="w-8" />
              <div className="h-1.5 w-10 rounded-full bg-fog-500/40" />
              <button aria-label={t('common.close')} onClick={onClose} className="grid h-8 w-8 place-items-center rounded-full text-fog-400 hover:bg-veil/5">
                <X size={18} />
              </button>
            </div>
            {title && <header className="px-5 pb-3">{title}</header>}
            <div className="no-scrollbar overflow-y-auto overscroll-contain px-5 pb-4">{children}</div>
          </motion.section>
        </div>
      )}
    </AnimatePresence>
  )
}
