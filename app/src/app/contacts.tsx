import { useState } from 'react'
import { View } from 'react-native'
import { UserMinus, Users } from 'lucide-react-native'
import { account, type EmergencyContact } from '@/data/api'
import { useAction, useLoad } from '@/data/hooks'
import { Screen, Skeleton, ErrorBlock } from '@/ui/layout'
import { Text } from '@/ui/Text'
import { Button, IconButton } from '@/ui/Button'
import { Card, Divider, EmptyState } from '@/ui/primitives'
import { formatMoroccanPhone } from '@/ui/forms'
import { Field } from '@/ui/Field'

// S19 (sous-écran) — Contacts d'urgence, prévenus en cas d'alerte pendant une course.
export default function Contacts() {
  const contacts = useLoad<EmergencyContact[]>(() => account.contacts(), [])
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const add = useAction(account.addContact)
  const full = (contacts.data?.length ?? 0) >= 5

  return (
    <Screen title="Contacts d’urgence" tone="surface">
      <Text tone="muted">Ils reçoivent un SMS avec le lien de suivi si vous déclenchez une alerte pendant une course. 5 personnes maximum.</Text>
      <Card style={{ gap: 12 }}>
        {contacts.loading && !contacts.data ? <Skeleton height={56} /> : null}
        {contacts.error ? <ErrorBlock message={contacts.error.message} onRetry={contacts.reload} /> : null}
        {contacts.data && !contacts.data.length ? <EmptyState icon={Users} title="Aucun contact" body="Ajoutez un proche de confiance ci-dessous." /> : null}
        {contacts.data?.map((c) => (
          <View key={c.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <View style={{ flex: 1 }}>
              <Text weight={600} numberOfLines={1}>{c.name}</Text>
              <Text variant="sm" tone="muted">{formatMoroccanPhone('0' + c.phone.slice(4))}</Text>
            </View>
            <IconButton icon={UserMinus} variant="ghost" label={`Retirer ${c.name}`} onPress={async () => { await account.removeContact(c.id); contacts.reload() }} />
          </View>
        ))}
      </Card>
      {full ? <Text variant="sm" tone="subtle">Vous avez atteint 5 contacts. Retirez-en un pour en ajouter un autre.</Text> : (
        <Card style={{ gap: 12 }}>
          <Text weight={600}>Ajouter un contact</Text>
          <Field label="Nom" value={name} onChangeText={setName} maxLength={60} />
          <Field label="Téléphone" value={formatMoroccanPhone(phone)} onChangeText={(v) => setPhone(v.replace(/\D/g, '').slice(0, 10))} keyboardType="phone-pad" placeholder="06 12 34 56 78" error={add.error} />
          <Divider />
          <Button label="Ajouter" variant="secondary" loading={add.busy} disabled={!name.trim() || phone.length < 10}
            onPress={async () => { if (await add.run(name, phone)) { setName(''); setPhone(''); contacts.reload() } }} />
        </Card>
      )}
    </Screen>
  )
}
