import { Minus, Plus } from 'lucide-react'
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'

/**
 * Lightweight slippy map (no SDK) on OpenStreetMap tiles (no key needed; dark theme uses a CSS filter).
 * Supports drag-to-pan, wheel / button zoom and positioned overlays.
 */
// Turns the light OSM style into a dark map that matches the app.
const DARK_TILES = 'invert(1) hue-rotate(180deg) brightness(0.9) contrast(0.85) saturate(0.6)'

export interface Overlay {
  key: string
  lat: number
  lng: number
  node: ReactNode
}

const TILE = 256
const clampLat = (lat: number) => Math.max(-85, Math.min(85, lat))
const project = (lat: number, lng: number, z: number) => {
  const s = TILE * 2 ** z
  const sin = Math.sin((clampLat(lat) * Math.PI) / 180)
  return { x: ((lng + 180) / 360) * s, y: (0.5 - Math.log((1 + sin) / (1 - sin)) / (4 * Math.PI)) * s }
}
const unproject = (x: number, y: number, z: number) => {
  const s = TILE * 2 ** z
  const lng = (x / s) * 360 - 180
  const n = Math.PI - (2 * Math.PI * y) / s
  return { lat: (180 / Math.PI) * Math.atan(0.5 * (Math.exp(n) - Math.exp(-n))), lng }
}

export function TileMap({
  center,
  zoom: initialZoom = 15,
  overlays,
  radius,
  onBackgroundClick,
  recenterKey,
  theme = 'dark',
}: {
  center: { lat: number; lng: number }
  zoom?: number
  overlays: Overlay[]
  radius?: { lat: number; lng: number; meters: number }
  onBackgroundClick?: () => void
  recenterKey?: string
  theme?: 'dark' | 'light'
}) {
  const { t } = useTranslation()
  const ref = useRef<HTMLDivElement>(null)
  const [size, setSize] = useState({ w: 360, h: 320 })
  const [view, setView] = useState({ ...center, z: initialZoom })
  const drag = useRef<{ x: number; y: number; cx: number; cy: number; moved: boolean } | null>(null)

  useEffect(() => {
    setView({ lat: center.lat, lng: center.lng, z: initialZoom })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recenterKey])

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const ro = new ResizeObserver(([e]) => setSize({ w: e.contentRect.width, h: e.contentRect.height }))
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const c = project(view.lat, view.lng, view.z)
  const origin = { x: c.x - size.w / 2, y: c.y - size.h / 2 }

  const tiles = useMemo(() => {
    const out: { key: string; x: number; y: number; url: string }[] = []
    const n = 2 ** view.z
    const x0 = Math.floor(origin.x / TILE)
    const y0 = Math.floor(origin.y / TILE)
    const x1 = Math.floor((origin.x + size.w) / TILE)
    const y1 = Math.floor((origin.y + size.h) / TILE)
    for (let tx = x0; tx <= x1; tx++)
      for (let ty = y0; ty <= y1; ty++) {
        if (ty < 0 || ty >= n) continue
        const wx = ((tx % n) + n) % n
        out.push({ key: `${view.z}/${tx}/${ty}`, x: tx * TILE - origin.x, y: ty * TILE - origin.y, url: `https://tile.openstreetmap.org/${view.z}/${wx}/${ty}.png` })
      }
    return out
  }, [origin.x, origin.y, size.w, size.h, view.z])

  const zoomBy = (d: number) => setView((v) => ({ ...v, z: Math.max(3, Math.min(19, v.z + d)) }))

  const onPointerDown = (e: React.PointerEvent) => {
    ;(e.target as HTMLElement).setPointerCapture?.(e.pointerId)
    drag.current = { x: e.clientX, y: e.clientY, cx: c.x, cy: c.y, moved: false }
  }
  const onPointerMove = (e: React.PointerEvent) => {
    const d = drag.current
    if (!d) return
    const dx = e.clientX - d.x
    const dy = e.clientY - d.y
    if (Math.abs(dx) + Math.abs(dy) > 4) d.moved = true
    const ll = unproject(d.cx - dx, d.cy - dy, view.z)
    setView((v) => ({ ...v, ...ll }))
  }
  const onPointerUp = () => {
    if (drag.current && !drag.current.moved) onBackgroundClick?.()
    drag.current = null
  }

  const radiusPx = radius ? radius.meters / ((156543.03392 * Math.cos((radius.lat * Math.PI) / 180)) / 2 ** view.z) : 0
  const rc = radius ? project(radius.lat, radius.lng, view.z) : null

  return (
    <div
      ref={ref}
      className={`relative h-full w-full touch-none overflow-hidden select-none ${theme === 'light' ? 'bg-[#eae8e1]' : 'bg-[#0e1116]'}`}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={() => (drag.current = null)}
      onWheel={(e) => zoomBy(e.deltaY > 0 ? -1 : 1)}
      data-no-swipe
    >
      {tiles.map((t) => (
        <img key={t.key} src={t.url} alt="" draggable={false} className="pointer-events-none absolute max-w-none" style={{ left: t.x, top: t.y, width: TILE, height: TILE, filter: theme === 'light' ? undefined : DARK_TILES }} />
      ))}
      {rc && (
        <div
          className="pointer-events-none absolute rounded-full border border-ember-500/40 bg-ember-500/[0.06]"
          style={{ left: rc.x - origin.x - radiusPx, top: rc.y - origin.y - radiusPx, width: radiusPx * 2, height: radiusPx * 2 }}
        />
      )}
      {overlays.map((o) => {
        const p = project(o.lat, o.lng, view.z)
        return (
          <div key={o.key} className="absolute" style={{ left: p.x - origin.x, top: p.y - origin.y }} onPointerDown={(e) => e.stopPropagation()}>
            {o.node}
          </div>
        )
      })}
      <div className="absolute top-3 right-3 flex flex-col overflow-hidden rounded-xl glass" onPointerDown={(e) => e.stopPropagation()}>
        <button onClick={() => zoomBy(1)} className="grid h-9 w-9 place-items-center text-fog-100 hover:bg-veil/5" aria-label={t('map.zoomIn')}>
          <Plus size={16} />
        </button>
        <div className="h-px bg-veil/10" />
        <button onClick={() => zoomBy(-1)} className="grid h-9 w-9 place-items-center text-fog-100 hover:bg-veil/5" aria-label={t('map.zoomOut')}>
          <Minus size={16} />
        </button>
      </div>
      <div className="pointer-events-auto absolute right-2 bottom-1 text-[9px] text-fog-500">
        © <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a> contributors
      </div>
    </div>
  )
}
