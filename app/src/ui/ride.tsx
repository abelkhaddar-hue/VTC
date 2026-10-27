import { useEffect, useRef, useState, type ReactNode } from 'react'
import { AccessibilityInfo, Animated, Easing, View } from 'react-native'
import {
  Armchair, Banknote, Bike, Car, CreditCard, Delete, MapPin, MessageCircle, Navigation, Phone,
  ShieldCheck, Users, Wallet, type LucideIcon,
} from 'lucide-react-native'
import { color, formatMAD, shadow, tokens } from '@/theme'
import { Text } from './Text'
import { Touchable } from './Pressable'
import { Button, IconButton } from './Button'
import { Avatar, PlateBadge, RatingBadge } from './primitives'

// ───────── adresses ─────────

export function AddressField({ kind, value, placeholder, error, onPress, onPickOnMap }: {
  kind: 'pickup' | 'dropoff'; value?: string; placeholder: string; error?: string; onPress?: () => void; onPickOnMap?: () => void
}) {
  const label = kind === 'pickup' ? 'Départ' : 'Arrivée'
  return (
    <View style={{ gap: 4 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <Touchable
          onPress={onPress}
          accessibilityRole="button"
          accessibilityLabel={`${label} : ${value ?? 'à choisir'}`}
          style={({ pressed }) => ({
            flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 56, paddingHorizontal: 16,
            borderRadius: tokens.radius.md, borderWidth: error ? 2 : 0, borderColor: color('danger'),
            backgroundColor: pressed ? color('surface-pressed') : color('surface'),
          })}
        >
          <View style={{ width: 12, height: 12, borderRadius: 6, backgroundColor: color(kind === 'pickup' ? 'marker-pickup' : 'marker-dropoff') }} />
          <View style={{ flex: 1 }}>
            <Text variant="xs" tone="subtle">{label}</Text>
            <Text numberOfLines={1} weight={value ? 500 : 400} tone={value ? 'default' : 'subtle'}>{value ?? placeholder}</Text>
          </View>
        </Touchable>
        {onPickOnMap ? <IconButton icon={MapPin} label={`Choisir le point ${label.toLowerCase()} sur la carte`} variant="ghost" onPress={onPickOnMap} /> : null}
      </View>
      {error ? <Text variant="sm" tone="danger">{error}</Text> : null}
    </View>
  )
}

export function RouteSummary({ from, to, meta }: { from: string; to: string; meta?: string }) {
  return (
    <View accessible accessibilityLabel={`De ${from} à ${to}${meta ? `, ${meta}` : ''}`} style={{ flexDirection: 'row', gap: 12 }}>
      <View style={{ alignItems: 'center', paddingVertical: 5 }}>
        <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: color('marker-pickup') }} />
        <View style={{ width: 2, flex: 1, backgroundColor: color('border'), marginVertical: 3 }} />
        <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: color('marker-dropoff') }} />
      </View>
      <View style={{ flex: 1, gap: 8 }}>
        <Text variant="sm" numberOfLines={1}>{from}</Text>
        <Text variant="sm" numberOfLines={1}>{to}</Text>
      </View>
      {meta ? <Text variant="xs" tone="subtle">{meta}</Text> : null}
    </View>
  )
}

// ───────── service ─────────

export type ServiceCode = 'economy' | 'comfort' | 'xl' | 'moto'
const services: { code: ServiceCode; label: string; icon: LucideIcon }[] = [
  { code: 'economy', label: 'Course', icon: Car },
  { code: 'comfort', label: 'Confort', icon: Armchair },
  { code: 'xl', label: 'XL', icon: Users },
  { code: 'moto', label: 'Moto', icon: Bike },
]

export function ServiceTabs({ value, onChange, unavailable = [] }: { value: ServiceCode; onChange: (c: ServiceCode) => void; unavailable?: ServiceCode[] }) {
  return (
    <View accessibilityRole="tablist" style={{ flexDirection: 'row', gap: 8 }}>
      {services.map(({ code, label, icon: Icon }) => {
        const off = unavailable.includes(code)
        const on = value === code
        return (
          <Touchable
            key={code}
            disabled={off}
            onPress={() => onChange(code)}
            accessibilityRole="tab"
            accessibilityLabel={off ? `${label}, bientôt disponible` : label}
            accessibilityState={{ selected: on, disabled: off }}
            style={({ pressed }) => ({
              flex: 1, alignItems: 'center', gap: 4, paddingVertical: 10, borderRadius: tokens.radius.md, borderWidth: 1,
              borderColor: on ? color('accent') : 'transparent',
              backgroundColor: on ? color('accent-soft') : pressed ? color('surface-2') : color('surface'),
            })}
          >
            <Icon size={tokens.size['icon-lg']} color={off ? color('text-subtle') : on ? color('on-accent-soft') : color('text')} />
            <Text variant="xs" weight={on ? 700 : 500} tone={off ? 'subtle' : on ? 'on-accent-soft' : 'default'}>{off ? 'Bientôt' : label}</Text>
          </Touchable>
        )
      })}
    </View>
  )
}

// ───────── prix ─────────

export function FareInput({ cents, recommendedCents, raising }: { cents: number | null; recommendedCents: number; raising?: boolean }) {
  const below = cents != null && cents < recommendedCents
  return (
    <View style={{ alignItems: 'center', gap: 8, paddingVertical: 8 }}>
      <Text variant="xs" tone="subtle">{raising ? 'Nouveau prix' : 'Votre prix'}</Text>
      <View accessibilityLiveRegion="polite" accessible accessibilityLabel={cents ? formatMAD(cents) : 'Aucun montant saisi'} style={{ flexDirection: 'row', alignItems: 'baseline', gap: 8 }}>
        <Text variant="display" tabular tone={cents ? (below ? 'danger' : 'default') : 'subtle'}>{cents ? cents / 100 : 0}</Text>
        <Text variant="lg" tone="muted">MAD</Text>
      </View>
      <Text variant="sm" tone={below ? 'danger' : 'muted'}>
        {below ? `Minimum ${formatMAD(recommendedCents)} pour ce trajet` : raising ? `Au moins ${formatMAD(recommendedCents)}` : `Prix conseillé : ${formatMAD(recommendedCents)}`}
      </Text>
      <Text variant="xs" tone="subtle" center>Péages et frais d'aéroport en plus, payés sur place.</Text>
    </View>
  )
}

const keys = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '+5', '0', 'del'] as const

export function Keypad({ onKey, shortcuts = true }: { onKey: (k: string) => void; shortcuts?: boolean }) {
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', rowGap: 8, justifyContent: 'space-between' }}>
      {keys.map((k) => {
        if (k === '+5' && !shortcuts) return <View key={k} style={{ width: '31%' }} />
        const label = k === 'del' ? 'Effacer le dernier chiffre' : k === '+5' ? 'Ajouter 5 dirhams' : k
        return (
          <Touchable
            key={k}
            onPress={() => onKey(k)}
            accessibilityRole="button"
            accessibilityLabel={label}
            style={({ pressed }) => ({ width: '31%', height: 56, borderRadius: tokens.radius.pill, alignItems: 'center', justifyContent: 'center', backgroundColor: pressed ? color('surface-2') : color('surface') })}
          >
            {k === 'del' ? <Delete size={tokens.size['icon-lg']} color={color('text')} /> : <Text variant="lg" weight={600} tone={k === '+5' ? 'accent' : 'default'}>{k}</Text>}
          </Touchable>
        )
      })}
    </View>
  )
}

export type PaymentMethod = 'cash' | 'card' | 'wallet'
const methods: { code: PaymentMethod; label: string; icon: LucideIcon }[] = [
  { code: 'cash', label: 'Espèces', icon: Banknote },
  { code: 'card', label: 'Carte bancaire', icon: CreditCard },
  { code: 'wallet', label: 'Portefeuille', icon: Wallet },
]

export function PaymentPicker({ value, onChange, available }: { value: PaymentMethod; onChange: (m: PaymentMethod) => void; available: PaymentMethod[] }) {
  return (
    <View accessibilityRole="radiogroup" style={{ gap: 8 }}>
      {methods.filter((m) => available.includes(m.code)).map(({ code, label, icon: Icon }) => {
        const on = value === code
        return (
          <Touchable
            key={code}
            onPress={() => onChange(code)}
            accessibilityRole="radio"
            accessibilityState={{ checked: on }}
            accessibilityLabel={label}
            style={({ pressed }) => ({
              flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 56, paddingHorizontal: 16, borderRadius: tokens.radius.md,
              borderWidth: on ? 2 : 1, borderColor: on ? color('accent') : color('border'), backgroundColor: pressed ? color('surface') : color('bg'),
            })}
          >
            <Icon size={tokens.size['icon-lg']} color={color('text')} />
            <Text style={{ flex: 1 }} weight={on ? 600 : 400}>{label}</Text>
            <View style={{ width: 20, height: 20, borderRadius: 10, borderWidth: 2, borderColor: on ? color('accent') : color('border-input'), alignItems: 'center', justifyContent: 'center' }}>
              {on ? <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: color('accent') }} /> : null}
            </View>
          </Touchable>
        )
      })}
    </View>
  )
}

// ───────── offres ─────────

export function CountdownBar({ total, left }: { total: number; left: number }) {
  const pct = Math.max(0, Math.min(1, left / total))
  return (
    <View importantForAccessibility="no-hide-descendants" accessibilityElementsHidden style={{ height: 4, backgroundColor: color('surface-2'), borderRadius: 2, overflow: 'hidden' }}>
      <View style={{ width: `${pct * 100}%`, height: 4, backgroundColor: left <= 10 ? color('warning') : color('accent') }} />
    </View>
  )
}

export type Offer = {
  id: string; fareCents: number; kind: 'accept' | 'counter'; etaMin: number; distanceKm: number
  driver: { name: string; rating: number | null; rides: number; photo?: string }
  vehicle: { make: string; model: string; color: string }
  totalS: number; leftS: number
}

export function OfferCard({ offer, onAccept, onDecline, accepting, disabled }: { offer: Offer; onAccept: () => void; onDecline: () => void; accepting?: boolean; disabled?: boolean }) {
  const slide = useRef(new Animated.Value(0)).current
  useEffect(() => {
    let cancelled = false
    AccessibilityInfo.isReduceMotionEnabled().then((reduce) => {
      if (cancelled) return
      if (reduce) slide.setValue(1)
      else Animated.timing(slide, { toValue: 1, duration: tokens.motion['offer-in'], easing: Easing.out(Easing.cubic), useNativeDriver: true }).start()
    })
    return () => { cancelled = true }
  }, [slide])
  const { driver: d, vehicle: v } = offer
  return (
    <Animated.View
      accessibilityLiveRegion="polite"
      style={[
        { backgroundColor: color('bg'), borderRadius: tokens.radius.lg, borderWidth: 1, borderColor: color('border'), overflow: 'hidden', opacity: slide, transform: [{ translateY: slide.interpolate({ inputRange: [0, 1], outputRange: [-16, 0] }) }] },
      ]}
    >
      <View
        accessible
        accessibilityLabel={`${offer.kind === 'counter' ? 'Contre-offre' : 'Accepte votre prix'}, ${formatMAD(offer.fareCents)}, ${d.name}, arrive dans ${offer.etaMin} minutes, ${v.make} ${v.model} ${v.color}, expire dans ${offer.leftS} secondes`}
        style={{ padding: 16, gap: 12 }}
      >
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <View style={{ gap: 2 }}>
            <Text variant="xl" tabular>{formatMAD(offer.fareCents)}</Text>
            <Text variant="xs" weight={600} tone={offer.kind === 'counter' ? 'warning' : 'success'}>{offer.kind === 'counter' ? 'Contre-offre' : 'Accepte votre prix'}</Text>
          </View>
          <View style={{ alignItems: 'flex-end', gap: 2 }}>
            <Text weight={600}>{offer.etaMin} min</Text>
            <Text variant="xs" tone="subtle">{offer.distanceKm.toLocaleString('fr-MA')} km</Text>
          </View>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <Avatar name={d.name} uri={d.photo} />
          <View style={{ flex: 1, gap: 2 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Text weight={600}>{d.name}</Text>
              <RatingBadge rating={d.rating} count={d.rides} />
            </View>
            <Text variant="sm" tone="muted">{v.make} {v.model} · {v.color}</Text>
          </View>
        </View>
      </View>
      <View style={{ flexDirection: 'row', gap: 8, paddingHorizontal: 16, paddingBottom: 16 }}>
        <Button label="Refuser" variant="secondary" accessibilityLabel={`Refuser l'offre de ${d.name}`} onPress={onDecline} disabled={disabled || accepting} />
        <View style={{ flex: 1 }}>
          <Button label="Accepter" fullWidth accessibilityLabel={`Accepter l'offre de ${d.name} à ${formatMAD(offer.fareCents)}`} onPress={onAccept} loading={accepting} disabled={disabled} />
        </View>
      </View>
      <CountdownBar total={offer.totalS} left={offer.leftS} />
    </Animated.View>
  )
}

// ───────── course ─────────

export function DriverCard({ name, rating, rides, vehicle, plate, etaMin, arrived, onCall, onMessage, onSafety }: {
  name: string; rating: number | null; rides: number; vehicle: string; plate: string; etaMin?: number; arrived?: boolean
  onCall?: () => void; onMessage?: () => void; onSafety?: () => void
}) {
  return (
    <View style={{ gap: 16 }}>
      {arrived ? (
        <View accessibilityLiveRegion="assertive" style={{ backgroundColor: color('success-soft'), borderRadius: tokens.radius.md, padding: 12 }}>
          <Text weight={600} tone="success">Votre chauffeur est arrivé</Text>
        </View>
      ) : etaMin != null ? (
        <Text variant="label-lg" heading accessibilityLiveRegion="polite">Arrive dans {etaMin} min</Text>
      ) : null}
      <View style={{ flexDirection: 'row', gap: 16, alignItems: 'center' }}>
        <Avatar name={name} size="lg" />
        <View style={{ flex: 1, gap: 4 }}>
          <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
            <Text variant="lg">{name}</Text>
            <RatingBadge rating={rating} count={rides} />
          </View>
          <Text variant="sm" tone="muted">{vehicle}</Text>
          <PlateBadge plate={plate} />
        </View>
      </View>
      <View style={{ flexDirection: 'row', gap: 12, alignItems: 'center' }}>
        <IconButton icon={Phone} label={`Appeler ${name}`} variant="ghost" onPress={onCall} />
        <IconButton icon={MessageCircle} label={`Écrire à ${name}`} variant="ghost" onPress={onMessage} />
        <View style={{ flex: 1 }}>
          <Button label="Sécurité" variant="secondary" icon={ShieldCheck} fullWidth onPress={onSafety} />
        </View>
      </View>
    </View>
  )
}

export function SearchingPulse({ label = 'On prévient les chauffeurs autour de vous…' }: { label?: string }) {
  const p = useRef(new Animated.Value(0)).current
  const [reduce, setReduce] = useState(false)
  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled().then(setReduce)
  }, [])
  useEffect(() => {
    if (reduce) return
    const loop = Animated.loop(Animated.timing(p, { toValue: 1, duration: tokens.motion.slow * 5, easing: Easing.out(Easing.quad), useNativeDriver: true }))
    loop.start()
    return () => loop.stop()
  }, [p, reduce])
  return (
    <View style={{ alignItems: 'center', gap: 16 }} accessibilityRole="progressbar" accessibilityLabel={label}>
      <View style={{ width: 120, height: 120, alignItems: 'center', justifyContent: 'center' }}>
        {[0, 1].map((i) => (
          <Animated.View
            key={i}
            style={{
              position: 'absolute', width: 120, height: 120, borderRadius: 60, backgroundColor: color('accent'),
              opacity: reduce ? 0.12 : p.interpolate({ inputRange: [0, 1], outputRange: [0.25 - i * 0.1, 0] }),
              transform: [{ scale: reduce ? 0.8 : p.interpolate({ inputRange: [0, 1], outputRange: [0.3 + i * 0.2, 1] }) }],
            }}
          />
        ))}
        <View style={{ width: 20, height: 20, borderRadius: 10, backgroundColor: color('marker-pickup'), borderWidth: 3, borderColor: color('bg') }} />
      </View>
      <Text tone="muted" center>{label}</Text>
    </View>
  )
}

// Carte factice pour la vitrine et le web : fond neutre + marqueurs. La vraie carte Google arrive avec /replica-build.
export function MapPlaceholder({ height = 220, children }: { height?: number; children?: ReactNode }) {
  return (
    <View accessible accessibilityLabel="Carte" style={{ height, borderRadius: tokens.radius.lg, overflow: 'hidden', backgroundColor: color('surface-2') }}>
      {Array.from({ length: 8 }).map((_, i) => (
        <View key={`h${i}`} style={{ position: 'absolute', left: 0, right: 0, top: i * 32, height: 1, backgroundColor: color('border') }} />
      ))}
      {Array.from({ length: 14 }).map((_, i) => (
        <View key={`v${i}`} style={{ position: 'absolute', top: 0, bottom: 0, left: i * 32, width: 1, backgroundColor: color('border') }} />
      ))}
      <View style={{ position: 'absolute', left: '22%', top: '62%', width: '50%', height: 4, backgroundColor: color('route'), borderRadius: 2, transform: [{ rotate: '-18deg' }] }} />
      <View style={{ position: 'absolute', left: '20%', top: '66%', width: 16, height: 16, borderRadius: 8, backgroundColor: color('marker-pickup'), borderWidth: 3, borderColor: color('bg') }} />
      <View style={{ position: 'absolute', left: '70%', top: '42%', width: 16, height: 16, borderRadius: 8, backgroundColor: color('marker-dropoff'), borderWidth: 3, borderColor: color('bg') }} />
      <View style={{ position: 'absolute', left: '42%', top: '30%', width: 36, height: 36, borderRadius: 18, backgroundColor: color('bg'), alignItems: 'center', justifyContent: 'center', ...shadow('card') }}>
        <Navigation size={18} color={color('text')} fill={color('text')} style={{ transform: [{ rotate: '35deg' }] }} />
      </View>
      {children}
    </View>
  )
}

export function BottomSheetFrame({ children }: { children: ReactNode }) {
  return (
    <View style={[{ backgroundColor: color('bg'), borderTopLeftRadius: tokens.radius.xl, borderTopRightRadius: tokens.radius.xl, padding: 16, paddingTop: 8, gap: 16 }, shadow('sheet')]}>
      <Touchable accessibilityRole="button" accessibilityLabel="Agrandir le panneau" style={{ alignSelf: 'center', paddingVertical: 8, paddingHorizontal: 24 }}>
        <View style={{ width: tokens.size['sheet-handle-width'], height: tokens.layout['sheet-handle'], borderRadius: tokens.radius.pill, backgroundColor: color('border') }} />
      </Touchable>
      {children}
    </View>
  )
}
