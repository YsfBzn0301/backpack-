/**
 * Backpack Audio Scout: tap to identify what's playing, browse it in a 3D
 * cover flow, play the 30-second preview, jump to Spotify.
 */
import { AnimatePresence, motion } from 'framer-motion'
import { AudioLines, ExternalLink, History, KeyRound, Loader2, Mic, Pause, Play, RotateCcw, Search } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { AudioError, enrich, loadHistory, openMic, recognize, recordClip, saveHistory, searchTracks, spotifyUrl, TOKEN_CODES, type AudioErrorCode, type Track } from '@/services/audio'
import { keys } from '@/lib/settings'
import { openSettings } from '@/lib/ui'
import { haptic } from '@/lib/haptics'
import { relativeTime } from '@/i18n/format'
import { useOnline } from '@/hooks/useOnline'
import { Waveform } from '@/modules/translate/Waveform'
import { SectionTitle } from '@/components/ui/SectionTitle'
import { CoverFlow3D, hasWebGL } from './CoverFlow3D'
import { CoverFlowCSS } from './CoverFlowCSS'
import { TrackMatchModal } from './TrackMatchModal'
import { usePreview } from './usePreview'

type Phase = 'idle' | 'listening' | 'matching' | 'nomatch' | 'error'

const AUDD_DASHBOARD = 'https://dashboard.audd.io/'

type AC = typeof AudioContext
const AudioCtx = (): AC | undefined => (typeof window === 'undefined' ? undefined : (window.AudioContext ?? (window as unknown as { webkitAudioContext?: AC }).webkitAudioContext))

export function AudioScout() {
  const { t } = useTranslation()
  const online = useOnline()
  const [phase, setPhase] = useState<Phase>('idle')
  const [progress, setProgress] = useState(0)
  /** Recognition failure (drives the error card). */
  const [failure, setFailure] = useState<AudioErrorCode | null>(null)
  /** One-line notices from the text search. */
  const [error, setError] = useState<string | null>(null)
  const [tracks, setTracks] = useState<Track[]>([])
  const [active, setActive] = useState(0)
  const [history, setHistory] = useState<Track[]>([])
  const [query, setQuery] = useState('')
  const [searching, setSearching] = useState(false)
  /** Track shown in the "Song found" modal. */
  const [match, setMatch] = useState<Track | null>(null)
  const mic = useRef(new Uint8Array(64))
  const preview = usePreview()
  // Covers whose host refuses CORS can't become WebGL textures: show the <img> flow instead.
  const [artBlocked, setArtBlocked] = useState(false)
  const webgl = useMemo(hasWebGL, []) && !artBlocked
  const hasToken = Boolean(keys.audd())
  const searchInput = useRef<HTMLInputElement>(null)

  useEffect(() => {
    loadHistory().then((h) => {
      setHistory(h)
      if (h.length) setTracks(h.slice(0, 12))
    })
  }, [])

  /** Show a recognised track in the flow and history, then pop the match modal. */
  const showResult = async (hit: Track) => {
    const full = await enrich(hit)
    const more = await searchTracks(full.artist, 10).catch(() => [])
    const rest = more.filter((m) => m.title.toLowerCase() !== full.title.toLowerCase())
    setTracks([full, ...rest])
    setActive(0)
    const nextHistory = [full, ...history.filter((h) => h.id !== full.id)]
    setHistory(nextHistory)
    saveHistory(nextHistory)
    setMatch(full)
  }

  const listen = async () => {
    setError(null)
    setFailure(null)
    haptic('heavy')
    // Create/resume the AudioContext synchronously inside the tap: iOS Safari
    // only lets audio start from a user gesture, and the await below ends it.
    let ac: AudioContext | null = null
    try {
      const Ctx = AudioCtx()
      if (Ctx) {
        ac = new Ctx()
        ac.resume().catch(() => {})
      }
    } catch {
      ac = null
    }
    let stream: MediaStream | null = null
    let raf = 0
    try {
      stream = await openMic()
      // Levels for the waveform while recording (cosmetic: never block on it).
      try {
        if (ac) {
          if (ac.state !== 'running') await ac.resume().catch(() => {})
          const an = ac.createAnalyser()
          an.fftSize = 128
          ac.createMediaStreamSource(stream).connect(an)
          const buf = new Uint8Array(an.frequencyBinCount)
          const loop = () => {
            an.getByteFrequencyData(buf)
            mic.current = buf
            raf = requestAnimationFrame(loop)
          }
          loop()
        }
      } catch {
        /* waveform falls back to idle */
      }
      setPhase('listening')
      const clip = await recordClip(stream, 8000, setProgress)
      cancelAnimationFrame(raf)
      stream.getTracks().forEach((tr) => tr.stop())
      setPhase('matching')
      const hit = await recognize(clip)
      await showResult(hit)
      setPhase('idle')
    } catch (e) {
      const code: AudioErrorCode = e instanceof AudioError ? e.code : 'service'
      if (e instanceof AudioError && e.code !== 'no-match') console.warn('[audio]', e.code, e.auddCode ?? '', e.message)
      if (code === 'no-match') {
        setPhase('nomatch')
        setFailure('no-match')
        haptic('warn')
      } else {
        setFailure((code === 'network' || code === 'timeout') && !online ? 'network' : code)
        setPhase('error')
        haptic('warn')
      }
    } finally {
      cancelAnimationFrame(raf)
      stream?.getTracks().forEach((tr) => tr.stop())
      ac?.close().catch(() => {})
      setProgress(0)
    }
  }

  const search = async () => {
    const q = query.trim()
    if (!q) return
    setSearching(true)
    setError(null)
    try {
      const r = await searchTracks(q)
      setTracks(r)
      setActive(0)
      if (!r.length) setError(t('audio.noResults'))
    } catch {
      setError(online ? t('audio.failed') : t('audio.offline'))
    } finally {
      setSearching(false)
    }
  }

  const current = tracks[active]
  const busy = phase === 'listening' || phase === 'matching'
  const R = 46
  const C = 2 * Math.PI * R

  return (
    <div className="space-y-5">
      <section className="card relative overflow-hidden p-5 text-center">
        <div className="pointer-events-none absolute inset-0" style={{ background: busy ? 'radial-gradient(60% 50% at 50% 40%, rgba(29,185,84,0.16), transparent 70%)' : undefined }} />
        <div className="relative mx-auto h-28 w-28">
          <svg viewBox="0 0 100 100" className="absolute inset-0 -rotate-90">
            <circle cx="50" cy="50" r={R} fill="none" stroke="currentColor" strokeOpacity={0.08} strokeWidth="4" />
            <circle cx="50" cy="50" r={R} fill="none" stroke="#1db954" strokeWidth="4" strokeLinecap="round" strokeDasharray={C} strokeDashoffset={C * (1 - progress)} style={{ transition: 'stroke-dashoffset 0.1s linear' }} />
          </svg>
          <motion.button
            whileTap={{ scale: 0.92 }}
            onClick={listen}
            disabled={busy}
            data-audio-mic
            className="absolute inset-3 grid place-items-center rounded-full bg-[#1db954] text-[#0d1117] shadow-[0_10px_40px_-10px_rgba(29,185,84,0.8)] disabled:opacity-90"
            aria-label={t('audio.listen')}
          >
            {phase === 'matching' ? <Loader2 size={30} className="animate-spin" /> : busy ? <AudioLines size={30} /> : <Mic size={30} />}
            {phase === 'listening' && <motion.span className="absolute inset-0 rounded-full bg-[#1db954]" animate={{ scale: [1, 1.35], opacity: [0.45, 0] }} transition={{ duration: 1.3, repeat: Infinity }} />}
          </motion.button>
        </div>
        <p className="relative mt-3 text-sm font-medium text-fog-50" role="status">
          {failure && (phase === 'error' || phase === 'nomatch') ? t(`audio.err.${failure}.title`) : t(`audio.phase.${phase}`)}
        </p>
        <div className="relative mt-1 h-10">
          <Waveform levels={mic} active={phase === 'listening'} color="#1db954" />
        </div>
        {failure && (phase === 'error' || phase === 'nomatch') ? (
          <FailureCard
            code={failure}
            offline={!online}
            onRetry={listen}
            onSearch={() => {
              searchInput.current?.focus()
              searchInput.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })
            }}
          />
        ) : (
          !hasToken &&
          !busy && (
            <button onClick={() => openSettings('audd')} className="relative mt-1 inline-flex items-center gap-1.5 text-xs text-fog-400 hover:text-fog-100">
              <KeyRound size={12} /> {t('audio.tokenHint')}
            </button>
          )
        )}
        {error && <p className="relative mt-2 text-xs text-amber-glow">{error}</p>}
      </section>

      <form
        onSubmit={(e) => {
          e.preventDefault()
          search()
        }}
        className="glass flex items-center gap-2 rounded-2xl px-3.5 py-2.5"
      >
        <Search size={16} className="text-fog-500" />
        <input ref={searchInput} value={query} onChange={(e) => setQuery(e.target.value)} placeholder={t('audio.searchPlaceholder')} className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-fog-500" enterKeyHint="search" />
        {searching && <Loader2 size={15} className="animate-spin text-fog-500" />}
      </form>

      {tracks.length > 0 && current && (
        <section>
          {webgl ? <CoverFlow3D tracks={tracks} active={active} onChange={setActive} onOpen={(i) => setMatch(tracks[i])} onArtFail={() => setArtBlocked(true)} /> : <CoverFlowCSS tracks={tracks} active={active} onChange={setActive} onOpen={(i) => setMatch(tracks[i])} />}
          <AnimatePresence mode="wait">
            <motion.div key={current.id} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="-mt-2 text-center">
              <h2 className="text-lg font-semibold text-fog-50">{current.title}</h2>
              <p className="text-sm text-fog-400">
                {current.artist}
                {current.album ? ` · ${current.album}` : ''}
                {current.year ? ` · ${current.year}` : ''}
              </p>
            </motion.div>
          </AnimatePresence>

          <div className="mt-4 flex items-center gap-2">
            <button
              onClick={() => preview.play(current)}
              disabled={!current.previewUrl}
              className="relative flex h-12 flex-1 items-center justify-center gap-2 overflow-hidden rounded-full bg-veil/[0.07] text-sm font-medium text-fog-50 disabled:opacity-40"
            >
              <span className="absolute inset-y-0 left-0 bg-[#1db954]/25" style={{ width: preview.playing === current.id ? `${preview.progress * 100}%` : 0 }} />
              <span className="relative flex items-center gap-2">
                {preview.playing === current.id ? <Pause size={16} /> : <Play size={16} />}
                {current.previewUrl ? t('audio.preview') : t('audio.noPreview')}
              </span>
            </button>
            <a
              href={spotifyUrl(current)}
              target="_blank"
              rel="noopener"
              className="flex h-12 items-center gap-2 rounded-full bg-[#1db954] px-5 text-sm font-semibold text-[#0d1117]"
              onClick={() => haptic('select')}
            >
              <SpotifyMark /> {t('audio.openSpotify')}
            </a>
          </div>
          <div className="mt-2 h-12">
            <Waveform levels={preview.levels} active={preview.playing === current.id} color="#1db954" />
          </div>
          <div className="flex justify-center gap-4 text-xs">
            {current.appleUrl && (
              <a href={current.appleUrl} target="_blank" rel="noopener" className="flex items-center gap-1 text-fog-400 hover:text-fog-100">
                <ExternalLink size={12} /> Apple Music
              </a>
            )}
            {current.songLink && (
              <a href={current.songLink} target="_blank" rel="noopener" className="flex items-center gap-1 text-fog-400 hover:text-fog-100">
                <ExternalLink size={12} /> song.link
              </a>
            )}
          </div>
        </section>
      )}

      {history.length > 0 && (
        <section>
          <SectionTitle>
            <span className="flex items-center gap-1.5">
              <History size={11} /> {t('audio.history')}
            </span>
          </SectionTitle>
          <ul className="card divide-y divide-veil/5">
            {history.slice(0, 8).map((h) => (
              <li key={h.id}>
                <button
                  onClick={() => {
                    const i = tracks.findIndex((x) => x.id === h.id)
                    if (i >= 0) setActive(i)
                    else {
                      setTracks([h, ...tracks])
                      setActive(0)
                    }
                  }}
                  className="flex w-full items-center gap-3 px-3 py-2.5 text-left"
                >
                  {h.artwork ? <img src={h.artwork} alt="" className="h-10 w-10 rounded-md object-cover" /> : <span className="grid h-10 w-10 place-items-center rounded-md bg-veil/5">♪</span>}
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm text-fog-100">{h.title}</span>
                    <span className="block truncate text-xs text-fog-500">{h.artist}</span>
                  </span>
                  {h.recognizedAt && <span className="shrink-0 text-[10px] text-fog-500">{relativeTime(h.recognizedAt)}</span>}
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}
      <p className="px-1 text-[10px] text-fog-500">{t('audio.credit')}</p>
      <TrackMatchModal track={match} onClose={() => setMatch(null)} preview={preview} />
    </div>
  )
}

function FailureCard({ code, offline, onRetry, onSearch }: { code: AudioErrorCode; offline: boolean; onRetry: () => void; onSearch: () => void }) {
  const { t } = useTranslation()
  const tokenProblem = TOKEN_CODES.includes(code)
  const body = code === 'network' && offline ? t('audio.offline') : t(`audio.err.${code}.body`)
  const btn = 'inline-flex h-9 items-center gap-1.5 rounded-full px-4 text-xs font-medium'
  return (
    <div className="relative mx-auto mt-2 max-w-sm text-center">
      <p className="text-xs leading-relaxed text-fog-300">{body}</p>
      <div className="mt-3 flex flex-wrap items-center justify-center gap-2">
        {tokenProblem ? (
          <>
            <button onClick={() => openSettings('audd')} className={`${btn} bg-[#1db954] text-[#0d1117]`}>
              <KeyRound size={13} /> {t('audio.addKey')}
            </button>
            <a href={AUDD_DASHBOARD} target="_blank" rel="noopener" className={`${btn} bg-veil/[0.07] text-fog-100`}>
              <ExternalLink size={13} /> {t('audio.getKey')}
            </a>
          </>
        ) : (
          code !== 'mic-unsupported' && (
            <button onClick={onRetry} className={`${btn} bg-veil/[0.07] text-fog-100`}>
              <RotateCcw size={13} /> {t('audio.retry')}
            </button>
          )
        )}
        <button onClick={onSearch} className={`${btn} text-fog-400 hover:text-fog-100`}>
          <Search size={13} /> {t('audio.searchInstead')}
        </button>
      </div>
    </div>
  )
}

function SpotifyMark() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden fill="currentColor">
      <path d="M12 1.5a10.5 10.5 0 1 0 0 21 10.5 10.5 0 0 0 0-21Zm4.8 15.15a.66.66 0 0 1-.9.22c-2.48-1.52-5.6-1.86-9.28-1.02a.66.66 0 1 1-.29-1.28c4.02-.92 7.48-.52 10.25 1.18.31.19.41.6.22.9Zm1.28-2.85a.82.82 0 0 1-1.13.27c-2.84-1.75-7.17-2.25-10.53-1.23a.82.82 0 0 1-.48-1.57c3.84-1.17 8.62-.6 11.87 1.4.39.24.51.75.27 1.13Zm.11-2.97C14.8 8.8 9.2 8.6 5.95 9.6a.99.99 0 1 1-.57-1.89c3.73-1.13 9.92-.91 13.84 1.41a.99.99 0 0 1-1.03 1.71Z" />
    </svg>
  )
}
