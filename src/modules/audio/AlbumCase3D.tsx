/**
 * WebGL album sleeve for TrackMatchModal (lazy-loaded): a thin box with the
 * artwork on a clear-coated front, dark edges and back, and a vinyl record
 * sliding out of the open edge. Motion comes from the shared CaseMotion.
 */
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { useEffect, useMemo, useRef, useState } from 'react'
import * as THREE from 'three'
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js'
import type { Track } from '@/services/audio'
import type { CaseMotion } from './caseMotion'
import { initials, trackHue, corsArtUrl } from './trackMatch'

const W = 2
const D = 0.07
const DISC_R = 0.93
/** How far the record slides out of the sleeve (scene units). */
const SLIDE = 0.72

function placeholderTexture(track: Track) {
  const c = document.createElement('canvas')
  c.width = c.height = 512
  const g = c.getContext('2d')!
  const h = trackHue(track)
  const grad = g.createLinearGradient(0, 0, 512, 512)
  grad.addColorStop(0, `hsl(${h} 70% 46%)`)
  grad.addColorStop(0.55, `hsl(${(h + 40) % 360} 62% 26%)`)
  grad.addColorStop(1, `hsl(${(h + 80) % 360} 55% 12%)`)
  g.fillStyle = grad
  g.fillRect(0, 0, 512, 512)
  // Soft light bloom + fine grain so it reads as printed, not flat.
  const bloom = g.createRadialGradient(150, 120, 10, 150, 120, 380)
  bloom.addColorStop(0, 'rgba(255,255,255,0.28)')
  bloom.addColorStop(1, 'rgba(255,255,255,0)')
  g.fillStyle = bloom
  g.fillRect(0, 0, 512, 512)
  for (let i = 0; i < 2400; i++) {
    g.fillStyle = `rgba(255,255,255,${Math.random() * 0.05})`
    g.fillRect(Math.random() * 512, Math.random() * 512, 1.5, 1.5)
  }
  g.fillStyle = 'rgba(255,255,255,0.94)'
  g.font = '700 190px system-ui, -apple-system, sans-serif'
  g.textAlign = 'left'
  g.textBaseline = 'alphabetic'
  g.fillText(initials(track), 40, 470)
  g.font = '600 26px system-ui, -apple-system, sans-serif'
  g.fillStyle = 'rgba(255,255,255,0.7)'
  g.fillText(track.artist.toUpperCase().slice(0, 26), 44, 70)
  const tex = new THREE.CanvasTexture(c)
  tex.colorSpace = THREE.SRGBColorSpace
  return tex
}

function grooveTexture() {
  const c = document.createElement('canvas')
  c.width = c.height = 512
  const g = c.getContext('2d')!
  g.fillStyle = '#0b0c0e'
  g.fillRect(0, 0, 512, 512)
  for (let r = 250; r > 90; r -= 2.2) {
    g.strokeStyle = `rgba(255,255,255,${0.04 + Math.random() * 0.05})`
    g.lineWidth = 1
    g.beginPath()
    g.arc(256, 256, r, 0, Math.PI * 2)
    g.stroke()
  }
  // Two bands of sheen, like light catching the grooves.
  const sheen = g.createConicGradient(0.6, 256, 256)
  sheen.addColorStop(0, 'rgba(255,255,255,0)')
  sheen.addColorStop(0.08, 'rgba(255,255,255,0.12)')
  sheen.addColorStop(0.16, 'rgba(255,255,255,0)')
  sheen.addColorStop(0.5, 'rgba(255,255,255,0)')
  sheen.addColorStop(0.58, 'rgba(255,255,255,0.1)')
  sheen.addColorStop(0.66, 'rgba(255,255,255,0)')
  g.fillStyle = sheen
  g.beginPath()
  g.arc(256, 256, 252, 0, Math.PI * 2)
  g.fill()
  const tex = new THREE.CanvasTexture(c)
  tex.colorSpace = THREE.SRGBColorSpace
  return tex
}

function shadowTexture() {
  const c = document.createElement('canvas')
  c.width = c.height = 128
  const g = c.getContext('2d')!
  const grad = g.createRadialGradient(64, 64, 0, 64, 64, 64)
  grad.addColorStop(0, 'rgba(0,0,0,0.55)')
  grad.addColorStop(0.6, 'rgba(0,0,0,0.18)')
  grad.addColorStop(1, 'rgba(0,0,0,0)')
  g.fillStyle = grad
  g.fillRect(0, 0, 128, 128)
  return new THREE.CanvasTexture(c)
}

/** Artwork texture (CORS-anonymous); the generated placeholder until/unless it loads. */
function useArtwork(track: Track, onFail?: () => void) {
  const failRef = useRef(onFail)
  failRef.current = onFail
  const placeholder = useMemo(() => placeholderTexture(track), [track])
  const [art, setArt] = useState<THREE.Texture | null>(null)
  useEffect(() => {
    setArt(null)
    if (!track.artwork) return
    let alive = true
    const loader = new THREE.TextureLoader()
    loader.setCrossOrigin('anonymous')
    loader.load(
      corsArtUrl(track.artwork),
      (t) => {
        if (!alive) return t.dispose()
        t.colorSpace = THREE.SRGBColorSpace
        t.anisotropy = 8
        setArt(t)
      },
      undefined,
      () => {
        // Host refused CORS (or 404): let the modal switch to the <img>-based sleeve.
        if (alive) failRef.current?.()
      },
    )
    return () => {
      alive = false
    }
  }, [track.artwork])
  useEffect(() => () => art?.dispose(), [art])
  useEffect(() => () => placeholder.dispose(), [placeholder])
  return art ?? placeholder
}

function Environment() {
  const { gl, scene } = useThree()
  useEffect(() => {
    const pmrem = new THREE.PMREMGenerator(gl)
    const env = pmrem.fromScene(new RoomEnvironment(), 0.04).texture
    scene.environment = env
    scene.environmentIntensity = 0.55
    return () => {
      scene.environment = null
      env.dispose()
      pmrem.dispose()
    }
  }, [gl, scene])
  return null
}

function Sleeve({ track, motion, onArtFail }: { track: Track; motion: CaseMotion; onArtFail?: () => void }) {
  const group = useRef<THREE.Group>(null)
  const disc = useRef<THREE.Group>(null)
  const spin = useRef<THREE.Group>(null)
  const shadow = useRef<THREE.Mesh>(null)
  const tex = useArtwork(track, onArtFail)
  const grooves = useMemo(grooveTexture, [])
  const shadowTex = useMemo(shadowTexture, [])
  const slide = useRef(motion.reduced ? SLIDE : 0)
  const clock = useRef(0)
  useEffect(
    () => () => {
      grooves.dispose()
      shadowTex.dispose()
    },
    [grooves, shadowTex],
  )

  useFrame((_, dt) => {
    const pose = motion.step(dt)
    clock.current += dt
    const g = group.current
    if (g) {
      g.rotation.set(pose.rx, pose.ry, 0)
      g.position.y = 0.05 + Math.sin(clock.current * 1.6) * (motion.reduced ? 0.02 : 0.09)
    }
    // The record eases out of the sleeve shortly after the modal opens.
    if (!motion.reduced && clock.current > 0.35) slide.current += (SLIDE - slide.current) * (1 - Math.exp(-dt * 3.2))
    if (disc.current) disc.current.position.x = slide.current
    if (spin.current) spin.current.rotation.z -= dt * (motion.reduced ? 0.4 : 1.8)
    if (shadow.current) {
      // Shadow narrows as the sleeve turns edge-on.
      const m = shadow.current.material as THREE.MeshBasicMaterial
      shadow.current.scale.x = 0.55 + Math.abs(Math.cos(pose.ry)) * 0.75
      m.opacity = 0.75 - (g ? g.position.y : 0) * 2
    }
  })

  return (
    <>
      <group ref={group}>
        <group position={[-SLIDE / 2, 0, 0]}>
          <mesh>
            <boxGeometry args={[W, W, D]} />
            {/* +x, -x, +y, -y edges; +z front; -z back */}
            <meshStandardMaterial attach="material-0" color="#0e1014" roughness={0.5} metalness={0.25} />
            <meshStandardMaterial attach="material-1" color="#0e1014" roughness={0.5} metalness={0.25} />
            <meshStandardMaterial attach="material-2" color="#14171c" roughness={0.5} metalness={0.25} />
            <meshStandardMaterial attach="material-3" color="#0a0b0e" roughness={0.5} metalness={0.25} />
            <meshPhysicalMaterial attach="material-4" map={tex} roughness={0.42} metalness={0} clearcoat={1} clearcoatRoughness={0.16} />
            <meshPhysicalMaterial attach="material-5" map={tex} color="#2b2d33" roughness={0.7} clearcoat={0.4} clearcoatRoughness={0.4} />
          </mesh>
          <group ref={disc} position={[0, 0, 0]}>
            <group ref={spin}>
              <mesh rotation={[Math.PI / 2, 0, 0]}>
                <cylinderGeometry args={[DISC_R, DISC_R, 0.018, 96, 1]} />
                <meshStandardMaterial attach="material-0" color="#08090b" roughness={0.35} metalness={0.4} />
                <meshPhysicalMaterial attach="material-1" map={grooves} roughness={0.32} metalness={0.3} clearcoat={0.8} clearcoatRoughness={0.2} />
                <meshPhysicalMaterial attach="material-2" map={grooves} roughness={0.32} metalness={0.3} clearcoat={0.8} clearcoatRoughness={0.2} />
              </mesh>
              {[1, -1].map((s) => (
                <mesh key={s} position={[0, 0, s * 0.0105]} rotation={[0, s < 0 ? Math.PI : 0, 0]}>
                  <circleGeometry args={[0.31, 64]} />
                  <meshStandardMaterial map={tex} roughness={0.6} />
                </mesh>
              ))}
            </group>
          </group>
        </group>
      </group>
      <mesh ref={shadow} position={[0, -1.32, -0.2]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[3.2, 1.1]} />
        <meshBasicMaterial map={shadowTex} transparent depthWrite={false} opacity={0.75} />
      </mesh>
    </>
  )
}

export default function AlbumCase3D({ track, motion, accent, onArtFail }: { track: Track; motion: CaseMotion; accent: string; onArtFail?: () => void }) {
  return (
    <Canvas
      dpr={[1, 2]}
      camera={{ fov: 30, position: [0, 0.1, 6.4] }}
      gl={{ antialias: true, alpha: true, toneMapping: THREE.NeutralToneMapping }}
      style={{ touchAction: 'none' }}
      aria-hidden
    >
      <Environment />
      <ambientLight intensity={0.35} />
      <directionalLight position={[-2.5, 3, 4]} intensity={2.1} />
      <directionalLight position={[3, -1, -3]} intensity={1.1} color={accent} />
      <pointLight position={[3.5, 2.5, 4]} intensity={3} distance={12} color="#ffffff" />
      <Sleeve track={track} motion={motion} onArtFail={onArtFail} />
    </Canvas>
  )
}
