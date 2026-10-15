// Devis : itinéraire + prix conseillé, sans rien enregistrer (S05, S07).
import { z } from 'npm:zod@3.23.8'
import { admin, caller, fail, handle, json, sqlCode } from '../_shared/http.ts'
import { computeRoute } from '../_shared/route.ts'

const Point = z.object({ lng: z.number().min(-180).max(180), lat: z.number().min(-90).max(90) })
const Input = z.object({ pickup: Point, dropoff: Point, service: z.enum(['economy', 'comfort', 'xl', 'moto']) })

Deno.serve(handle(async (req) => {
  if (!(await caller(req))) return fail('not_authenticated', 401)
  const parsed = Input.safeParse(await req.json().catch(() => null))
  if (!parsed.success) return fail('invalid_input')
  const { pickup, dropoff, service } = parsed.data
  const db = admin()

  const type = await db.rpc('quote_ride_type', { p_code: service, p_pickup_lng: pickup.lng, p_pickup_lat: pickup.lat, p_dropoff_lng: dropoff.lng, p_dropoff_lat: dropoff.lat })
  if (type.error) return fail(sqlCode(type.error.message))

  const route = await computeRoute(pickup, dropoff)
  if (route.distanceM < 300) return fail('too_short')
  const fare = await db.rpc('compute_recommended_fare', { p_ride_type: type.data, p_distance_m: route.distanceM, p_duration_s: route.durationS })
  if (fare.error) return fail(sqlCode(fare.error.message))

  return json({ distanceM: route.distanceM, durationS: route.durationS, recommendedCents: fare.data, polyline: route.polyline, source: route.source })
}))
