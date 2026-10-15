import { useEffect, useState } from 'react'
import { ScrollView, View } from 'react-native'
import { router, useLocalSearchParams } from 'expo-router'
import { SearchX, TrendingUp } from 'lucide-react-native'
import { rides, type Offer, type RideRequest } from '@/data/api'
import { draft } from '@/data/draft'
import { useAction, useLoad, useSecondsLeft } from '@/data/hooks'
import { formatMAD } from '@/theme'
import { Text } from '@/ui/Text'
import { Button } from '@/ui/Button'
import { Banner, EmptyState } from '@/ui/primitives'
import { OfferCard, RouteSummary, SearchingPulse } from '@/ui/ride'
import { FakeMap } from '@/ui/map'
import { ErrorBlock, Loading, MapScreen } from '@/ui/layout'

const OFFER_TTL_S = 45

function LiveOffer({ offer, onAccept, onDecline, accepting, disabled }: { offer: Offer; onAccept: () => void; onDecline: () => void; accepting: boolean; disabled: boolean }) {
  const left = useSecondsLeft(offer.expiresAt)
  return (
    <OfferCard accepting={accepting} disabled={disabled} onAccept={onAccept} onDecline={onDecline}
      offer={{
        id: offer.id, fareCents: offer.fareCents, kind: offer.kind, etaMin: Math.max(1, Math.round(offer.etaS / 60)),
        distanceKm: Math.round(offer.distanceM / 100) / 10,
        driver: { name: offer.driver.firstName, rating: offer.driver.rating, rides: offer.driver.rides },
        vehicle: offer.vehicle, totalS: OFFER_TTL_S, leftS: left,
      }} />
  )
}

// S09 (recherche) et S10 (offres) : un seul écran, les offres arrivent pendant la recherche.
export default function RequestScreen() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const req = useLoad<RideRequest>(() => rides.request(id), [id], (set) => rides.onRequest(id, set))
  const offers = useLoad<Offer[]>(() => rides.offers(id), [id], (set) => rides.onOffers(id, set))
  const [accepting, setAccepting] = useState<string | null>(null)
  const [banner, setBanner] = useState<string>()
  const cancel = useAction(rides.cancelRequest)
  const elapsedFrom = req.data?.createdAt
  const [elapsed, setElapsed] = useState(0)

  useEffect(() => {
    if (!elapsedFrom) return
    const t = setInterval(() => setElapsed(Math.round((Date.now() - Date.parse(elapsedFrom)) / 1000)), 1000)
    return () => clearInterval(t)
  }, [elapsedFrom])

  // Les offres expirent côté serveur ; on retire aussi celles échues à l'écran.
  const [, tick] = useState(0)
  useEffect(() => { const t = setInterval(() => tick((n) => n + 1), 1000); return () => clearInterval(t) }, [])
  const live = (offers.data ?? []).filter((o) => Date.parse(o.expiresAt) > Date.now())

  if (req.loading && !req.data) return <Loading label="Chargement de votre demande…" />
  if (req.error || !req.data) return <MapScreen map={<FakeMap />}><ErrorBlock message={req.error?.message ?? 'Demande introuvable.'} onRetry={req.reload} /><Button label="Retour à l’accueil" size="lg" onPress={() => router.replace('/home')} /></MapScreen>

  const r = req.data
  const accept = async (o: Offer) => {
    setAccepting(o.id); setBanner(undefined)
    try {
      const ride = await rides.acceptOffer(o.id)
      draft.reset()
      router.replace(`/ride/${ride.id}`)
    } catch (e) {
      setBanner(e instanceof Error ? e.message : 'Impossible d’accepter cette offre.')
      offers.reload()
    } finally { setAccepting(null) }
  }

  const map = <FakeMap pickup={r.pickup.point} dropoff={r.dropoff.point} route={r.route} label={`Trajet de ${r.pickup.name} à ${r.dropoff.name}`} />
  const meta = `${(r.distanceM / 1000).toLocaleString('fr-MA', { maximumFractionDigits: 1 })} km · ${Math.round(r.durationS / 60)} min`

  if (r.status === 'expired' || r.status === 'cancelled') {
    return (
      <MapScreen map={map}>
        <EmptyState icon={SearchX} title={r.status === 'expired' ? 'Aucun chauffeur n’a répondu' : 'Demande annulée'}
          body={r.status === 'expired' ? 'Votre demande a expiré. Essayez un prix un peu plus haut.' : 'Vous pouvez en créer une nouvelle quand vous voulez.'} />
        <Button label="Nouvelle demande" size="lg" onPress={() => router.replace('/home')} />
      </MapScreen>
    )
  }

  const slow = elapsed >= 20 && live.length === 0
  return (
    <MapScreen map={map}>
      {banner ? <Banner kind="warning" title={banner} onDismiss={() => setBanner(undefined)} /> : null}
      {live.length === 0 ? (
        <View style={{ gap: 16 }}>
          <SearchingPulse label={slow ? 'Toujours personne… Les chauffeurs proches sont peut-être occupés.' : 'On prévient les chauffeurs autour de vous…'} />
          <RouteSummary from={r.pickup.name} to={r.dropoff.name} meta={meta} />
          <Text center tone="muted">Votre prix : <Text weight={700}>{formatMAD(r.offeredCents)}</Text></Text>
        </View>
      ) : (
        <View style={{ gap: 8 }}>
          <Text variant="lg" heading accessibilityLiveRegion="polite">{live.length} offre{live.length > 1 ? 's' : ''} pour {formatMAD(r.offeredCents)}</Text>
          <ScrollView style={{ maxHeight: 420 }} contentContainerStyle={{ gap: 12, paddingBottom: 4 }}>
            {live.map((o) => (
              <LiveOffer key={o.id} offer={o} accepting={accepting === o.id} disabled={!!accepting && accepting !== o.id}
                onAccept={() => accept(o)} onDecline={() => rides.declineOffer(o.id).catch(() => {})} />
            ))}
          </ScrollView>
        </View>
      )}
      {cancel.error ? <Banner kind="danger" title={cancel.error} /> : null}
      <View style={{ flexDirection: 'row', gap: 8 }}>
        <Button label="Annuler" variant="secondary" loading={cancel.busy} disabled={!!accepting}
          onPress={async () => { if ((await cancel.attempt(id)).ok) router.replace('/home') }} />
        <View style={{ flex: 1 }}>
          <Button label="Augmenter le prix" icon={TrendingUp} fullWidth variant={slow ? 'primary' : 'ghost'} disabled={!!accepting}
            onPress={() => router.push({ pathname: '/fare', params: { raise: id } })} />
        </View>
      </View>
    </MapScreen>
  )
}
