// Crée la demande : le serveur refait l'itinéraire et le prix, le client n'est jamais cru (S05 → S09).
import { z } from 'npm:zod@3.23.8'
import { admin, caller, fail, handle, json, sqlCode } from '../_shared/http.ts'
import { computeRoute } from '../_shared/route.ts'

const Place = z.object({
  name: z.string().trim().min(1).max(200),
  detail: z.string().max(200).default(''),
  lng: z.number().min(-180).max(180),
  lat: z.number().min(-90).max(90),
})
const Input = z.object({
  service: z.enum(['economy', 'comfort', 'xl', 'moto']),
  pickup: Place,
  dropoff: Place,
  offeredCents: z.number().int().positive().max(1_000_000),
  payment: z.enum(['cash', 'card', 'wallet']),
  options: z.array(z.enum(['child_seat', 'luggage', 'pet'])).max(3).default([]),
  passengers: z.number().int().min(1).max(8).default(1),
  comment: z.string().max(280).optional(),
})

Deno.serve(handle(async (req) => {
  const user = await caller(req)
  if (!user) return fail('not_authenticated', 401)
  const parsed = Input.safeParse(await req.json().catch(() => null))
  if (!parsed.success) return fail('invalid_input')
  const i = parsed.data
  const db = admin()

  const type = await db.rpc('quote_ride_type', { p_code: i.service, p_pickup_lng: i.pickup.lng, p_pickup_lat: i.pickup.lat, p_dropoff_lng: i.dropoff.lng, p_dropoff_lat: i.dropoff.lat })
  if (type.error) return fail(sqlCode(type.error.message))
  const route = await computeRoute(i.pickup, i.dropoff)

  const { data, error } = await db.rpc('create_ride_request', {
    p_passenger: user.id, p_ride_type: type.data,
    p_pickup_lng: i.pickup.lng, p_pickup_lat: i.pickup.lat, p_pickup_address: i.pickup.name, p_pickup_detail: i.pickup.detail,
    p_dropoff_lng: i.dropoff.lng, p_dropoff_lat: i.dropoff.lat, p_dropoff_address: i.dropoff.name, p_dropoff_detail: i.dropoff.detail,
    p_distance_m: route.distanceM, p_duration_s: route.durationS, p_route_polyline: route.polyline,
    p_offered_fare_cents: i.offeredCents, p_payment_method: i.payment,
    p_passengers_count: i.passengers, p_options: Object.fromEntries(i.options.map((o) => [o, true])), p_comment: i.comment ?? null,
  })
  if (error) {
    // l'index « une seule demande en recherche » remonte avec le nom de la contrainte
    if (error.message.includes('ride_requests_one_searching')) return fail('ride_requests_one_searching', 409)
    return fail(sqlCode(error.message))
  }
  return json({ id: (data as { id: string }).id })
}))
