import type { InsightAction } from '@/agents/protocol'
import { directionsUrl } from './geo'
import { goTab, openParking, openScreen, ui, type Screen, type Tab } from './ui'

export function runAction(action: InsightAction) {
  switch (action.type) {
    case 'tab':
      goTab(action.payload as Tab)
      break
    case 'screen':
      openScreen(action.payload as Screen)
      break
    case 'sos':
      ui.set({ sosOpen: true })
      break
    case 'parking':
      openParking()
      break
    case 'directions': {
      const p = action.payload as { lat: number; lng: number; id?: string }
      window.open(directionsUrl(p, 'walking', p.id), '_blank', 'noopener')
      break
    }
    case 'place': {
      const p = action.payload as { lat: number; lng: number; name?: string }
      ui.set({ mapFocus: p, mapMode: 'places' })
      goTab('map')
      break
    }
  }
}
