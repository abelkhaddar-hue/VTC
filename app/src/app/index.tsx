import { useEffect } from 'react'
import { router } from 'expo-router'
import { account, auth, rides } from '@/data/api'
import { Loading } from '@/ui/layout'

// Aiguillage au lancement : connexion, compte bloqué, ou reprise de la course en cours.
export default function Index() {
  useEffect(() => {
    let alive = true
    ;(async () => {
      if (!auth.session()) return router.replace('/welcome')
      const p = await account.profile().catch(() => null)
      if (!alive) return
      if (!p) return router.replace('/welcome')
      if (p.status === 'blocked') return router.replace('/blocked')
      if (!p.firstName) return router.replace('/login/profile')
      const a: { rideId?: string; rideToRate?: string; requestId?: string } = await rides.active().catch(() => ({}))
      if (!alive) return
      if (a.rideId) return router.replace(`/ride/${a.rideId}`)
      if (a.rideToRate) return router.replace(`/ride/${a.rideToRate}/rate`)
      if (a.requestId) return router.replace(`/request/${a.requestId}`)
      router.replace('/home')
    })()
    return () => { alive = false }
  }, [])
  return <Loading />
}
