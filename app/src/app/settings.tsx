import { useEffect, useState } from 'react'
import { View } from 'react-native'
import { router } from 'expo-router'
import { Contact, Trash2 } from 'lucide-react-native'
import { account, dataSource, demo, type Profile, type Scenario } from '@/data/api'
import { useAction, useLoad } from '@/data/hooks'
import { Screen, Skeleton } from '@/ui/layout'
import { Text } from '@/ui/Text'
import { Button } from '@/ui/Button'
import { Banner, Card, Chip, Divider, ListRow } from '@/ui/primitives'
import { ChoiceList, formatMoroccanPhone } from '@/ui/forms'
import { Field } from '@/ui/Field'

function Title({ children }: { children: string }) {
  return <Text variant="xs" weight={700} tone="subtle" heading style={{ textTransform: 'uppercase', letterSpacing: 1, marginTop: 8 }}>{children}</Text>
}

// S19 — Profil et réglages, lien vers les contacts d'urgence, suppression du compte, mode démo.
export default function Settings() {
  const p = useLoad<Profile>(() => account.profile(), [])
  const [firstName, setFirstName] = useState('')
  const [email, setEmail] = useState('')
  const [saved, setSaved] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [scenario, setScenario] = useState<Scenario[]>([demo.scenario])
  const [speed, setSpeed] = useState(demo.speed)
  const save = useAction(account.update)
  const del = useAction(account.deleteAccount)

  useEffect(() => { if (p.data) { setFirstName(p.data.firstName); setEmail(p.data.email ?? '') } }, [p.data])

  return (
    <Screen title="Réglages" tone="surface">
      <Title>Profil</Title>
      <Card style={{ gap: 12 }}>
        {p.data ? (
          <>
            <Text variant="sm" tone="muted">Téléphone : {formatMoroccanPhone('0' + p.data.phone.slice(4))} (vérifié)</Text>
            <Field label="Prénom" value={firstName} onChangeText={(v) => { setFirstName(v); setSaved(false) }} maxLength={60} />
            <Field label="E-mail pour les reçus" value={email} onChangeText={(v) => { setEmail(v); setSaved(false) }} keyboardType="email-address" autoCapitalize="none" />
            {save.error ? <Banner kind="danger" title={save.error} /> : null}
            {saved ? <Banner kind="success" title="Profil enregistré" /> : null}
            <Button label="Enregistrer" loading={save.busy} disabled={!firstName.trim()}
              onPress={async () => { if (await save.run({ firstName: firstName.trim(), email: email.trim() || undefined })) { setSaved(true); p.reload() } }} />
          </>
        ) : <Skeleton height={160} />}
      </Card>

      <Title>Ville et langue</Title>
      <Card style={{ gap: 12 }}>
        <Text>Casablanca</Text>
        <Text variant="xs" tone="subtle">D’autres villes arrivent bientôt.</Text>
        <Divider />
        <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
          <Chip label="Français" selected />
          <Chip label="العربية · bientôt" />
          <Chip label="English · soon" />
        </View>
      </Card>

      <Title>Sécurité</Title>
      <Card style={{ paddingHorizontal: 0, paddingVertical: 8 }}>
        <ListRow icon={Contact} label="Contacts d’urgence" detail="Prévenus en cas d’alerte" onPress={() => router.push('/contacts')} />
      </Card>

      {dataSource === 'fake' ? (
        <>
        <Title>Mode démo (équipe)</Title>
        <Card style={{ gap: 12 }}>
          <Text variant="sm" tone="muted">Pour essayer chaque situation sans vrais chauffeurs.</Text>
          <ChoiceList mode="single" value={scenario} onChange={(v) => { setScenario(v); demo.scenario = v[0] }} options={[
            { value: 'normal', label: 'Normal : 3 chauffeurs répondent' },
            { value: 'no_offers', label: 'Aucun chauffeur ne répond' },
            { value: 'counters_only', label: 'Seulement des contre-offres' },
            { value: 'network_error', label: 'Pas de réseau' },
          ]} />
          <View style={{ flexDirection: 'row', gap: 8 }}>
            {[1, 3].map((s) => <Chip key={s} label={s === 1 ? 'Vitesse normale' : 'Accéléré ×3'} selected={speed === s} onPress={() => { setSpeed(s); demo.speed = s }} />)}
          </View>
        </Card>
        </>
      ) : null}

      <Title>Compte</Title>
      <Card style={{ gap: 12 }}>
        {confirmDelete ? (
          <>
            <Banner kind="danger" title="Supprimer définitivement votre compte ?" body="Votre profil et vos contacts sont effacés. Les courses passées restent dans nos comptes, sans votre nom, comme la loi l’exige." />
            {del.error ? <Banner kind="danger" title={del.error} /> : null}
            <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
              <Button label="Oui, supprimer" variant="danger" icon={Trash2} loading={del.busy} onPress={async () => { if ((await del.attempt()).ok) router.replace('/welcome') }} />
              <Button label="Non, garder" variant="secondary" onPress={() => setConfirmDelete(false)} />
            </View>
          </>
        ) : <Button label="Supprimer mon compte" variant="ghost" onPress={() => setConfirmDelete(true)} />}
      </Card>
    </Screen>
  )
}
