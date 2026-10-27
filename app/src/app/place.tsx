import { useEffect, useState } from 'react'
import { ScrollView, TextInput, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { router, useLocalSearchParams } from 'expo-router'
import { Building2, Clock, Landmark, LocateFixed, Map as MapIcon, MapPin, Search, ShoppingBag, TrainFront, X, type LucideIcon } from 'lucide-react-native'
import { geo, type LngLat, type Place } from '@/data/api'
import { draft } from '@/data/draft'
import { color, tokens, typeStyle } from '@/theme'
import { inputFrame } from '@/ui/inputFrame'
import { Text } from '@/ui/Text'
import { Button, IconButton } from '@/ui/Button'
import { Touchable } from '@/ui/Pressable'
import { Banner } from '@/ui/primitives'
import { FakeMap } from '@/ui/map'
import { Skeleton } from '@/ui/layout'

const kindIcon: Record<NonNullable<Place['kind']>, LucideIcon> = { landmark: Landmark, station: TrainFront, mall: ShoppingBag, street: Building2, recent: Clock }

function PlaceRow({ place, onPress }: { place: Place; onPress: () => void }) {
  const Icon = kindIcon[place.kind ?? 'street']
  return (
    <Touchable onPress={onPress} accessibilityRole="button" accessibilityLabel={`${place.name}, ${place.detail}`}
      style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 16, minHeight: 64, paddingHorizontal: 16, borderRadius: tokens.radius.md, backgroundColor: pressed ? color('surface') : 'transparent' })}>
      <View style={{ width: 40, height: 40, borderRadius: tokens.radius.pill, backgroundColor: color('surface-2'), alignItems: 'center', justifyContent: 'center' }}>
        <Icon size={tokens.size.icon} color={color('text-muted')} />
      </View>
      <View style={{ flex: 1 }}>
        <Text weight={500} numberOfLines={1}>{place.name}</Text>
        <Text variant="sm" tone="muted" numberOfLines={1}>{place.detail}</Text>
      </View>
    </Touchable>
  )
}

// S06 — Recherche d'adresse, avec « choisir sur la carte ».
export default function PlaceScreen() {
  const { field = 'dropoff' } = useLocalSearchParams<{ field: 'pickup' | 'dropoff' }>()
  const isPickup = field === 'pickup'
  const [q, setQ] = useState('')
  const [results, setResults] = useState<Place[] | null>(null)
  const [recent, setRecent] = useState<Place[]>([])
  const [searching, setSearching] = useState(false)
  const [error, setError] = useState<string>()
  const [mapMode, setMapMode] = useState(false)
  const [pin, setPin] = useState<LngLat | null>(null)
  const [pinPlace, setPinPlace] = useState<Place | null>(null)
  const [me, setMe] = useState<LngLat | null>(null)
  const [focused, setFocused] = useState(false)
  const search = inputFrame({ focused })

  useEffect(() => { geo.recent().then(setRecent).catch(() => {}); geo.myPosition().then(setMe).catch(() => {}) }, [])

  // Recherche avec un petit délai pour ne pas interroger à chaque lettre (coût Places API).
  useEffect(() => {
    if (q.trim().length < 2) { setResults(null); return }
    let alive = true
    setSearching(true); setError(undefined)
    const t = setTimeout(() => {
      geo.search(q).then((r) => { if (alive) setResults(r) }).catch((e) => { if (alive) setError(e.message) }).finally(() => { if (alive) setSearching(false) })
    }, 250)
    return () => { alive = false; clearTimeout(t) }
  }, [q])

  useEffect(() => {
    if (!pin) return
    let alive = true
    geo.reverse(pin).then((p) => { if (alive) setPinPlace(p) })
    return () => { alive = false }
  }, [pin])

  const choose = (p: Place) => { draft.set(isPickup ? { pickup: p } : { dropoff: p }); router.back() }
  const current = draft.get()

  if (mapMode) {
    const start = pin ?? (isPickup ? current.pickup?.point : current.dropoff?.point) ?? me
    return (
      <View style={{ flex: 1 }}>
        <FakeMap me={me} pin={start} onPick={(p) => { setPin(p); setPinPlace(null) }} label="Carte : touchez pour placer le point">
          <SafeAreaView edges={['top']} style={{ padding: tokens.layout.gutter }} pointerEvents="box-none">
            <IconButton icon={X} label="Revenir à la recherche" onPress={() => setMapMode(false)} />
          </SafeAreaView>
        </FakeMap>
        <SafeAreaView edges={['bottom']} style={{ backgroundColor: color('bg'), padding: tokens.layout.gutter, gap: 12 }}>
          <View style={{ width: '100%', maxWidth: tokens.layout['max-content'], alignSelf: 'center', gap: 12 }}>
            <Text variant="sm" tone="muted">{isPickup ? 'Où le chauffeur doit-il vous prendre ?' : 'Où allez-vous ?'} Touchez la carte pour placer le point.</Text>
            <Text weight={600} numberOfLines={2} accessibilityLiveRegion="polite">{pinPlace ? `${pinPlace.name} — ${pinPlace.detail}` : pin ? 'Recherche de l’adresse…' : 'Aucun point choisi'}</Text>
            <Button label="Valider ce point" size="lg" disabled={!pinPlace} onPress={() => pinPlace && choose(pinPlace)} />
          </View>
        </SafeAreaView>
      </View>
    )
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: color('bg') }}>
      <View style={{ width: '100%', maxWidth: tokens.layout['max-content'], alignSelf: 'center', flex: 1 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, padding: 8 }}>
          <IconButton icon={X} label="Fermer" variant="ghost" onPress={() => router.back()} />
          <View style={[search.style, { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8, height: tokens.size.input, paddingHorizontal: 14 + search.inset, borderRadius: tokens.radius.pill }]}>
            <Search size={18} color={color('text-subtle')} />
            <TextInput value={q} onChangeText={setQ} autoFocus placeholder={isPickup ? 'Point de départ' : 'Adresse, lieu, quartier'}
              placeholderTextColor={color('text-subtle')} accessibilityLabel={isPickup ? 'Rechercher le point de départ' : 'Rechercher l’arrivée'}
              onFocus={() => setFocused(true)} onBlur={() => setFocused(false)} returnKeyType="search"
              style={[typeStyle('base'), { flex: 1, color: color('text'), outlineStyle: 'none' } as object]} />
            {q ? <IconButton icon={X} size={40} variant="ghost" label="Effacer la recherche" onPress={() => setQ('')} /> : null}
          </View>
        </View>
        <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: 8, gap: 4 }}>
          {!results && !searching ? (
            <>
              {isPickup && me ? <PlaceRow place={{ id: 'me', name: 'Ma position', detail: 'Utiliser le GPS', point: me, kind: 'street' }} onPress={async () => choose(await geo.reverse(me))} /> : null}
              <Touchable onPress={() => setMapMode(true)} accessibilityRole="button" accessibilityLabel="Choisir sur la carte"
                style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 16, minHeight: 56, paddingHorizontal: 16, borderRadius: tokens.radius.md, backgroundColor: pressed ? color('surface') : 'transparent' })}>
                <View style={{ width: 40, height: 40, borderRadius: tokens.radius.pill, backgroundColor: color('accent-soft'), alignItems: 'center', justifyContent: 'center' }}>
                  <MapIcon size={tokens.size.icon} color={color('on-accent-soft')} />
                </View>
                <Text weight={500} tone="accent">Choisir sur la carte</Text>
              </Touchable>
              {recent.length ? <Text variant="xs" weight={700} tone="subtle" style={{ paddingHorizontal: 16, paddingTop: 12, textTransform: 'uppercase', letterSpacing: 1 }}>Récents</Text> : null}
              {recent.map((p) => <PlaceRow key={p.id} place={p} onPress={() => choose(p)} />)}
            </>
          ) : null}
          {searching ? <View style={{ gap: 8, padding: 8 }}><Skeleton /><Skeleton /><Skeleton /></View> : null}
          {error ? <Banner kind="danger" title={error} /> : null}
          {results && !searching ? (results.length ? results.map((p) => <PlaceRow key={p.id} place={p} onPress={() => choose(p)} />) : (
            <View style={{ padding: 24, gap: 12, alignItems: 'center' }}>
              <MapPin size={32} color={color('text-subtle')} />
              <Text weight={600} center>Aucun lieu trouvé pour « {q.trim()} »</Text>
              <Text variant="sm" tone="muted" center>Vérifiez l’orthographe, ou placez le point vous-même.</Text>
              <Button label="Choisir sur la carte" variant="secondary" icon={LocateFixed} onPress={() => setMapMode(true)} />
            </View>
          )) : null}
        </ScrollView>
      </View>
    </SafeAreaView>
  )
}
