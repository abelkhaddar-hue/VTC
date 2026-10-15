import { useEffect, useState } from 'react'
import { View } from 'react-native'
import { router } from 'expo-router'
import { Banknote, CreditCard, LocateFixed, Menu, SlidersHorizontal, Wallet, type LucideIcon } from 'lucide-react-native'
import { account, auth, geo, rides, type City, type PaymentMethod, type Profile } from '@/data/api'
import { draft, useDraft } from '@/data/draft'
import { useAction } from '@/data/hooks'
import { color, formatMAD, tokens } from '@/theme'
import { Text } from '@/ui/Text'
import { Button, IconButton } from '@/ui/Button'
import { Touchable } from '@/ui/Pressable'
import { Banner } from '@/ui/primitives'
import { AddressField, ServiceTabs } from '@/ui/ride'
import { FakeMap } from '@/ui/map'
import { MapScreen } from '@/ui/layout'

const payIcons: Record<PaymentMethod, LucideIcon> = { cash: Banknote, card: CreditCard, wallet: Wallet }
const payLabels: Record<PaymentMethod, string> = { cash: 'Espèces', card: 'Carte', wallet: 'Portefeuille' }

function SheetRow({ icon: Icon, label, value, onPress, a11y }: { icon: LucideIcon; label: string; value: string; onPress: () => void; a11y: string }) {
  return (
    <Touchable onPress={onPress} accessibilityRole="button" accessibilityLabel={a11y}
      style={({ pressed }) => ({ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 48, paddingHorizontal: 12, borderRadius: tokens.radius.md, backgroundColor: pressed ? color('surface-2') : color('surface') })}>
      <Icon size={tokens.size.icon} color={color('text')} />
      <View style={{ flex: 1 }}>
        <Text variant="xs" tone="subtle">{label}</Text>
        <Text variant="sm" weight={600} numberOfLines={1}>{value}</Text>
      </View>
    </Touchable>
  )
}

// S05 — Accueil : carte + formulaire de demande.
export default function Home() {
  const d = useDraft()
  const [me, setMe] = useState<{ lng: number; lat: number } | null>(null)
  const [city, setCity] = useState<City>()
  const [profile, setProfile] = useState<Profile>()
  const [quoteError, setQuoteError] = useState<string>()
  const [quoting, setQuoting] = useState(false)
  const create = useAction(rides.createRequest)

  useEffect(() => {
    if (!auth.session()) { router.replace('/welcome'); return }
    account.city().then(setCity).catch(() => {})
    account.profile().then(setProfile).catch(() => {})
    const unsub = account.onProfile(setProfile)
    geo.myPosition().then(async (p) => {
      setMe(p)
      if (!draft.get().pickup) draft.set({ pickup: await geo.reverse(p) })
    }).catch(() => {})
    return unsub
  }, [])

  // Nouveau devis dès que départ, arrivée ou service changent.
  useEffect(() => {
    if (!d.pickup || !d.dropoff) { draft.set({ quote: null }); setQuoteError(undefined); return }
    let alive = true
    setQuoting(true); setQuoteError(undefined)
    rides.quote(d.pickup.point, d.dropoff.point, d.service)
      .then((q) => {
        if (!alive) return
        const cur = draft.get().offeredCents
        draft.set({ quote: q, offeredCents: cur && cur >= q.recommendedCents ? cur : q.recommendedCents })
      })
      .catch((e) => { if (alive) { draft.set({ quote: null }); setQuoteError(e.message) } })
      .finally(() => { if (alive) setQuoting(false) })
    return () => { alive = false }
  }, [d.pickup?.id, d.dropoff?.id, d.service])

  const restricted = profile?.status === 'restricted'
  const ready = !!(d.quote && d.offeredCents && d.offeredCents >= d.quote.recommendedCents && !restricted)
  const optionsCount = d.options.length + (d.comment ? 1 : 0) + (d.passengers > 1 ? 1 : 0)
  const PayIcon = payIcons[d.payment]

  const submit = async () => {
    if (!d.pickup || !d.dropoff || !d.offeredCents) return
    const r = await create.run({ service: d.service, pickup: d.pickup, dropoff: d.dropoff, offeredCents: d.offeredCents, payment: d.payment, options: d.options, passengers: d.passengers, comment: d.comment })
    if (r) router.replace(`/request/${r.id}`)
  }

  return (
    <MapScreen
      map={<FakeMap me={me} pickup={d.dropoff ? d.pickup?.point : null} dropoff={d.dropoff?.point} route={d.quote?.route} label="Carte autour de votre position" />}
      top={
        <View style={{ flexDirection: 'row', justifyContent: 'space-between' }} pointerEvents="box-none">
          <IconButton icon={Menu} label="Ouvrir le menu" onPress={() => router.push('/menu')} />
          <IconButton icon={LocateFixed} label="Partir de ma position" onPress={async () => { if (me) draft.set({ pickup: await geo.reverse(me) }) }} />
        </View>
      }
    >
      {restricted ? <Banner kind="danger" title="Compte limité pour 2 h" body="Trop d’annulations aujourd’hui. Vous pourrez commander de nouveau un peu plus tard." /> : null}
      <ServiceTabs value={d.service} onChange={(service) => draft.set({ service })}
        unavailable={city?.rideTypes.filter((t) => !t.available).map((t) => t.code) ?? []} />
      <View style={{ gap: 8 }}>
        <AddressField kind="pickup" value={d.pickup?.name} placeholder="Recherche de votre position…" onPress={() => router.push({ pathname: '/place', params: { field: 'pickup' } })}
          error={quoteError?.includes('départ') ? quoteError : undefined} />
        <AddressField kind="dropoff" value={d.dropoff?.name} placeholder="Où allez-vous ?" onPress={() => router.push({ pathname: '/place', params: { field: 'dropoff' } })}
          error={quoteError && !quoteError.includes('départ') ? quoteError : undefined} />
      </View>
      {d.dropoff && !quoteError ? (
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <SheetRow icon={PayIcon} label="Votre prix" a11y={`Votre prix : ${d.offeredCents ? formatMAD(d.offeredCents) : 'calcul en cours'}, payé en ${payLabels[d.payment]}. Modifier`}
            value={quoting || !d.offeredCents ? 'Calcul…' : `${formatMAD(d.offeredCents)} · ${payLabels[d.payment]}`} onPress={() => router.push('/fare')} />
          <SheetRow icon={SlidersHorizontal} label="Options" a11y={`Options et commentaire, ${optionsCount || 'aucune'}. Modifier`}
            value={optionsCount ? `${optionsCount} choisie${optionsCount > 1 ? 's' : ''}` : 'Aucune'} onPress={() => router.push('/options')} />
        </View>
      ) : null}
      {d.quote && !quoting ? (
        <Text variant="xs" tone="subtle" center>
          {(d.quote.distanceM / 1000).toLocaleString('fr-MA', { maximumFractionDigits: 1 })} km · environ {Math.round(d.quote.durationS / 60)} min · prix conseillé {formatMAD(d.quote.recommendedCents)}
        </Text>
      ) : null}
      {create.error ? <Banner kind="danger" title={create.error} /> : null}
      <Button label="Trouver un chauffeur" size="lg" disabled={!ready} loading={create.busy} onPress={submit} />
    </MapScreen>
  )
}
