/**
 * Shared motion model for the album case in TrackMatchModal: pointer drag with
 * inertia, a spring back to a gently idling rest pose, and device tilt. Both
 * the WebGL case and the CSS fallback read it once per frame via `step`.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { tiltFromOrientation } from './trackMatch'

export interface CasePose {
  rx: number
  ry: number
}

export interface CaseMotion {
  /** Advance the simulation; returns the current pose (radians). */
  step: (dt: number) => CasePose
  /** Pointer handlers for the stage element. */
  bind: {
    onPointerDown: (e: React.PointerEvent<HTMLElement>) => void
    onPointerMove: (e: React.PointerEvent<HTMLElement>) => void
    onPointerUp: (e: React.PointerEvent<HTMLElement>) => void
    onPointerCancel: (e: React.PointerEvent<HTMLElement>) => void
  }
  reduced: boolean
}

const TAU = Math.PI * 2
const K = 16 // spring stiffness
const C = 5.2 // damping (slightly under-damped: a soft settle)

export function useCaseMotion(tilt: React.RefObject<{ x: number; y: number }>, reduced: boolean): CaseMotion {
  const s = useRef({ rx: -0.08, ry: reduced ? 0 : -0.5, vx: 0, vy: reduced ? 0 : 2.2, time: 0, drag: null as null | { x: number; y: number; t: number; id: number } })

  const step = useCallback(
    (dtIn: number) => {
      const st = s.current
      const dt = Math.min(dtIn, 1 / 30)
      st.time += dt
      if (st.drag) return st
      const g = tilt.current ?? { x: 0, y: 0 }
      // Keeps the sleeve visibly turning: about ±34° every ~6 s, with a slow nod.
      const idleY = reduced ? Math.sin(st.time * 0.4) * 0.14 : Math.sin(st.time * 1.05) * 0.6 + Math.sin(st.time * 0.37) * 0.12
      const idleX = reduced ? -0.04 : -0.06 + Math.sin(st.time * 0.8) * 0.14
      let ty = idleY + g.y * 0.65
      const tx = idleX + g.x * 0.45
      // Settle on the nearest front-facing turn so a hard flick doesn't rewind.
      ty += Math.round((st.ry - ty) / TAU) * TAU
      st.vy += (K * (ty - st.ry) - C * st.vy) * dt
      st.vx += (K * (tx - st.rx) - C * st.vx) * dt
      st.ry += st.vy * dt
      st.rx += st.vx * dt
      return st
    },
    [tilt, reduced],
  )

  const bind = useMemo<CaseMotion['bind']>(() => {
    const end = (e: React.PointerEvent<HTMLElement>) => {
      const st = s.current
      if (!st.drag || st.drag.id !== e.pointerId) return
      // A pause before release kills the fling.
      if (performance.now() - st.drag.t > 90) st.vx = st.vy = 0
      st.drag = null
    }
    return {
      onPointerDown: (e) => {
        // Keep the dialog's swipe-to-dismiss from starting on the stage.
        e.stopPropagation()
        try {
          e.currentTarget.setPointerCapture(e.pointerId)
        } catch {
          /* synthetic events */
        }
        const st = s.current
        st.drag = { x: e.clientX, y: e.clientY, t: performance.now(), id: e.pointerId }
        st.vx = st.vy = 0
      },
      onPointerMove: (e) => {
        const st = s.current
        const d = st.drag
        if (!d || d.id !== e.pointerId) return
        const now = performance.now()
        const dt = Math.max(8, now - d.t) / 1000
        const dy = (e.clientX - d.x) * 0.011
        const dx = (e.clientY - d.y) * 0.008
        st.ry += dy
        st.rx = Math.max(-0.9, Math.min(0.9, st.rx + dx))
        // Low-pass the velocity so the fling feels like the last few frames.
        st.vy = st.vy * 0.4 + (dy / dt) * 0.6
        st.vx = st.vx * 0.4 + (dx / dt) * 0.6
        st.drag = { ...d, x: e.clientX, y: e.clientY, t: now }
      },
      onPointerUp: end,
      onPointerCancel: end,
    }
  }, [])

  return useMemo(() => ({ step, bind, reduced }), [step, bind, reduced])
}

export type TiltStatus = 'off' | 'on' | 'denied' | 'unavailable'

type OrientationCtor = typeof DeviceOrientationEvent & { requestPermission?: () => Promise<'granted' | 'denied'> }

export const tiltSupported = () => typeof window !== 'undefined' && 'DeviceOrientationEvent' in window

/**
 * Device-orientation tilt. `toggle` must run inside a tap: iOS 13+ only
 * grants motion access from a user gesture.
 */
export function useTilt() {
  const tilt = useRef({ x: 0, y: 0 })
  const [status, setStatus] = useState<TiltStatus>('off')

  useEffect(() => {
    if (status !== 'on') {
      tilt.current = { x: 0, y: 0 }
      return
    }
    let base: { beta: number; gamma: number } | null = null
    let seen = false
    const onOrient = (e: DeviceOrientationEvent) => {
      if (e.beta == null || e.gamma == null) return
      seen = true
      base ??= { beta: e.beta, gamma: e.gamma }
      const next = tiltFromOrientation(e.beta, e.gamma, base)
      // Smooth sensor jitter.
      tilt.current = { x: tilt.current.x * 0.7 + next.x * 0.3, y: tilt.current.y * 0.7 + next.y * 0.3 }
    }
    window.addEventListener('deviceorientation', onOrient)
    // Desktop browsers expose the event but never fire it.
    const probe = setTimeout(() => !seen && setStatus('unavailable'), 1500)
    return () => {
      clearTimeout(probe)
      window.removeEventListener('deviceorientation', onOrient)
    }
  }, [status])

  const toggle = useCallback(async (): Promise<TiltStatus> => {
    if (status === 'on') {
      setStatus('off')
      return 'off'
    }
    if (!tiltSupported()) {
      setStatus('unavailable')
      return 'unavailable'
    }
    const Ctor = window.DeviceOrientationEvent as OrientationCtor
    if (typeof Ctor.requestPermission === 'function') {
      try {
        const r = await Ctor.requestPermission()
        const next: TiltStatus = r === 'granted' ? 'on' : 'denied'
        setStatus(next)
        return next
      } catch {
        setStatus('denied')
        return 'denied'
      }
    }
    setStatus('on')
    return 'on'
  }, [status])

  return { tilt, status, toggle }
}
