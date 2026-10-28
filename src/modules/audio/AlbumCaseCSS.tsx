/**
 * CSS 3D album sleeve for TrackMatchModal when WebGL is missing (and while the
 * WebGL chunk loads). A real six-faced box with a vinyl record sliding out of
 * the open edge, driven by the same CaseMotion as the WebGL version.
 */
import { motion as m } from 'framer-motion'
import { useEffect, useRef, useState } from 'react'
import type { Track } from '@/services/audio'
import type { CaseMotion } from './caseMotion'
import { initials, trackHue } from './trackMatch'

const S = 188 // sleeve size, px
const D = 8 // sleeve depth, px
const SLIDE = S * 0.36 // how far the record slides out, px

export function ArtworkPlaceholder({ track, className = '' }: { track: Track; className?: string }) {
  const h = trackHue(track)
  return (
    <div
      className={`relative h-full w-full overflow-hidden ${className}`}
      style={{ background: `radial-gradient(120% 90% at 25% 15%, hsl(${h} 72% 52% / .9), transparent 60%), linear-gradient(135deg, hsl(${h} 70% 42%), hsl(${(h + 40) % 360} 62% 24%) 55%, hsl(${(h + 80) % 360} 55% 11%))` }}
    >
      <span className="absolute top-3 left-3.5 max-w-[85%] truncate text-[10px] font-semibold tracking-[0.14em] text-white/70 uppercase">{track.artist}</span>
      <span className="absolute bottom-1 left-3 text-[72px] leading-none font-bold tracking-tight text-white/95">{initials(track)}</span>
    </div>
  )
}

function Art({ track }: { track: Track }) {
  const [failed, setFailed] = useState(false)
  if (!track.artwork || failed) return <ArtworkPlaceholder track={track} />
  return <img src={track.artwork} alt="" draggable={false} className="h-full w-full object-cover" onError={() => setFailed(true)} />
}

export function AlbumCaseCSS({ track, motion }: { track: Track; motion: CaseMotion }) {
  const box = useRef<HTMLDivElement>(null)
  const sheen = useRef<HTMLDivElement>(null)

  useEffect(() => {
    let raf = 0
    let last = performance.now()
    const loop = (now: number) => {
      const pose = motion.step((now - last) / 1000)
      last = now
      if (box.current) box.current.style.transform = `translateY(${Math.sin(now / 625) * (motion.reduced ? 2 : 7)}px) rotateX(${-pose.rx}rad) rotateY(${pose.ry}rad)`
      // Light sweeps across the front as it turns.
      if (sheen.current) sheen.current.style.backgroundPosition = `${50 + Math.sin(pose.ry) * 60}% ${50 + Math.sin(pose.rx) * 40}%`
      raf = requestAnimationFrame(loop)
    }
    raf = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(raf)
  }, [motion])

  const face = 'absolute [backface-visibility:hidden]'
  const edge = 'bg-[#101216]'
  return (
    <div className="grid h-full w-full place-items-center" style={{ perspective: 900 }}>
      <div className="relative" style={{ width: S, height: S, transform: `translateX(${-SLIDE / 2}px)`, transformStyle: 'preserve-3d' }}>
        <div ref={box} className="absolute inset-0" style={{ transformStyle: 'preserve-3d' }}>
          {/* Record, between the faces so it emerges from the open edge */}
          <m.div
            className="absolute rounded-full"
            style={{
              width: S - 12,
              height: S - 12,
              left: 6,
              top: 6,
              background: 'repeating-radial-gradient(circle, #0b0c0e 0 1.5px, #16181c 1.5px 3px)',
              boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.05)',
            }}
            initial={{ x: motion.reduced ? SLIDE : 0 }}
            animate={{ x: SLIDE }}
            transition={{ delay: motion.reduced ? 0 : 0.35, type: 'spring', stiffness: 60, damping: 16 }}
          >
            <div className="absolute inset-0 rounded-full" style={{ background: 'conic-gradient(from 30deg, transparent 0 8%, rgba(255,255,255,.1) 12%, transparent 18% 50%, rgba(255,255,255,.08) 62%, transparent 68%)' }} />
            <div className={`absolute inset-[34%] overflow-hidden rounded-full ring-1 ring-black/40 ${motion.reduced ? '' : 'animate-[spin_14s_linear_infinite]'}`}>
              <Art track={track} />
            </div>
          </m.div>
          {/* Front */}
          <div className={`${face} inset-0 overflow-hidden rounded-[3px]`} style={{ transform: `translateZ(${D / 2}px)` }}>
            <Art track={track} />
            <div
              ref={sheen}
              className="pointer-events-none absolute inset-0 mix-blend-soft-light"
              style={{ backgroundImage: 'linear-gradient(115deg, transparent 30%, rgba(255,255,255,.55) 48%, transparent 62%)', backgroundSize: '220% 220%' }}
            />
            <div className="pointer-events-none absolute inset-0 rounded-[3px] ring-1 ring-white/10 ring-inset" />
          </div>
          {/* Back */}
          <div className={`${face} inset-0 overflow-hidden rounded-[3px] ${edge}`} style={{ transform: `rotateY(180deg) translateZ(${D / 2}px)` }}>
            <div className="absolute inset-0 opacity-20 blur-[1px] grayscale">
              <Art track={track} />
            </div>
          </div>
          {/* Edges */}
          <div className={`${face} top-0 ${edge}`} style={{ width: D, height: S, left: S / 2 - D / 2, transform: `rotateY(90deg) translateZ(${S / 2}px)` }} />
          <div className={`${face} top-0 ${edge}`} style={{ width: D, height: S, left: S / 2 - D / 2, transform: `rotateY(-90deg) translateZ(${S / 2}px)` }} />
          <div className={`${face} left-0 bg-[#16191e]`} style={{ width: S, height: D, top: S / 2 - D / 2, transform: `rotateX(90deg) translateZ(${S / 2}px)` }} />
          <div className={`${face} left-0 bg-[#0a0b0e]`} style={{ width: S, height: D, top: S / 2 - D / 2, transform: `rotateX(-90deg) translateZ(${S / 2}px)` }} />
        </div>
        <div className="pointer-events-none absolute -bottom-9 left-1/2 h-8 w-[130%] rounded-[50%] bg-black/45 blur-xl" style={{ transform: 'translateX(-50%) translateZ(-60px)' }} />
      </div>
    </div>
  )
}
