// Couche de données FACTICE : simule la base, les chauffeurs et le temps réel en mémoire.
// Mêmes fonctions et mêmes erreurs que la future couche Supabase (voir architecture.md) :
// la remplacer ne doit changer aucun écran.
import { casablanca, drivers, fares, myPosition, places, seedContacts, seedHistory, serviceArea } from './seed'
import {
  ApiError, type CancelReason, type EmergencyContact, type LngLat, type Message, type Offer, type PaymentMethod,
  type Place, type Profile, type Quote, type RideOption, type RideRequest, type RideSummary, type RideView,
  type ServiceCode, type Session, type SharedRide, type SupportTicket, type Unsubscribe,
} from './types'

// ───────── réglages de démo (S19 → « Mode démo ») ─────────

export type Scenario = 'normal' | 'no_offers' | 'counters_only' | 'network_error'
export const demo = { scenario: 'normal' as Scenario, speed: 1, latencyMs: 350 }

// ───────── outils ─────────

const now = () => Date.now()
const iso = (t = now()) => new Date(t).toISOString()
let seq = 0
const id = (p: string) => `${p}_${(++seq).toString(36)}${Math.random().toString(36).slice(2, 6)}`
const wait = (ms = demo.latencyMs) => new Promise<void>((r) => setTimeout(r, ms))

async function call<T>(fn: () => T): Promise<T> {
  await wait()
  if (demo.scenario === 'network_error') throw new ApiError('network', 'Connexion impossible. Vérifiez votre réseau.')
  return fn()
}

type Listener<T> = (v: T) => void
const channels = new Map<string, Set<Listener<unknown>>>()
function on<T>(channel: string, fn: Listener<T>): Unsubscribe {
  if (!channels.has(channel)) channels.set(channel, new Set())
  channels.get(channel)!.add(fn as Listener<unknown>)
  return () => { channels.get(channel)?.delete(fn as Listener<unknown>) }
}
function emit<T>(channel: string, v: T) { channels.get(channel)?.forEach((fn) => fn(v)) }

const R = 6371000
const rad = (d: number) => (d * Math.PI) / 180
export function distanceM(a: LngLat, b: LngLat) {
  const dLat = rad(b.lat - a.lat), dLng = rad(b.lng - a.lng)
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(h))
}
const lerp = (a: LngLat, b: LngLat, t: number): LngLat => ({ lng: a.lng + (b.lng - a.lng) * t, lat: a.lat + (b.lat - a.lat) * t })
const bearing = (a: LngLat, b: LngLat) => (Math.atan2(b.lng - a.lng, b.lat - a.lat) * 180 / Math.PI + 360) % 360
const inArea = (p: LngLat) => p.lng >= serviceArea.minLng && p.lng <= serviceArea.maxLng && p.lat >= serviceArea.minLat && p.lat <= serviceArea.maxLat

// Faux itinéraire « en escalier » qui ressemble à des rues, à la place de l'API Routes.
function fakeRoute(a: LngLat, b: LngLat): LngLat[] {
  const mid1 = { lng: a.lng + (b.lng - a.lng) * 0.35, lat: a.lat }
  const mid2 = { lng: mid1.lng, lat: a.lat + (b.lat - a.lat) * 0.7 }
  const mid3 = { lng: b.lng, lat: mid2.lat }
  return [a, mid1, mid2, mid3, b]
}
const routeLength = (r: LngLat[]) => r.slice(1).reduce((s, p, i) => s + distanceM(r[i], p), 0)
function alongRoute(r: LngLat[], t: number): LngLat & { heading: number } {
  const total = routeLength(r); let d = total * Math.max(0, Math.min(1, t))
  for (let i = 1; i < r.length; i++) {
    const seg = distanceM(r[i - 1], r[i])
    if (d <= seg || i === r.length - 1) {
      const p = lerp(r[i - 1], r[i], seg ? Math.min(1, d / seg) : 1)
      return { ...p, heading: bearing(r[i - 1], r[i]) }
    }
    d -= seg
  }
  return { ...r[r.length - 1], heading: 0 }
}

// Prix recommandé : même formule que compute_recommended_fare() en SQL.
export function recommendedFare(service: ServiceCode, dist: number, dur: number) {
  const f = fares[service]
  return Math.ceil(Math.max(f.min, f.base + (f.perKm * dist) / 1000 + (f.perMin * dur) / 60) / 100) * 100
}

// ───────── état en mémoire ─────────

const db = {
  session: null as Session | null,
  profiles: new Map<string, Profile>(),
  requests: new Map<string, RideRequest>(),
  offers: new Map<string, Offer>(),
  rides: new Map<string, RideView & { timers: ReturnType<typeof setTimeout>[]; durationS: number }>(),
  messages: new Map<string, Message[]>(),
  history: [...seedHistory] as RideSummary[],
  contacts: [...seedContacts] as EmergencyContact[],
  shares: new Map<string, string>(), // jeton → ride id
  tickets: [] as SupportTicket[],
  cancellations: [] as number[],
  recentPlaceIds: ['p3', 'p9'] as string[],
  timers: new Map<string, ReturnType<typeof setTimeout>[]>(), // par demande
  codeAttempts: 3,
}

const BLOCKED_PHONE = '0699999999'
const STORE_KEY = 'ride-demo-session'

// Sur le web, la session de démo survit au rechargement de la page (la vraie viendra de Supabase Auth).
function persist() {
  try {
    const s = db.session ? { session: db.session, profile: db.profiles.get(db.session.userId) } : null
    if (s) globalThis.localStorage?.setItem(STORE_KEY, JSON.stringify(s))
    else globalThis.localStorage?.removeItem(STORE_KEY)
  } catch { /* stockage indisponible : on reste en mémoire */ }
}
function restore() {
  try {
    const raw = globalThis.localStorage?.getItem(STORE_KEY)
    if (!raw) return
    const { session, profile } = JSON.parse(raw) as { session: Session; profile?: Profile }
    if (profile) db.profiles.set(profile.id, profile)
    if (db.profiles.has(session.userId)) db.session = session
  } catch { /* données illisibles : ignorées */ }
}
export const DEMO_CODE = '123456'

db.profiles.set('u_sara', { id: 'u_sara', phone: '+212612345678', firstName: 'Sara', locale: 'fr', rating: 4.8, ratingCount: 41, cityId: 'casa', status: 'active' })
restore()

function me(): Profile {
  if (!db.session) throw new ApiError('not_authenticated')
  const p = db.profiles.get(db.session.userId)
  if (!p) throw new ApiError('not_authenticated')
  if (p.status === 'restricted' && p.restrictedUntil && Date.parse(p.restrictedUntil) < now()) { p.status = 'active'; p.restrictedUntil = undefined }
  return p
}
function assertActive() {
  const p = me()
  if (p.status !== 'active') throw new ApiError('account_restricted', 'Votre compte est limité pour le moment.')
}

// ───────── compte (S02-S04, S19, S22) ─────────

export const auth = {
  session: () => db.session,
  onSession: (fn: Listener<Session | null>) => on('session', fn),

  sendCode: (phone: string) => call(() => {
    const digits = phone.replace(/\D/g, '')
    if (!/^0[67]\d{8}$/.test(digits)) throw new ApiError('invalid_phone', 'Ce numéro n’est pas un mobile marocain.')
    db.codeAttempts = 3
    return { resendInS: 45 }
  }),

  verifyCode: (phone: string, code: string) => call(() => {
    if (code !== DEMO_CODE) {
      db.codeAttempts -= 1
      if (db.codeAttempts <= 0) throw new ApiError('too_many_attempts', 'Trop d’essais. Demandez un nouveau code.')
      throw new ApiError('invalid_code', `Code incorrect. Il vous reste ${db.codeAttempts} essai${db.codeAttempts > 1 ? 's' : ''}.`)
    }
    const digits = phone.replace(/\D/g, '')
    let userId = [...db.profiles.values()].find((p) => p.phone === `+212${digits.slice(1)}`)?.id
    const isNew = !userId
    if (!userId) {
      userId = id('u')
      db.profiles.set(userId, {
        id: userId, phone: `+212${digits.slice(1)}`, firstName: '', locale: 'fr', rating: null, ratingCount: 0, cityId: 'casa',
        status: digits === BLOCKED_PHONE ? 'blocked' : 'active',
      })
    }
    db.session = { userId, phone: `+212${digits.slice(1)}`, isNew }
    persist()
    emit('session', db.session)
    return db.session
  }),

  signOut: async () => { db.session = null; persist(); emit('session', null) },
}

export const account = {
  profile: () => call(() => ({ ...me() })),
  city: () => call(() => casablanca),
  update: (patch: Partial<Pick<Profile, 'firstName' | 'email' | 'locale'>>) => call(() => {
    const p = me()
    if (patch.firstName !== undefined && !patch.firstName.trim()) throw new ApiError('first_name_required', 'Indiquez votre prénom.')
    if (patch.firstName && patch.firstName.length > 60) throw new ApiError('first_name_too_long', '60 caractères maximum.')
    Object.assign(p, patch)
    if (db.session) db.session.isNew = false
    persist()
    emit('profile', { ...p })
    return { ...p }
  }),
  onProfile: (fn: Listener<Profile>) => on('profile', fn),
  contacts: () => call(() => [...db.contacts]),
  addContact: (name: string, phone: string) => call(() => {
    const digits = phone.replace(/\D/g, '')
    if (!name.trim()) throw new ApiError('name_required', 'Indiquez un nom.')
    if (!/^0[5-7]\d{8}$/.test(digits)) throw new ApiError('invalid_phone', 'Numéro marocain à 10 chiffres.')
    if (db.contacts.length >= 5) throw new ApiError('too_many_contacts', '5 contacts maximum.')
    const c = { id: id('c'), name: name.trim(), phone: `+212${digits.slice(1)}` }
    db.contacts.push(c); return c
  }),
  removeContact: (cid: string) => call(() => { db.contacts = db.contacts.filter((c) => c.id !== cid) }),
  deleteAccount: () => call(() => {
    const p = me(); p.status = 'blocked'; p.firstName = 'Compte supprimé'
    db.session = null; persist(); emit('session', null)
  }),
}

// ───────── lieux (S06) ─────────

const norm = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()

export const geo = {
  myPosition: () => call(() => ({ ...myPosition })),
  reverse: (p: LngLat) => call((): Place => {
    const nearest = [...places].sort((a, b) => distanceM(a.point, p) - distanceM(b.point, p))[0]
    const d = distanceM(nearest.point, p)
    return d < 250
      ? { ...nearest, id: id('pl') }
      : { id: id('pl'), name: `Près de ${nearest.name}`, detail: `à ${Math.round(d / 10) * 10} m · position choisie`, point: p, kind: 'street' }
  }),
  recent: () => call(() => db.recentPlaceIds.map((pid) => places.find((p) => p.id === pid)!).filter(Boolean).map((p) => ({ ...p, kind: 'recent' as const }))),
  search: (text: string) => call(() => {
    const q = norm(text.trim())
    if (q.length < 2) return []
    return places.filter((p) => norm(p.name).includes(q) || norm(p.detail).includes(q)).slice(0, 8)
  }),
}

// ───────── devis et demande (S05, S07, S09) ─────────

export const rides = {
  quote: (pickup: LngLat, dropoff: LngLat, service: ServiceCode) => call((): Quote => {
    if (!inArea(pickup)) throw new ApiError('pickup_outside_service_area', 'Ce départ est hors de la zone desservie.')
    if (!inArea(dropoff)) throw new ApiError('dropoff_outside_service_area', 'Cette arrivée est hors de la zone desservie.')
    const route = fakeRoute(pickup, dropoff)
    const dist = Math.max(400, Math.round(routeLength(route) * 1.1))
    const dur = Math.round(dist / (22000 / 3600)) + 60
    if (dist < 300) throw new ApiError('too_short', 'Le départ et l’arrivée sont trop proches.')
    return { distanceM: dist, durationS: dur, recommendedCents: recommendedFare(service, dist, dur), route }
  }),

  createRequest: (input: {
    service: ServiceCode; pickup: Place; dropoff: Place; offeredCents: number; payment: PaymentMethod
    options: RideOption[]; passengers: number; comment?: string
  }) => call(() => {
    assertActive()
    if ([...db.requests.values()].some((r) => r.status === 'searching')) throw new ApiError('ride_requests_one_searching', 'Vous avez déjà une demande en cours.')
    if (!casablanca.paymentMethods.includes(input.payment)) throw new ApiError('payment_method_unavailable')
    const type = casablanca.rideTypes.find((t) => t.code === input.service)
    if (!type?.available) throw new ApiError('ride_type_unavailable', 'Ce service n’est pas encore disponible ici.')
    if (input.passengers > type.seatsMax) throw new ApiError('too_many_passengers', `${type.seatsMax} passagers maximum pour ce service.`)
    if (!inArea(input.pickup.point)) throw new ApiError('pickup_outside_service_area', 'Ce départ est hors de la zone desservie.')
    // Le serveur refait le calcul : le client n'est jamais cru.
    const route = fakeRoute(input.pickup.point, input.dropoff.point)
    const dist = Math.max(400, Math.round(routeLength(route) * 1.1))
    const dur = Math.round(dist / (22000 / 3600)) + 60
    const rec = recommendedFare(input.service, dist, dur)
    if (input.offeredCents < rec) throw new ApiError('fare_below_recommended', `Le minimum pour ce trajet est ${rec / 100} MAD.`)
    const r: RideRequest = {
      id: id('rq'), service: input.service, pickup: input.pickup, dropoff: input.dropoff, distanceM: dist, durationS: dur, route,
      recommendedCents: rec, offeredCents: input.offeredCents, payment: input.payment, options: input.options,
      passengers: input.passengers, comment: input.comment?.trim() || undefined, status: 'searching',
      createdAt: iso(), expiresAt: iso(now() + 10 * 60_000),
    }
    db.requests.set(r.id, r)
    db.recentPlaceIds = [input.dropoff.id, ...db.recentPlaceIds.filter((x) => x !== input.dropoff.id)].slice(0, 4)
    scheduleOffers(r, false)
    return { ...r }
  }),

  request: (rid: string) => call(() => {
    const r = db.requests.get(rid); if (!r) throw new ApiError('request_not_found')
    return { ...r }
  }),
  onRequest: (rid: string, fn: Listener<RideRequest>) => on(`request:${rid}`, fn),

  raiseFare: (rid: string, cents: number) => call(() => {
    assertActive()
    const r = db.requests.get(rid)
    if (!r || r.status !== 'searching' || cents <= r.offeredCents) throw new ApiError('request_not_raisable', 'Le nouveau prix doit être plus haut.')
    r.offeredCents = cents
    r.expiresAt = iso(Math.max(Date.parse(r.expiresAt), now() + 5 * 60_000))
    // une offre « accepte » sous le nouveau prix reste valable ; de nouveaux chauffeurs répondent
    scheduleOffers(r, true)
    emit(`request:${rid}`, { ...r })
    return { ...r }
  }),

  cancelRequest: (rid: string) => call(() => {
    const r = db.requests.get(rid)
    if (!r || r.status !== 'searching') throw new ApiError('request_not_cancellable')
    r.status = 'cancelled'
    clearRequestTimers(rid)
    for (const o of db.offers.values()) if (o.requestId === rid) db.offers.delete(o.id)
    emit(`offers:${rid}`, [])
    emit(`request:${rid}`, { ...r })
  }),

  offers: (rid: string) => call(() => liveOffers(rid)),
  onOffers: (rid: string, fn: Listener<Offer[]>) => on(`offers:${rid}`, fn),

  declineOffer: (oid: string) => call(() => {
    const o = db.offers.get(oid); if (!o) throw new ApiError('offer_not_declinable')
    db.offers.delete(oid); emit(`offers:${o.requestId}`, liveOffers(o.requestId))
  }),

  acceptOffer: (oid: string) => call(() => {
    assertActive()
    const o = db.offers.get(oid); if (!o) throw new ApiError('offer_expired', 'Cette offre n’est plus disponible.')
    const r = db.requests.get(o.requestId)!
    if (r.status !== 'searching') throw new ApiError('request_closed')
    if (Date.parse(o.expiresAt) <= now()) throw new ApiError('offer_expired', 'Cette offre vient d’expirer.')
    r.status = 'matched'
    clearRequestTimers(r.id)
    for (const x of db.offers.values()) if (x.requestId === r.id) db.offers.delete(x.id)
    const d = drivers.find((x) => x.id === o.driver.id)!
    const ride = {
      id: id('rd'), requestId: r.id, status: 'driver_en_route' as const, fareCents: o.fareCents, payment: r.payment,
      pickup: r.pickup, dropoff: r.dropoff, route: r.route, distanceM: r.distanceM, durationS: r.durationS,
      driver: { id: d.id, firstName: d.firstName, rating: d.rating, rides: d.rides },
      vehicle: { ...d.vehicle }, driverPosition: null, etaS: o.etaS, acceptedAt: iso(), rated: false,
      timers: [] as ReturnType<typeof setTimeout>[],
    }
    db.rides.set(ride.id, ride)
    db.messages.set(ride.id, [{ id: id('m'), rideId: ride.id, from: 'system', text: `${d.firstName} a accepté · ${new Date().toLocaleTimeString('fr-MA', { hour: '2-digit', minute: '2-digit' })}`, at: iso() }])
    emit(`offers:${r.id}`, [])
    emit(`request:${r.id}`, { ...r })
    simulateRide(ride.id, o.distanceM)
    return viewOf(ride.id)
  }),

  ride: (rid: string) => call(() => viewOf(rid)),
  onRide: (rid: string, fn: Listener<RideView>) => on(`ride:${rid}`, fn),

  // Pour reprendre l'app au bon écran après une coupure.
  active: () => call(() => {
    const ride = [...db.rides.values()].find((x) => ['driver_en_route', 'driver_arrived', 'in_progress'].includes(x.status))
    if (ride) return { rideId: ride.id }
    const done = [...db.rides.values()].find((x) => x.status === 'completed' && !x.rated)
    if (done) return { rideToRate: done.id }
    const req = [...db.requests.values()].find((x) => x.status === 'searching')
    return req ? { requestId: req.id } : {}
  }),

  cancelRide: (rid: string, reason: CancelReason, comment?: string) => call(() => {
    const ride = db.rides.get(rid)
    if (!ride) throw new ApiError('ride_not_found')
    if (!['driver_en_route', 'driver_arrived'].includes(ride.status)) throw new ApiError('ride_not_cancellable', 'La course a déjà commencé.')
    if (reason === 'other' && !comment?.trim()) throw new ApiError('reason_required', 'Dites-nous en quelques mots ce qui se passe.')
    ride.timers.forEach(clearTimeout)
    Object.assign(ride, { status: 'cancelled', cancelledAt: iso(), cancelledBy: 'passenger', cancelReason: reason, etaS: null })
    db.cancellations = [...db.cancellations.filter((t) => t > now() - 86_400_000), now()]
    if (db.cancellations.length > 3) {
      const p = me(); p.status = 'restricted'; p.restrictedUntil = iso(now() + 2 * 3_600_000); emit('profile', { ...p })
    }
    db.history.unshift(summaryOf(ride))
    emit(`ride:${rid}`, viewOf(rid))
    return viewOf(rid)
  }),

  rate: (rid: string, stars: number, tags: string[], comment?: string) => call(() => {
    const ride = db.rides.get(rid)
    if (!ride || ride.status !== 'completed') throw new ApiError('ride_not_rateable')
    if (ride.rated) throw new ApiError('ratings_ride_id_author_id_key', 'Vous avez déjà noté cette course.')
    if (stars < 1 || stars > 5) throw new ApiError('invalid_stars')
    void tags; void comment
    ride.rated = true
    const h = db.history.find((x) => x.id === rid); if (h) h.myStars = stars
  }),

  history: () => call(() => [...db.history].sort((a, b) => b.at.localeCompare(a.at))),
  historyItem: (hid: string) => call(() => {
    const h = db.history.find((x) => x.id === hid); if (!h) throw new ApiError('ride_not_found')
    return h
  }),

  // ── sécurité (S13, S21) ──
  createShareLink: (rid: string) => call(() => {
    const ride = db.rides.get(rid)
    if (!ride || !['driver_en_route', 'driver_arrived', 'in_progress'].includes(ride.status)) throw new ApiError('ride_not_shareable')
    const token = Math.random().toString(36).slice(2, 14)
    db.shares.set(token, rid)
    return token
  }),
  shared: (token: string) => call((): SharedRide | null => {
    const rid = db.shares.get(token); if (!rid) return null
    const r = db.rides.get(rid); if (!r) return null
    if (r.completedAt && Date.parse(r.completedAt) < now() - 3_600_000) return null
    return {
      status: r.status, driverFirstName: r.driver.firstName, vehicle: `${r.vehicle.make} ${r.vehicle.model} ${r.vehicle.color}`,
      plate: r.vehicle.plate, dropoff: r.dropoff.name,
      driverPosition: r.status === 'completed' || r.status === 'cancelled' ? null : r.driverPosition,
      pickup: r.pickup.point, dropoffPoint: r.dropoff.point, updatedAt: iso(),
    }
  }),

  // ── messagerie (S12) ──
  messages: (rid: string) => call(() => [...(db.messages.get(rid) ?? [])]),
  onMessages: (rid: string, fn: Listener<Message[]>) => on(`messages:${rid}`, fn),
  sendMessage: (rid: string, text: string) => call(() => {
    const ride = db.rides.get(rid)
    if (!ride || !['driver_en_route', 'driver_arrived', 'in_progress'].includes(ride.status)) throw new ApiError('chat_closed', 'La messagerie est fermée pour cette course.')
    const list = db.messages.get(rid) ?? []
    const m: Message = { id: id('m'), rideId: rid, from: 'me', text: text.trim().slice(0, 1000), at: iso(), status: 'sent' }
    list.push(m); db.messages.set(rid, list); emit(`messages:${rid}`, [...list])
    if (list.filter((x) => x.from === 'me').length === 1) {
      ride.timers.push(setTimeout(() => {
        list.push({ id: id('m'), rideId: rid, from: 'driver', text: 'Bien reçu, à tout de suite.', at: iso() })
        emit(`messages:${rid}`, [...list])
      }, 2500 / demo.speed))
    }
    return m
  }),
}

// ───────── support (S20) ─────────

export const support = {
  tickets: () => call(() => [...db.tickets]),
  open: (category: SupportTicket['category'], text: string, rideId?: string) => call(() => {
    if (!text.trim()) throw new ApiError('message_required', 'Décrivez votre problème.')
    const t: SupportTicket = { id: id('t'), category, rideId, status: 'open', createdAt: iso(), messages: [{ from: 'me', text: text.trim(), at: iso() }] }
    db.tickets.unshift(t)
    setTimeout(() => { t.messages.push({ from: 'staff', text: 'Merci, nous avons bien reçu votre message. Un conseiller vous répond ici, en général en moins d’une heure.', at: iso() }); t.status = 'waiting_user'; emit('tickets', [...db.tickets]) }, 2000)
    emit('tickets', [...db.tickets])
    return t
  }),
  onTickets: (fn: Listener<SupportTicket[]>) => on('tickets', fn),
}

// ───────── simulation ─────────

function liveOffers(rid: string) {
  return [...db.offers.values()].filter((o) => o.requestId === rid && Date.parse(o.expiresAt) > now())
    .sort((a, b) => a.fareCents - b.fareCents || a.etaS - b.etaS)
}

function clearRequestTimers(rid: string) {
  db.timers.get(rid)?.forEach(clearTimeout); db.timers.delete(rid)
}

function scheduleOffers(r: RideRequest, afterRaise: boolean) {
  if (demo.scenario === 'no_offers') return
  const taken = new Set([...db.offers.values()].filter((o) => o.requestId === r.id).map((o) => o.driver.id))
  const pool = drivers.filter((d) => !taken.has(d.id))
  const picks = afterRaise ? pool.slice(0, 2) : pool.slice(0, 3)
  const delays = afterRaise ? [2, 5] : [3, 6, 10]
  const timers = db.timers.get(r.id) ?? []
  picks.forEach((d, i) => {
    timers.push(setTimeout(() => {
      if (r.status !== 'searching') return
      const counter = demo.scenario === 'counters_only' || (!afterRaise && d.id === 'd2')
      const fare = counter ? Math.ceil((r.offeredCents * 1.1) / 100) * 100 : r.offeredCents
      const dist = 600 + i * 700 + Math.round(Math.random() * 400)
      const o: Offer = {
        id: id('of'), requestId: r.id, fareCents: Math.max(fare, r.offeredCents + (counter ? 100 : 0)), kind: counter ? 'counter' : 'accept',
        etaS: Math.round(dist / (22000 / 3600)) + 60, distanceM: dist, createdAt: iso(), expiresAt: iso(now() + 45_000),
        driver: { id: d.id, firstName: d.firstName, rating: d.rating, rides: d.rides },
        vehicle: { make: d.vehicle.make, model: d.vehicle.model, color: d.vehicle.color },
      }
      db.offers.set(o.id, o)
      emit(`offers:${r.id}`, liveOffers(r.id))
      timers.push(setTimeout(() => {
        if (db.offers.delete(o.id)) emit(`offers:${r.id}`, liveOffers(r.id))
      }, 45_000))
    }, (delays[i] * 1000) / demo.speed))
  })
  db.timers.set(r.id, timers)
}

function viewOf(rid: string): RideView {
  const r = db.rides.get(rid); if (!r) throw new ApiError('ride_not_found')
  const { timers, durationS, ...view } = r
  void timers; void durationS
  return { ...view, driverPosition: view.driverPosition ? { ...view.driverPosition } : null }
}

function summaryOf(r: RideView & { durationS: number }): RideSummary {
  return {
    id: r.id, at: r.acceptedAt, pickup: r.pickup.name, dropoff: r.dropoff.name, fareCents: r.fareCents,
    status: r.status === 'completed' ? 'completed' : 'cancelled', driverName: r.driver.firstName,
    vehicle: `${r.vehicle.make} ${r.vehicle.model} ${r.vehicle.color}`, payment: r.payment, distanceM: r.distanceM, durationS: r.durationS,
  }
}

// Le chauffeur rejoint le départ, attend, puis roule jusqu'à l'arrivée. Durées raccourcies pour la démo.
function simulateRide(rid: string, approachM: number) {
  const ride = db.rides.get(rid)!
  const start = { lng: ride.pickup.point.lng + approachM / 92000, lat: ride.pickup.point.lat - approachM / 160000 }
  const approach = fakeRoute(start, ride.pickup.point)
  const eta0 = ride.etaS ?? 60
  const approachS = Math.min(eta0, 20) / demo.speed
  const tripS = Math.min(ride.durationS, 30) / demo.speed
  const tick = 1000
  let t0 = now()
  const push = () => emit(`ride:${rid}`, viewOf(rid))

  ride.driverPosition = { ...start, heading: bearing(start, ride.pickup.point) }
  const enRoute = setInterval(() => {
    if (ride.status !== 'driver_en_route') return clearInterval(enRoute)
    const p = Math.min(1, (now() - t0) / (approachS * 1000))
    ride.driverPosition = alongRoute(approach, p)
    ride.etaS = Math.round((1 - p) * eta0)
    if (p >= 1) {
      clearInterval(enRoute)
      Object.assign(ride, { status: 'driver_arrived', arrivedAt: iso(), etaS: 0 })
      ride.timers.push(setTimeout(startTrip, 8000 / demo.speed))
    }
    push()
  }, tick)
  ride.timers.push(enRoute as unknown as ReturnType<typeof setTimeout>)

  function startTrip() {
    if (ride.status !== 'driver_arrived') return
    Object.assign(ride, { status: 'in_progress', startedAt: iso(), etaS: ride.durationS })
    t0 = now()
    const trip = setInterval(() => {
      if (ride.status !== 'in_progress') return clearInterval(trip)
      const p = Math.min(1, (now() - t0) / (tripS * 1000))
      ride.driverPosition = alongRoute(ride.route, p)
      ride.etaS = Math.round(ride.durationS * (1 - p))
      if (p >= 1) {
        clearInterval(trip)
        Object.assign(ride, { status: 'completed', completedAt: iso(), etaS: null })
        db.history.unshift(summaryOf(ride))
      }
      push()
    }, tick)
    ride.timers.push(trip as unknown as ReturnType<typeof setTimeout>)
    push()
  }
  push()
}
