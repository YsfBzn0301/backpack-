import { useEffect, useState } from 'react'
import { hasMapsKey, isMapsLoaded, loadGoogleMaps } from '@/services/maps-loader'

export function useMapsLoader() {
  const [state, setState] = useState<'none' | 'loading' | 'ready' | 'error'>(() => (isMapsLoaded() ? 'ready' : hasMapsKey() ? 'loading' : 'none'))
  useEffect(() => {
    if (state !== 'loading') return
    loadGoogleMaps()
      .then(() => setState('ready'))
      .catch(() => setState('error'))
  }, [state])
  return state
}
