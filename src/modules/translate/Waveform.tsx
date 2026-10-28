import { useEffect, useRef } from 'react'

/** Canvas waveform. Mirrors mic levels into rounded bars; idles with a soft breathing line. */
export function Waveform({ levels, active, color = '#ff6b4a', className = 'h-16 w-full' }: { levels: React.RefObject<Uint8Array>; active: boolean; color?: string; className?: string }) {
  const ref = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    const c = ref.current
    if (!c) return
    const ctx = c.getContext('2d')!
    let raf = 0
    const start = performance.now()
    const draw = () => {
      const dpr = window.devicePixelRatio || 1
      const w = c.clientWidth
      const h = c.clientHeight
      if (c.width !== w * dpr) {
        c.width = w * dpr
        c.height = h * dpr
      }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      ctx.clearRect(0, 0, w, h)
      const bars = 36
      const gap = 3
      const bw = (w - gap * (bars - 1)) / bars
      // Not laid out yet (or too narrow): try again next frame.
      if (bw <= 0.5) {
        raf = requestAnimationFrame(draw)
        return
      }
      const data = levels.current
      const t = (performance.now() - start) / 1000
      for (let i = 0; i < bars; i++) {
        // Fold the spectrum so the centre is loudest.
        const mid = Math.abs(i - bars / 2) / (bars / 2)
        const idx = Math.floor((1 - mid) * (data.length * 0.6))
        const v = active ? (data[idx] ?? 0) / 255 : 0
        const idle = 0.08 + 0.05 * Math.sin(t * 2.2 + i * 0.45)
        const amp = Math.max(idle, v * (1 - mid * 0.4))
        const bh = Math.max(3, amp * h)
        ctx.fillStyle = color
        ctx.globalAlpha = active ? 0.35 + amp * 0.65 : 0.25
        const x = i * (bw + gap)
        const y = (h - bh) / 2
        ctx.beginPath()
        ctx.roundRect(x, y, bw, bh, bw / 2)
        ctx.fill()
      }
      raf = requestAnimationFrame(draw)
    }
    draw()
    return () => cancelAnimationFrame(raf)
  }, [levels, active, color])
  return <canvas ref={ref} className={className} aria-hidden />
}
