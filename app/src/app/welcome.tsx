import { View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { router } from 'expo-router'
import { HandCoins, ShieldCheck, UserCheck } from 'lucide-react-native'
import { color, tokens } from '@/theme'
import { Text } from '@/ui/Text'
import { Button } from '@/ui/Button'

// S01 — Accueil. Nom et visuel provisoires en attendant /replica-brand.
const points = [
  { icon: HandCoins, title: 'Vous fixez le prix', body: 'Indiquez ce que vous voulez payer, les chauffeurs répondent.' },
  { icon: UserCheck, title: 'Vous choisissez qui vient', body: 'Comparez la note, l’heure d’arrivée et la voiture.' },
  { icon: ShieldCheck, title: 'Vos proches suivent le trajet', body: 'Un lien suffit pour voir où vous êtes, en direct.' },
]

export default function Welcome() {
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: color('bg') }}>
      <View style={{ flex: 1, padding: 24, gap: 32, justifyContent: 'center', width: '100%', maxWidth: tokens.layout['max-content'], alignSelf: 'center' }}>
        <View style={{ gap: 8 }}>
          <View style={{ width: 64, height: 64, borderRadius: tokens.radius.lg, backgroundColor: color('accent'), alignItems: 'center', justifyContent: 'center' }}>
            <Text variant="xl" tone="on-accent">R</Text>
          </View>
          <Text variant="display" heading>Ride</Text>
          <Text variant="lg" tone="muted" weight={500}>Le trajet au prix que vous proposez.</Text>
        </View>
        <View style={{ gap: 20 }}>
          {points.map(({ icon: Icon, title, body }) => (
            <View key={title} style={{ flexDirection: 'row', gap: 16, alignItems: 'flex-start' }}>
              <View style={{ width: 44, height: 44, borderRadius: tokens.radius.pill, backgroundColor: color('tile'), alignItems: 'center', justifyContent: 'center' }}>
                <Icon size={tokens.size['icon-lg']} color={color('accent')} />
              </View>
              <View style={{ flex: 1, gap: 2 }}>
                <Text weight={600}>{title}</Text>
                <Text variant="sm" tone="muted">{body}</Text>
              </View>
            </View>
          ))}
        </View>
      </View>
      <View style={{ padding: 24, gap: 12, width: '100%', maxWidth: tokens.layout['max-content'], alignSelf: 'center' }}>
        <Button label="Commencer" size="lg" onPress={() => router.push('/login/phone')} />
        <Text variant="xs" tone="subtle" center>Gratuit pour les passagers. Disponible à Casablanca.</Text>
      </View>
    </SafeAreaView>
  )
}
