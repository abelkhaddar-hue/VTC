import { PGlite } from '@electric-sql/pglite'
import { postgis } from '@electric-sql/pglite-postgis'
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

// Usage : node tests.mjs <dossier supabase>  — charge migrations + seed + simulateur de dev, puis joue les scénarios.
const dir = process.argv[2]

const db = await PGlite.create({ extensions: { postgis } })
const ok = (m) => console.log('  ok  ', m)
let failures = 0
const fail = (m) => { failures++; console.log('  FAIL', m) }

// Simule l'environnement Supabase : rôles, schéma auth, auth.uid()
await db.exec(`
  create schema extensions; set search_path = public, extensions;
  create role anon nologin; create role authenticated nologin; create role service_role nologin bypassrls;
  create schema auth;
  create table auth.users (id uuid primary key default gen_random_uuid(), phone text, email text);
  -- même définition que Supabase : claim.sub, sinon le JSON des claims
  create function auth.uid() returns uuid language sql stable as
    $$ select coalesce(nullif(current_setting('request.jwt.claim.sub', true), ''),
                       (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub'))::uuid $$;
  grant usage on schema auth, extensions, public to anon, authenticated, service_role;
  grant execute on function auth.uid() to anon, authenticated, service_role;
`)
const files = [
  ...readdirSync(join(dir, 'migrations')).filter((f) => f.endsWith('.sql')).sort().map((f) => join(dir, 'migrations', f)),
  join(dir, 'seed.sql'),
  join(dir, 'dev', 'simulator.sql'),
]
for (const f of files) {
  try { await db.exec(readFileSync(f, 'utf8')) } catch (e) { console.log('ERREUR SQL', f, ':', e.message, 'pos', e.position, e.where ?? ''); process.exit(1) }
}
// Les droits sur les tables viennent de la migration grants (pas de droits « tout » ici).
await db.exec(`grant execute on all functions in schema extensions to anon, authenticated, service_role;`)
ok(`schéma chargé (${files.length} fichiers)`)

const as = async (role, uid, sql, params = []) => {
  await db.exec(`reset role; select set_config('request.jwt.claim.sub', '${uid ?? ''}', false); set role ${role};`)
  try { return (await db.query(sql, params)).rows } finally { await db.exec('reset role') }
}
const expectErr = async (label, fn, code) => {
  try { await fn(); fail(label + ' (aucune erreur)') }
  catch (e) { e.message.includes(code) ? ok(label + ' → ' + code) : fail(label + ' → ' + e.message) }
}

// Données : Casablanca, une gamme, un passager, deux chauffeurs
// Casablanca et ses gammes viennent de seed.sql
const [{ id: city }] = (await db.query(`select id from cities where name = 'Casablanca'`)).rows
const [{ id: eco }] = (await db.query(`select id from ride_types where city_id = $1 and code = 'economy'`, [city])).rows
const mkUser = async (phone) => (await db.query(`insert into auth.users (phone) values ($1) returning id`, [phone])).rows[0].id
const pax = await mkUser('+212600000001'), d1 = await mkUser('+212600000002'), d2 = await mkUser('+212600000003'), other = await mkUser('+212600000004')
await db.query(`update profiles set first_name = 'Sara' where id = $1`, [pax])
for (const [d, name, plate, lng] of [[d1, 'Karim', '12345-A-6', -7.62], [d2, 'Youssef', '6789-B-1', -7.63]]) {
  await db.query(`update profiles set first_name = $2 where id = $1`, [d, name])
  await db.query(`insert into drivers (id, city_id, verification_status) values ($1, $2, 'approved')`, [d, city])
  await db.query(`insert into vehicles (driver_id, make, model, color, plate) values ($1, 'Dacia', 'Logan', 'blanche', $2)`, [d, plate])
  await as('authenticated', d, `select driver_set_online(true)`)
  await as('authenticated', d, `select driver_update_location($1, 33.59, 90::smallint)`, [lng])
}
ok('données de départ')

// F01 : le passager crée sa demande (via l'Edge Function = service_role)
const rec = (await db.query(`select compute_recommended_fare($1, 5400, 900) f`, [eco])).rows[0].f
rec === 3400 ? ok('prix recommandé 34 MAD pour 5,4 km / 15 min') : fail('prix recommandé = ' + rec)
await expectErr('client ne peut pas créer une demande directement',
  () => as('authenticated', pax, `select create_ride_request($1,$2,-7.6,33.59,'A','',-7.55,33.57,'B','',5400,900,null,3800,'cash')`, [pax, eco]), 'permission denied')
await expectErr('prix sous le recommandé refusé',
  () => as('service_role', null, `select create_ride_request($1,$2,-7.6,33.59,'A','',-7.55,33.57,'B','',5400,900,null,3000,'cash')`, [pax, eco]), 'fare_below_recommended')
await expectErr('départ hors zone refusé',
  () => as('service_role', null, `select create_ride_request($1,$2,-5.0,35.0,'A','',-7.55,33.57,'B','',5400,900,null,4000,'cash')`, [pax, eco]), 'pickup_outside_service_area')
const [{ id: req }] = await as('service_role', null,
  `select (create_ride_request($1,$2,-7.6,33.59,'Mosquée Hassan II','',-7.55,33.57,'Morocco Mall','',5400,900,null,4000,'cash')).id`, [pax, eco])
ok('demande créée à 40 MAD')
await expectErr('deuxième demande simultanée refusée',
  () => as('service_role', null, `select create_ride_request($1,$2,-7.6,33.59,'A','',-7.55,33.57,'B','',5400,900,null,4000,'cash')`, [pax, eco]), 'ride_requests_one_searching')

// RLS
;(await as('authenticated', other, `select * from ride_requests`)).length === 0 ? ok('un autre utilisateur ne voit pas la demande') : fail('fuite de demande')
await expectErr('anonyme ne peut pas lire les profils', () => as('anon', null, `select * from profiles`), 'permission denied')
;(await as('authenticated', pax, `select * from profiles`)).length === 1 ? ok('passager ne voit que son profil') : fail('profils visibles')
await expectErr('le passager ne peut pas toucher à sa note', () => as('authenticated', pax, `update profiles set rating_sum = 999, rating_count = 1 where id = $1`, [pax]), 'permission denied')
await as('authenticated', pax, `update profiles set first_name = 'Sara B.' where id = $1`, [pax])
await as('authenticated', pax, `update profiles set first_name = 'Pirate' where id = $1`, [d1])
const me = (await db.query(`select rating_sum, first_name from profiles where id = $1`, [pax])).rows[0]
me.rating_sum === 0 && me.first_name === 'Sara B.' && (await db.query(`select first_name from profiles where id = $1`, [d1])).rows[0].first_name !== 'Pirate' ? ok('le passager change son prénom, pas celui des autres') : fail(JSON.stringify(me))

// Enchères
const near = await as('authenticated', d1, `select * from driver_nearby_requests()`)
near.length === 1 && near[0].passenger_first_name === 'Sara B.' ? ok('chauffeur 1 voit la demande à ' + near[0].distance_to_pickup_m + ' m') : fail('nearby ' + JSON.stringify(near))
await expectErr('contre-offre plus basse refusée', () => as('authenticated', d1, `select driver_make_offer($1, 3000)`, [req]), 'counter_must_be_higher')
const [{ id: o1 }] = await as('authenticated', d1, `select (driver_make_offer($1)).id`, [req])
const [{ id: o2 }] = await as('authenticated', d2, `select (driver_make_offer($1, 4500)).id`, [req])
const [{ id: o2b }] = await as('authenticated', d2, `select (driver_make_offer($1, 4400)).id`, [req])
const offers = await as('authenticated', pax, `select * from request_offers($1)`, [req])
offers.length === 2 && offers[0].fare_cents === 4000 && offers[0].kind === 'accept' && offers[1].fare_cents === 4400
  ? ok('passager voit 2 offres : 40 MAD (accepte) et 44 MAD (contre-offre, remplace 45)') : fail('offres ' + JSON.stringify(offers))
;(await as('authenticated', other, `select * from request_offers($1)`, [req])).length === 0 ? ok('un tiers ne voit pas les offres') : fail('fuite offres')
await expectErr('raise_fare par un tiers', () => as('authenticated', other, `select raise_fare($1, 4200)`, [req]), 'request_not_raisable')

// Acceptation atomique
const [{ id: ride }] = await as('authenticated', pax, `select (accept_offer($1)).id`, [o2b])
ok('passager accepte l\'offre de Youssef')
await expectErr('deuxième acceptation refusée', () => as('authenticated', pax, `select accept_offer($1)`, [o1]), 'request_closed')
const st = (await db.query(`select status from offers where id = $1`, [o1])).rows[0].status
st === 'expired' ? ok('l\'autre offre est fermée') : fail('offre 1 = ' + st)
const view = (await as('authenticated', pax, `select * from ride_view($1)`, [ride]))[0]
view.counterpart_first_name === 'Youssef' && view.vehicle_plate === '6789-B-1' && view.driver_lng !== null ? ok('vue course : chauffeur, plaque, position') : fail(JSON.stringify(view))
;(await as('authenticated', other, `select * from ride_view($1)`, [ride])).length === 0 ? ok('un tiers ne voit pas la course') : fail('fuite course')
;(await as('authenticated', d1, `select * from driver_nearby_requests()`)).length === 0 ? ok('demande disparaît pour les autres chauffeurs') : fail('demande encore visible')

// Pendant la course
await as('authenticated', pax, `insert into messages (ride_id, sender_id, body) values ($1, $2, 'Je suis devant')`, [ride, pax])
await expectErr('un tiers ne peut pas écrire', () => as('authenticated', other, `insert into messages (ride_id, sender_id, body) values ($1, $2, 'x')`, [ride, other]), 'row-level security')
const [{ token }] = await as('authenticated', pax, `select create_share_link($1) as token`, [ride])
const shared = await as('anon', null, `select * from shared_ride($1)`, [token])
shared.length === 1 && shared[0].vehicle_plate === '6789-B-1' ? ok('lien partagé lisible sans compte') : fail('partage ' + JSON.stringify(shared))
;(await as('anon', null, `select * from shared_ride('faux')`)).length === 0 ? ok('faux jeton → rien') : fail('faux jeton')
await as('authenticated', d2, `select driver_update_location(-7.61, 33.585, 80::smallint)`)
const pts = (await db.query(`select count(*)::int n from ride_locations where ride_id = $1`, [ride])).rows[0].n
pts === 1 ? ok('trace GPS enregistrée') : fail('points GPS = ' + pts)

await expectErr('le passager ne peut pas terminer la course', () => as('authenticated', pax, `select driver_advance_ride($1, 'completed')`, [ride]), 'ride_not_found')
await expectErr('transition sautée refusée', () => as('authenticated', d2, `select driver_advance_ride($1, 'completed')`, [ride]), 'invalid_transition')
for (const s of ['driver_arrived', 'in_progress', 'completed']) await as('authenticated', d2, `select driver_advance_ride($1, $2)`, [ride, s])
const pay = (await db.query(`select status, amount_cents from payments where ride_id = $1`, [ride])).rows[0]
pay?.status === 'cash_declared' && pay.amount_cents === 4400 ? ok('course terminée, espèces 44 MAD enregistrées') : fail('paiement ' + JSON.stringify(pay))

// Notes
await as('authenticated', pax, `select rate_ride($1, 5::smallint, '{propre,poli}')`, [ride])
await expectErr('noter deux fois refusé', () => as('authenticated', pax, `select rate_ride($1, 1::smallint)`, [ride]), 'ratings_ride_id_author_id_key')
await as('authenticated', d2, `select rate_ride($1, 4::smallint)`, [ride])
const r = (await db.query(`select (select rating_count from profiles where id=$1) d, (select rating_sum from profiles where id=$2) p`, [d2, pax])).rows[0]
r.d === 1 && r.p === 4 ? ok('notes mises à jour des deux côtés') : fail(JSON.stringify(r))

// Annulations et expiration
const newReq = async () => (await as('service_role', null,
  `select (create_ride_request($1,$2,-7.6,33.59,'A','',-7.55,33.57,'B','',5400,900,null,4000,'cash')).id`, [pax, eco]))[0].id
const req2 = await newReq()
await as('authenticated', pax, `select cancel_request($1)`, [req2]); ok('annulation avant acceptation')
for (let i = 0; i < 4; i++) {
  const q = await newReq()
  const [{ id: o }] = await as('authenticated', d1, `select (driver_make_offer($1)).id`, [q])
  const [{ id: rr }] = await as('authenticated', pax, `select (accept_offer($1)).id`, [o])
  if (i === 0) await expectErr('annulation sans motif refusée', () => as('authenticated', pax, `select cancel_ride($1, null)`, [rr]), 'reason_required')
  await as('authenticated', pax, `select cancel_ride($1, 'changed_mind')`, [rr])
}
const pst = (await db.query(`select status from profiles where id = $1`, [pax])).rows[0].status
pst === 'restricted' ? ok('4 annulations en 24 h → compte restreint') : fail('statut ' + pst)
await expectErr('compte restreint ne peut pas accepter', () => as('authenticated', pax, `select accept_offer(gen_random_uuid())`), 'account_restricted')
await db.query(`update profiles set status = 'active', restricted_until = null where id = $1`, [pax])
const req3 = await newReq()
await as('authenticated', d1, `select driver_make_offer($1)`, [req3])
await db.exec(`update offers set expires_at = now() - interval '1 s' where request_id = '${req3}'; update ride_requests set expires_at = now() - interval '1 s' where id = '${req3}'`)
await as('service_role', null, `select expire_stale()`)
const ex = (await db.query(`select status from ride_requests where id = $1`, [req3])).rows[0].status
ex === 'expired' ? ok('tâche d\'expiration ferme demande et offres') : fail('expiration ' + ex)

// ───────── ajouts de la migration app_api ─────────
const uNew = await mkUser('212611111111')
const [{ phone }] = (await db.query(`select phone from profiles where id = $1`, [uNew])).rows
phone === '+212611111111' ? ok('téléphone normalisé en +212…') : fail('téléphone = ' + phone)

for (let i = 0; i < 5; i++) await as('authenticated', pax, `insert into emergency_contacts (user_id, name, phone) values ($1, $2, $3)`, [pax, 'C' + i, '+21260000100' + i])
await expectErr('6e contact d’urgence refusé', () => as('authenticated', pax, `insert into emergency_contacts (user_id, name, phone) values ($1, 'X', '+212600009999')`, [pax]), 'too_many_contacts')

const nC = (await db.query(`select count(*)::int n from emergency_contacts where user_id = $1`, [pax])).rows[0].n
nC <= 5 ? ok(`contacts d’urgence plafonnés (${nC})`) : fail('contacts = ' + nC)

const hist = await as('authenticated', pax, `select * from my_rides()`)
hist.length >= 5 && hist.some((h) => h.status === 'completed' && h.my_stars === 5) && hist.some((h) => h.status === 'cancelled')
  ? ok(`historique : ${hist.length} courses, note 5 retrouvée`) : fail('historique ' + JSON.stringify(hist.map((h) => [h.status, h.my_stars])))
;(await as('authenticated', other, `select * from my_rides()`)).length === 0 ? ok('historique vide pour un tiers') : fail('fuite historique')

const recents = await as('authenticated', pax, `select * from my_recent_places()`)
recents.length >= 1 && new Set(recents.map((r) => r.name)).size === recents.length ? ok(`récents sans doublon (${recents.map((r) => r.name).join(', ')})`) : fail('récents ' + JSON.stringify(recents))

;(await as('authenticated', other, `select * from request_view($1)`, [req])).length === 0 ? ok('request_view : rien pour un tiers') : fail('fuite request_view')
const rv = (await as('authenticated', pax, `select * from request_view($1)`, [req]))[0]
rv?.pickup_name === 'Mosquée Hassan II' && rv.service === 'economy' ? ok('request_view : demande + coordonnées') : fail('request_view ' + JSON.stringify(rv))

const rated = (await as('authenticated', pax, `select rated from ride_view($1)`, [ride]))[0]?.rated
rated === true ? ok('ride_view sait que la course est notée') : fail('rated = ' + rated)

const active = (await as('authenticated', pax, `select my_active_state() s`))[0].s
typeof active === 'object' && !active.rideId ? ok('reprise : ' + JSON.stringify(active)) : fail('active ' + JSON.stringify(active))

await expectErr('arrivée hors zone refusée',
  () => as('service_role', null, `select create_ride_request($1,$2,-7.6,33.59,'A','',-5.0,35.0,'B','',5400,900,null,4000,'cash')`, [pax, eco]), 'dropoff_outside_service_area')

// simulateur de dev : réservé à la clé service
const req4 = await newReq()
await expectErr('simulateur interdit à un utilisateur', () => as('authenticated', pax, `select sim_driver_offer($1, $2)`, [d1, req4]), 'permission denied')
await as('service_role', null, `select sim_driver_location($1, -7.601, 33.591, 0::smallint)`, [d2])
const [{ id: simOffer, kind }] = await as('service_role', null, `select * from sim_driver_offer($1, $2, 4400)`, [d2, req4])
kind === 'counter' ? ok('simulateur : contre-offre via les vraies règles') : fail('sim kind ' + kind)
const [{ id: simRide }] = await as('authenticated', pax, `select (accept_offer($1)).id`, [simOffer])
await as('service_role', null, `select sim_driver_advance($1, $2, 'driver_arrived')`, [d2, simRide])
await as('service_role', null, `select sim_driver_message($1, $2, 'Je suis là')`, [d2, simRide])
const msgs = await as('authenticated', pax, `select body from messages where ride_id = $1`, [simRide])
msgs.length === 1 ? ok('simulateur : statut + message du chauffeur visibles par le passager') : fail('messages ' + JSON.stringify(msgs))
await as('service_role', null, `select sim_driver_location($1, -7.6005, 33.5905, 10::smallint)`, [d2])
const loc = await as('authenticated', pax, `select lng, lat from ride_locations where ride_id = $1 order by recorded_at desc limit 1`, [simRide])
loc.length === 1 && Math.abs(loc[0].lng + 7.6005) < 1e-6 ? ok('position du chauffeur lisible en lng/lat par le passager') : fail('positions ' + JSON.stringify(loc))
;(await as('authenticated', other, `select * from ride_locations where ride_id = $1`, [simRide])).length === 0 ? ok('positions invisibles pour un tiers') : fail('fuite positions')

const info = (await as('service_role', null, `select * from sim_request_info($1)`, [req4]))[0]
Math.abs(info.pickup_lng + 7.6) < 1e-9 && info.status === 'matched' ? ok('simulateur : coordonnées d’une demande lisibles') : fail('info ' + JSON.stringify(info))
await expectErr('sim_request_info interdit à un utilisateur', () => as('authenticated', pax, `select * from sim_request_info($1)`, [req4]), 'permission denied')

console.log(failures ? `\n${failures} échec(s)` : '\nTout passe.')
process.exit(failures ? 1 : 0)
