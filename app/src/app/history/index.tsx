import { View } from 'react-native'
import { router } from 'expo-router'
import { ChevronRight, History as HistoryIcon } from 'lucide-react-native'
import { rides, type RideSummary } from '@/data/api'
import { useLoad } from '@/data/hooks'
import { color, formatMAD, tokens } from '@/theme'
import { ErrorBlock, Screen, Skeleton } from '@/ui/layout'
import { Text } from '@/ui/Text'
import { Button } from '@/ui/Button'
import { Touchable } from '@/ui/Pressable'
import { Card, EmptyState } from '@/ui/primitives'
import { formatWhen } from '@/ui/format'


function Row({ r }: { r: RideSummary }) {
  return (
    <Touchable onPress={() => router.push(`/history/${r.id}`)} accessibilityRole="button"
      accessibilityLabel={`${formatWhen(r.at)}, de ${r.pickup} à ${r.dropoff}, ${r.status === 'cancelled' ? 'annulée' : formatMAD(r.fareCents)}`}
      style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 16, borderRadius: tokens.radius.lg, backgroundColor: pressed ? color('surface-2') : color('bg') })}>
      <View style={{ flex: 1, gap: 4 }}>
        <Text variant="xs" tone="subtle">{formatWhen(r.at)}</Text>
        <Text weight={600} numberOfLines={1}>{r.dropoff}</Text>
        <Text variant="sm" tone="muted" numberOfLines={1}>depuis {r.pickup}</Text>
      </View>
      <View style={{ alignItems: 'flex-end', gap: 4 }}>
        {r.status === 'cancelled' ? <Text variant="sm" weight={600} tone="danger">Annulée</Text> : <Text weight={700} tabular>{formatMAD(r.fareCents)}</Text>}
      </View>
      <ChevronRight size={tokens.size.icon} color={color('text-subtle')} />
    </Touchable>
  )
}

// S18 — Historique des courses.
export default function History() {
  const h = useLoad<RideSummary[]>(() => rides.history(), [])
  return (
    <Screen title="Mes courses" tone="surface">
      {h.loading ? <View style={{ gap: 8 }}><Skeleton height={88} /><Skeleton height={88} /><Skeleton height={88} /></View> : null}
      {h.error ? <ErrorBlock message={h.error.message} onRetry={h.reload} /> : null}
      {h.data && !h.data.length ? (
        <Card><EmptyState icon={HistoryIcon} title="Aucune course pour l’instant" body="Vos trajets apparaîtront ici, avec leurs reçus."
          action={<Button label="Commander une course" onPress={() => router.replace('/home')} />} /></Card>
      ) : null}
      {h.data?.map((r) => <Row key={r.id} r={r} />)}
      {h.data?.length ? <Text variant="xs" tone="subtle" center>Une course apparaît ici dès qu’elle se termine. Historique conservé 2 ans.</Text> : null}
    </Screen>
  )
}
