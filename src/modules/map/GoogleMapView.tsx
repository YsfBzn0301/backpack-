import { CircleF, GoogleMap, OverlayViewF, OVERLAY_MOUSE_TARGET, PolygonF } from '@react-google-maps/api'
import { useEffect, useRef } from 'react'
import { DARK_MAP_STYLE } from './mapStyle'
import type { Overlay, Shape } from './TileMap'

const options = (theme: 'dark' | 'light'): google.maps.MapOptions => ({
  disableDefaultUI: true,
  zoomControl: true,
  clickableIcons: false,
  gestureHandling: 'greedy',
  // Light theme uses Google's default cartography, which already reads as "sand".
  styles: theme === 'dark' ? DARK_MAP_STYLE : [{ featureType: 'poi.business', stylers: [{ visibility: 'off' }] }],
  backgroundColor: theme === 'dark' ? '#11161e' : '#eae8e1',
})

export function GoogleMapView({
  center,
  overlays,
  shapes,
  radius,
  onBackgroundClick,
  recenterKey,
  zoom = 15,
  theme = 'dark',
}: {
  center: { lat: number; lng: number }
  overlays: Overlay[]
  shapes?: Shape[]
  radius?: { lat: number; lng: number; meters: number }
  onBackgroundClick?: () => void
  recenterKey?: string
  zoom?: number
  theme?: 'dark' | 'light'
}) {
  const map = useRef<google.maps.Map | null>(null)
  useEffect(() => {
    map.current?.panTo(center)
    map.current?.setZoom(zoom)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recenterKey])

  return (
    <GoogleMap
      mapContainerClassName="h-full w-full"
      center={center}
      zoom={zoom}
      options={options(theme)}
      onLoad={(m) => {
        map.current = m
      }}
      onClick={onBackgroundClick}
    >
      {radius && (
        <CircleF
          center={radius}
          radius={radius.meters}
          options={{ strokeColor: '#ff6b4a', strokeOpacity: 0.4, strokeWeight: 1, fillColor: '#ff6b4a', fillOpacity: 0.05, clickable: false }}
        />
      )}
      {shapes?.flatMap((s) =>
        s.polygons.map((poly, i) => (
          <PolygonF
            key={`${s.key}-${i}`}
            paths={poly.map((ring) => ring.map(([lat, lng]) => ({ lat, lng })))}
            options={{ fillColor: s.color, fillOpacity: s.fillOpacity, strokeColor: s.color, strokeOpacity: s.strokeOpacity, strokeWeight: 1, clickable: false }}
          />
        )),
      )}
      {overlays.map((o) => (
        <OverlayViewF key={o.key} position={{ lat: o.lat, lng: o.lng }} mapPaneName={OVERLAY_MOUSE_TARGET}>
          <div>{o.node}</div>
        </OverlayViewF>
      ))}
    </GoogleMap>
  )
}
