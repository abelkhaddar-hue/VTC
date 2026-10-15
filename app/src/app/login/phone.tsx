import { useState } from 'react'
import { router } from 'expo-router'
import { auth } from '@/data/api'
import { useAction } from '@/data/hooks'
import { Screen } from '@/ui/layout'
import { Text } from '@/ui/Text'
import { Button } from '@/ui/Button'
import { PhoneInput, isMoroccanMobile } from '@/ui/forms'

// S02 — Numéro de téléphone.
export default function Phone() {
  const [phone, setPhone] = useState('')
  const send = useAction(auth.sendCode)
  const complete = phone.length === 10
  const invalid = complete && !isMoroccanMobile(phone)
  const submit = async () => {
    if (await send.run(phone)) router.push({ pathname: '/login/code', params: { phone } })
  }
  return (
    <Screen
      title="Votre numéro"
      footer={<Button label="Recevoir le code" size="lg" disabled={!complete || invalid} loading={send.busy} onPress={submit} />}
    >
      <Text tone="muted">Nous vous envoyons un code par SMS pour vérifier que ce numéro est bien le vôtre. Il n’est jamais montré aux chauffeurs.</Text>
      <PhoneInput value={phone} onChange={(v) => { setPhone(v); send.setError(undefined) }} disabled={send.busy}
        error={invalid ? 'Ce numéro n’est pas un mobile marocain.' : send.error} />
      <Text variant="xs" tone="subtle">En continuant, vous acceptez les conditions d’utilisation et la politique de confidentialité.</Text>
    </Screen>
  )
}
