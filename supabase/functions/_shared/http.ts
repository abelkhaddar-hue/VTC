import { createClient, type SupabaseClient } from 'npm:@supabase/supabase-js@2.117.3'

export const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

export const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } })

// Erreur métier : même code que les fonctions SQL et la couche factice de l'app.
export const fail = (code: string, status = 400) => json({ code }, status)

export function admin(): SupabaseClient {
  return createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false } })
}

// L'utilisateur qui appelle, vérifié auprès de Supabase Auth (jamais cru sur parole).
export async function caller(req: Request): Promise<{ id: string } | null> {
  const token = req.headers.get('Authorization')?.replace(/^Bearer\s+/i, '')
  if (!token) return null
  const { data, error } = await admin().auth.getUser(token)
  return error || !data.user ? null : { id: data.user.id }
}

// Code métier depuis une erreur Postgres (« raise exception 'fare_below_recommended' »).
export function sqlCode(message: string | undefined): string {
  const m = (message ?? '').match(/^[a-z_]+/)
  return m ? m[0] : 'server_error'
}

export function handle(fn: (req: Request) => Promise<Response>) {
  return async (req: Request) => {
    if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
    if (req.method !== 'POST') return fail('method_not_allowed', 405)
    try { return await fn(req) } catch (e) {
      console.error(e instanceof Error ? e.message : e)
      return fail('server_error', 500)
    }
  }
}
