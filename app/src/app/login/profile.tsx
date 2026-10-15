import { useState } from 'react'
import { router } from 'expo-router'
import { account } from '@/data/api'
import { useAction } from '@/data/hooks'
import { Screen } from '@/ui/layout'
import { Text } from '@/ui/Text'
import { Button } from '@/ui/Button'
import { Field } from '@/ui/Field'

// S04 — Création du profil : prénom obligatoire, e-mail facultatif (reçus).
export default function ProfileSetup() {
  const [firstName, setFirstName] = useState('')
  const [email, setEmail] = useState('')
  const save = useAction(account.update)
  const emailOk = !email || /^\S+@\S+\.\S+$/.test(email)
  return (
    <Screen title="Faisons connaissance" onBack={() => router.replace('/welcome')}
      footer={<Button label="Continuer" size="lg" disabled={!firstName.trim() || !emailOk} loading={save.busy}
        onPress={async () => { if (await save.run({ firstName: firstName.trim(), email: email.trim() || undefined })) router.replace('/home') }} />}>
      <Text tone="muted">Les chauffeurs voient seulement votre prénom et votre note.</Text>
      <Field label="Prénom" value={firstName} onChangeText={setFirstName} maxLength={60} autoComplete="given-name" textContentType="givenName" error={save.error} autoFocus />
      <Field label="E-mail (facultatif)" hint="Pour recevoir vos reçus." value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none"
        autoComplete="email" textContentType="emailAddress" error={emailOk ? undefined : 'Adresse e-mail invalide.'} />
    </Screen>
  )
}
