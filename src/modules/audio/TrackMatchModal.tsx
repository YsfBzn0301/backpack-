/**
 * "Song found" pop-up: a 3D album sleeve you can turn by drag or device tilt,
 * the track details, a 30-second preview with live waveform, and hand-offs to
 * Spotify, Apple Music and song.link. Opens after a successful recognition or
 * from a tap on the centred cover.
 */
import { AnimatePresence, motion, useDragControls, useReducedMotion, type PanInfo } from 'framer-motion'
import { Check, ExternalLink, Pause, Play, Rotate3d, Share2, X } from 'lucide-react'
import { Component, lazy, Suspense, useEffect, useId, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { useTranslation } from 'react-i18next'
import { spotifyUrl, type Track } from '@/services/audio'
import { haptic } from '@/lib/haptics'
import { Waveform } from '@/modules/translate/Waveform'
import { AlbumCaseCSS } from './AlbumCaseCSS'
import { tiltSupported, useCaseMotion, useTilt, type CaseMotion } from './caseMotion'
import { hasWebGL } from './CoverFlow3D'
import { formatTime, isMobileUA, spotifyDeepLink, trackHue } from './trackMatch'
import type { Preview } from './usePreview'

const AlbumCase3D = lazy(() => import('./AlbumCase3D'))
const SPOTIFY = '#1DB954'
const PREVIEW_SECONDS = 30

interface Props {
  /** The track to show; null closes the modal. */
  track: Track | null
  onClose: () => void
  preview: Preview
}

export function TrackMatchModal({ track, onClose, preview }: Props) {
  const open = Boolean(track)
  const stopRef = useRef(preview.stop)
  stopRef.current = preview.stop
  const closeRef = useRef(onClose)
  closeRef.current = onClose

  // Open/close side effects: haptic, scroll lock, Escape, focus restore, preview stop.
  useEffect(() => {
    if (!open) return
    // The dialog focuses itself in a layout effect before this runs, so ignore it.
    const active = document.activeElement as HTMLElement | null
    const prevFocus = active && active !== document.body && !active.closest('[role=dialog]') ? active : null
    const html = document.documentElement
    const prev = { body: document.body.style.overflow, html: html.style.overflow }
    document.body.style.overflow = 'hidden'
    html.style.overflow = 'hidden'
    haptic('success')
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation()
        closeRef.current()
      }
    }
    window.addEventListener('keydown', onKey, true)
    return () => {
      window.removeEventListener('keydown', onKey, true)
      document.body.style.overflow = prev.body
      html.style.overflow = prev.html
      stopRef.current()
      // After a recognition nothing usable had focus (the mic was disabled): fall back to the mic.
      setTimeout(() => {
        const back = prevFocus?.isConnected && !(prevFocus as HTMLButtonElement).disabled ? prevFocus : document.querySelector<HTMLElement>('[data-audio-mic]')
        back?.focus({ preventScroll: true })
      }, 0)
    }
  }, [open])

  if (typeof document === 'undefined') return null
  return createPortal(<AnimatePresence>{track && <Dialog key={track.id} track={track} onClose={onClose} preview={preview} />}</AnimatePresence>, document.body)
}

function Dialog({ track, onClose, preview }: { track: Track; onClose: () => void; preview: Preview }) {
  const { t } = useTranslation()
  const reduced = Boolean(useReducedMotion())
  const titleId = useId()
  const descId = useId()
  const dialog = useRef<HTMLElement>(null)
  const scroller = useRef<HTMLDivElement>(null)
  const controls = useDragControls()
  const { tilt, status: tiltStatus, toggle: toggleTilt } = useTilt()
  const caseMotion = useCaseMotion(tilt, reduced)
  const webgl = useMemo(hasWebGL, [])
  const [fits, setFits] = useState(true)
  const [toast, setToast] = useState<string | null>(null)
  const toastTimer = useRef(0)
  const hue = trackHue(track)

  const say = (msg: string) => {
    setToast(msg)
    clearTimeout(toastTimer.current)
    toastTimer.current = window.setTimeout(() => setToast(null), 2400)
  }
  useEffect(() => () => clearTimeout(toastTimer.current), [])

  useLayoutEffect(() => {
    dialog.current?.focus({ preventScroll: true })
  }, [])

  // Swipe-down needs touch-action:none on the whole card, which would block
  // scrolling. Only allow it when the card fits without scrolling.
  useEffect(() => {
    const el = scroller.current
    if (!el || typeof ResizeObserver === 'undefined') return
    const ro = new ResizeObserver(() => setFits(el.scrollHeight <= el.clientHeight + 1))
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  // Keep Tab inside the dialog.
  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key !== 'Tab' || !dialog.current) return
    const items = [...dialog.current.querySelectorAll<HTMLElement>('a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])')].filter((el) => el.offsetParent !== null)
    if (!items.length) return
    const first = items[0]
    const last = items[items.length - 1]
    if (e.shiftKey && (document.activeElement === first || document.activeElement === dialog.current)) {
      e.preventDefault()
      last.focus()
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault()
      first.focus()
    }
  }

  const onDragEnd = (_: unknown, info: PanInfo) => {
    if (info.offset.y > 110 || info.velocity.y > 650) {
      haptic('select')
      onClose()
    }
  }

  const onTilt = async () => {
    haptic('select')
    const next = await toggleTilt()
    if (next === 'denied') say(t('audio.match.tiltDenied'))
    else if (next === 'on') say(t('audio.match.tiltOn'))
  }
  useEffect(() => {
    if (tiltStatus === 'unavailable') say(t('audio.match.tiltUnavailable'))
  }, [tiltStatus])

  const share = async () => {
    haptic('select')
    const url = track.songLink ?? spotifyUrl(track)
    const text = t('audio.match.shareText', { title: track.title, artist: track.artist })
    if (navigator.share) {
      try {
        await navigator.share({ title: `${track.title} · ${track.artist}`, text, url })
        return
      } catch (e) {
        if ((e as { name?: string })?.name === 'AbortError') return
      }
    }
    try {
      await navigator.clipboard.writeText(`${text} ${url}`)
      say(t('audio.match.copied'))
    } catch {
      say(t('audio.match.shareFailed'))
    }
  }

  const playing = preview.playing === track.id
  const elapsed = playing ? preview.time.current : 0
  const total = playing && preview.time.duration ? preview.time.duration : PREVIEW_SECONDS
  const R = 21
  const C = 2 * Math.PI * R
  const meta = [track.album && { k: t('audio.match.album'), v: track.album }, track.year && { k: t('audio.match.released'), v: track.year }].filter(Boolean) as { k: string; v: string }[]

  const spring = { type: 'spring', stiffness: 340, damping: 30, mass: 0.9 } as const
  const pill = 'inline-flex h-10 min-w-0 flex-auto items-center justify-center gap-1.5 rounded-full bg-veil/[0.06] px-3 text-[13px] font-medium text-fog-100 ring-1 ring-veil/[0.06] transition-colors hover:bg-veil/[0.1] active:bg-veil/[0.14]'
  const iconBtn = 'grid h-9 w-9 place-items-center rounded-full bg-veil/[0.06] text-fog-300 ring-1 ring-veil/[0.06] transition-colors hover:text-fog-50 hover:bg-veil/[0.1]'

  return (
    <motion.div className="fixed inset-0 z-[70] flex items-end justify-center p-3 pb-[max(env(safe-area-inset-bottom),0.75rem)] sm:items-center" data-no-swipe>
      <motion.div
        className="absolute inset-0 bg-ink-950/55 backdrop-blur-lg backdrop-saturate-150"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: reduced ? 0.15 : 0.3 }}
        onClick={onClose}
        aria-hidden
      />
      <motion.section
        ref={dialog}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descId}
        tabIndex={-1}
        onKeyDown={onKeyDown}
        className={`glass-strong relative flex max-h-[calc(100dvh-1.5rem)] w-full max-w-[400px] flex-col overflow-hidden rounded-[30px] shadow-[0_40px_120px_-30px_rgba(0,0,0,0.75)] outline-none [[data-theme=light]_&]:shadow-[0_40px_100px_-30px_rgba(13,17,23,0.35)] ${fits ? 'touch-none' : ''}`}
        initial={reduced ? { opacity: 0 } : { opacity: 0, y: 70, scale: 0.86 }}
        animate={reduced ? { opacity: 1 } : { opacity: 1, y: 0, scale: 1 }}
        exit={reduced ? { opacity: 0 } : { opacity: 0, y: 40, scale: 0.94, transition: { duration: 0.22, ease: [0.4, 0, 1, 1] } }}
        transition={reduced ? { duration: 0.15 } : spring}
        drag="y"
        dragControls={controls}
        dragListener={false}
        dragConstraints={{ top: 0, bottom: 0 }}
        dragElastic={{ top: 0.05, bottom: 0.7 }}
        onDragEnd={onDragEnd}
        onPointerDown={(e) => controls.start(e)}
      >
        {/* Artwork-tinted light behind the stage */}
        <div className="pointer-events-none absolute inset-x-0 top-0 h-[360px] overflow-hidden" aria-hidden>
          {track.artwork ? (
            <img src={track.artwork} alt="" className="absolute inset-0 h-full w-full scale-125 object-cover opacity-45 blur-3xl saturate-150 [[data-theme=light]_&]:opacity-35" />
          ) : (
            <div className="absolute inset-0" style={{ background: `radial-gradient(70% 60% at 50% 40%, hsl(${hue} 70% 50% / .45), transparent 70%)` }} />
          )}
          <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-ink-850" />
        </div>

        <div ref={scroller} className="no-scrollbar relative overflow-y-auto overscroll-contain">
          <div className="flex touch-none justify-center pt-2.5" aria-hidden>
            <span className="h-1 w-9 rounded-full bg-fog-500/40" />
          </div>
          <header className="flex touch-none items-center gap-2 px-4 pt-2">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-[#1DB954]/15 px-2.5 py-1 text-[11px] font-semibold tracking-[0.08em] text-[#1DB954] uppercase [[data-theme=light]_&]:text-[#138a3e]">
              <span className="relative flex h-1.5 w-1.5">
                {!reduced && <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#1DB954] opacity-60" />}
                <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-[#1DB954]" />
              </span>
              <span id={descId}>{t('audio.match.title')}</span>
            </span>
            <span className="flex-1" />
            {tiltSupported() && (
              <button type="button" onClick={onTilt} aria-pressed={tiltStatus === 'on'} aria-label={t('audio.match.tilt')} title={t('audio.match.tilt')} className={`${iconBtn} ${tiltStatus === 'on' ? '!bg-ember-500/20 !text-ember-400 !ring-ember-500/30' : ''}`}>
                <Rotate3d size={16} />
              </button>
            )}
            <button type="button" onClick={onClose} aria-label={t('audio.match.close')} className={iconBtn}>
              <X size={17} />
            </button>
          </header>

          {/* 3D stage */}
          <div className="relative h-[260px] cursor-grab touch-none select-none active:cursor-grabbing" {...caseMotion.bind}>
            <Stage track={track} motion={caseMotion} webgl={webgl} accent={`hsl(${hue}, 85%, 62%)`} />
          </div>

          <div className="relative px-6">
            <motion.h2
              id={titleId}
              className="text-[26px] leading-[1.12] font-semibold tracking-[-0.02em] text-balance text-fog-50"
              initial={reduced ? false : { opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.12, ...spring }}
              data-selectable
            >
              {track.title}
            </motion.h2>
            <motion.p className="mt-1 text-[15px] font-medium text-fog-300" initial={reduced ? false : { opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.18, ...spring }} data-selectable>
              {track.artist}
            </motion.p>
            {meta.length > 0 && (
              <motion.dl className="mt-3.5 flex gap-6 border-t hairline pt-3" initial={reduced ? false : { opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.24 }}>
                {meta.map((row) => (
                  <div key={row.k} className="min-w-0 last:shrink-0 first:flex-1">
                    <dt className="text-[10px] font-semibold tracking-[0.14em] text-fog-500 uppercase">{row.k}</dt>
                    <dd className="mt-0.5 line-clamp-2 text-[13px] leading-snug text-fog-100 tabular">{row.v}</dd>
                  </div>
                ))}
              </motion.dl>
            )}
          </div>

          {/* Preview */}
          <div className="relative mx-4 mt-4 rounded-[20px] bg-veil/[0.045] p-2.5 pr-4 ring-1 ring-veil/[0.05]">
            {track.previewUrl ? (
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => {
                    haptic('select')
                    preview.play(track)
                  }}
                  aria-label={playing ? t('audio.match.pause') : t('audio.match.play')}
                  aria-pressed={playing}
                  className="relative grid h-12 w-12 shrink-0 place-items-center rounded-full text-fog-50"
                >
                  <svg viewBox="0 0 48 48" className="absolute inset-0 -rotate-90" aria-hidden>
                    <circle cx="24" cy="24" r={R} fill="none" stroke="currentColor" strokeOpacity={0.12} strokeWidth="3" />
                    <circle cx="24" cy="24" r={R} fill="none" stroke={SPOTIFY} strokeWidth="3" strokeLinecap="round" strokeDasharray={C} strokeDashoffset={C * (1 - (playing ? preview.progress : 0))} style={{ transition: 'stroke-dashoffset .25s linear' }} />
                  </svg>
                  <span className="grid h-9 w-9 place-items-center rounded-full bg-fog-50 text-ink-900">{playing ? <Pause size={16} fill="currentColor" /> : <Play size={16} fill="currentColor" className="ml-0.5" />}</span>
                </button>
                <div className="min-w-0 flex-1">
                  <div className="h-8">
                    <Waveform levels={preview.levels} active={playing} color={SPOTIFY} className="h-8 w-full" />
                  </div>
                  <div className="mt-0.5 flex justify-between text-[11px] text-fog-500 tabular" aria-live="off">
                    <span>{t('audio.match.preview')}</span>
                    <span>
                      <span className="text-fog-300">{formatTime(elapsed)}</span> / {formatTime(total)}
                    </span>
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-3 opacity-80">
                <span className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-veil/[0.06] text-fog-500" aria-hidden>
                  <Play size={16} />
                </span>
                <div className="min-w-0">
                  <p className="text-[13px] font-medium text-fog-300">{t('audio.match.preview')}</p>
                  <p className="text-xs text-fog-500">{t('audio.match.noPreview')}</p>
                </div>
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="relative px-4 pt-3 pb-4">
            <a
              href={spotifyUrl(track)}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => openSpotify(e, track)}
              className="group relative flex h-[52px] items-center justify-center gap-2.5 overflow-hidden rounded-full text-[15px] font-semibold text-[#0b0f0c] shadow-[0_14px_36px_-12px_rgba(29,185,84,0.75)] transition-transform active:scale-[0.98]"
              style={{ background: `linear-gradient(180deg, #2ee06d, ${SPOTIFY})` }}
            >
              <span className="pointer-events-none absolute inset-0 bg-gradient-to-b from-white/25 to-transparent opacity-60" />
              <SpotifyGlyph />
              <span className="relative">{t('audio.match.listenSpotify')}</span>
            </a>
            <div className="mt-2.5 flex gap-2">
              {track.appleUrl && (
                <a href={track.appleUrl} target="_blank" rel="noopener noreferrer" className={pill} onClick={() => haptic('select')}>
                  <AppleMusicGlyph /> <span className="truncate">{t('audio.match.appleMusic')}</span>
                </a>
              )}
              {track.songLink && (
                <a href={track.songLink} target="_blank" rel="noopener noreferrer" className={pill} onClick={() => haptic('select')}>
                  <ExternalLink size={14} /> <span className="truncate">{t('audio.match.songLink')}</span>
                </a>
              )}
              <button type="button" onClick={share} className={pill}>
                <Share2 size={14} /> <span className="truncate">{t('audio.match.share')}</span>
              </button>
            </div>
          </div>
        </div>

        <AnimatePresence>
          {toast && (
            <motion.div
              role="status"
              className="pointer-events-none absolute inset-x-0 top-14 z-10 flex justify-center"
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
            >
              <span className="inline-flex items-center gap-1.5 rounded-full bg-ink-950/85 px-3.5 py-2 text-xs font-medium text-fog-50 shadow-lg ring-1 ring-veil/10 backdrop-blur">
                <Check size={13} className="text-moss-400" /> {toast}
              </span>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.section>
    </motion.div>
  )
}

function Stage({ track, motion, webgl, accent }: { track: Track; motion: CaseMotion; webgl: boolean; accent: string }) {
  const [artBlocked, setArtBlocked] = useState(false)
  useEffect(() => setArtBlocked(false), [track.artwork])
  const css = <AlbumCaseCSS track={track} motion={motion} />
  if (!webgl || artBlocked) return css
  return (
    <GLBoundary fallback={css}>
      <Suspense fallback={css}>
        <AlbumCase3D track={track} motion={motion} accent={accent} onArtFail={() => setArtBlocked(true)} />
      </Suspense>
    </GLBoundary>
  )
}

/** Falls back to the CSS sleeve if the WebGL context can't be created. */
class GLBoundary extends Component<{ fallback: ReactNode; children: ReactNode }, { failed: boolean }> {
  state = { failed: false }
  static getDerivedStateFromError() {
    return { failed: true }
  }
  componentDidCatch(e: unknown) {
    console.warn('[audio] 3D sleeve unavailable, using CSS', e)
  }
  render() {
    return this.state.failed ? this.props.fallback : this.props.children
  }
}

/**
 * On phones, try the Spotify app first and fall back to the web player if the
 * page is still visible shortly after (the app didn't take over). Desktop
 * follows the link's default: open.spotify.com in a new tab.
 */
function openSpotify(e: React.MouseEvent<HTMLAnchorElement>, track: Track) {
  haptic('select')
  if (!isMobileUA(navigator.userAgent, navigator.maxTouchPoints)) return
  e.preventDefault()
  const web = spotifyUrl(track)
  let left = false
  const onHide = () => {
    if (document.visibilityState === 'hidden') left = true
  }
  const onPageHide = () => (left = true)
  document.addEventListener('visibilitychange', onHide)
  window.addEventListener('pagehide', onPageHide)
  window.setTimeout(() => {
    document.removeEventListener('visibilitychange', onHide)
    window.removeEventListener('pagehide', onPageHide)
    if (!left && document.visibilityState === 'visible') window.location.href = web
  }, 1600)
  window.location.href = spotifyDeepLink(track)
}

function SpotifyGlyph() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden className="relative">
      <circle cx="12" cy="12" r="11" fill="#0b0f0c" />
      <g fill="none" stroke={SPOTIFY} strokeLinecap="round">
        <path d="M6.4 9.2c3.7-1.1 8-.8 11.2 1.1" strokeWidth="1.9" />
        <path d="M7 12.3c3-.85 6.4-.55 9 .95" strokeWidth="1.6" />
        <path d="M7.6 15.2c2.4-.6 4.9-.4 7 .75" strokeWidth="1.35" />
      </g>
    </svg>
  )
}

function AppleMusicGlyph() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" aria-hidden fill="currentColor">
      <path d="M19 3.2v12.3a3.2 3.2 0 1 1-2-2.96V7.3l-7 1.55v8.65a3.2 3.2 0 1 1-2-2.96V6.1c0-.5.34-.93.83-1.03l9-1.95A1 1 0 0 1 19 3.2Z" />
    </svg>
  )
}
