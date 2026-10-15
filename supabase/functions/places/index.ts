// Recherche d'adresse et adresse d'un point (S06). Google Places / Geocoding si la clé existe,
// sinon les lieux connus de Casablanca. Réservé aux utilisateurs connectés (coût par appel).
import { z } from 'npm:zod@3.23.8'
import { caller, fail, handle, json } from '../_shared/http.ts'
import { landmarks } from '../_shared/landmarks.ts'
import { haversine } from '../_shared/route.ts'

const Input = z.discriminatedUnion('action', [
  z.object({ action: z.literal('search'), text: z.string().trim().min(2).max(100), near: z.object({ lng: z.number(), lat: z.number() }).optional() }),
  z.object({ action: z.literal('reverse'), lng: z.number().min(-180).max(180), lat: z.number().min(-90).max(90) }),
])
type Place = { name: string; detail: string; lng: number; lat: number }
const norm = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()

Deno.serve(handle(async (req) => {
  if (!(await caller(req))) return fail('not_authenticated', 401)
  const parsed = Input.safeParse(await req.json().catch(() => null))
  if (!parsed.success) return fail('invalid_input')
  const key = Deno.env.get('GOOGLE_MAPS_API_KEY')
  const p = parsed.data

  if (p.action === 'search') {
    if (key) {
      const near = p.near ?? { lng: -7.6186, lat: 33.5937 }
      const res = await fetch('https://places.googleapis.com/v1/places:searchText', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Goog-Api-Key': key, 'X-Goog-FieldMask': 'places.displayName,places.formattedAddress,places.location' },
        body: JSON.stringify({
          textQuery: p.text, languageCode: 'fr', regionCode: 'MA', pageSize: 8,
          locationBias: { circle: { center: { latitude: near.lat, longitude: near.lng }, radius: 30000 } },
        }),
      })
      if (res.ok) {
        const places = ((await res.json()).places ?? []) as { displayName?: { text: string }; formattedAddress?: string; location: { latitude: number; longitude: number } }[]
        return json(places.map((x): Place => ({ name: x.displayName?.text ?? x.formattedAddress ?? '', detail: x.formattedAddress ?? '', lng: x.location.longitude, lat: x.location.latitude })))
      }
      console.error('places api', res.status, await res.text())
    }
    const q = norm(p.text)
    return json(landmarks.filter((l) => norm(l.name).includes(q) || norm(l.detail).includes(q)).slice(0, 8))
  }

  if (key) {
    const url = `https://maps.googleapis.com/maps/api/geocode/json?latlng=${p.lat},${p.lng}&language=fr&key=${key}`
    const res = await fetch(url)
    if (res.ok) {
      const r = (await res.json()).results?.[0]
      if (r) {
        const [first, ...rest] = String(r.formatted_address).split(',')
        return json({ name: first.trim(), detail: rest.join(',').trim(), lng: p.lng, lat: p.lat } satisfies Place)
      }
    }
  }
  const nearest = [...landmarks].sort((a, b) => haversine(a, p) - haversine(b, p))[0]
  const d = haversine(nearest, p)
  return json((d < 250
    ? { ...nearest }
    : { name: `Près de ${nearest.name}`, detail: `à ${Math.round(d / 10) * 10} m · position choisie`, lng: p.lng, lat: p.lat }) satisfies Place)
}))
