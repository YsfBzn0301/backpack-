import { useCallback, useEffect, useRef, useState } from 'react'

/* Minimal typings for the Web Speech API (not in lib.dom for all TS versions). */
interface SRAlternative {
  transcript: string
  confidence: number
}
interface SRResult {
  isFinal: boolean
  0: SRAlternative
  length: number
}
interface SREvent {
  resultIndex: number
  results: { length: number; [i: number]: SRResult }
}
interface SpeechRecognitionLike {
  lang: string
  continuous: boolean
  interimResults: boolean
  maxAlternatives: number
  start(): void
  stop(): void
  abort(): void
  onresult: ((e: SREvent) => void) | null
  onerror: ((e: { error: string }) => void) | null
  onend: (() => void) | null
}

const SR: (new () => SpeechRecognitionLike) | undefined =
  typeof window !== 'undefined'
    ? ((window as unknown as Record<string, unknown>).SpeechRecognition as never) ?? ((window as unknown as Record<string, unknown>).webkitSpeechRecognition as never)
    : undefined

export const speechSupported = Boolean(SR)

export function useSpeechRecognition(lang: string, onFinal: (text: string) => void) {
  const [listening, setListening] = useState(false)
  const [interim, setInterim] = useState('')
  const [error, setError] = useState<string | null>(null)
  const rec = useRef<SpeechRecognitionLike | null>(null)
  const finalRef = useRef('')
  const onFinalRef = useRef(onFinal)
  onFinalRef.current = onFinal

  const stop = useCallback(() => rec.current?.stop(), [])

  const start = useCallback(() => {
    if (!SR) {
      setError('notSupported')
      return
    }
    rec.current?.abort()
    const r = new SR()
    r.lang = lang
    r.continuous = false
    r.interimResults = true
    r.maxAlternatives = 1
    finalRef.current = ''
    r.onresult = (e) => {
      let interimText = ''
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const res = e.results[i]
        if (res.isFinal) finalRef.current += res[0].transcript
        else interimText += res[0].transcript
      }
      setInterim(finalRef.current + interimText)
    }
    r.onerror = (e) => {
      // Error codes; the UI translates them (translate.err.*).
      const map: Record<string, string> = { 'not-allowed': 'notAllowed', 'service-not-allowed': 'notAllowed', 'no-speech': 'noSpeech', network: 'network', 'language-not-supported': 'langUnsupported' }
      if (e.error !== 'aborted') setError(map[e.error] ?? 'generic')
    }
    r.onend = () => {
      setListening(false)
      const text = finalRef.current.trim()
      if (text) onFinalRef.current(text)
      setInterim('')
    }
    rec.current = r
    setError(null)
    setInterim('')
    try {
      r.start()
      setListening(true)
    } catch {
      setError('generic')
    }
  }, [lang])

  useEffect(() => () => rec.current?.abort(), [])

  return { supported: speechSupported, listening, interim, error, start, stop, clearError: () => setError(null) }
}

/** Live microphone levels for the waveform (separate stream from recognition). */
export function useMicLevels(active: boolean) {
  const levels = useRef(new Uint8Array(64))
  useEffect(() => {
    if (!active || !navigator.mediaDevices?.getUserMedia) return
    let stream: MediaStream | null = null
    let ctx: AudioContext | null = null
    let raf = 0
    let cancelled = false
    navigator.mediaDevices
      .getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } })
      .then((s) => {
        if (cancelled) return s.getTracks().forEach((t) => t.stop())
        stream = s
        ctx = new AudioContext()
        const src = ctx.createMediaStreamSource(s)
        const analyser = ctx.createAnalyser()
        analyser.fftSize = 128
        analyser.smoothingTimeConstant = 0.75
        src.connect(analyser)
        const buf = new Uint8Array(analyser.frequencyBinCount)
        const loop = () => {
          analyser.getByteFrequencyData(buf)
          levels.current = buf
          raf = requestAnimationFrame(loop)
        }
        loop()
      })
      .catch(() => {})
    return () => {
      cancelled = true
      cancelAnimationFrame(raf)
      stream?.getTracks().forEach((t) => t.stop())
      ctx?.close().catch(() => {})
      levels.current = new Uint8Array(64)
    }
  }, [active])
  return levels
}

let voicesCache: SpeechSynthesisVoice[] = []
if (typeof speechSynthesis !== 'undefined') {
  voicesCache = speechSynthesis.getVoices()
  speechSynthesis.addEventListener?.('voiceschanged', () => (voicesCache = speechSynthesis.getVoices()))
}

export const ttsSupported = typeof speechSynthesis !== 'undefined'

export function hasVoice(tag: string) {
  const base = tag.split('-')[0]
  return voicesCache.some((v) => v.lang.replace('_', '-').toLowerCase().startsWith(base))
}

/** Speak text aloud, preferring a native voice for the language. */
export function speak(text: string, tag: string, opts: { rate?: number; onEnd?: () => void } = {}) {
  if (!ttsSupported || !text) return false
  speechSynthesis.cancel()
  const u = new SpeechSynthesisUtterance(text)
  u.lang = tag
  const base = tag.split('-')[0]
  const voice =
    voicesCache.find((v) => v.lang.replace('_', '-').toLowerCase() === tag.toLowerCase()) ??
    voicesCache.find((v) => v.lang.toLowerCase().startsWith(base))
  if (voice) u.voice = voice
  u.rate = opts.rate ?? 0.92
  u.volume = 1
  u.onend = () => opts.onEnd?.()
  u.onerror = () => opts.onEnd?.()
  speechSynthesis.speak(u)
  return true
}
