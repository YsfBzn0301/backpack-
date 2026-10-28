import { AnimatePresence, motion } from 'framer-motion'
import { Volume2, X } from 'lucide-react'
import { speak } from '@/hooks/useSpeech'
import { LANG_BY_CODE } from '@/data/languages'

/** Full-screen, high-contrast card to hand the phone to someone. */
export function ShowToLocal({ text, phonetic, lang, onClose }: { text: string | null; phonetic?: string; lang: string; onClose: () => void }) {
  const l = LANG_BY_CODE[lang]
  return (
    <AnimatePresence>
      {text && (
        <motion.div
          className="fixed inset-0 z-[70] flex flex-col bg-fog-50 text-ink-900"
          initial={{ opacity: 0, scale: 0.96 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.96 }}
          transition={{ duration: 0.22 }}
          data-no-swipe
          onClick={onClose}
        >
          <div className="safe-top flex justify-end p-4">
            <button className="grid h-10 w-10 place-items-center rounded-full bg-ink-900/10" aria-label="Close">
              <X size={20} />
            </button>
          </div>
          <div className="flex flex-1 flex-col items-center justify-center px-8 text-center">
            <p className="text-[clamp(2rem,9vw,3.5rem)] leading-tight font-semibold" dir={l?.rtl ? 'rtl' : undefined} lang={lang}>
              {text}
            </p>
            {phonetic && <p className="mt-6 text-lg text-ink-600 italic">{phonetic}</p>}
          </div>
          <div className="safe-bottom flex justify-center p-6">
            <button
              onClick={(e) => {
                e.stopPropagation()
                speak(text, l?.speech ?? lang, { rate: 0.85 })
              }}
              className="flex items-center gap-2 rounded-full bg-ink-900 px-6 py-3.5 text-base font-medium text-fog-50"
            >
              <Volume2 size={20} /> Play aloud
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
