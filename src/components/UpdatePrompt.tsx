import { AnimatePresence, motion } from 'framer-motion'
import { useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { useRegisterSW } from 'virtual:pwa-register/react'

export function UpdatePrompt() {
  const { t } = useTranslation()
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    offlineReady: [offlineReady, setOfflineReady],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisteredSW(_url, reg) {
      // Check for a new version every hour while the app is open.
      if (reg) setInterval(() => reg.update().catch(() => {}), 3600_000)
    },
  })

  const show = needRefresh || offlineReady
  useEffect(() => {
    if (!offlineReady || needRefresh) return
    const t = setTimeout(() => setOfflineReady(false), 4000)
    return () => clearTimeout(t)
  }, [offlineReady, needRefresh, setOfflineReady])

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          className="fixed inset-x-0 bottom-28 z-[45] flex justify-center px-4"
          initial={{ y: 30, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 30, opacity: 0 }}
        >
          <div className="glass-strong flex items-center gap-3 rounded-2xl px-4 py-3 text-sm shadow-xl">
            <span className="text-fog-100">{needRefresh ? t('update.ready') : t('update.offlineReady')}</span>
            {needRefresh && (
              <>
                <button className="rounded-full bg-ember-500 px-3 py-1 text-xs font-semibold text-onaccent" onClick={() => updateServiceWorker(true)}>
                  {t('update.update')}
                </button>
                <button className="text-xs text-fog-400" onClick={() => setNeedRefresh(false)}>
                  {t('update.later')}
                </button>
              </>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
