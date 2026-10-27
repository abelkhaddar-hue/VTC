import { useEffect, useState, type ReactNode } from 'react'
import { ScrollView, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import {
  Bell, History, LifeBuoy, LocateFixed, Menu, SearchX, Settings, Share2, Siren, Trash2, UserRound,
} from 'lucide-react-native'
import { color, tokens, type ColorRole } from '@/theme'
import { Text } from '@/ui/Text'
import { Button, IconButton } from '@/ui/Button'
import { Avatar, Banner, Card, Divider, EmptyState, ListGroup, ListRow, PlateBadge, RatingBadge } from '@/ui/primitives'
import {
  AddressField, BottomSheetFrame, DriverCard, FareInput, Keypad, MapPlaceholder, OfferCard, PaymentPicker,
  RouteSummary, SearchingPulse, ServiceTabs, type Offer, type PaymentMethod, type ServiceCode,
} from '@/ui/ride'
import { ChatBubble, ChoiceList, CodeInput, Composer, PhoneInput, StarRating, isMoroccanMobile } from '@/ui/forms'

function Section({ id, title, children }: { id: string; title: string; children: ReactNode }) {
  return (
    <View style={{ gap: 12 }} nativeID={id}>
      <Text variant="xs" weight={700} tone="subtle" style={{ textTransform: 'uppercase', letterSpacing: 1 }} heading>{title}</Text>
      {children}
    </View>
  )
}

function Swatch({ role }: { role: ColorRole }) {
  return (
    <View style={{ width: '31%', gap: 4 }}>
      <View style={{ height: 44, borderRadius: tokens.radius.md, backgroundColor: color(role), borderWidth: 1, borderColor: color('border') }} />
      <Text variant="xs" weight={600}>{role}</Text>
      <Text variant="xs" tone="subtle">{color(role)}</Text>
    </View>
  )
}

const baseOffers: Offer[] = [
  { id: 'a', fareCents: 4000, kind: 'accept', etaMin: 3, distanceKm: 1.2, driver: { name: 'Karim', rating: 4.9, rides: 312 }, vehicle: { make: 'Dacia', model: 'Logan', color: 'blanche' }, totalS: 45, leftS: 38 },
  { id: 'b', fareCents: 4400, kind: 'counter', etaMin: 5, distanceKm: 2.1, driver: { name: 'Youssef', rating: 4.7, rides: 88 }, vehicle: { make: 'Hyundai', model: 'Accent', color: 'grise' }, totalS: 45, leftS: 9 },
  { id: 'c', fareCents: 4000, kind: 'accept', etaMin: 6, distanceKm: 2.6, driver: { name: 'Salma', rating: null, rides: 2 }, vehicle: { make: 'Peugeot', model: '301', color: 'noire' }, totalS: 45, leftS: 44 },
]

export default function DesignScreen() {
  const [service, setService] = useState<ServiceCode>('economy')
  const [fare, setFare] = useState<number | null>(3000)
  const [pay, setPay] = useState<PaymentMethod>('cash')
  const [offers, setOffers] = useState(baseOffers)
  const [accepting, setAccepting] = useState<string | null>(null)
  const [phone, setPhone] = useState('0612')
  const [code, setCode] = useState('12')
  const [reason, setReason] = useState<string[]>(['changed_mind'])
  const [opts, setOpts] = useState<string[]>(['luggage'])
  const [stars, setStars] = useState(5)
  const [tags, setTags] = useState<string[]>(['Conduite douce'])
  const [chat, setChat] = useState([{ from: 'them' as const, text: 'Bonjour, je suis à 2 minutes.' }, { from: 'me' as const, text: 'Parfait, je vous attends devant.' }])

  // Les comptes à rebours tournent pour voir la barre passer à l'orange puis l'offre disparaître.
  useEffect(() => {
    const t = setInterval(() => setOffers((os) => os.map((o) => ({ ...o, leftS: o.leftS > 0 ? o.leftS - 1 : o.totalS }))), 1000)
    return () => clearInterval(t)
  }, [])

  const onKey = (k: string) => setFare((f) => {
    const mad = (f ?? 0) / 100
    if (k === 'del') { const n = Math.floor(mad / 10); return n ? n * 100 : null }
    if (k === '+5') return (mad + 5) * 100
    const n = mad * 10 + Number(k)
    return n > 9999 ? f : n * 100
  })

  const roles = Object.keys(tokens.color) as ColorRole[]

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: color('surface') }}>
      <ScrollView contentContainerStyle={{ padding: tokens.layout.gutter, paddingBottom: 64, gap: 32, width: '100%', maxWidth: tokens.layout['max-content'], alignSelf: 'center' }}>
        <View style={{ gap: 4 }}>
          <Text variant="xl" heading>Design system</Text>
          <Text tone="muted">Accent provisoire en attendant /replica-brand. Tous les composants, tous leurs états.</Text>
        </View>

        <Section id="couleurs" title="Couleurs (rôles)">
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, justifyContent: 'space-between' }}>
            {roles.map((r) => <Swatch key={r} role={r} />)}
          </View>
        </Section>

        <Section id="typo" title="Typographie · Inter">
          <Card>
            <Text variant="display">44 MAD</Text>
            <Text variant="xl">Titre d’écran</Text>
            <Text variant="lg">Sous-titre, nom du chauffeur</Text>
            <Text>Texte courant. Votre chauffeur arrive bientôt.</Text>
            <Text variant="sm" tone="muted">Adresse secondaire, aide</Text>
            <Text variant="xs" tone="subtle">Mention, horodatage</Text>
          </Card>
        </Section>

        <Section id="boutons" title="Boutons (toujours en pilule)">
          <Card style={{ gap: 12 }}>
            <Button label="Trouver un chauffeur" size="lg" />
            <Button label="Accepter" size="lg" trailing="44 MAD" />
            <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
              <Button label="Principal" />
              <Button label="Secondaire" variant="secondary" />
              <Button label="Discret" variant="ghost" />
              <Button label="Annuler la course" variant="danger" />
            </View>
            <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
              <Button label="Petit" size="sm" />
              <Button label="Chargement" loading />
              <Button label="Désactivé" disabled />
            </View>
            <View style={{ flexDirection: 'row', gap: 12 }}>
              <IconButton icon={Menu} label="Ouvrir le menu" />
              <IconButton icon={LocateFixed} label="Recentrer sur ma position" />
              <IconButton icon={Share2} label="Partager ma course" variant="accent" />
              <IconButton icon={Bell} label="Notifications" variant="ghost" disabled />
            </View>
          </Card>
        </Section>

        <Section id="badges" title="Avatar, note, plaque">
          <Card style={{ flexDirection: 'row', gap: 16, alignItems: 'center', flexWrap: 'wrap' }}>
            <Avatar name="Karim B" size="sm" />
            <Avatar name="Youssef" />
            <Avatar name="Salma E" size="lg" />
            <RatingBadge rating={4.9} count={312} />
            <RatingBadge rating={null} />
            <PlateBadge plate="6789-B-1" />
          </Card>
        </Section>

        <Section id="demande" title="Demande (S05) dans le panneau du bas">
          <MapPlaceholder height={200}>
            <View style={{ position: 'absolute', top: 12, left: 12 }}><IconButton icon={Menu} label="Ouvrir le menu" /></View>
            <View style={{ position: 'absolute', bottom: 12, right: 12 }}><IconButton icon={LocateFixed} label="Recentrer sur ma position" /></View>
          </MapPlaceholder>
          <BottomSheetFrame>
            <ServiceTabs value={service} onChange={setService} unavailable={['moto']} />
            <AddressField kind="pickup" value="Mosquée Hassan II, Casablanca" placeholder="Point de départ" />
            <AddressField kind="dropoff" placeholder="Où allez-vous ?" onPickOnMap={() => {}} />
            <AddressField kind="pickup" value="Tanger Ville" placeholder="Point de départ" error="Ce départ est hors de la zone desservie." />
            <Button label="Trouver un chauffeur" size="lg" disabled />
          </BottomSheetFrame>
        </Section>

        <Section id="prix" title="Prix (S07) — tapez sur le pavé">
          <Card style={{ gap: 16 }}>
            <FareInput cents={fare} recommendedCents={3400} />
            <Keypad onKey={onKey} />
            <Button label="Valider ce prix" size="lg" disabled={!fare || fare < 3400} />
          </Card>
        </Section>

        <Section id="paiement" title="Paiement">
          <PaymentPicker value={pay} onChange={setPay} available={['cash', 'card', 'wallet']} />
        </Section>

        <Section id="recherche" title="Recherche (S09)">
          <Card style={{ gap: 16 }}>
            <SearchingPulse />
            <RouteSummary from="Mosquée Hassan II" to="Morocco Mall" meta="5,4 km · 15 min" />
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <Button label="Annuler" variant="secondary" />
              <View style={{ flex: 1 }}><Button label="Passer à 45 MAD" fullWidth /></View>
            </View>
          </Card>
        </Section>

        <Section id="offres" title="Offres (S10) — comptes à rebours réels">
          {offers.map((o) => (
            <OfferCard
              key={o.id}
              offer={o}
              accepting={accepting === o.id}
              disabled={accepting !== null && accepting !== o.id}
              onAccept={() => { setAccepting(o.id); setTimeout(() => setAccepting(null), 1500) }}
              onDecline={() => setOffers((os) => os.filter((x) => x.id !== o.id))}
            />
          ))}
          {offers.length === 0 ? (
            <EmptyState icon={SearchX} title="Pas encore d’offre" body="Les chauffeurs proches sont occupés. Augmenter votre prix aide souvent." action={<Button label="Revoir les offres" onPress={() => setOffers(baseOffers)} />} />
          ) : null}
        </Section>

        <Section id="course" title="Chauffeur en route (S11)">
          <Card><DriverCard name="Youssef" rating={4.7} rides={88} vehicle="Hyundai Accent · grise" plate="6789-B-1" etaMin={4} /></Card>
          <Card><DriverCard name="Youssef" rating={4.7} rides={88} vehicle="Hyundai Accent · grise" plate="6789-B-1" arrived /></Card>
        </Section>

        <Section id="bannieres" title="Messages">
          <Banner kind="info" title="Prix conseillé mis à jour" body="Le trafic est dense, le prix conseillé a augmenté de 4 MAD." onDismiss={() => {}} />
          <Banner kind="success" title="Course partagée avec Maman" />
          <Banner kind="warning" title="Localisation imprécise" body="Déplacez l’épingle pour indiquer votre point exact." />
          <Banner kind="danger" title="Compte limité pendant 2 h" body="Trop d’annulations aujourd’hui." />
        </Section>

        <Section id="formulaires" title="Connexion (S02, S03)">
          <Card style={{ gap: 20 }}>
            <PhoneInput value={phone} onChange={setPhone} error={phone.length === 10 && !isMoroccanMobile(phone) ? 'Ce numéro n’est pas un mobile marocain.' : undefined} />
            <CodeInput value={code} onChange={setCode} resendIn={42} />
            <CodeInput value="483912" onChange={() => {}} error="Code incorrect. Il vous reste 2 essais." />
          </Card>
        </Section>

        <Section id="choix" title="Choix (S08, S16)">
          <Card style={{ gap: 16 }}>
            <Text weight={600}>Pourquoi annulez-vous ?</Text>
            <ChoiceList mode="single" value={reason} onChange={setReason} options={[
              { value: 'driver_late', label: 'Le chauffeur est trop loin' },
              { value: 'wrong_vehicle', label: 'Ce n’est pas la bonne voiture' },
              { value: 'changed_mind', label: 'J’ai changé d’avis' },
              { value: 'other', label: 'Autre raison' },
            ]} />
            <Divider />
            <Text weight={600}>Options</Text>
            <ChoiceList mode="multiple" value={opts} onChange={setOpts} options={[
              { value: 'child_seat', label: 'Siège enfant' },
              { value: 'luggage', label: 'Bagages volumineux' },
              { value: 'pet', label: 'Animal de compagnie' },
            ]} />
          </Card>
        </Section>

        <Section id="note" title="Note (S15)">
          <Card><StarRating value={stars} onChange={setStars} tags={tags} onTags={setTags} /></Card>
        </Section>

        <Section id="chat" title="Messagerie (S12)">
          <Card style={{ gap: 8 }}>
            <ChatBubble from="system" text="Course acceptée · 14:32" />
            {chat.map((m, i) => <ChatBubble key={i} from={m.from} text={m.text} />)}
            <ChatBubble from="me" text="Je porte une veste rouge." status="failed" />
            <Composer onSend={(t) => setChat((c) => [...c, { from: 'me', text: t }])} />
          </Card>
        </Section>

        <Section id="menu" title="Menu et sécurité (S13, S17)">
          <ListGroup>
            <ListRow icon={UserRound} label="Mon profil" detail="Sara · 4,8" />
            <ListRow icon={History} label="Mes courses" />
            <ListRow icon={Share2} label="Partager ma course" detail="Envoyer un lien de suivi" />
            <ListRow icon={Siren} label="Appeler les urgences" detail="Police 19 · SAMU 15" />
            <ListRow icon={LifeBuoy} label="Aide" />
            <ListRow icon={Settings} label="Réglages" />
            <ListRow icon={Trash2} label="Supprimer mon compte" danger />
          </ListGroup>
        </Section>

        <Section id="vide" title="État vide (S18)">
          <Card><EmptyState icon={History} title="Aucune course pour l’instant" body="Vos trajets apparaîtront ici après votre première course." action={<Button label="Commander une course" />} /></Card>
        </Section>
      </ScrollView>
    </SafeAreaView>
  )
}
