/**
 * 3D album cover flow (React Three Fiber). Covers sit on a curved rail with
 * soft floor reflections; drag, tap or use arrow keys to browse.
 */
import { Canvas, useFrame } from '@react-three/fiber'
import { useEffect, useMemo, useRef, useState } from 'react'
import * as THREE from 'three'
import type { Track } from '@/services/audio'

const SIZE = 1.6

/** Gradient placeholder when artwork is missing or blocked by CORS. */
function placeholderTexture(track: Track) {
  const c = document.createElement('canvas')
  c.width = c.height = 256
  const g = c.getContext('2d')!
  let h = 0
  for (const ch of track.artist + track.title) h = (h * 31 + ch.charCodeAt(0)) % 360
  const grad = g.createLinearGradient(0, 0, 256, 256)
  grad.addColorStop(0, `hsl(${h} 55% 32%)`)
  grad.addColorStop(1, `hsl(${(h + 50) % 360} 60% 14%)`)
  g.fillStyle = grad
  g.fillRect(0, 0, 256, 256)
  g.fillStyle = 'rgba(255,255,255,0.88)'
  g.font = '600 92px system-ui, sans-serif'
  g.textAlign = 'center'
  g.textBaseline = 'middle'
  g.fillText((track.title[0] ?? '♪').toUpperCase(), 128, 120)
  g.font = '500 20px system-ui, sans-serif'
  g.fillStyle = 'rgba(255,255,255,0.6)'
  g.fillText(track.artist.slice(0, 22), 128, 200)
  const tex = new THREE.CanvasTexture(c)
  tex.colorSpace = THREE.SRGBColorSpace
  return tex
}

let reflectionMask: THREE.Texture | null = null
function getReflectionMask() {
  if (reflectionMask) return reflectionMask
  const c = document.createElement('canvas')
  c.width = 4
  c.height = 128
  const g = c.getContext('2d')!
  const grad = g.createLinearGradient(0, 0, 0, 128)
  grad.addColorStop(0, '#000')
  grad.addColorStop(1, '#555')
  g.fillStyle = grad
  g.fillRect(0, 0, 4, 128)
  reflectionMask = new THREE.CanvasTexture(c)
  return reflectionMask
}

function useCoverTexture(track: Track) {
  const [tex, setTex] = useState<THREE.Texture>(() => placeholderTexture(track))
  useEffect(() => {
    if (!track.artwork) return
    let alive = true
    const loader = new THREE.TextureLoader()
    loader.setCrossOrigin('anonymous')
    loader.load(
      track.artwork,
      (t) => {
        if (!alive) return t.dispose()
        t.colorSpace = THREE.SRGBColorSpace
        t.anisotropy = 4
        setTex(t)
      },
      undefined,
      () => {},
    )
    return () => {
      alive = false
    }
  }, [track.artwork])
  useEffect(() => () => tex.dispose(), [tex])
  return tex
}

function Cover({ track, index, pos, onPick }: { track: Track; index: number; pos: React.RefObject<number>; onPick: (i: number) => void }) {
  const group = useRef<THREE.Group>(null)
  const front = useRef<THREE.MeshBasicMaterial>(null)
  const back = useRef<THREE.MeshBasicMaterial>(null)
  const tex = useCoverTexture(track)
  const mask = useMemo(getReflectionMask, [])

  useFrame(() => {
    const g = group.current
    if (!g) return
    const d = index - pos.current
    const a = Math.abs(d)
    const s = Math.sign(d)
    // Centre cover faces the camera; neighbours turn ~60° and stack tighter.
    const x = a < 1 ? d * 1.35 : s * (1.35 + (a - 1) * 0.5)
    const z = -Math.min(a, 1) * 0.9 - Math.max(0, a - 1) * 0.08
    const ry = -Math.max(-1, Math.min(1, d)) * 1.05
    g.position.set(x, 0, z)
    g.rotation.y = ry
    const opacity = Math.max(0, Math.min(1, 1 - (a - 2.5) * 0.6))
    if (front.current) front.current.opacity = opacity
    if (back.current) back.current.opacity = opacity * 0.32
    g.visible = opacity > 0.01
  })

  return (
    <group
      ref={group}
      onClick={(e) => {
        e.stopPropagation()
        onPick(index)
      }}
    >
      <mesh>
        <planeGeometry args={[SIZE, SIZE]} />
        <meshBasicMaterial ref={front} map={tex} transparent toneMapped={false} />
      </mesh>
      <mesh position={[0, -SIZE - 0.02, 0]} scale={[1, -1, 1]}>
        <planeGeometry args={[SIZE, SIZE]} />
        <meshBasicMaterial ref={back} map={tex} alphaMap={mask} transparent toneMapped={false} depthWrite={false} />
      </mesh>
    </group>
  )
}

function Rail({ tracks, target, onPick }: { tracks: Track[]; target: React.RefObject<number>; onPick: (i: number) => void }) {
  const pos = useRef(target.current)
  useFrame((_, dt) => {
    // Critically-damped follow of the target index.
    pos.current += (target.current - pos.current) * (1 - Math.exp(-dt * 9))
  })
  return (
    <group position={[0, 0.45, 0]}>
      {tracks.map((t, i) => (
        <Cover key={t.id} track={t} index={i} pos={pos} onPick={onPick} />
      ))}
    </group>
  )
}

export function CoverFlow3D({ tracks, active, onChange }: { tracks: Track[]; active: number; onChange: (i: number) => void }) {
  const target = useRef(active)
  const drag = useRef<{ x: number; start: number; moved: boolean } | null>(null)

  useEffect(() => {
    target.current = active
  }, [active])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement)?.tagName === 'INPUT') return
      if (e.key === 'ArrowRight') onChange(Math.min(tracks.length - 1, active + 1))
      if (e.key === 'ArrowLeft') onChange(Math.max(0, active - 1))
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [active, tracks.length, onChange])

  const clamp = (v: number) => Math.max(0, Math.min(tracks.length - 1, v))

  return (
    <div
      className="relative h-64 w-full cursor-grab touch-pan-y select-none active:cursor-grabbing"
      data-no-swipe
      onPointerDown={(e) => (drag.current = { x: e.clientX, start: active, moved: false })}
      onPointerMove={(e) => {
        const d = drag.current
        if (!d) return
        const dx = e.clientX - d.x
        if (Math.abs(dx) > 6) d.moved = true
        target.current = clamp(d.start - dx / 110)
      }}
      onPointerUp={() => {
        const d = drag.current
        drag.current = null
        if (d?.moved) onChange(Math.round(target.current))
      }}
      onPointerLeave={() => {
        if (drag.current?.moved) onChange(Math.round(target.current))
        drag.current = null
      }}
    >
      <Canvas dpr={[1, 2]} camera={{ fov: 38, position: [0, 0.15, 4.6] }} gl={{ antialias: true, alpha: true }}>
        <Rail tracks={tracks} target={target} onPick={(i) => !drag.current?.moved && onChange(i)} />
      </Canvas>
    </div>
  )
}

export function hasWebGL() {
  try {
    const c = document.createElement('canvas')
    return Boolean(c.getContext('webgl2') ?? c.getContext('webgl'))
  } catch {
    return false
  }
}
