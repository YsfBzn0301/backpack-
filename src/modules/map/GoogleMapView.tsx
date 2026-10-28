import { CircleF, GoogleMap, OverlayViewF, OVERLAY_MOUSE_TARGET } from '@react-google-maps/api'
import { useEffect, useRef } from 'react'
import { DARK_MAP_STYLE } from './mapStyle'
import type { Overlay } from './TileMap'

const OPTIONS: google.maps.MapOptions = {
  disableDefaultUI: true,
  zoomControl: true,
  clickableIcons: false,
  gestureHandling: 'greedy',
  styles: DARK_MAP_STYLE,
  backgroundColor: '#11161e',
}

export function GoogleMapView({
  center,
  overlays,
  radius,
  onBackgroundClick,
  recenterKey,
}: {
  center: { lat: number; lng: number }
  overlays: Overlay[]
  radius?: { lat: number; lng: number; meters: number }
  onBackgroundClick?: () => void
  recenterKey?: string
}) {
  const map = useRef<google.maps.Map | null>(null)
  useEffect(() => {
    map.current?.panTo(center)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recenterKey])

  return (
    <GoogleMap
      mapContainerClassName="h-full w-full"
      center={center}
      zoom={15}
      options={OPTIONS}
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
      {overlays.map((o) => (
        <OverlayViewF key={o.key} position={{ lat: o.lat, lng: o.lng }} mapPaneName={OVERLAY_MOUSE_TARGET}>
          <div>{o.node}</div>
        </OverlayViewF>
      ))}
    </GoogleMap>
  )
}
