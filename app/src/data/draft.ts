import { useSyncExternalStore } from 'react'
import type { PaymentMethod, Place, Quote, RideOption, ServiceCode } from './types'

// Brouillon de la demande, partagé entre S05 (accueil), S06 (adresse), S07 (prix) et S08 (options).
export type Draft = {
  service: ServiceCode; pickup: Place | null; dropoff: Place | null; quote: Quote | null
  offeredCents: number | null; payment: PaymentMethod; options: RideOption[]; passengers: number; comment: string
}

const initial: Draft = { service: 'economy', pickup: null, dropoff: null, quote: null, offeredCents: null, payment: 'cash', options: [], passengers: 1, comment: '' }
let state: Draft = initial
const listeners = new Set<() => void>()

export const draft = {
  get: () => state,
  set: (patch: Partial<Draft>) => { state = { ...state, ...patch }; listeners.forEach((l) => l()) },
  reset: () => { state = { ...initial, pickup: state.pickup, payment: state.payment }; listeners.forEach((l) => l()) },
}

export function useDraft() {
  return useSyncExternalStore((l) => { listeners.add(l); return () => { listeners.delete(l) } }, draft.get, draft.get)
}
