import { useEffect, useState } from 'react'
import { View } from 'react-native'
import { router, useLocalSearchParams } from 'expo-router'
import { CarTaxiFront, ShieldCheck } from 'lucide-react-native'
import { rides, type RideView } from '@/data/api'
import { useLoad } from '@/data/hooks'
import { color, formatMAD, tokens } from '@/theme'
import { Text } from '@/ui/Text'
import { Button, IconButton } from '@/ui/Button'
import { Banner, Divider, EmptyState } from '@/ui/primitives'
import { DriverCard, RouteSummary } from '@/ui/ride'
import { FakeMap } from '@/ui/map'
import { ErrorBlock, Loading, MapScreen } from '@/ui/layout'

const payLabel = { cash: 'en espèces', card: 'par carte', wallet: 'par portefeuille' } as const
const cancelLabel: Record<string, string> = {
  driver_late: 'le chauffeur était trop loin', driver_asked_cancel: 'le chauffeur a demandé d’annuler', wrong_vehicle: 'ce n’était pas la bonne voiture',
  changed_mind: 'vous avez changé d’avis', price_dispute: 'désaccord sur le prix', safety: 'raison de sécurité', other: 'autre raison',
}

// S11 (chauffeur en route / arrivé) et S14 (course en cours), selon le statut.
export default function RideScreen() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const ride = useLoad<RideView>(() => rides.ride(id), [id], (set) => rides.onRide(id, set))
  const [callInfo, setCallInfo] = useState(false)

  useEffect(() => {
    if (ride.data?.status === 'completed' && !ride.data.rated) router.replace(`/ride/${id}/rate`)
  }, [ride.data?.status, ride.data?.rated, id])

  if (ride.loading && !ride.data) return <Loading label="Chargement de la course…" />
  if (ride.error || !ride.data) return <MapScreen map={<FakeMap />}><ErrorBlock message={ride.error?.message ?? 'Course introuvable.'} onRetry={ride.reload} /></MapScreen>

  const r = ride.data
  const enRoute = r.status === 'driver_en_route' || r.status === 'driver_arrived'
  const inTrip = r.status === 'in_progress'
  const eta = r.etaS != null ? Math.max(1, Math.round(r.etaS / 60)) : undefined
  const map = (
    <FakeMap
      pickup={r.pickup.point}
      dropoff={inTrip ? r.dropoff.point : null}
      driver={r.driverPosition}
      route={inTrip ? r.route : null}
      label={inTrip ? `En route vers ${r.dropoff.name}` : `${r.driver.firstName} arrive à ${r.pickup.name}`}
    />
  )

  if (r.status === 'cancelled') {
    return (
      <MapScreen map={map}>
        <EmptyState icon={CarTaxiFront} title="Course annulée"
          body={`Annulée par ${r.cancelledBy === 'driver' ? 'le chauffeur' : 'vous'}${r.cancelReason ? ` : ${cancelLabel[r.cancelReason]}` : ''}. Rien ne vous est facturé.`} />
        <Button label="Commander une autre course" size="lg" onPress={() => router.replace('/home')} />
      </MapScreen>
    )
  }

  return (
    <MapScreen map={map} top={
      <View style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: 8 }} pointerEvents="box-none">
        <IconButton icon={ShieldCheck} label="Sécurité et partage du trajet" onPress={() => router.push(`/ride/${id}/safety`)} />
      </View>
    }>
      {inTrip ? (
        <View style={{ gap: 4 }}>
          <Text variant="label-lg" heading accessibilityLiveRegion="polite">Arrivée dans {eta ?? '…'} min</Text>
          <Text variant="sm" tone="muted" numberOfLines={1}>Vers {r.dropoff.name}</Text>
        </View>
      ) : null}
      <DriverCard name={r.driver.firstName} rating={r.driver.rating} rides={r.driver.rides}
        vehicle={`${r.vehicle.make} ${r.vehicle.model} · ${r.vehicle.color}`} plate={r.vehicle.plate}
        etaMin={enRoute && r.status === 'driver_en_route' ? eta : undefined} arrived={r.status === 'driver_arrived'}
        onCall={() => setCallInfo(true)} onMessage={() => router.push(`/ride/${id}/chat`)} onSafety={() => router.push(`/ride/${id}/safety`)} />
      {callInfo ? <Banner kind="info" title="L’appel masqué arrive bientôt" body="En attendant, écrivez au chauffeur : votre numéro n’est jamais partagé." onDismiss={() => setCallInfo(false)} /> : null}
      {r.status === 'driver_en_route' ? <Banner kind="info" title="Vérifiez la plaque avant de monter" body="Si la voiture ou le chauffeur ne correspondent pas, ne montez pas et annulez." /> : null}
      <Divider />
      <RouteSummary from={r.pickup.name} to={r.dropoff.name} />
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: color('surface'), borderRadius: tokens.radius.md, padding: 12 }}>
        <Text tone="muted">À payer {payLabel[r.payment]}</Text>
        <Text variant="lg" tabular>{formatMAD(r.fareCents)}</Text>
      </View>
      {enRoute ? <Button label="Annuler la course" variant="ghost" fullWidth onPress={() => router.push(`/ride/${id}/cancel`)} /> : null}
    </MapScreen>
  )
}
