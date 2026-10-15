import { useState } from 'react'
import { View } from 'react-native'
import { router, useLocalSearchParams } from 'expo-router'
import { rides, type RideView } from '@/data/api'
import { useAction, useLoad } from '@/data/hooks'
import { color, formatMAD, tokens } from '@/theme'
import { Loading, Screen, ErrorBlock } from '@/ui/layout'
import { Text } from '@/ui/Text'
import { Button } from '@/ui/Button'
import { Avatar, Banner } from '@/ui/primitives'
import { RouteSummary } from '@/ui/ride'
import { StarRating } from '@/ui/forms'
import { Field } from '@/ui/Field'

const payLine = { cash: 'Réglez en espèces au chauffeur', card: 'Payé par carte', wallet: 'Payé par portefeuille' } as const

// S15 — Fin de course : montant à régler et note du chauffeur.
export default function Rate() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const ride = useLoad<RideView>(() => rides.ride(id), [id])
  const [stars, setStars] = useState(0)
  const [tags, setTags] = useState<string[]>([])
  const [comment, setComment] = useState('')
  const rate = useAction(rides.rate)
  const done = () => router.replace('/home')

  if (ride.loading) return <Loading />
  if (ride.error || !ride.data) return <Screen><ErrorBlock message={ride.error?.message ?? 'Course introuvable.'} onRetry={ride.reload} /></Screen>
  const r = ride.data
  const minutes = r.startedAt && r.completedAt ? Math.max(1, Math.round((Date.parse(r.completedAt) - Date.parse(r.startedAt)) / 60000)) : null

  return (
    <Screen onBack={done} close footer={<>
      <Button label="Envoyer ma note" size="lg" disabled={!stars} loading={rate.busy}
        onPress={async () => { if ((await rate.attempt(id, stars, tags, comment)).ok) done() }} />
      <Button label="Plus tard" variant="ghost" fullWidth onPress={done} />
    </>}>
      <View style={{ alignItems: 'center', gap: 4 }}>
        <Text variant="xl" heading center>Vous êtes arrivé</Text>
        <Text tone="muted" center numberOfLines={1}>{r.dropoff.name}</Text>
      </View>
      <View style={{ backgroundColor: color('surface'), borderRadius: tokens.radius.lg, padding: 16, gap: 12 }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <Text weight={600}>{payLine[r.payment]}</Text>
          <Text variant="xl" tabular>{formatMAD(r.fareCents)}</Text>
        </View>
        <Text variant="xs" tone="subtle">Le prix ne peut pas changer après acceptation. Si on vous demande plus, signalez-le à l’assistance.</Text>
        <RouteSummary from={r.pickup.name} to={r.dropoff.name} meta={minutes ? `${minutes} min` : undefined} />
      </View>
      <View style={{ alignItems: 'center', gap: 8 }}>
        <Avatar name={r.driver.firstName} size="lg" />
        <Text variant="lg" center>Comment s’est passé le trajet avec {r.driver.firstName} ?</Text>
      </View>
      <StarRating value={stars} onChange={setStars} tags={tags} onTags={setTags} />
      {stars ? <Field label="Un commentaire ? (facultatif)" value={comment} onChangeText={setComment} multiline maxLength={500} counter /> : null}
      {rate.error ? <Banner kind="danger" title={rate.error} /> : null}
    </Screen>
  )
}
