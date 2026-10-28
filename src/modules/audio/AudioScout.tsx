/**
 * Backpack Audio Scout: tap to identify what's playing, browse it in a 3D
 * cover flow, play the 30-second preview, jump to Spotify.
 */
import { AnimatePresence, motion } from 'framer-motion'
import { AudioLines, ExternalLink, History, KeyRound, Loader2, Mic, Pause, Play, Search } from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { enrich, loadHistory, recognize, recordClip, saveHistory, searchTracks, spotifyUrl, type Track } from '@/services/audio'
import { keys } from '@/lib/settings'
import { openScreen } from '@/lib/ui'
import { haptic } from '@/lib/haptics'
import { relativeTime } from '@/i18n/format'
import { useOnline } from '@/hooks/useOnline'
import { Waveform } from '@/modules/translate/Waveform'
import { SectionTitle } from '@/components/ui/SectionTitle'
import { CoverFlow3D, hasWebGL } from './CoverFlow3D'
import { CoverFlowCSS } from './CoverFlowCSS'

type Phase = 'idle' | 'listening' | 'matching' | 'nomatch' | 'error'

/** Audio element + analyser for the live preview waveform. */
function usePreview() {
  const audio = useRef<HTMLAudioElement | null>(null)
  const levels = useRef(new Uint8Array(64))
  const ctx = useRef<{ ac: AudioContext; an: AnalyserNode } | null>(null)
  const raf = useRef(0)
  const [playing, setPlaying] = useState<string | null>(null)
  const [progress, setProgress] = useState(0)

  const stop = useCallback(() => {
    audio.current?.pause()
    cancelAnimationFrame(raf.current)
    setPlaying(null)
    setProgress(0)
  }, [])

  const play = useCallback(
    async (t: Track) => {
      if (!t.previewUrl) return
      if (playing === t.id) return stop()
      stop()
      // A fresh element per track: createMediaElementSource binds once per element.
      const el = new Audio()
      el.crossOrigin = 'anonymous'
      el.src = t.previewUrl
      audio.current = el
      el.ontimeupdate = () => setProgress(el.duration ? el.currentTime / el.duration : 0)
      el.onended = stop
      let analysed = true
      try {
        const ac = ctx.current?.ac ?? new AudioContext()
        const an = ctx.current?.an ?? ac.createAnalyser()
        an.fftSize = 128
        if (!ctx.current) an.connect(ac.destination)
        ctx.current = { ac, an }
        ac.createMediaElementSource(el).connect(an)
        await ac.resume()
        await el.play()
      } catch {
        // CORS-blocked analysis: play plainly, the waveform falls back to a pulse.
        const plain = new Audio(t.previewUrl)
        audio.current = plain
        plain.ontimeupdate = () => setProgress(plain.duration ? plain.currentTime / plain.duration : 0)
        plain.onended = stop
        analysed = false
        await plain.play().catch(() => stop())
      }
      setPlaying(t.id)
      const buf = new Uint8Array(64)
      const loop = () => {
        const a = audio.current
        if (ctx.current && analysed) {
          ctx.current.an.getByteFrequencyData(buf)
          levels.current = buf
        } else if (a) {
          // Synthetic pulse keyed to playback time.
          const tt = a.currentTime
          levels.current = buf.map((_, i) => 110 + 90 * Math.abs(Math.sin(tt * 6 + i * 0.4)))
        }
        raf.current = requestAnimationFrame(loop)
      }
      loop()
    },
    [playing, stop],
  )

  useEffect(() => () => {
    stop()
    ctx.current?.ac.close().catch(() => {})
  }, [stop])

  return { play, stop, playing, progress, levels }
}

export function AudioScout() {
  const { t } = useTranslation()
  const online = useOnline()
  const [phase, setPhase] = useState<Phase>('idle')
  const [progress, setProgress] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [tracks, setTracks] = useState<Track[]>([])
  const [active, setActive] = useState(0)
  const [history, setHistory] = useState<Track[]>([])
  const [query, setQuery] = useState('')
  const [searching, setSearching] = useState(false)
  const mic = useRef(new Uint8Array(64))
  const preview = usePreview()
  const webgl = useMemo(hasWebGL, [])
  const hasToken = Boolean(keys.audd())

  useEffect(() => {
    loadHistory().then((h) => {
      setHistory(h)
      if (h.length) setTracks(h.slice(0, 12))
    })
  }, [])

  const showResult = async (hit: Track) => {
    const full = await enrich(hit)
    const more = await searchTracks(full.artist, 10).catch(() => [])
    const rest = more.filter((m) => m.title.toLowerCase() !== full.title.toLowerCase())
    setTracks([full, ...rest])
    setActive(0)
    const nextHistory = [full, ...history.filter((h) => h.id !== full.id)]
    setHistory(nextHistory)
    saveHistory(nextHistory)
    haptic('success')
  }

  const listen = async () => {
    if (!hasToken) {
      setError(t('audio.needToken'))
      return
    }
    setError(null)
    haptic('heavy')
    let stream: MediaStream | null = null
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: false, noiseSuppression: false } })
      // Levels for the waveform while recording.
      const ac = new AudioContext()
      const an = ac.createAnalyser()
      an.fftSize = 128
      ac.createMediaStreamSource(stream).connect(an)
      const buf = new Uint8Array(an.frequencyBinCount)
      let raf = 0
      const loop = () => {
        an.getByteFrequencyData(buf)
        mic.current = buf
        raf = requestAnimationFrame(loop)
      }
      loop()
      setPhase('listening')
      const clip = await recordClip(stream, 8000, setProgress)
      cancelAnimationFrame(raf)
      ac.close().catch(() => {})
      setPhase('matching')
      const hit = await recognize(clip)
      if (!hit) {
        setPhase('nomatch')
        haptic('warn')
        return
      }
      await showResult(hit)
      setPhase('idle')
    } catch (e) {
      const m = e instanceof Error ? e.message : String(e)
      setError(m === 'no-token' ? t('audio.needToken') : /denied|NotAllowed/i.test(m) ? t('audio.micBlocked') : online ? t('audio.failed') : t('audio.offline'))
      setPhase('error')
    } finally {
      stream?.getTracks().forEach((tr) => tr.stop())
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
            className="absolute inset-3 grid place-items-center rounded-full bg-[#1db954] text-[#0d1117] shadow-[0_10px_40px_-10px_rgba(29,185,84,0.8)] disabled:opacity-90"
            aria-label={t('audio.listen')}
          >
            {phase === 'matching' ? <Loader2 size={30} className="animate-spin" /> : busy ? <AudioLines size={30} /> : <Mic size={30} />}
            {phase === 'listening' && <motion.span className="absolute inset-0 rounded-full bg-[#1db954]" animate={{ scale: [1, 1.35], opacity: [0.45, 0] }} transition={{ duration: 1.3, repeat: Infinity }} />}
          </motion.button>
        </div>
        <p className="relative mt-3 text-sm font-medium text-fog-50">{t(`audio.phase.${phase}`)}</p>
        <div className="relative mt-1 h-10">
          <Waveform levels={mic} active={phase === 'listening'} color="#1db954" />
        </div>
        {!hasToken && (
          <button onClick={() => openScreen('settings')} className="relative mt-1 inline-flex items-center gap-1.5 text-xs text-fog-400 hover:text-fog-100">
            <KeyRound size={12} /> {t('audio.tokenHint')}
          </button>
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
        <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder={t('audio.searchPlaceholder')} className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-fog-500" enterKeyHint="search" />
        {searching && <Loader2 size={15} className="animate-spin text-fog-500" />}
      </form>

      {tracks.length > 0 && current && (
        <section>
          {webgl ? <CoverFlow3D tracks={tracks} active={active} onChange={setActive} /> : <CoverFlowCSS tracks={tracks} active={active} onChange={setActive} />}
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
