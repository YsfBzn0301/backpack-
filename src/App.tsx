import { AnimatePresence, motion } from 'framer-motion'
import { ArrowLeft } from 'lucide-react'
import { lazy, Suspense, useCallback, useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useAgentBridge } from '@/hooks/useAgentBridge'
import { useAgentState } from '@/agents/host'
import type { SafetyState } from '@/agents/safety.worker'
import { location } from '@/lib/location'
import { closeScreen, goTab, TABS, ui, type Screen, type Tab } from '@/lib/ui'
import { useThemeEngine } from '@/lib/theme'
import { haptic } from '@/lib/haptics'
import { countryName } from '@/i18n/format'
import { SplashScreen } from '@/components/SplashScreen'
import { Header } from '@/components/Header'
import { TabBar } from '@/components/TabBar'
import { OfflineBanner } from '@/components/OfflineBanner'
import { UpdatePrompt } from '@/components/UpdatePrompt'
import { LocationSearch } from '@/components/LocationSearch'
import { HomeModule } from '@/modules/home/HomeModule'
import { ConvertModule } from '@/modules/convert/ConvertModule'
import { KitModule } from '@/modules/kit/KitModule'
import { TranslateModule } from '@/modules/translate/TranslateModule'
import { VaultModule } from '@/modules/vault/VaultModule'
import { ChecklistModule } from '@/modules/checklist/ChecklistModule'
import { SettingsScreen } from '@/modules/settings/SettingsScreen'
import { SosSheet } from '@/modules/sos/SosSheet'
import { ScannerSheet } from '@/modules/scanner/ScannerSheet'
import { CameraScreen } from '@/modules/camera/CameraScreen'
import { QuickTour, tourDone } from '@/help/QuickTour'

// Heavier modules load on first open: maps SDK bindings, transit client, Three.js.
const MapModule = lazy(() => import('@/modules/map/MapModule').then((m) => ({ default: m.MapModule })))
const TransitModule = lazy(() => import('@/modules/transit/TransitModule').then((m) => ({ default: m.TransitModule })))
const AudioScout = lazy(() => import('@/modules/audio/AudioScout').then((m) => ({ default: m.AudioScout })))
const FeatureHelpCenter = lazy(() => import('@/help/FeatureHelpCenter').then((m) => ({ default: m.FeatureHelpCenter })))

const variants = {
  enter: (dir: number) => ({ x: dir * 48, opacity: 0 }),
  center: { x: 0, opacity: 1 },
  exit: (dir: number) => ({ x: dir * -48, opacity: 0 }),
}

const Loading = () => <div className="card h-[40dvh] animate-pulse" />

function TabContent({ tab, weather, placeName }: { tab: Tab; weather: ReturnType<typeof useAgentBridge>['weather']; placeName: string }) {
  switch (tab) {
    case 'home':
      return <HomeModule weather={weather} placeName={placeName} />
    case 'map':
      return <MapModule />
    case 'transit':
      return <TransitModule />
    case 'convert':
      return <ConvertModule />
    case 'kit':
      return <KitModule />
  }
}

function ScreenContent({ screen }: { screen: Screen }) {
  switch (screen) {
    case 'translate':
      return <TranslateModule />
    case 'audio':
      return <AudioScout />
    case 'checklist':
      return <ChecklistModule />
    case 'vault':
      return <VaultModule />
    case 'settings':
      return <SettingsScreen />
  }
}

export default function App() {
  const { t } = useTranslation()
  useThemeEngine()
  const [booted, setBooted] = useState(() => sessionStorage.getItem('bp:booted') === '1')
  const bridge = useAgentBridge()
  const safety = useAgentState<SafetyState>('safety')
  const searched = location.use((s) => s.searched)
  const { tab, prevTab, screen, helpOpen } = ui.use()
  const dir = Math.sign(TABS.indexOf(tab) - TABS.indexOf(prevTab)) || 1
  const touch = useRef<{ x: number; y: number; t: number; skip: boolean } | null>(null)

  const onBoot = useCallback(() => {
    sessionStorage.setItem('bp:booted', '1')
    setBooted(true)
    // First launch only: the quick tour. Never repeats once finished or skipped.
    if (!tourDone()) setTimeout(() => ui.set({ tourOpen: true }), 250)
  }, [])

  useEffect(() => {
    if (booted && !tourDone() && !ui.get().tourOpen) ui.set({ tourOpen: true })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    window.scrollTo({ top: 0 })
  }, [tab, screen])

  const safetyCity = safety?.city ?? undefined
  const placeName =
    searched?.name ??
    safetyCity ??
    bridge.weather.data?.city ??
    (bridge.gpsStatus === 'locating'
      ? t('header.locating')
      : safety && safety.country.code !== 'XX' && bridge.gpsStatus !== 'denied'
        ? countryName(safety.country.code)
        : t('header.setLocation'))

  // Horizontal swipe between root tabs (not inside maps, carousels, sheets or screens).
  const onTouchStart = (e: React.TouchEvent) => {
    const tt = e.touches[0]
    const skip = Boolean(screen) || Boolean((e.target as HTMLElement).closest('[data-no-swipe], input, textarea, select'))
    touch.current = { x: tt.clientX, y: tt.clientY, t: Date.now(), skip }
  }
  const onTouchEnd = (e: React.TouchEvent) => {
    const s = touch.current
    touch.current = null
    if (!s || s.skip) return
    const tt = e.changedTouches[0]
    const dx = tt.clientX - s.x
    const dy = tt.clientY - s.y
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
        <div className="pointer-events-none fixed inset-x-0 top-0 -z-10 h-[50vh]" style={{ background: 'radial-gradient(80% 60% at 50% 0%, rgba(255,107,74,0.07), transparent 70%)' }} />
        <Header utcOffsetSec={bridge.weather.data?.utcOffsetSec} placeName={placeName} />
        <main className="px-4 pt-2 pb-32">
          <AnimatePresence mode="popLayout" initial={false}>
            {screen ? (
              <motion.div key={`screen-${screen}`} initial={{ x: 60, opacity: 0 }} animate={{ x: 0, opacity: 1 }} exit={{ x: 60, opacity: 0 }} transition={{ type: 'spring', stiffness: 420, damping: 40 }}>
                <div className="mb-4 flex items-center gap-2">
                  <button onClick={closeScreen} className="grid h-10 w-10 place-items-center rounded-full bg-veil/[0.06] text-fog-100" aria-label={t('common.back')}>
                    <ArrowLeft size={18} />
                  </button>
                  <h1 className="text-[28px] font-semibold tracking-[-0.02em] text-fog-50">{t(`titles.${screen}`)}</h1>
                </div>
                <Suspense fallback={<Loading />}>
                  <ScreenContent screen={screen} />
                </Suspense>
              </motion.div>
            ) : (
              <motion.div key={tab} custom={dir} variants={variants} initial="enter" animate="center" exit="exit" transition={{ type: 'spring', stiffness: 420, damping: 40, mass: 0.8 }}>
                <h1 className="mb-4 px-1 text-[28px] font-semibold tracking-[-0.02em] text-fog-50">{t(`titles.${tab}`)}</h1>
                <Suspense fallback={<Loading />}>
                  <TabContent tab={tab} weather={bridge.weather} placeName={placeName} />
                </Suspense>
              </motion.div>
            )}
          </AnimatePresence>
        </main>
      </div>
      <TabBar />
      <LocationSearch />
      <SosSheet />
      <ScannerSheet />
      <CameraScreen />
      <AnimatePresence>
        {helpOpen && (
          <Suspense fallback={null}>
            <FeatureHelpCenter />
          </Suspense>
        )}
      </AnimatePresence>
      <QuickTour />
      <UpdatePrompt />
    </>
  )
}
