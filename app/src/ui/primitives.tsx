import { useState, type ReactNode } from 'react'
import { Image, View, type ViewStyle } from 'react-native'
import { ChevronRight, CircleAlert, CircleCheck, Info, Star, TriangleAlert, X, type LucideIcon } from 'lucide-react-native'
import { color, formatRating, shadow, tokens, type ColorRole } from '@/theme'
import { Text } from './Text'
import { Touchable } from './Pressable'

export function Card({ children, style, tone = 'bg' }: { children: ReactNode; style?: ViewStyle; tone?: 'bg' | 'surface' }) {
  return (
    <View style={[{ backgroundColor: color(tone), borderRadius: tokens.radius.lg, padding: 16 }, tone === 'bg' && shadow('card'), style]}>
      {children}
    </View>
  )
}

const avatarSizes = { sm: tokens.size['avatar-sm'], md: tokens.size['avatar-md'], lg: tokens.size['avatar-lg'] }

export function Avatar({ name, uri, size = 'md', decorative = true }: { name: string; uri?: string; size?: keyof typeof avatarSizes; decorative?: boolean }) {
  const d = avatarSizes[size]
  const initials = name.split(/\s+/).map((p) => p[0]).join('').slice(0, 2).toUpperCase()
  return (
    <View
      accessible={!decorative}
      accessibilityLabel={decorative ? undefined : `Photo de ${name}`}
      importantForAccessibility={decorative ? 'no-hide-descendants' : 'auto'}
      style={{ width: d, height: d, borderRadius: tokens.radius.pill, backgroundColor: color('accent-soft'), alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}
    >
      {uri ? <Image source={{ uri }} style={{ width: d, height: d }} /> : (
        <Text variant={size === 'lg' ? 'lg' : 'sm'} weight={700} tone="on-accent-soft">{initials}</Text>
      )}
    </View>
  )
}

export function RatingBadge({ rating, count }: { rating?: number | null; count?: number }) {
  const isNew = rating == null || (count ?? 0) < 5
  return (
    <View
      accessible
      accessibilityLabel={isNew ? 'Nouveau, pas encore assez de notes' : `Note ${formatRating(rating!)} sur 5${count ? `, ${count} courses` : ''}`}
      style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}
    >
      <Star size={14} color={color('star')} fill={color('star')} />
      <Text variant="sm" weight={600}>{isNew ? 'Nouveau' : formatRating(rating!)}</Text>
      {!isNew && count ? <Text variant="xs" tone="subtle">({count})</Text> : null}
    </View>
  )
}

export function PlateBadge({ plate }: { plate: string }) {
  return (
    <View
      accessible
      accessibilityLabel={`Plaque ${plate.replace(/[\s-]/g, '').split('').join(' ')}`}
      style={{ alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 4, borderRadius: tokens.radius.sm, borderWidth: 1, borderColor: color('border-input'), backgroundColor: color('surface') }}
    >
      <Text variant="sm" weight={700} tabular style={{ letterSpacing: 1 }}>{plate}</Text>
    </View>
  )
}

export function Chip({ label, selected, onPress, icon: Icon }: { label: string; selected?: boolean; onPress?: () => void; icon?: LucideIcon }) {
  return (
    <Touchable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected: !!selected }}
      style={({ pressed }) => ({
        flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: 40, paddingHorizontal: 16, borderRadius: tokens.radius.pill,
        borderWidth: 1, borderColor: selected ? color('accent') : color('border'),
        backgroundColor: selected ? color('accent-soft') : pressed ? color('surface') : color('bg'),
      })}
    >
      {Icon ? <Icon size={16} color={selected ? color('on-accent-soft') : color('text-muted')} /> : null}
      <Text variant="sm" weight={selected ? 600 : 500} tone={selected ? 'on-accent-soft' : 'default'}>{label}</Text>
    </Touchable>
  )
}

const bannerLook: Record<'info' | 'success' | 'warning' | 'danger', { bg: ColorRole; fg: ColorRole; icon: LucideIcon }> = {
  info: { bg: 'accent-soft', fg: 'on-accent-soft', icon: Info },
  success: { bg: 'success-soft', fg: 'success', icon: CircleCheck },
  warning: { bg: 'warning-soft', fg: 'warning', icon: TriangleAlert },
  danger: { bg: 'danger-soft', fg: 'danger', icon: CircleAlert },
}

// Une bannière fermée ne revient pas (onDismiss doit mémoriser la raison).
export function Banner({ kind = 'info', title, body, onDismiss }: { kind?: keyof typeof bannerLook; title: string; body?: string; onDismiss?: () => void }) {
  const [open, setOpen] = useState(true)
  if (!open) return null
  const l = bannerLook[kind]
  const Icon = l.icon
  return (
    <View
      accessibilityRole={kind === 'danger' ? 'alert' : undefined}
      accessibilityLiveRegion={kind === 'danger' ? 'assertive' : 'polite'}
      style={{ flexDirection: 'row', gap: 12, padding: 12, paddingRight: onDismiss ? 4 : 12, borderRadius: tokens.radius.md, backgroundColor: color(l.bg), alignItems: 'flex-start' }}
    >
      <Icon size={tokens.size.icon} color={color(l.fg)} style={{ marginTop: 2 }} />
      <View style={{ flex: 1, gap: 2 }}>
        <Text variant="sm" weight={600} style={{ color: color(l.fg) }}>{title}</Text>
        {body ? <Text variant="sm" tone="muted">{body}</Text> : null}
      </View>
      {onDismiss ? (
        <Touchable
          onPress={() => { setOpen(false); onDismiss() }}
          accessibilityRole="button"
          accessibilityLabel="Fermer le message"
          style={{ width: 40, height: 40, borderRadius: tokens.radius.pill, alignItems: 'center', justifyContent: 'center' }}
        >
          <X size={18} color={color('text-muted')} />
        </Touchable>
      ) : null}
    </View>
  )
}

export function EmptyState({ icon: Icon, title, body, action }: { icon: LucideIcon; title: string; body: string; action?: ReactNode }) {
  return (
    <View style={{ alignItems: 'center', gap: 12, paddingVertical: 32, paddingHorizontal: 24 }}>
      {/* À remplacer par une illustration maison (jamais celles de l'original). */}
      <View style={{ width: 88, height: 88, borderRadius: tokens.radius.pill, backgroundColor: color('tile'), alignItems: 'center', justifyContent: 'center' }}>
        <Icon size={40} color={color('accent')} />
      </View>
      <Text variant="lg" heading center>{title}</Text>
      <Text tone="muted" center>{body}</Text>
      {action}
    </View>
  )
}

export function ListRow({ icon: Icon, label, detail, onPress, danger, trailing }: { icon: LucideIcon; label: string; detail?: string; onPress?: () => void; danger?: boolean; trailing?: ReactNode }) {
  return (
    <Touchable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={detail ? `${label}, ${detail}` : label}
      style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 16, minHeight: 56, paddingHorizontal: 16, borderRadius: tokens.radius.md, backgroundColor: pressed ? color('surface') : 'transparent' })}
    >
      <Icon size={tokens.size['icon-lg']} color={danger ? color('danger') : color('text')} />
      <View style={{ flex: 1 }}>
        <Text weight={500} tone={danger ? 'danger' : 'default'}>{label}</Text>
        {detail ? <Text variant="sm" tone="muted">{detail}</Text> : null}
      </View>
      {trailing ?? <ChevronRight size={tokens.size.icon} color={color('text-subtle')} />}
    </Touchable>
  )
}

export function Divider() {
  return <View style={{ height: 1, backgroundColor: color('border') }} />
}
