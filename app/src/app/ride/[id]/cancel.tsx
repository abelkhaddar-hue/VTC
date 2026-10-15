import { useState } from 'react'
import { router, useLocalSearchParams } from 'expo-router'
import { rides, type CancelReason } from '@/data/api'
import { useAction } from '@/data/hooks'
import { Screen } from '@/ui/layout'
import { Text } from '@/ui/Text'
import { Button } from '@/ui/Button'
import { Banner, Card } from '@/ui/primitives'
import { ChoiceList } from '@/ui/forms'
import { Field } from '@/ui/Field'

const reasons: { value: CancelReason; label: string }[] = [
  { value: 'driver_late', label: 'Le chauffeur est trop loin ou ne bouge pas' },
  { value: 'driver_asked_cancel', label: 'Le chauffeur m’a demandé d’annuler' },
  { value: 'wrong_vehicle', label: 'La voiture ou le chauffeur ne correspondent pas' },
  { value: 'price_dispute', label: 'On me demande un autre prix' },
  { value: 'changed_mind', label: 'Je n’ai plus besoin de la course' },
  { value: 'safety', label: 'Je ne me sens pas en sécurité' },
  { value: 'other', label: 'Autre raison' },
]

// S16 — Annuler après acceptation : motif obligatoire.
export default function Cancel() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const [reason, setReason] = useState<CancelReason[]>([])
  const [comment, setComment] = useState('')
  const cancel = useAction(rides.cancelRide)
  const r = reason[0]
  const blames = r === 'driver_late' || r === 'driver_asked_cancel' || r === 'wrong_vehicle' || r === 'price_dispute' || r === 'safety'

  return (
    <Screen title="Annuler la course" close footer={<>
      <Button label="Annuler la course" variant="danger" size="lg" disabled={!r || (r === 'other' && !comment.trim())} loading={cancel.busy}
        onPress={async () => {
          if ((await cancel.attempt(id, r, comment)).ok) {
            if (r === 'safety' || r === 'price_dispute') router.replace({ pathname: '/support', params: { ride: id, category: r } })
            else router.replace(`/ride/${id}`)
          }
        }} />
      <Button label="Garder ma course" variant="ghost" fullWidth onPress={() => router.back()} />
    </>}>
      <Text tone="muted">Le chauffeur est déjà en route vers vous. Dites-nous pourquoi vous annulez :</Text>
      <Card tone="surface"><ChoiceList mode="single" value={reason} onChange={setReason} options={reasons} /></Card>
      {r === 'other' ? <Field label="Expliquez en quelques mots" value={comment} onChangeText={setComment} multiline maxLength={500} counter autoFocus /> : null}
      {r && !blames ? <Banner kind="warning" title="Annuler souvent limite votre compte" body="Au-delà de 3 annulations en 24 h, vous ne pourrez plus commander pendant 2 h." /> : null}
      {r === 'safety' ? <Banner kind="info" title="Vous serez mis en relation avec l’assistance" body="En cas de danger immédiat, appelez le 19." /> : null}
      {cancel.error ? <Banner kind="danger" title={cancel.error} /> : null}
    </Screen>
  )
}
