import { Banknote, Bed, Building2, Bus, Coffee, Cross, Flag, Pill, ShieldAlert, ShoppingBasket, Soup, UtensilsCrossed, Wine } from 'lucide-react'
import type { PlaceKind } from '@/agents/protocol'

export const KIND_STYLE: Record<PlaceKind, { color: string; Icon: typeof Coffee }> = {
  atm: { color: '#5fd39a', Icon: Banknote },
  hostel: { color: '#b38cff', Icon: Bed },
  street_food: { color: '#ffb347', Icon: Soup },
  restaurant: { color: '#ff876b', Icon: UtensilsCrossed },
  cafe: { color: '#d9a066', Icon: Coffee },
  convenience: { color: '#6cb6ff', Icon: ShoppingBasket },
  bar: { color: '#e57bb8', Icon: Wine },
  pharmacy: { color: '#4fd1c5', Icon: Pill },
  hospital: { color: '#ff4d5e', Icon: Cross },
  bus: { color: '#8fa8ff', Icon: Bus },
  embassy: { color: '#e6edf3', Icon: Flag },
  police: { color: '#6cb6ff', Icon: ShieldAlert },
}

export const FallbackIcon = Building2
