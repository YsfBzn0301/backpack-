/**
 * Native-feeling camera: live getUserMedia viewfinder, flip, torch, grid,
 * shutter with flash + haptic. Browsers can't write to the camera roll
 * directly, so "Save to Photos" hands the JPEG to the OS share sheet
 * (iOS: Save Image · Android: Save to gallery) or downloads it.
 */
import { AnimatePresence, motion } from 'framer-motion'
import { Download, Grid3x3, ImageUp, Loader2, RefreshCcw, ScanLine, Share2, X, Zap, ZapOff } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ui } from '@/lib/ui'
import { haptic } from '@/lib/haptics'

interface Shot {
  id: string
  blob: Blob
  url: string
  file: File
}

const fileName = () => {
  const d = new Date()
  const p = (n: number) => String(n).padStart(2, '0')
  return `Backpack_${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}_${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}.jpg`
}

export async function saveToPhotos(file: File): Promise<'shared' | 'downloaded' | 'cancelled'> {
  const nav = navigator as Navigator & { canShare?: (d: ShareData) => boolean }
  if (nav.canShare?.({ files: [file] })) {
    try {
      await nav.share({ files: [file], title: file.name })
      return 'shared'
    } catch (e) {
      if ((e as Error).name === 'AbortError') return 'cancelled'
    }
  }
  const a = document.createElement('a')
  a.href = URL.createObjectURL(file)
  a.download = file.name
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(a.href), 4000)
  return 'downloaded'
}

/** A short shutter click synthesised with Web Audio (no asset needed). */
function shutterSound() {
  try {
    const ac = new AudioContext()
    const len = ac.sampleRate * 0.05
    const buf = ac.createBuffer(1, len, ac.sampleRate)
    const data = buf.getChannelData(0)
    for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3)
    const src = ac.createBufferSource()
    const gain = ac.createGain()
    gain.gain.value = 0.25
    src.buffer = buf
    src.connect(gain).connect(ac.destination)
    src.start()
    src.onended = () => ac.close()
  } catch {
    /* no audio */
  }
}

export function CameraScreen() {
  const { t } = useTranslation()
  const open = ui.use((s) => s.cameraOpen)
  const video = useRef<HTMLVideoElement>(null)
  const stream = useRef<MediaStream | null>(null)
  const fallbackInput = useRef<HTMLInputElement>(null)
  const [facing, setFacing] = useState<'environment' | 'user'>('environment')
  const [status, setStatus] = useState<'starting' | 'live' | 'denied' | 'unsupported'>('starting')
  const [torch, setTorch] = useState<boolean | null>(null)
  const [grid, setGrid] = useState(false)
  const [flash, setFlash] = useState(0)
  const [shots, setShots] = useState<Shot[]>([])
  const [review, setReview] = useState<Shot | null>(null)
  const [toast, setToast] = useState<string | null>(null)

  const stop = useCallback(() => {
    stream.current?.getTracks().forEach((tr) => tr.stop())
    stream.current = null
  }, [])

  useEffect(() => {
    if (!open) {
      stop()
      return
    }
    if (!navigator.mediaDevices?.getUserMedia) {
      setStatus('unsupported')
      return
    }
    let cancelled = false
    setStatus('starting')
    navigator.mediaDevices
      .getUserMedia({ video: { facingMode: { ideal: facing }, width: { ideal: 3840 }, height: { ideal: 2160 } }, audio: false })
      .then((s) => {
        if (cancelled) return s.getTracks().forEach((tr) => tr.stop())
        stop()
        stream.current = s
        if (video.current) {
          video.current.srcObject = s
          video.current.play().catch(() => {})
        }
        const track = s.getVideoTracks()[0]
        const caps = (track.getCapabilities?.() ?? {}) as MediaTrackCapabilities & { torch?: boolean }
        setTorch(caps.torch ? false : null)
        setStatus('live')
      })
      .catch((e: Error) => setStatus(e.name === 'NotAllowedError' ? 'denied' : 'unsupported'))
    return () => {
      cancelled = true
    }
  }, [open, facing, stop])

  useEffect(() => () => shots.forEach((s) => URL.revokeObjectURL(s.url)), []) // eslint-disable-line react-hooks/exhaustive-deps

  const close = () => {
    stop()
    ui.set({ cameraOpen: false })
    setReview(null)
  }

  const toggleTorch = async () => {
    const track = stream.current?.getVideoTracks()[0]
    if (!track || torch === null) return
    try {
      await track.applyConstraints({ advanced: [{ torch: !torch } as MediaTrackConstraintSet] })
      setTorch(!torch)
    } catch {
      setTorch(null)
    }
  }

  const capture = async () => {
    const v = video.current
    if (!v || status !== 'live') return
    haptic('heavy')
    shutterSound()
    setFlash((f) => f + 1)
    let blob: Blob | null = null
    const track = stream.current?.getVideoTracks()[0]
    // Full-resolution still where ImageCapture exists (Chrome/Android).
    const IC = (window as unknown as { ImageCapture?: new (t: MediaStreamTrack) => { takePhoto(): Promise<Blob> } }).ImageCapture
    if (IC && track) blob = await new IC(track).takePhoto().catch(() => null)
    if (!blob) {
      const c = document.createElement('canvas')
      c.width = v.videoWidth
      c.height = v.videoHeight
      const g = c.getContext('2d')!
      if (facing === 'user') {
        g.translate(c.width, 0)
        g.scale(-1, 1)
      }
      g.drawImage(v, 0, 0)
      blob = await new Promise<Blob | null>((r) => c.toBlob(r, 'image/jpeg', 0.92))
    }
    if (!blob) return
    const file = new File([blob], fileName(), { type: 'image/jpeg' })
    const shot = { id: file.name + Math.random(), blob, url: URL.createObjectURL(blob), file }
    setShots((s) => [shot, ...s].slice(0, 12))
  }

  const save = async (shot: Shot) => {
    const r = await saveToPhotos(shot.file)
    if (r !== 'cancelled') {
      haptic('success')
      setToast(r === 'shared' ? t('camera.savedShare') : t('camera.savedDownload'))
      setTimeout(() => setToast(null), 2600)
    }
  }

  const scan = (shot: Shot) => {
    ui.set({ scanFile: shot.file, scannerOpen: true, cameraOpen: false })
    stop()
  }

  return (
    <AnimatePresence>
      {open && (
        <motion.div className="fixed inset-0 z-[80] flex flex-col bg-black text-white" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} data-no-swipe>
          <div className="relative flex-1 overflow-hidden">
            <video ref={video} playsInline muted autoPlay className={`absolute inset-0 h-full w-full object-cover ${facing === 'user' ? '-scale-x-100' : ''}`} />
            {grid && (
              <div className="pointer-events-none absolute inset-0 grid grid-cols-3 grid-rows-3">
                {Array.from({ length: 9 }).map((_, i) => (
                  <div key={i} className="border border-white/15" />
                ))}
              </div>
            )}
            <AnimatePresence>{flash > 0 && <motion.div key={flash} className="pointer-events-none absolute inset-0 bg-white" initial={{ opacity: 0.85 }} animate={{ opacity: 0 }} transition={{ duration: 0.35 }} />}</AnimatePresence>

            {status !== 'live' && (
              <div className="absolute inset-0 grid place-items-center p-8 text-center">
                {status === 'starting' ? (
                  <Loader2 size={28} className="animate-spin text-white/70" />
                ) : (
                  <div>
                    <p className="text-sm text-white/80">{status === 'denied' ? t('camera.denied') : t('camera.unsupported')}</p>
                    <button onClick={() => fallbackInput.current?.click()} className="mt-4 rounded-full bg-white px-5 py-2.5 text-sm font-semibold text-black">
                      {t('camera.systemCamera')}
                    </button>
                  </div>
                )}
              </div>
            )}

            <div className="safe-top absolute inset-x-0 top-0 flex items-center justify-between px-4 pb-2">
              <button onClick={close} className="grid h-10 w-10 place-items-center rounded-full bg-black/40 backdrop-blur" aria-label={t('common.close')}>
                <X size={20} />
              </button>
              <div className="flex gap-2">
                {torch !== null && (
                  <button onClick={toggleTorch} className={`grid h-10 w-10 place-items-center rounded-full backdrop-blur ${torch ? 'bg-amber-glow text-black' : 'bg-black/40'}`} aria-label={t('camera.torch')}>
                    {torch ? <Zap size={18} /> : <ZapOff size={18} />}
                  </button>
                )}
                <button onClick={() => setGrid((g) => !g)} className={`grid h-10 w-10 place-items-center rounded-full backdrop-blur ${grid ? 'bg-white text-black' : 'bg-black/40'}`} aria-label={t('camera.grid')}>
                  <Grid3x3 size={18} />
                </button>
              </div>
            </div>

            <AnimatePresence>
              {toast && (
                <motion.div className="absolute inset-x-0 top-20 flex justify-center" initial={{ y: -10, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ opacity: 0 }}>
                  <span className="rounded-full bg-black/70 px-4 py-2 text-xs backdrop-blur">{toast}</span>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          <div className="safe-bottom flex items-center justify-between bg-black px-8 pt-5">
            <button onClick={() => shots[0] && setReview(shots[0])} className="h-12 w-12 overflow-hidden rounded-xl bg-white/10 ring-2 ring-white/20" aria-label={t('camera.lastShot')}>
              {shots[0] && <motion.img key={shots[0].id} src={shots[0].url} alt="" className="h-full w-full object-cover" initial={{ scale: 1.4 }} animate={{ scale: 1 }} />}
            </button>
            <motion.button whileTap={{ scale: 0.88 }} onClick={capture} disabled={status !== 'live'} className="grid h-[76px] w-[76px] place-items-center rounded-full border-4 border-white disabled:opacity-40" aria-label={t('camera.shutter')}>
              <span className="h-[60px] w-[60px] rounded-full bg-white" />
            </motion.button>
            <button
              onClick={() => {
                haptic('select')
                setFacing((f) => (f === 'environment' ? 'user' : 'environment'))
              }}
              className="grid h-12 w-12 place-items-center rounded-full bg-white/10"
              aria-label={t('camera.flip')}
            >
              <RefreshCcw size={20} />
            </button>
          </div>
          <p className="bg-black px-6 pt-3 pb-2 text-center text-[10px] text-white/50">{t('camera.galleryNote')}</p>

          <input
            ref={fallbackInput}
            type="file"
            accept="image/*"
            capture="environment"
            hidden
            onChange={(e) => {
              const f = e.target.files?.[0]
              e.target.value = ''
              if (!f) return
              const shot = { id: f.name + Math.random(), blob: f, url: URL.createObjectURL(f), file: f }
              setShots((s) => [shot, ...s])
              setReview(shot)
            }}
          />

          <AnimatePresence>
            {review && (
              <motion.div className="absolute inset-0 z-10 flex flex-col bg-black" initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }}>
                <div className="safe-top flex items-center justify-between px-4 pb-2">
                  <button onClick={() => setReview(null)} className="grid h-10 w-10 place-items-center rounded-full bg-white/10" aria-label={t('common.back')}>
                    <X size={20} />
                  </button>
                  <span className="text-xs text-white/60">{review.file.name}</span>
                  <span className="w-10" />
                </div>
                <div className="flex-1 overflow-hidden p-3">
                  <img src={review.url} alt="" className="h-full w-full rounded-2xl object-contain" />
                </div>
                <div className="no-scrollbar flex gap-2 overflow-x-auto px-4 pb-3">
                  {shots.map((s) => (
                    <button key={s.id} onClick={() => setReview(s)} className={`h-14 w-14 shrink-0 overflow-hidden rounded-lg ${s.id === review.id ? 'ring-2 ring-white' : 'opacity-60'}`}>
                      <img src={s.url} alt="" className="h-full w-full object-cover" />
                    </button>
                  ))}
                </div>
                <div className="safe-bottom grid grid-cols-3 gap-2 px-4">
                  <button onClick={() => save(review)} className="flex flex-col items-center gap-1 rounded-2xl bg-white py-3 text-xs font-semibold text-black">
                    {(navigator as Navigator & { canShare?: unknown }).canShare ? <Share2 size={18} /> : <Download size={18} />}
                    {t('camera.save')}
                  </button>
                  <button onClick={() => scan(review)} className="flex flex-col items-center gap-1 rounded-2xl bg-white/10 py-3 text-xs font-medium">
                    <ScanLine size={18} /> {t('camera.scanPrices')}
                  </button>
                  <button onClick={() => fallbackInput.current?.click()} className="flex flex-col items-center gap-1 rounded-2xl bg-white/10 py-3 text-xs font-medium">
                    <ImageUp size={18} /> {t('camera.systemCamera')}
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
