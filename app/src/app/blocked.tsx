import { router } from 'expo-router'
import { Ban } from 'lucide-react-native'
import { auth } from '@/data/api'
import { Screen } from '@/ui/layout'
import { Button } from '@/ui/Button'
import { EmptyState } from '@/ui/primitives'

// S22 — Compte bloqué (incident, fraude, suppression). La restriction temporaire s'affiche sur S05.
export default function Blocked() {
  return (
    <Screen onBack={async () => { await auth.signOut(); router.replace('/welcome') }}
      footer={<>
        <Button label="Contacter l’assistance" size="lg" onPress={() => router.push('/support')} />
        <Button label="Se déconnecter" variant="ghost" fullWidth onPress={async () => { await auth.signOut(); router.replace('/welcome') }} />
      </>}>
      <EmptyState icon={Ban} title="Votre compte est suspendu"
        body="Vous ne pouvez pas commander de course pour le moment. Notre équipe peut vous expliquer pourquoi et voir avec vous comment le réactiver." />
    </Screen>
  )
}
