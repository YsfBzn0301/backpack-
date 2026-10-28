import { useMapsLoader } from '@/hooks/useMapsLoader'
import { useTheme } from '@/lib/theme'
import { GoogleMapView } from './GoogleMapView'
import { TileMap, type Overlay, type Shape } from './TileMap'

export const zoomForRadius = (r: number) => (r >= 5000 ? 13 : r >= 1000 ? 15 : 16)

/** Google Maps when a key is loaded, otherwise the built-in tile map. Follows the theme. */
export function MapView(props: { center: { lat: number; lng: number }; overlays: Overlay[]; shapes?: Shape[]; radius?: { lat: number; lng: number; meters: number }; onBackgroundClick?: () => void; recenterKey?: string }) {
  const state = useMapsLoader()
  const theme = useTheme()
  const zoom = zoomForRadius(props.radius?.meters ?? 1000)
  return state === 'ready' ? <GoogleMapView {...props} zoom={zoom} theme={theme} /> : <TileMap {...props} zoom={zoom} theme={theme} />
}
