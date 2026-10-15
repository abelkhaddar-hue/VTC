import { View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useLocalSearchParams } from 'expo-router'
import { Link2Off } from 'lucide-react-native'
import { rides, type SharedRide } from '@/data/api'
import { useLoad } from '@/data/hooks'
import { useEffect } from 'react'
import { color, tokens } from '@/theme'
import { Text } from '@/ui/Text'
import { EmptyState, PlateBadge } from '@/ui/primitives'
import { FakeMap } from '@/ui/map'
import { Loading } from '@/ui/layout'

const statusText: Record<SharedRide['status'], string> = {
  driver_en_route: 'Le chauffeur arrive au point de départ',
  driver_arrived: 'Le chauffeur est au point de départ',
  in_progress: 'En route',
  completed: 'Arrivé à destination',
  cancelled: 'Course annulée',
}

// S21 — Page de suivi partagée, ouverte par un proche sans compte ni app.
export default function SharedRidePage() {
  const { token } = useLocalSearchParams<{ token: string }>()
  const r = useLoad<SharedRide | null>(() => rides.shared(token), [token])
  useEffect(() => { const t = setInterval(r.reload, 5000); return () => clearInterval(t) }, [r.reload])

  if (r.loading && r.data === undefined) return <Loading label="Chargement du trajet…" />
  if (!r.data) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: color('bg'), justifyContent: 'center' }}>
        <EmptyState icon={Link2Off} title="Ce lien n’est plus valable" body="Le trajet est terminé depuis plus d’une heure, ou le lien a été désactivé." />
      </SafeAreaView>
    )
  }
  const s = r.data
  return (
    <View style={{ flex: 1, backgroundColor: color('bg') }}>
      <View style={{ flex: 1 }}>
        <FakeMap pickup={s.status === 'in_progress' ? null : s.pickup} dropoff={s.dropoffPoint} driver={s.driverPosition} label="Position de la voiture" />
      </View>
      <SafeAreaView edges={['bottom']} style={{ padding: tokens.layout.gutter }}>
        <View style={{ gap: 8, width: '100%', maxWidth: tokens.layout['max-content'], alignSelf: 'center' }}>
          <Text variant="xs" tone="subtle">Trajet partagé avec vous</Text>
          <Text variant="lg" heading accessibilityLiveRegion="polite">{statusText[s.status]}</Text>
          <Text tone="muted" numberOfLines={1}>Vers {s.dropoff}</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
            <Text weight={600}>{s.driverFirstName}</Text>
            <Text variant="sm" tone="muted">{s.vehicle}</Text>
            <PlateBadge plate={s.plate} />
          </View>
          <Text variant="xs" tone="subtle">Mise à jour toutes les 5 secondes. Ce lien expire une heure après l’arrivée.</Text>
        </View>
      </SafeAreaView>
    </View>
  )
}
