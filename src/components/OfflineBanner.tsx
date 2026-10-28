import { AnimatePresence, motion } from 'framer-motion'
import { Wifi, WifiOff } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { useOnline } from '@/hooks/useOnline'
import { haptic } from '@/lib/haptics'

/** Slides in when the connection drops; briefly confirms when it's back. */
export function OfflineBanner() {
  const online = useOnline()
  const [showBack, setShowBack] = useState(false)
  const wasOffline = useRef(!online)

  useEffect(() => {
    if (!online) {
      wasOffline.current = true
      haptic('warn')
      return
    }
    if (wasOffline.current) {
      wasOffline.current = false
      setShowBack(true)
      const t = setTimeout(() => setShowBack(false), 2600)
      return () => clearTimeout(t)
    }
  }, [online])

  const visible = !online || showBack
  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          className="pointer-events-none fixed inset-x-0 top-0 z-[60] flex justify-center"
          // Sits just below the header so it never covers the SOS button.
          style={{ paddingTop: 'calc(max(env(safe-area-inset-top), 0.75rem) + 3.75rem)' }}
          initial={{ y: -60, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: -60, opacity: 0 }}
          transition={{ type: 'spring', stiffness: 420, damping: 32 }}
        >
          <div
            role="status"
            className={`flex items-center gap-2 rounded-full px-4 py-2 text-xs font-medium shadow-lg ${online ? 'bg-moss-400 text-ink-900' : 'bg-ink-700 text-fog-100 ring-1 ring-amber-glow/40'}`}
          >
            {online ? <Wifi size={14} /> : <WifiOff size={14} className="text-amber-glow" />}
            {online ? 'Back online. Syncing.' : 'Offline. Rates, phrasebook, SOS and vault still work.'}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
