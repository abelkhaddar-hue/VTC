import { useCallback, useEffect, useRef, useState } from 'react'
import { ApiError } from './types'

export type Loadable<T> = { data: T | undefined; error: ApiError | undefined; loading: boolean; reload: () => void }

// Charge une donnée, et la tient à jour si `subscribe` est fourni (temps réel).
export function useLoad<T>(load: () => Promise<T>, deps: unknown[], subscribe?: (set: (v: T) => void) => () => void): Loadable<T> {
  const [data, setData] = useState<T>()
  const [error, setError] = useState<ApiError>()
  const [loading, setLoading] = useState(true)
  const [n, setN] = useState(0)
  const alive = useRef(true)
  useEffect(() => {
    alive.current = true
    setLoading(true); setError(undefined)
    load().then((v) => { if (alive.current) setData(v) })
      .catch((e) => { if (alive.current) setError(e instanceof ApiError ? e : new ApiError('unknown', String(e))) })
      .finally(() => { if (alive.current) setLoading(false) })
    const unsub = subscribe?.((v) => { if (alive.current) setData(v) })
    return () => { alive.current = false; unsub?.() }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, n])
  const reload = useCallback(() => setN((x) => x + 1), [])
  return { data, error, loading, reload }
}

// Lance une action (bouton) avec état de chargement et message d'erreur.
export function useAction<A extends unknown[], R>(fn: (...a: A) => Promise<R>) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string>()
  // Renvoie le résultat, ou undefined en cas d'erreur. Pour une action sans résultat, `ok` dit si elle a réussi.
  const attempt = useCallback(async (...a: A): Promise<{ ok: true; value: R } | { ok: false }> => {
    setBusy(true); setError(undefined)
    try { return { ok: true, value: await fn(...a) } }
    catch (e) { setError(e instanceof ApiError ? e.message : 'Une erreur est survenue. Réessayez.'); return { ok: false } }
    finally { setBusy(false) }
  }, [fn])
  const run = useCallback(async (...a: A) => { const r = await attempt(...a); return r.ok ? r.value : undefined }, [attempt])
  return { run, attempt, busy, error, setError }
}

// Secondes restantes avant une date ISO, mises à jour chaque seconde.
export function useSecondsLeft(isoDate: string | undefined) {
  const calc = () => (isoDate ? Math.max(0, Math.round((Date.parse(isoDate) - Date.now()) / 1000)) : 0)
  const [s, setS] = useState(calc)
  useEffect(() => {
    setS(calc())
    const t = setInterval(() => setS(calc()), 1000)
    return () => clearInterval(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isoDate])
  return s
}
