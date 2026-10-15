import { useEffect, useState } from 'react'
import { View } from 'react-native'
import { router } from 'expo-router'
import { Minus, Plus } from 'lucide-react-native'
import { account, type RideOption } from '@/data/api'
import { draft } from '@/data/draft'
import { Screen } from '@/ui/layout'
import { Text } from '@/ui/Text'
import { Button, IconButton } from '@/ui/Button'
import { Card, Divider } from '@/ui/primitives'
import { ChoiceList } from '@/ui/forms'
import { Field } from '@/ui/Field'

// S08 — Options et commentaire pour le chauffeur.
export default function Options() {
  const d = draft.get()
  const [options, setOptions] = useState<RideOption[]>(d.options)
  const [passengers, setPassengers] = useState(d.passengers)
  const [comment, setComment] = useState(d.comment)
  const [max, setMax] = useState(4)
  useEffect(() => {
    account.city().then((c) => setMax(c.rideTypes.find((t) => t.code === d.service)?.seatsMax ?? 4)).catch(() => {})
  }, [d.service])

  return (
    <Screen title="Options" close footer={<Button label="Enregistrer" size="lg" onPress={() => { draft.set({ options, passengers, comment: comment.trim() }); router.back() }} />}>
      <Card tone="surface" style={{ gap: 8 }}>
        <ChoiceList mode="multiple" value={options} onChange={setOptions} options={[
          { value: 'child_seat', label: 'Siège enfant' },
          { value: 'luggage', label: 'Bagages volumineux' },
          { value: 'pet', label: 'Animal de compagnie' },
        ]} />
        <Divider />
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 12, minHeight: 56 }}>
          <Text style={{ flex: 1 }}>Passagers</Text>
          <IconButton icon={Minus} size={40} label="Un passager de moins" disabled={passengers <= 1} onPress={() => setPassengers((n) => n - 1)} />
          <Text variant="lg" tabular accessibilityLiveRegion="polite" accessibilityLabel={`${passengers} passager${passengers > 1 ? 's' : ''}`}>{passengers}</Text>
          <IconButton icon={Plus} size={40} label="Un passager de plus" disabled={passengers >= max} onPress={() => setPassengers((n) => n + 1)} />
        </View>
        {passengers >= max ? <Text variant="xs" tone="subtle" style={{ paddingHorizontal: 12 }}>{max} passagers maximum pour ce service. Prenez XL pour un groupe.</Text> : null}
      </Card>
      <Field label="Message pour le chauffeur" hint="Par exemple : devant l’entrée principale, veste rouge." value={comment} onChangeText={setComment} multiline maxLength={280} counter />
    </Screen>
  )
}
