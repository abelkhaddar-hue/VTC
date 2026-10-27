import { useState } from 'react'
import { View } from 'react-native'
import { router, useLocalSearchParams } from 'expo-router'
import { FileText, LifeBuoy } from 'lucide-react-native'
import { account, rides, type RideSummary } from '@/data/api'
import { useLoad } from '@/data/hooks'
import { color, formatMAD, tokens } from '@/theme'
import { ErrorBlock, Loading, Screen } from '@/ui/layout'
import { Text } from '@/ui/Text'
import { Banner, Card, Divider, ListGroup, ListRow } from '@/ui/primitives'
import { RouteSummary } from '@/ui/ride'
import { formatWhen } from '@/ui/format'

const payLabel = { cash: 'Espèces', card: 'Carte bancaire', wallet: 'Portefeuille' } as const

// S18 (détail) — une course passée, son reçu, et les problèmes à signaler.
export default function HistoryItem() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const h = useLoad<RideSummary>(() => rides.historyItem(id), [id])
  const profile = useLoad(() => account.profile(), [])
  const [receipt, setReceipt] = useState<string>()

  if (h.loading) return <Loading />
  if (h.error || !h.data) return <Screen title="Course"><ErrorBlock message={h.error?.message ?? 'Course introuvable.'} onRetry={h.reload} /></Screen>
  const r = h.data
  const report = () => router.push({ pathname: '/support', params: { ride: r.id } })

  return (
    <Screen title={formatWhen(r.at)} tone="surface">
      <Card style={{ gap: 16 }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <Text variant="xl" tabular tone={r.status === 'cancelled' ? 'muted' : 'default'}>{r.status === 'cancelled' ? 'Annulée' : formatMAD(r.fareCents)}</Text>
          <Text variant="sm" tone="muted">{payLabel[r.payment]}</Text>
        </View>
        <RouteSummary from={r.pickup} to={r.dropoff} meta={`${(r.distanceM / 1000).toLocaleString('fr-MA', { maximumFractionDigits: 1 })} km`} />
        <Divider />
        <Text variant="sm" tone="muted">Chauffeur : {r.driverName} · {r.vehicle}</Text>
        {r.myStars ? <Text variant="sm" tone="muted">Votre note : {'★'.repeat(r.myStars)}{'☆'.repeat(5 - r.myStars)}</Text> : null}
      </Card>
      {receipt ? <Banner kind="success" title={receipt} /> : null}
      <ListGroup>
        {r.status === 'completed' ? (
          <ListRow icon={FileText} label="Recevoir le reçu" detail={profile.data?.email ? `Par e-mail à ${profile.data.email}` : 'Ajoutez un e-mail dans les réglages'}
            onPress={() => profile.data?.email ? setReceipt(`Reçu envoyé à ${profile.data.email}.`) : router.push('/settings')} />
        ) : null}
        <ListRow icon={LifeBuoy} label="Signaler un problème" detail="Objet oublié, prix, comportement…" onPress={report} />
      </ListGroup>
      <View style={{ height: tokens.space[4], backgroundColor: color('surface') }} />
    </Screen>
  )
}
