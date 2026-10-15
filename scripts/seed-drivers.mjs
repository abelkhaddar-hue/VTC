// Crée (ou met à jour) les 5 chauffeurs de test : compte, profil, statut validé, véhicule.
// Usage : npm run seed   (scripts/.env avec la clé service du projet de TEST uniquement)
import { createClient } from '@supabase/supabase-js'
import { CASABLANCA, env, testDrivers } from './drivers.mjs'

const { url, key } = env()
const db = createClient(url, key, { auth: { persistSession: false } })

async function findUserByPhone(phone) {
  for (let page = 1; page < 20; page++) {
    const { data, error } = await db.auth.admin.listUsers({ page, perPage: 200 })
    if (error) throw error
    const u = data.users.find((x) => `+${(x.phone ?? '').replace(/^\+/, '')}` === phone)
    if (u) return u
    if (data.users.length < 200) return null
  }
  return null
}

for (const d of testDrivers) {
  let user = await findUserByPhone(d.phone)
  if (!user) {
    const { data, error } = await db.auth.admin.createUser({ phone: d.phone, phone_confirm: true })
    if (error) throw error
    user = data.user
  }
  const id = user.id
  const step = async (label, q) => { const { error } = await q; if (error) throw new Error(`${d.firstName} / ${label} : ${error.message}`) }
  await step('profil', db.from('profiles').update({ first_name: d.firstName, rating_sum: d.ratingSum, rating_count: d.ratingCount, city_id: CASABLANCA }).eq('id', id))
  await step('chauffeur', db.from('drivers').upsert({ id, city_id: CASABLANCA, verification_status: 'approved', verified_at: new Date().toISOString() }))
  const { data: v } = await db.from('vehicles').select('id').eq('driver_id', id).eq('is_active', true).maybeSingle()
  if (!v) await step('véhicule', db.from('vehicles').insert({ driver_id: id, ...d.vehicle, ride_type_codes: ['economy', 'comfort', 'xl'] }))
  console.log(`✓ ${d.firstName} (${d.phone}) prêt`)
}
console.log('Chauffeurs de test en place. Lancez maintenant : npm run simulate')
