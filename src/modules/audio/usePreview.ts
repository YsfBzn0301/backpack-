import { useCallback, useEffect, useRef, useState } from 'react'
import type { Track } from '@/services/audio'

export type Preview = ReturnType<typeof usePreview>

/**
 * One audio element + analyser for 30-second previews. `levels` feeds the
 * Waveform; `time` gives elapsed/duration in seconds for the time readout.
 * Shared by the Audio Scout screen and the TrackMatchModal so only one
 * preview ever plays.
 */
export function usePreview() {
  const audio = useRef<HTMLAudioElement | null>(null)
  const levels = useRef(new Uint8Array(64))
  const ctx = useRef<{ ac: AudioContext; an: AnalyserNode } | null>(null)
  const raf = useRef(0)
  const [playing, setPlaying] = useState<string | null>(null)
  const [progress, setProgress] = useState(0)
  const [time, setTime] = useState({ current: 0, duration: 0 })

  const stop = useCallback(() => {
    audio.current?.pause()
    cancelAnimationFrame(raf.current)
    setPlaying(null)
    setProgress(0)
    setTime({ current: 0, duration: 0 })
  }, [])

  const play = useCallback(
    async (t: Track) => {
      if (!t.previewUrl) return
      if (playing === t.id) return stop()
      stop()
      const track = (el: HTMLAudioElement) => {
        el.ontimeupdate = () => {
          const d = Number.isFinite(el.duration) ? el.duration : 0
          setProgress(d ? el.currentTime / d : 0)
          setTime({ current: el.currentTime, duration: d })
        }
        el.onended = stop
      }
      // A fresh element per track: createMediaElementSource binds once per element.
      const el = new Audio()
      el.crossOrigin = 'anonymous'
      el.src = t.previewUrl
      audio.current = el
      track(el)
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
        track(plain)
        analysed = false
        await plain.play().catch(() => stop())
        if (audio.current !== plain || plain.paused) return
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

  useEffect(
    () => () => {
      stop()
      ctx.current?.ac.close().catch(() => {})
    },
    [stop],
  )

  return { play, stop, playing, progress, time, levels }
}
