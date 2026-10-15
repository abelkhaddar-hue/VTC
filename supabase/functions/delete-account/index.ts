// Suppression du compte (S19). Les courses passées restent (comptabilité, litiges) mais sans nom ni numéro.
import { admin, caller, fail, handle, json } from '../_shared/http.ts'

Deno.serve(handle(async (req) => {
  const user = await caller(req)
  if (!user) return fail('not_authenticated', 401)
  const db = admin()
  const steps = [
    db.from('emergency_contacts').delete().eq('user_id', user.id),
    db.from('push_tokens').delete().eq('user_id', user.id),
    db.from('profiles').update({ first_name: '', email: null, phone: null, photo_path: null, status: 'deleted', deleted_at: new Date().toISOString() }).eq('id', user.id),
  ]
  for (const s of steps) { const { error } = await s; if (error) { console.error(error.message); return fail('server_error', 500) } }
  // Suppression « douce » côté Auth : l'identité (téléphone) est effacée, la ligne garde les liens comptables.
  const { error } = await db.auth.admin.deleteUser(user.id, true)
  if (error) { console.error(error.message); return fail('server_error', 500) }
  return json({ ok: true })
}))
