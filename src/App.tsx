import { AnimatePresence, motion } from 'framer-motion'
import { lazy, Suspense, useCallback, useEffect, useRef, useState } from 'react'
import { useAgentBridge } from '@/hooks/useAgentBridge'
import { useAgentState } from '@/agents/host'
import type { SafetyState } from '@/agents/safety.worker'
import { location } from '@/lib/location'
import { goTab, TABS, ui, type Tab } from '@/lib/ui'
import { haptic } from '@/lib/haptics'
import { SplashScreen } from '@/components/SplashScreen'
import { Header } from '@/components/Header'
import { TabBar } from '@/components/TabBar'
import { OfflineBanner } from '@/components/OfflineBanner'
import { UpdatePrompt } from '@/components/UpdatePrompt'
import { LocationSearch } from '@/components/LocationSearch'
import { HomeModule } from '@/modules/home/HomeModule'
import { ConvertModule } from '@/modules/convert/ConvertModule'
import { TranslateModule } from '@/modules/translate/TranslateModule'
import { VaultModule } from '@/modules/vault/VaultModule'
import { SosSheet } from '@/modules/sos/SosSheet'
import { ScannerSheet } from '@/modules/scanner/ScannerSheet'

// The map pulls in the Google Maps bindings; load it when first opened.
const MapModule = lazy(() => import('@/modules/map/MapModule').then((m) => ({ default: m.MapModule })))

const TITLES: Record<Tab, string> = {
  home: 'Today',
  map: 'Nearby',
  convert: 'Money',
  translate: 'Speak',
  vault: 'Vault',
}

const variants = {
  enter: (dir: number) => ({ x: dir * 48, opacity: 0 }),
  center: { x: 0, opacity: 1 },
  exit: (dir: number) => ({ x: dir * -48, opacity: 0 }),
}

export default function App() {
  const [booted, setBooted] = useState(() => sessionStorage.getItem('bp:booted') === '1')
  const bridge = useAgentBridge()
  const safety = useAgentState<SafetyState>('safety')
  const searched = location.use((s) => s.searched)
  const { tab, prevTab } = ui.use()
  const dir = Math.sign(TABS.indexOf(tab) - TABS.indexOf(prevTab)) || 1
  const touch = useRef<{ x: number; y: number; t: number; skip: boolean } | null>(null)

  const onBoot = useCallback(() => {
    sessionStorage.setItem('bp:booted', '1')
    setBooted(true)
  }, [])

  useEffect(() => {
    window.scrollTo({ top: 0 })
  }, [tab])

  const placeName =
    searched?.name ??
    safety?.city ??
    bridge.weather.data?.city ??
    (bridge.gpsStatus === 'locating' ? 'Locating…' : bridge.gpsStatus === 'denied' ? 'Set location' : safety?.country.code !== 'XX' ? safety?.country.name : 'Set location') ??
    'Set location'

  // Horizontal swipe between tabs, ignored inside maps, carousels and sheets.
  const onTouchStart = (e: React.TouchEvent) => {
    const t = e.touches[0]
    const skip = Boolean((e.target as HTMLElement).closest('[data-no-swipe], input, textarea, select'))
    touch.current = { x: t.clientX, y: t.clientY, t: Date.now(), skip }
  }
  const onTouchEnd = (e: React.TouchEvent) => {
    const s = touch.current
    touch.current = null
    if (!s || s.skip) return
    const t = e.changedTouches[0]
    const dx = t.clientX - s.x
    const dy = t.clientY - s.y
    if (Math.abs(dx) < 70 || Math.abs(dy) > 60 || Date.now() - s.t > 600) return
    const i = TABS.indexOf(tab) + (dx < 0 ? 1 : -1)
    if (i >= 0 && i < TABS.length) {
      haptic('select')
      goTab(TABS[i])
    }
  }

  return (
    <>
      <AnimatePresence>{!booted && <SplashScreen onDone={onBoot} />}</AnimatePresence>
      <OfflineBanner />
      <div className="relative mx-auto min-h-dvh max-w-xl" onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}>
        <div
          className="pointer-events-none fixed inset-x-0 top-0 -z-10 h-[50vh]"
          style={{ background: 'radial-gradient(80% 60% at 50% 0%, rgba(255,107,74,0.07), transparent 70%)' }}
        />
        <Header utcOffsetSec={bridge.weather.data?.utcOffsetSec} placeName={placeName} />
        <main className="px-4 pt-2 pb-32">
          <motion.h1 key={tab} className="mb-4 px-1 text-[28px] font-semibold tracking-[-0.02em] text-fog-50" initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }}>
            {TITLES[tab]}
          </motion.h1>
          <AnimatePresence mode="popLayout" custom={dir} initial={false}>
            <motion.div
              key={tab}
              custom={dir}
              variants={variants}
              initial="enter"
              animate="center"
              exit="exit"
              transition={{ type: 'spring', stiffness: 420, damping: 40, mass: 0.8 }}
            >
              {tab === 'home' && <HomeModule weather={bridge.weather} placeName={placeName} />}
              {tab === 'map' && (
                <Suspense fallback={<div className="card h-[46dvh] animate-pulse" />}>
                  <MapModule />
                </Suspense>
              )}
              {tab === 'convert' && <ConvertModule />}
              {tab === 'translate' && <TranslateModule />}
              {tab === 'vault' && <VaultModule />}
            </motion.div>
          </AnimatePresence>
        </main>
      </div>
      <TabBar />
      <LocationSearch />
      <SosSheet />
      <ScannerSheet />
      <UpdatePrompt />
    </>
  )
}
