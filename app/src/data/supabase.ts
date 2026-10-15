// Couche de données RÉELLE : Supabase (Auth par SMS, base, temps réel, Edge Functions).
// Mêmes fonctions et mêmes types que fake.ts : les écrans ne voient pas la différence.
import { AppState, Platform } from 'react-native'
import * as Location from 'expo-location'
import { createClient, type RealtimeChannel, type SupabaseClient } from '@supabase/supabase-js'
import type * as Fake from './fake'
import { decode } from './polyline'
import { messageFor, toApiError } from './errors'
import {
  ApiError, type ActiveState, type CancelReason, type City, type EmergencyContact, type LngLat, type Message, type Offer, type PaymentMethod,
  type Place, type Profile, type Quote, type RideOption, type RideRequest, type RideSummary, type RideView,
  type ServiceCode, type Session, type SharedRide, type SupportTicket, type Unsubscribe,
} from './types'

type Api = Pick<typeof Fake, 'auth' | 'account' | 'geo' | 'rides' | 'support'>

// ───────── client, créé au premier usage (le mode démo n'en a pas besoin) ─────────

let client: SupabaseClient | null = null
function sb(): SupabaseClient {
  if (client) return client
  const url = process.env.EXPO_PUBLIC_SUPABASE_URL
  const key = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY
  if (!url || !key) throw new ApiError('not_configured', messageFor('not_configured'))
  // Sur téléphone, la session est gardée par expo-sqlite ; le web a déjà localStorage.
  if (Platform.OS !== 'web') require('expo-sqlite/localStorage/install')
  client = createClient(url, key, {
    auth: { storage: globalThis.localStorage, autoRefreshToken: true, persistSession: true, detectSessionInUrl: false },
  })
  if (Platform.OS !== 'web') {
    AppState.addEventListener('change', (s) => (s === 'active' ? client!.auth.startAutoRefresh() : client!.auth.stopAutoRefresh()))
  }
  return client
}

const uid = () => {
  if (!session) throw new ApiError('not_authenticated', messageFor('not_authenticated'))
  return session.userId
}

async function rpc<T>(fn: string, args?: Record<string, unknown>): Promise<T> {
  const { data, error } = await sb().rpc(fn, args)
  if (error) throw toApiError(error)
  return data as T
}

async function edge<T>(name: string, body: Record<string, unknown>): Promise<T> {
  const { data, error } = await sb().functions.invoke(name, { body })
  if (error) {
    let code = 'server_error'
    try { code = ((await (error as { context?: Response }).context?.json()) as { code?: string })?.code ?? code } catch { /* réponse non JSON */ }
    if (/fetch|network/i.test(error.message)) code = 'network'
    throw new ApiError(code, messageFor(code))
  }
  return data as T
}

// Abonnement temps réel aux changements d'une table, filtrés par RLS côté serveur.
function watch(table: string, filter: string, events: ('INSERT' | 'UPDATE' | '*')[], onChange: (row: Record<string, unknown>) => void): Unsubscribe {
  const ch: RealtimeChannel = sb().channel(`${table}:${filter}:${Math.random().toString(36).slice(2)}`)
  for (const event of events) {
    ch.on('postgres_changes' as never, { event, schema: 'public', table, ...(filter ? { filter } : {}) } as never, (p: { new: Record<string, unknown> }) => onChange(p.new))
  }
  ch.subscribe()
  return () => { sb().removeChannel(ch) }
}

// ───────── session ─────────

let session: Session | null = null
let readyP: Promise<void> | null = null
const sessionListeners = new Set<(s: Session | null) => void>()
const toSession = (s: { user: { id: string; phone?: string } } | null, isNew = false): Session | null =>
  s ? { userId: s.user.id, phone: s.user.phone ? `+${s.user.phone.replace(/^\+/, '')}` : '', isNew } : null

function ready() {
  readyP ??= (async () => {
    const { data } = await sb().auth.getSession()
    session = toSession(data.session)
    sb().auth.onAuthStateChange((_e, s) => {
      const next = toSession(s, session?.isNew)
      if (next?.userId !== session?.userId) { session = next; sessionListeners.forEach((f) => f(session)) }
    })
  })()
  return readyP
}

const e164 = (moroccan: string) => `+212${moroccan.replace(/\D/g, '').slice(1)}`

const profileListeners = new Set<(p: Profile) => void>()
async function refreshProfile() { const p = await account.profile(); profileListeners.forEach((f) => f(p)); return p }

// ───────── compte ─────────

const auth: Api['auth'] & { ready: () => Promise<void> } = {
  ready,
  session: () => session,
  onSession: (fn) => { sessionListeners.add(fn); return () => { sessionListeners.delete(fn) } },

  sendCode: async (phone) => {
    const digits = phone.replace(/\D/g, '')
    if (!/^0[67]\d{8}$/.test(digits)) throw new ApiError('invalid_phone', messageFor('invalid_phone'))
    const { error } = await sb().auth.signInWithOtp({ phone: e164(digits) })
    if (error) {
      const code = error.code === 'over_sms_send_rate_limit' || error.status === 429 ? 'sms_rate_limited'
        : error.code === 'phone_provider_disabled' ? 'sms_disabled' : 'sms_failed'
      throw new ApiError(code, messageFor(code))
    }
    return { resendInS: 45 }
  },

  verifyCode: async (phone, code) => {
    const { data, error } = await sb().auth.verifyOtp({ phone: e164(phone), token: code, type: 'sms' })
    if (error || !data.session) throw new ApiError('invalid_code', messageFor('invalid_code'))
    const { data: p } = await sb().from('profiles').select('first_name').eq('id', data.session.user.id).single()
    session = toSession(data.session, !p?.first_name)!
    sessionListeners.forEach((f) => f(session))
    return session
  },

  signOut: async () => {
    await sb().auth.signOut()
    session = null
    sessionListeners.forEach((f) => f(null))
  },
}

const account: Api['account'] = {
  profile: async () => {
    const { data, error } = await sb().from('profiles')
      .select('id, phone, first_name, email, locale, rating_sum, rating_count, city_id, status, restricted_until').eq('id', uid()).single()
    if (error || !data) throw toApiError(error)
    const restricted = data.status === 'restricted' && data.restricted_until && Date.parse(data.restricted_until) > Date.now()
    return {
      id: data.id, phone: data.phone ?? '', firstName: data.first_name, email: data.email ?? undefined, locale: data.locale,
      rating: data.rating_count ? Math.round((data.rating_sum / data.rating_count) * 100) / 100 : null, ratingCount: data.rating_count,
      cityId: data.city_id ?? '', status: restricted ? 'restricted' : data.status === 'active' || data.status === 'restricted' ? 'active' : 'blocked',
      restrictedUntil: restricted ? data.restricted_until : undefined,
    } satisfies Profile
  },

  city: async () => {
    const { data, error } = await sb().from('cities')
      .select('id, name, currency, payment_methods, emergency_numbers, ride_types(code, name, seats_max, is_active, sort_order)')
      .eq('is_active', true).limit(1).single()
    if (error || !data) throw toApiError(error)
    const types = (data.ride_types ?? []) as { code: ServiceCode; name: string; seats_max: number; is_active: boolean }[]
    const labels: Record<ServiceCode, string> = { economy: 'Course', comfort: 'Confort', xl: 'XL', moto: 'Moto' }
    return {
      id: data.id, name: data.name, currency: 'MAD', paymentMethods: data.payment_methods as PaymentMethod[],
      emergency: { police: data.emergency_numbers?.police ?? '19', ambulance: data.emergency_numbers?.ambulance ?? '15' },
      // une gamme absente (désactivée, donc invisible par RLS) s'affiche « bientôt »
      rideTypes: (['economy', 'comfort', 'xl', 'moto'] as ServiceCode[]).map((code) => {
        const t = types.find((x) => x.code === code)
        return { code, name: t?.name ?? labels[code], seatsMax: t?.seats_max ?? 4, available: !!t?.is_active }
      }),
    } as City
  },

  update: async (patch) => {
    if (patch.firstName !== undefined && !patch.firstName.trim()) throw new ApiError('first_name_required', messageFor('first_name_required'))
    if (patch.firstName && patch.firstName.length > 60) throw new ApiError('first_name_too_long', messageFor('first_name_too_long'))
    const row: Record<string, unknown> = {}
    if (patch.firstName !== undefined) row.first_name = patch.firstName.trim()
    if (patch.email !== undefined) row.email = patch.email || null
    if (patch.locale !== undefined) row.locale = patch.locale
    const { error } = await sb().from('profiles').update(row).eq('id', uid())
    if (error) throw toApiError(error)
    if (session) session.isNew = false
    return refreshProfile()
  },

  onProfile: (fn) => { profileListeners.add(fn); return () => { profileListeners.delete(fn) } },

  contacts: async () => {
    const { data, error } = await sb().from('emergency_contacts').select('id, name, phone').order('created_at')
    if (error) throw toApiError(error)
    return data as EmergencyContact[]
  },

  addContact: async (name, phone) => {
    const digits = phone.replace(/\D/g, '')
    if (!name.trim()) throw new ApiError('name_required', messageFor('name_required'))
    if (!/^0[5-7]\d{8}$/.test(digits)) throw new ApiError('invalid_phone', 'Numéro marocain à 10 chiffres.')
    const { data, error } = await sb().from('emergency_contacts')
      .insert({ user_id: uid(), name: name.trim(), phone: e164(digits) }).select('id, name, phone').single()
    if (error) throw toApiError(error)
    return data as EmergencyContact
  },

  removeContact: async (cid) => {
    const { error } = await sb().from('emergency_contacts').delete().eq('id', cid)
    if (error) throw toApiError(error)
  },

  deleteAccount: async () => {
    await edge('delete-account', {})
    await auth.signOut()
  },
}

// ───────── lieux ─────────

const CASABLANCA_CENTER = { lng: -7.6186, lat: 33.5937 }
let lastPosition: LngLat | null = null
type EdgePlace = { name: string; detail: string; lng: number; lat: number }
const toPlace = (p: EdgePlace, kind: Place['kind'] = 'street'): Place =>
  ({ id: `pl_${p.lng.toFixed(5)}_${p.lat.toFixed(5)}`, name: p.name, detail: p.detail, point: { lng: p.lng, lat: p.lat }, kind })

const geo: Api['geo'] = {
  myPosition: async () => {
    const perm = await Location.requestForegroundPermissionsAsync()
    if (perm.status !== 'granted') throw new ApiError('location_denied', messageFor('location_denied'))
    const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced })
    lastPosition = { lng: pos.coords.longitude, lat: pos.coords.latitude }
    return lastPosition
  },
  reverse: async (p) => toPlace(await edge<EdgePlace>('places', { action: 'reverse', lng: p.lng, lat: p.lat })),
  recent: async () => (await rpc<EdgePlace[]>('my_recent_places', { p_limit: 4 })).map((p) => toPlace(p, 'recent')),
  search: async (text) => {
    if (text.trim().length < 2) return []
    const list = await edge<EdgePlace[]>('places', { action: 'search', text: text.trim(), near: lastPosition ?? CASABLANCA_CENTER })
    return list.map((p) => toPlace(p, 'landmark'))
  },
}

// ───────── courses ─────────

const SPEED = 22000 / 3600 // m/s en ville, pour l'heure d'arrivée estimée
const dist = (a: LngLat, b: LngLat) => {
  const r = (d: number) => (d * Math.PI) / 180
  const h = Math.sin(r(b.lat - a.lat) / 2) ** 2 + Math.cos(r(a.lat)) * Math.cos(r(b.lat)) * Math.sin(r(b.lng - a.lng) / 2) ** 2
  return 2 * 6371000 * Math.asin(Math.sqrt(h))
}

type RequestRow = {
  request_id: string; status: RideRequest['status']; service: ServiceCode
  pickup_name: string; pickup_detail: string; pickup_lng: number; pickup_lat: number
  dropoff_name: string; dropoff_detail: string; dropoff_lng: number; dropoff_lat: number
  distance_m: number; duration_s: number; route_polyline: string | null; recommended_fare_cents: number
  offered_fare_cents: number; payment_method: PaymentMethod; options: Record<string, boolean>; passengers_count: number
  comment: string | null; created_at: string; expires_at: string
}
const toRequest = (r: RequestRow): RideRequest => ({
  id: r.request_id, service: r.service,
  pickup: { id: `${r.request_id}-p`, name: r.pickup_name, detail: r.pickup_detail, point: { lng: r.pickup_lng, lat: r.pickup_lat } },
  dropoff: { id: `${r.request_id}-d`, name: r.dropoff_name, detail: r.dropoff_detail, point: { lng: r.dropoff_lng, lat: r.dropoff_lat } },
  distanceM: r.distance_m, durationS: r.duration_s, route: decode(r.route_polyline),
  recommendedCents: r.recommended_fare_cents, offeredCents: r.offered_fare_cents, payment: r.payment_method,
  options: Object.entries(r.options ?? {}).filter(([, v]) => v).map(([k]) => k as RideOption),
  passengers: r.passengers_count, comment: r.comment ?? undefined, status: r.status, createdAt: r.created_at, expiresAt: r.expires_at,
})

type OfferRow = {
  offer_id: string; fare_cents: number; kind: Offer['kind']; eta_s: number; distance_m: number; expires_at: string
  driver_first_name: string; driver_rating: number | null; driver_rides_count: number; driver_rating_count: number
  vehicle_make: string; vehicle_model: string; vehicle_color: string
}

type RideRow = {
  ride_id: string; request_id: string; status: RideView['status']; fare_cents: number; payment_method: PaymentMethod
  pickup_name: string; pickup_detail: string; pickup_lng: number; pickup_lat: number
  dropoff_name: string; dropoff_detail: string; dropoff_lng: number; dropoff_lat: number
  route_polyline: string | null; distance_m: number; duration_s: number
  accepted_at: string; arrived_at: string | null; started_at: string | null; completed_at: string | null
  cancelled_at: string | null; cancelled_by: 'passenger' | 'driver' | 'system' | null; cancel_reason: CancelReason | null
  counterpart_id: string; counterpart_first_name: string; counterpart_rating: number | null; counterpart_rides: number; counterpart_rating_count: number
  vehicle_make: string; vehicle_model: string; vehicle_color: string; vehicle_plate: string
  driver_lng: number | null; driver_lat: number | null; driver_heading: number | null; rated: boolean
}

function withEta(v: RideView): RideView {
  if (!v.driverPosition) return { ...v, etaS: null }
  const target = v.status === 'in_progress' ? v.dropoff.point : v.status === 'driver_en_route' ? v.pickup.point : null
  return { ...v, etaS: target ? Math.round(dist(v.driverPosition, target) * 1.3 / SPEED) : v.status === 'driver_arrived' ? 0 : null }
}

const toRide = (r: RideRow): RideView => withEta({
  id: r.ride_id, requestId: r.request_id, status: r.status, fareCents: r.fare_cents, payment: r.payment_method,
  pickup: { id: `${r.request_id}-p`, name: r.pickup_name, detail: r.pickup_detail, point: { lng: r.pickup_lng, lat: r.pickup_lat } },
  dropoff: { id: `${r.request_id}-d`, name: r.dropoff_name, detail: r.dropoff_detail, point: { lng: r.dropoff_lng, lat: r.dropoff_lat } },
  route: decode(r.route_polyline), distanceM: r.distance_m,
  driver: { id: r.counterpart_id, firstName: r.counterpart_first_name, rating: r.counterpart_rating, rides: r.counterpart_rating_count },
  vehicle: { make: r.vehicle_make, model: r.vehicle_model, color: r.vehicle_color, plate: r.vehicle_plate },
  driverPosition: r.driver_lng != null && r.driver_lat != null ? { lng: r.driver_lng, lat: r.driver_lat, heading: r.driver_heading ?? 0 } : null,
  etaS: null, acceptedAt: r.accepted_at, arrivedAt: r.arrived_at ?? undefined, startedAt: r.started_at ?? undefined,
  completedAt: r.completed_at ?? undefined, cancelledAt: r.cancelled_at ?? undefined,
  cancelledBy: r.cancelled_by === 'passenger' ? 'passenger' : r.cancelled_by ? 'driver' : undefined,
  cancelReason: r.cancel_reason ?? undefined, rated: r.rated,
})

type HistoryRow = {
  ride_id: string; at: string; pickup: string; dropoff: string; fare_cents: number; status: 'completed' | 'cancelled'
  driver_name: string; vehicle: string; payment_method: PaymentMethod; distance_m: number; duration_s: number; my_stars: number | null
}
const toSummary = (h: HistoryRow): RideSummary => ({
  id: h.ride_id, at: h.at, pickup: h.pickup, dropoff: h.dropoff, fareCents: h.fare_cents, status: h.status, driverName: h.driver_name,
  vehicle: h.vehicle, payment: h.payment_method, distanceM: h.distance_m, durationS: h.duration_s, myStars: h.my_stars ?? undefined,
})

const rides: Api['rides'] = {
  quote: async (pickup, dropoff, service) => {
    const q = await edge<{ distanceM: number; durationS: number; recommendedCents: number; polyline: string }>('quote', { pickup, dropoff, service })
    return { distanceM: q.distanceM, durationS: q.durationS, recommendedCents: q.recommendedCents, route: decode(q.polyline) } satisfies Quote
  },

  createRequest: async (i) => {
    const place = (p: Place) => ({ name: p.name, detail: p.detail, lng: p.point.lng, lat: p.point.lat })
    const { id } = await edge<{ id: string }>('create-request', {
      service: i.service, pickup: place(i.pickup), dropoff: place(i.dropoff), offeredCents: i.offeredCents, payment: i.payment,
      options: i.options, passengers: i.passengers, comment: i.comment?.trim() || undefined,
    })
    return rides.request(id)
  },

  request: async (rid) => {
    const rows = await rpc<RequestRow[]>('request_view', { p_request: rid })
    if (!rows?.length) throw new ApiError('request_not_found', messageFor('request_not_found'))
    return toRequest(rows[0])
  },
  onRequest: (rid, fn) => watch('ride_requests', `id=eq.${rid}`, ['UPDATE'], () => { rides.request(rid).then(fn).catch(() => {}) }),

  raiseFare: async (rid, cents) => { await rpc('raise_fare', { p_request: rid, p_new_fare_cents: cents }); return rides.request(rid) },
  cancelRequest: async (rid) => { await rpc('cancel_request', { p_request: rid }) },

  offers: async (rid) => (await rpc<OfferRow[]>('request_offers', { p_request: rid })).map((o): Offer => ({
    id: o.offer_id, requestId: rid, fareCents: o.fare_cents, kind: o.kind, etaS: o.eta_s, distanceM: o.distance_m,
    createdAt: new Date(Date.parse(o.expires_at) - 45_000).toISOString(), expiresAt: o.expires_at,
    driver: { id: o.offer_id, firstName: o.driver_first_name, rating: o.driver_rating, rides: o.driver_rating_count },
    vehicle: { make: o.vehicle_make, model: o.vehicle_model, color: o.vehicle_color },
  })),
  onOffers: (rid, fn) => watch('offers', `request_id=eq.${rid}`, ['*'], () => { rides.offers(rid).then(fn).catch(() => {}) }),

  declineOffer: async (oid) => { await rpc('decline_offer', { p_offer: oid }) },
  acceptOffer: async (oid) => { const r = await rpc<{ id: string }>('accept_offer', { p_offer: oid }); return rides.ride(r.id) },

  ride: async (rid) => {
    const rows = await rpc<RideRow[]>('ride_view', { p_ride: rid })
    if (!rows?.length) throw new ApiError('ride_not_found', messageFor('ride_not_found'))
    return toRide(rows[0])
  },

  // Statut : relecture complète. Position : mise à jour locale, sans relire toute la course.
  onRide: (rid, fn) => {
    let last: RideView | null = null
    const push = (v: RideView) => { last = v; fn(v) }
    const offStatus = watch('rides', `id=eq.${rid}`, ['UPDATE'], () => { rides.ride(rid).then(push).catch(() => {}) })
    const offPos = watch('ride_locations', `ride_id=eq.${rid}`, ['INSERT'], (row) => {
      if (!last) { rides.ride(rid).then(push).catch(() => {}); return }
      push(withEta({ ...last, driverPosition: { lng: Number(row.lng), lat: Number(row.lat), heading: Number(row.heading ?? 0) } }))
    })
    rides.ride(rid).then((v) => { last = v }).catch(() => {})
    return () => { offStatus(); offPos() }
  },

  active: async () => rpc<ActiveState>('my_active_state'),

  cancelRide: async (rid, reason, comment) => {
    if (reason === 'other' && !comment?.trim()) throw new ApiError('reason_required', messageFor('reason_required'))
    await rpc('cancel_ride', { p_ride: rid, p_reason: reason, p_comment: comment?.trim() || null })
    refreshProfile().catch(() => {}) // une restriction a pu tomber
    return rides.ride(rid)
  },

  rate: async (rid, stars, tags, comment) => {
    if (stars < 1 || stars > 5) throw new ApiError('invalid_input', messageFor('invalid_input'))
    await rpc('rate_ride', { p_ride: rid, p_stars: stars, p_tags: tags, p_comment: comment?.trim() || null })
  },

  history: async () => (await rpc<HistoryRow[]>('my_rides', { p_limit: 100 })).map(toSummary),
  historyItem: async (hid) => {
    const h = (await rpc<HistoryRow[]>('my_rides', { p_limit: 200 })).find((x) => x.ride_id === hid)
    if (!h) throw new ApiError('ride_not_found', messageFor('ride_not_found'))
    return toSummary(h)
  },

  createShareLink: async (rid) => rpc<string>('create_share_link', { p_ride: rid }),
  shared: async (token) => {
    const rows = await rpc<{
      status: RideView['status']; driver_first_name: string; vehicle_make: string; vehicle_model: string; vehicle_color: string
      vehicle_plate: string; dropoff_address: string; driver_lng: number | null; driver_lat: number | null; updated_at: string
      pickup_lng: number; pickup_lat: number; dropoff_lng: number; dropoff_lat: number
    }[]>('shared_ride', { p_token: token })
    const s = rows?.[0]
    if (!s) return null
    return {
      status: s.status, driverFirstName: s.driver_first_name, vehicle: `${s.vehicle_make} ${s.vehicle_model} ${s.vehicle_color}`,
      plate: s.vehicle_plate, dropoff: s.dropoff_address,
      driverPosition: s.driver_lng != null && s.driver_lat != null ? { lng: s.driver_lng, lat: s.driver_lat } : null,
      pickup: { lng: s.pickup_lng, lat: s.pickup_lat }, dropoffPoint: { lng: s.dropoff_lng, lat: s.dropoff_lat }, updatedAt: s.updated_at,
    } satisfies SharedRide
  },

  messages: async (rid) => {
    const { data, error } = await sb().from('messages').select('id, sender_id, body, created_at').eq('ride_id', rid).order('created_at')
    if (error) throw toApiError(error)
    const me = uid()
    return (data ?? []).map((m): Message => ({ id: m.id, rideId: rid, from: m.sender_id === me ? 'me' : 'driver', text: m.body, at: m.created_at, status: 'sent' }))
  },
  onMessages: (rid, fn) => watch('messages', `ride_id=eq.${rid}`, ['INSERT'], () => { rides.messages(rid).then(fn).catch(() => {}) }),
  sendMessage: async (rid, text) => {
    const { data, error } = await sb().from('messages').insert({ ride_id: rid, sender_id: uid(), body: text.trim().slice(0, 1000) })
      .select('id, body, created_at').single()
    if (error) {
      const e = toApiError(error)
      throw e.code === 'forbidden' ? new ApiError('chat_closed', messageFor('chat_closed')) : e
    }
    return { id: data.id, rideId: rid, from: 'me', text: data.body, at: data.created_at, status: 'sent' } satisfies Message
  },
}

// ───────── aide ─────────

type TicketRow = {
  id: string; category: SupportTicket['category']; ride_id: string | null; status: SupportTicket['status']; created_at: string
  support_messages: { body: string; is_staff: boolean; created_at: string }[]
}
const support: Api['support'] = {
  tickets: async () => {
    const { data, error } = await sb().from('support_tickets')
      .select('id, category, ride_id, status, created_at, support_messages(body, is_staff, created_at)')
      .order('created_at', { ascending: false })
    if (error) throw toApiError(error)
    return ((data ?? []) as TicketRow[]).map((t): SupportTicket => ({
      id: t.id, category: t.category, rideId: t.ride_id ?? undefined, status: t.status, createdAt: t.created_at,
      messages: [...t.support_messages].sort((a, b) => a.created_at.localeCompare(b.created_at))
        .map((m) => ({ from: m.is_staff ? 'staff' : 'me', text: m.body, at: m.created_at })),
    }))
  },
  open: async (category, text, rideId) => {
    if (!text.trim()) throw new ApiError('message_required', messageFor('message_required'))
    const { data: t, error } = await sb().from('support_tickets').insert({ user_id: uid(), category, ride_id: rideId ?? null }).select('id, created_at').single()
    if (error) throw toApiError(error)
    const m = await sb().from('support_messages').insert({ ticket_id: t.id, sender_id: uid(), body: text.trim().slice(0, 4000) })
    if (m.error) throw toApiError(m.error)
    return { id: t.id, category, rideId, status: 'open', createdAt: t.created_at, messages: [{ from: 'me', text: text.trim(), at: t.created_at }] }
  },
  onTickets: (fn) => watch('support_messages', '', ['INSERT'], () => { support.tickets().then(fn).catch(() => {}) }),
}

export const live = { auth, account, geo, rides, support } satisfies Api & { auth: { ready: () => Promise<void> } }
