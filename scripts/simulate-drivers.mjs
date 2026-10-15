// Simulateur de chauffeurs pour le projet de TEST, en attendant l'app chauffeur.
// Il écoute les demandes en temps réel et joue le rôle des 5 chauffeurs de test :
// offres (dont une contre-offre), trajet jusqu'au départ, course, réponse dans la messagerie.
// Tout passe par les mêmes fonctions SQL que la future app chauffeur (supabase/dev/simulator.sql).
// Usage : npm run simulate   (laisser tourner ; Ctrl+C pour arrêter)
import { createClient } from '@supabase/supabase-js'
import { env, testDrivers } from './drivers.mjs'

const { url, key } = env()
const db = createClient(url, key, { auth: { persistSession: false } })
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const log = (...a) => console.log(new Date().toLocaleTimeString('fr-MA'), ...a)

// ── chauffeurs de test ──
const { data: profiles, error } = await db.from('profiles').select('id, phone, first_name').in('phone', testDrivers.map((d) => d.phone))
if (error || !profiles?.length) { console.error('Chauffeurs introuvables : lancez d’abord « npm run seed ».'); process.exit(1) }
const drivers = testDrivers.map((d) => profiles.find((p) => p.phone === d.phone)).filter(Boolean)
const byId = new Map(drivers.map((d) => [d.id, d]))
log(`${drivers.length} chauffeurs de test : ${drivers.map((d) => d.first_name).join(', ')}`)

const rpc = async (fn, args) => {
  const { data, error } = await db.rpc(fn, args)
  if (error) throw new Error(`${fn} : ${error.message}`)
  return data
}
const info = async (requestId) => (await rpc('sim_request_info', { p_request: requestId }))?.[0]
const near = (p, i) => ({ lng: p.lng + 0.004 + i * 0.003, lat: p.lat - 0.003 - i * 0.002 }) // 500 m à 1,5 km
const heading = (a, b) => Math.round((Math.atan2(b.lng - a.lng, b.lat - a.lat) * 180 / Math.PI + 360) % 360)
const lastPos = new Map()
async function move(driverId, p, h = 0) {
  lastPos.set(driverId, p)
  await rpc('sim_driver_location', { p_driver: driverId, p_lng: p.lng, p_lat: p.lat, p_heading: h })
}

// Polyline Google → points
function decode(s) {
  const pts = []; let i = 0, lat = 0, lng = 0
  const next = () => { let r = 0, sh = 0, b; do { b = s.charCodeAt(i++) - 63; r |= (b & 0x1f) << sh; sh += 5 } while (b >= 0x20); return r & 1 ? ~(r >> 1) : r >> 1 }
  while (i < (s ?? '').length) { lat += next(); lng += next(); pts.push({ lat: lat / 1e5, lng: lng / 1e5 }) }
  return pts
}
function along(points, t) {
  if (points.length < 2) return points[0]
  const segs = points.slice(1).map((p, i) => Math.hypot(p.lng - points[i].lng, p.lat - points[i].lat))
  let d = segs.reduce((a, b) => a + b, 0) * Math.min(1, Math.max(0, t))
  for (let i = 0; i < segs.length; i++) {
    if (d <= segs[i] || i === segs.length - 1) {
      const k = segs[i] ? Math.min(1, d / segs[i]) : 1
      return { lng: points[i].lng + (points[i + 1].lng - points[i].lng) * k, lat: points[i].lat + (points[i + 1].lat - points[i].lat) * k, h: heading(points[i], points[i + 1]) }
    }
    d -= segs[i]
  }
}

// ── offres ──
const offered = new Map() // demande → chauffeurs ayant déjà répondu
async function answer(requestId, wave) {
  const q = await info(requestId)
  if (!q || q.status !== 'searching') return
  const pickup = { lng: q.pickup_lng, lat: q.pickup_lat }
  const done = offered.get(requestId) ?? new Set()
  offered.set(requestId, done)
  const team = drivers.filter((d) => !done.has(d.id)).slice(0, wave === 0 ? 3 : 2)
  const delays = wave === 0 ? [3, 6, 10] : [2, 5]
  team.forEach((d, i) => setTimeout(async () => {
    try {
      const now = await info(requestId)
      if (now?.status !== 'searching') return
      await move(d.id, near(pickup, i))
      const counter = wave === 0 && d.first_name === 'Youssef'
      const fare = counter ? Math.ceil((now.offered_fare_cents * 1.1) / 100) * 100 : null
      await rpc('sim_driver_offer', { p_driver: d.id, p_request: requestId, p_fare_cents: fare })
      done.add(d.id)
      log(`${d.first_name} → ${counter ? `contre-offre ${fare / 100} MAD` : `accepte ${now.offered_fare_cents / 100} MAD`}`)
    } catch (e) { log(`${d.first_name} n’a pas pu répondre : ${e.message}`) }
  }, delays[i] * 1000))
}

// ── course ──
const driving = new Set()
const busy = new Set() // chauffeurs en course
async function drive(ride) {
  if (driving.has(ride.id) || !byId.has(ride.driver_id)) return
  driving.add(ride.id); busy.add(ride.driver_id)
  const name = byId.get(ride.driver_id).first_name
  const q = await info(ride.request_id)
  const pickup = { lng: q.pickup_lng, lat: q.pickup_lat }
  const status = async () => (await db.from('rides').select('status').eq('id', ride.id).single()).data?.status
  try {
    log(`${name} part chercher le passager`)
    const start = lastPos.get(ride.driver_id) ?? near(pickup, 0)
    for (let t = 0; t <= 1; t += 0.15) {
      if ((await status()) !== 'driver_en_route') return log(`${name} : course annulée`)
      const p = along([start, { lng: start.lng, lat: pickup.lat }, pickup], t)
      await move(ride.driver_id, p, p.h); await sleep(3000)
    }
    await move(ride.driver_id, pickup)
    await rpc('sim_driver_advance', { p_driver: ride.driver_id, p_ride: ride.id, p_to: 'driver_arrived' })
    log(`${name} est arrivé`)
    await sleep(8000)
    if ((await status()) !== 'driver_arrived') return log(`${name} : course annulée`)
    await rpc('sim_driver_advance', { p_driver: ride.driver_id, p_ride: ride.id, p_to: 'in_progress' })
    log(`${name} : course commencée`)
    const route = decode(q.route_polyline)
    for (let t = 0; t <= 1.0001; t += 0.1) {
      const p = along(route, t); await move(ride.driver_id, p, p.h); await sleep(3000)
    }
    await rpc('sim_driver_advance', { p_driver: ride.driver_id, p_ride: ride.id, p_to: 'completed' })
    log(`${name} : course terminée (${ride.fare_cents / 100} MAD)`)
  } catch (e) { log(`${name} : ${e.message}`) } finally { driving.delete(ride.id); busy.delete(ride.driver_id) }
}

// ── temps réel ──
const replied = new Set()
const prices = new Map()
db.channel('simulateur')
  .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'ride_requests' }, ({ new: r }) => {
    prices.set(r.id, r.offered_fare_cents); log('Nouvelle demande'); answer(r.id, 0)
  })
  // l'ancienne valeur n'est pas envoyée par la base : on garde le dernier prix connu
  .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'ride_requests' }, ({ new: r }) => {
    const before = prices.get(r.id)
    prices.set(r.id, r.offered_fare_cents)
    if (r.status === 'searching' && before !== undefined && r.offered_fare_cents > before) { log(`Prix augmenté à ${r.offered_fare_cents / 100} MAD`); answer(r.id, 1) }
  })
  .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'rides' }, ({ new: ride }) => drive(ride))
  .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, async ({ new: m }) => {
    if (byId.has(m.sender_id) || replied.has(m.ride_id)) return
    const { data: ride } = await db.from('rides').select('driver_id').eq('id', m.ride_id).single()
    if (!ride || !byId.has(ride.driver_id)) return
    replied.add(m.ride_id)
    await sleep(2500)
    await rpc('sim_driver_message', { p_driver: ride.driver_id, p_ride: m.ride_id, p_body: 'Bien reçu, à tout de suite.' }).catch((e) => log(e.message))
  })
  .subscribe((s) => log(s === 'SUBSCRIBED' ? 'À l’écoute des demandes. Commandez une course dans l’app.' : `Temps réel : ${s}`))

// Garder les chauffeurs « en ligne » (hors ligne automatique après 2 min sans position).
const parking = { lng: -7.6186, lat: 33.5937 }
setInterval(() => drivers.forEach((d, i) => { if (!busy.has(d.id)) move(d.id, lastPos.get(d.id) ?? near(parking, i)).catch(() => {}) }), 60_000)
drivers.forEach((d, i) => move(d.id, near(parking, i)).catch((e) => log(e.message)))
