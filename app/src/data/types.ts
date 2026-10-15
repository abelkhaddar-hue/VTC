// Types partagés par la couche de données factice (src/data/fake.ts) et la future
// couche Supabase. Ils suivent replica/schema.sql : argent en centimes, heures ISO UTC.

export type LngLat = { lng: number; lat: number }

export type Place = { id: string; name: string; detail: string; point: LngLat; kind?: 'landmark' | 'station' | 'mall' | 'street' | 'recent' }

export type ServiceCode = 'economy' | 'comfort' | 'xl' | 'moto'
export type PaymentMethod = 'cash' | 'card' | 'wallet'
export type RideOption = 'child_seat' | 'luggage' | 'pet'

export type RideType = { code: ServiceCode; name: string; seatsMax: number; available: boolean }

export type City = {
  id: string; name: string; currency: 'MAD'; paymentMethods: PaymentMethod[]
  emergency: { police: string; ambulance: string }; rideTypes: RideType[]
}

export type Profile = {
  id: string; phone: string; firstName: string; email?: string; locale: 'fr' | 'ar' | 'en'
  rating: number | null; ratingCount: number; cityId: string
  status: 'active' | 'restricted' | 'blocked'; restrictedUntil?: string
}

export type Session = { userId: string; phone: string; isNew: boolean }

export type Quote = {
  distanceM: number; durationS: number; recommendedCents: number; route: LngLat[]
}

export type RideRequest = {
  id: string; service: ServiceCode; pickup: Place; dropoff: Place
  distanceM: number; durationS: number; route: LngLat[]
  recommendedCents: number; offeredCents: number; payment: PaymentMethod
  options: RideOption[]; passengers: number; comment?: string
  status: 'searching' | 'matched' | 'cancelled' | 'expired'
  createdAt: string; expiresAt: string
}

export type Offer = {
  id: string; requestId: string; fareCents: number; kind: 'accept' | 'counter'
  etaS: number; distanceM: number; createdAt: string; expiresAt: string
  driver: { id: string; firstName: string; rating: number | null; rides: number; photo?: string }
  vehicle: { make: string; model: string; color: string }
}

export type RideStatus = 'driver_en_route' | 'driver_arrived' | 'in_progress' | 'completed' | 'cancelled'

export type CancelReason =
  | 'driver_late' | 'driver_asked_cancel' | 'wrong_vehicle' | 'changed_mind' | 'price_dispute' | 'safety' | 'other'

export type RideView = {
  id: string; requestId: string; status: RideStatus; fareCents: number; payment: PaymentMethod
  pickup: Place; dropoff: Place; route: LngLat[]; distanceM: number
  driver: { id: string; firstName: string; rating: number | null; rides: number }
  vehicle: { make: string; model: string; color: string; plate: string }
  driverPosition: (LngLat & { heading: number }) | null
  etaS: number | null
  acceptedAt: string; arrivedAt?: string; startedAt?: string; completedAt?: string
  cancelledAt?: string; cancelledBy?: 'passenger' | 'driver'; cancelReason?: CancelReason
  rated: boolean
}

export type Message = { id: string; rideId: string; from: 'me' | 'driver' | 'system'; text: string; at: string; status?: 'sending' | 'sent' | 'failed' }

export type RideSummary = {
  id: string; at: string; pickup: string; dropoff: string; fareCents: number; status: 'completed' | 'cancelled'
  driverName: string; vehicle: string; payment: PaymentMethod; distanceM: number; durationS: number; myStars?: number
}

export type EmergencyContact = { id: string; name: string; phone: string }

export type SharedRide = {
  status: RideStatus; driverFirstName: string; vehicle: string; plate: string; dropoff: string
  driverPosition: LngLat | null; pickup: LngLat; dropoffPoint: LngLat; updatedAt: string
}

export type SupportTicket = { id: string; category: 'lost_item' | 'price_dispute' | 'safety' | 'account' | 'payment' | 'app_problem' | 'other'; rideId?: string; status: 'open' | 'waiting_user' | 'resolved'; createdAt: string; messages: { from: 'me' | 'staff'; text: string; at: string }[] }

// Erreurs métier : mêmes codes que les fonctions SQL (raise exception '…').
export class ApiError extends Error {
  constructor(public code: string, message?: string) { super(message ?? code) }
}

export type Unsubscribe = () => void
