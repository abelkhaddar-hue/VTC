import { useState } from 'react'
import { Linking, Platform, Share, View } from 'react-native'
import { router, useLocalSearchParams } from 'expo-router'
import { Ambulance, Contact, Copy, LifeBuoy, Link2, Siren } from 'lucide-react-native'
import { account, rides, type EmergencyContact } from '@/data/api'
import { useAction, useLoad } from '@/data/hooks'
import { Screen } from '@/ui/layout'
import { Text } from '@/ui/Text'
import { Button } from '@/ui/Button'
import { Banner, Card, ListRow } from '@/ui/primitives'

// S13 — Centre de sécurité pendant la course.
export default function Safety() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const city = useLoad(() => account.city(), [])
  const contacts = useLoad<EmergencyContact[]>(() => account.contacts(), [])
  const share = useAction(rides.createShareLink)
  const [link, setLink] = useState<string>()
  const [copied, setCopied] = useState(false)

  const makeLink = async () => {
    const token = await share.run(id)
    if (!token) return
    const url = Platform.OS === 'web' && typeof window !== 'undefined' ? `${window.location.origin}/s/${token}` : `https://ride.example/s/${token}`
    setLink(url)
    if (Platform.OS !== 'web') Share.share({ message: `Suivez mon trajet en direct : ${url}` }).catch(() => {})
  }
  const police = city.data?.emergency.police ?? '19'
  const ambulance = city.data?.emergency.ambulance ?? '15'

  return (
    <Screen title="Sécurité">
      <Card tone="surface" style={{ gap: 12 }}>
        <Text weight={600}>Partager le trajet en direct</Text>
        <Text variant="sm" tone="muted">Vos proches voient la voiture, la plaque et votre position jusqu’à l’arrivée, sans installer l’app.</Text>
        {link ? (
          <View style={{ gap: 8 }}>
            <Text variant="sm" weight={600} selectable numberOfLines={2}>{link}</Text>
            <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
              <Button label={copied ? 'Lien copié' : 'Copier le lien'} icon={Copy} variant="secondary" size="sm"
                onPress={async () => { try { await (globalThis.navigator as Navigator | undefined)?.clipboard?.writeText(link); setCopied(true) } catch { setCopied(false) } }} />
              {Platform.OS === 'web' ? <Button label="Ouvrir la page" variant="ghost" size="sm" onPress={() => router.push(link.replace(/^.*\/s\//, '/s/') as '/s/[token]')} /> : null}
            </View>
          </View>
        ) : <Button label="Créer le lien de suivi" icon={Link2} loading={share.busy} onPress={makeLink} />}
        {share.error ? <Banner kind="danger" title={share.error} /> : null}
        {contacts.data?.length ? <Text variant="xs" tone="subtle">Vos contacts d’urgence ({contacts.data.map((c) => c.name).join(', ')}) seront prévenus si vous appelez les secours.</Text> : null}
      </Card>
      <Card style={{ paddingHorizontal: 0, paddingVertical: 8 }}>
        <ListRow icon={Siren} danger label={`Appeler la police (${police})`} detail="En cas de danger immédiat" onPress={() => Linking.openURL(`tel:${police}`)} />
        <ListRow icon={Ambulance} label={`Appeler le SAMU (${ambulance})`} detail="Urgence médicale" onPress={() => Linking.openURL(`tel:${ambulance}`)} />
        <ListRow icon={LifeBuoy} label="Contacter l’assistance" detail="7 j/7, réponse dans l’app" onPress={() => router.push({ pathname: '/support', params: { ride: id, category: 'safety' } })} />
        <ListRow icon={Contact} label="Contacts d’urgence" detail={contacts.data?.length ? `${contacts.data.length} enregistré${contacts.data.length > 1 ? 's' : ''}` : 'Aucun pour l’instant'} onPress={() => router.push('/contacts')} />
      </Card>
    </Screen>
  )
}
