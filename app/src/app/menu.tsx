import { View } from 'react-native'
import { router } from 'expo-router'
import { CarFront, History, LifeBuoy, LogOut, Palette, Settings, ShieldCheck } from 'lucide-react-native'
import { account, auth, type Profile } from '@/data/api'
import { useLoad } from '@/data/hooks'
import { Screen, Skeleton } from '@/ui/layout'
import { Text } from '@/ui/Text'
import { Avatar, Card, ListRow, RatingBadge } from '@/ui/primitives'

// S17 — Menu latéral (écran plein sur mobile).
export default function Menu() {
  const p = useLoad<Profile>(() => account.profile(), [], (set) => account.onProfile(set))
  return (
    <Screen title="Menu" close tone="surface">
      <Card style={{ flexDirection: 'row', alignItems: 'center', gap: 16 }}>
        {p.data ? (
          <>
            <Avatar name={p.data.firstName || '?'} size="lg" />
            <View style={{ flex: 1, gap: 4 }}>
              <Text variant="lg" numberOfLines={1}>{p.data.firstName}</Text>
              <RatingBadge rating={p.data.rating} count={p.data.ratingCount} />
              <Text variant="xs" tone="subtle">La note que vous donnent les chauffeurs</Text>
            </View>
          </>
        ) : <View style={{ flex: 1 }}><Skeleton height={64} /></View>}
      </Card>
      <Card style={{ paddingHorizontal: 0, paddingVertical: 8 }}>
        <ListRow icon={CarFront} label="Commander une course" onPress={() => router.replace('/home')} />
        <ListRow icon={History} label="Mes courses" detail="Historique et reçus" onPress={() => router.push('/history')} />
        <ListRow icon={ShieldCheck} label="Sécurité" detail="Contacts d’urgence" onPress={() => router.push('/settings')} />
        <ListRow icon={LifeBuoy} label="Aide" detail="Objet oublié, problème de prix…" onPress={() => router.push('/support')} />
        <ListRow icon={Settings} label="Réglages" detail="Profil, langue, compte" onPress={() => router.push('/settings')} />
      </Card>
      <Card style={{ paddingHorizontal: 0, paddingVertical: 8 }}>
        <ListRow icon={Palette} label="Design system" detail="Pour l’équipe : tous les composants" onPress={() => router.push('/design')} />
        <ListRow icon={LogOut} label="Se déconnecter" danger trailing={<View />} onPress={async () => { await auth.signOut(); router.replace('/welcome') }} />
      </Card>
    </Screen>
  )
}
