import { useQuery } from '@tanstack/react-query'
import { Bike, Car, CircleDot, ExternalLink, Loader2, Motorbike, RefreshCw, Scooter, Zap } from 'lucide-react'
import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { fmtDistance } from '@/i18n/format'
import { haptic } from '@/lib/haptics'
import type { LatLng } from '@/lib/geo'
import { areaKey } from '@/services/places'
import {
  clusterPoints,
  detectPlatform,
  rentalLink,
  SHARING_MAX_RADIUS,
  sharingNearby,
  VEHICLE_KINDS,
  type SharingData,
  type SharingProvider,
  type VehicleKind,
} from '@/services/sharing'
import { Pressable } from '@/components/ui/Pressable'
import type { Overlay, Shape } from './TileMap'

export const SHARING_COLOR = '#4fd1c5'
const MAX_MARKERS = 200

export function useSharing(coords: LatLng | null, radius: number, enabled: boolean) {
  const r = Math.min(radius, SHARING_MAX_RADIUS)
  return useQuery({
    queryKey: ['sharing', coords ? areaKey(coords.lat, coords.lng) : null, r],
    queryFn: ({ signal }) => sharingNearby({ lat: coords!.lat, lng: coords!.lng, radius: r }, signal),
    enabled: enabled && Boolean(coords),
    // Vehicles move: refresh after a minute, but show the last snapshot instantly.
    staleTime: 60_000,
    gcTime: 6 * 3600_000,
    retry: false,
  })
}

export function KindIcon({ kind, size = 13 }: { kind: VehicleKind; size?: number }) {
  switch (kind) {
    case 'scooter':
      return <Scooter size={size} />
    case 'ebike':
      return (
        <span className="relative inline-flex">
          <Bike size={size} />
          <Zap size={Math.round(size * 0.6)} className="absolute -top-1 -right-1.5" fill="currentColor" />
        </span>
      )
    case 'bike':
      return <Bike size={size} />
    case 'moped':
      return <Motorbike size={size} />
    case 'car':
      return <Car size={size} />
    default:
      return <CircleDot size={size} />
  }
}

const dominant = (ids: string[]) => {
  const n = new Map<string, number>()
  for (const id of ids) n.set(id, (n.get(id) ?? 0) + 1)
  return [...n.entries()].sort((a, b) => b[1] - a[1])[0]?.[0]
}

/** Vehicles, stations and clusters as map overlays, coloured per provider. */
export function sharingOverlays(data: SharingData | undefined, label: (p: SharingProvider, kind: VehicleKind) => string): Overlay[] {
  if (!data) return []
  const prov = new Map(data.providers.map((p) => [p.id, p]))
  const color = (id: string | undefined) => (id && prov.get(id)?.color) || SHARING_COLOR
  const out: Overlay[] = []
  const stations = data.stations.slice(0, 60)
  const room = Math.max(40, MAX_MARKERS - stations.length)
  const clusters = clusterPoints(data.vehicles, room, Math.max(60, data.radius / 12))
  for (const c of clusters) {
    if (c.items.length === 1) {
      const v = c.items[0]
      const p = prov.get(v.providerId)
      out.push({
        key: `v-${v.id}`,
        lat: v.lat,
        lng: v.lng,
        node: (
          <span
            className="grid h-6 w-6 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full border-2 border-ink-900 text-ink-900 shadow-md"
            style={{ background: color(v.providerId) }}
            role="img"
            aria-label={p ? label(p, v.kind) : undefined}
          >
            <KindIcon kind={v.kind} size={12} />
          </span>
        ),
      })
    } else {
      out.push({
        key: `vc-${c.key}`,
        lat: c.lat,
        lng: c.lng,
        node: (
          <span
            className="grid h-8 min-w-8 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full border-2 border-ink-900 px-1.5 text-[11px] font-semibold text-ink-900 shadow-md"
            style={{ background: color(dominant(c.items.map((i) => i.providerId))) }}
          >
            {c.items.length}
          </span>
        ),
      })
    }
  }
  for (const s of stations)
    out.push({
      key: `s-${s.id}`,
      lat: s.lat,
      lng: s.lng,
      node: (
        <span
          className="flex h-6 -translate-x-1/2 -translate-y-1/2 items-center gap-0.5 rounded-md border-2 border-ink-900 px-1 text-[11px] font-semibold text-ink-900 shadow-md"
          style={{ background: color(s.providerId), opacity: s.available ? 1 : 0.55 }}
          title={s.name}
        >
          <Bike size={11} />
          {s.available}
        </span>
      ),
    })
  return out
}

export const ZONE_COLOR = { noParking: '#ff4d5e', stationParking: '#f2c14e' } as const

export function sharingShapes(data: SharingData | undefined): Shape[] {
  return (data?.zones ?? []).map((z) => ({ key: `z-${z.id}`, polygons: z.polygons, color: ZONE_COLOR[z.kind], fillOpacity: z.kind === 'noParking' ? 0.22 : 0.18, strokeOpacity: 0.6 }))
}

const platform = typeof navigator !== 'undefined' ? detectPlatform(navigator.userAgent, navigator.maxTouchPoints) : 'other'

function Shell({ children }: { children: ReactNode }) {
  return <div className="card p-4 text-center">{children}</div>
}

/** Below the map: one row per provider with counts by type and an "Open app" button. */
export function SharingList({ query, radius, onWiden }: { query: ReturnType<typeof useSharing>; radius: number; onWiden?: () => void }) {
  const { t } = useTranslation()
  const data = query.data
  const r = Math.min(radius, SHARING_MAX_RADIUS)

  if (!data) {
    if (query.isError)
      return (
        <Shell>
          <p className="text-sm font-medium text-fog-100">{t('scooters.errorTitle')}</p>
          <p className="mt-1 text-xs text-fog-400">{t('scooters.errorBody')}</p>
          <button onClick={() => query.refetch()} className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-fog-100 px-4 py-2 text-xs font-medium text-ink-900">
            <RefreshCw size={13} /> {t('map.retry')}
          </button>
        </Shell>
      )
    if (query.fetchStatus === 'paused') return <p className="card p-4 text-sm text-fog-400">{t('map.needsConnection')}</p>
    return <SkeletonRows label={t('scooters.loading')} />
  }

  const withVehicles = data.providers.filter((p) => p.total > 0)
  if (!withVehicles.length)
    return (
      <Shell>
        <span className="mx-auto grid h-11 w-11 place-items-center rounded-2xl" style={{ background: `${SHARING_COLOR}1f`, color: SHARING_COLOR }}>
          <Scooter size={20} />
        </span>
        <p className="mt-3 text-sm font-medium text-fog-100">{t('scooters.emptyTitle')}</p>
        <p className="mt-1 text-xs text-fog-400">{t('scooters.emptyBody', { radius: fmtDistance(r) })}</p>
        {onWiden && radius < SHARING_MAX_RADIUS && (
          <button onClick={onWiden} className="mt-3 rounded-full bg-veil/[0.06] px-4 py-2 text-xs font-medium text-fog-100">
            {t('scooters.widen', { radius: fmtDistance(SHARING_MAX_RADIUS) })}
          </button>
        )}
      </Shell>
    )

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between px-1 text-[11px] text-fog-500">
        <span>{t('scooters.summary', { n: withVehicles.reduce((a, p) => a + p.total, 0), radius: fmtDistance(r) })}</span>
        {query.isFetching && (
          <span className="flex items-center gap-1">
            <Loader2 size={11} className="animate-spin" /> {t('map.updating')}
          </span>
        )}
      </div>
      <ul className="space-y-1.5">
        {withVehicles.map((p) => (
          <ProviderRow key={p.id} p={p} />
        ))}
      </ul>
      {data.zones.length > 0 && (
        <p className="flex flex-wrap items-center gap-x-3 gap-y-1 px-1 pt-1 text-[11px] text-fog-400">
          <span className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-sm" style={{ background: `${ZONE_COLOR.noParking}66`, outline: `1px solid ${ZONE_COLOR.noParking}` }} /> {t('scooters.legendNoParking')}
          </span>
          {data.zones.some((z) => z.kind === 'stationParking') && (
            <span className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-sm" style={{ background: `${ZONE_COLOR.stationParking}66`, outline: `1px solid ${ZONE_COLOR.stationParking}` }} /> {t('scooters.legendStationParking')}
            </span>
          )}
        </p>
      )}
    </div>
  )
}

function ProviderRow({ p }: { p: SharingProvider }) {
  const { t } = useTranslation()
  const link = rentalLink(p.uris, platform, p.url)
  return (
    <li className="card flex items-center gap-3 p-3">
      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl" style={{ background: `${p.color}24`, color: p.color }}>
        <KindIcon kind={VEHICLE_KINDS.find((k) => p.counts[k]) ?? 'other'} size={18} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-medium text-fog-50">{p.name}</span>
        <span className="mt-0.5 flex flex-wrap items-center gap-x-2.5 gap-y-0.5 text-xs text-fog-400">
          {p.nearest != null && <span>{t('scooters.nearest', { dist: fmtDistance(p.nearest) })}</span>}
          {VEHICLE_KINDS.filter((k) => p.counts[k]).map((k) => (
            <span key={k} className="flex items-center gap-1 text-fog-300" title={t(`scooters.kind.${k}`)} aria-label={`${p.counts[k]} ${t(`scooters.kind.${k}`)}`}>
              <KindIcon kind={k} size={12} />
              {p.counts[k]}
            </span>
          ))}
        </span>
      </span>
      {link && (
        <Pressable
          onClick={() => {
            haptic('select')
            window.open(link, '_blank', 'noopener')
          }}
          className="flex shrink-0 items-center gap-1 rounded-full bg-veil/[0.06] px-3 py-2 text-xs font-medium text-fog-100"
        >
          {t('scooters.openApp')} <ExternalLink size={12} />
        </Pressable>
      )}
    </li>
  )
}

export function SkeletonRows({ label }: { label: string }) {
  return (
    <div className="space-y-1.5" role="status" aria-live="polite">
      <p className="flex items-center gap-1.5 px-1 text-[11px] text-fog-500">
        <Loader2 size={11} className="animate-spin" /> {label}
      </p>
      {[0, 1, 2].map((i) => (
        <div key={i} className="card flex items-center gap-3 p-3" aria-hidden>
          <span className="h-10 w-10 shrink-0 animate-pulse rounded-xl bg-veil/[0.06]" />
          <span className="flex-1 space-y-2">
            <span className="block h-3 w-2/5 animate-pulse rounded bg-veil/[0.08]" style={{ animationDelay: `${i * 120}ms` }} />
            <span className="block h-2.5 w-3/5 animate-pulse rounded bg-veil/[0.05]" style={{ animationDelay: `${i * 120}ms` }} />
          </span>
        </div>
      ))}
    </div>
  )
}
