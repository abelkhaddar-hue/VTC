import { ActivityIndicator, View, type ViewStyle } from 'react-native'
import type { LucideIcon } from 'lucide-react-native'
import { color, tokens, shadow } from '@/theme'
import { Text, type Tone } from './Text'
import { Touchable } from './Pressable'

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger'
type Size = 'sm' | 'md' | 'lg'

const look: Record<Variant, { bg: ViewStyle['backgroundColor']; pressed: ViewStyle['backgroundColor']; tone: Tone }> = {
  primary: { bg: color('accent'), pressed: color('accent-pressed'), tone: 'on-accent' },
  secondary: { bg: color('surface-2'), pressed: color('border'), tone: 'default' },
  ghost: { bg: 'transparent', pressed: color('surface'), tone: 'accent' },
  danger: { bg: color('danger'), pressed: color('danger'), tone: 'on-accent' },
}
const heights: Record<Size, number> = { sm: tokens.size['button-sm'], md: tokens.size['button-md'], lg: tokens.size['button-lg'] }

type Props = {
  label: string
  onPress?: () => void
  variant?: Variant
  size?: Size
  icon?: LucideIcon
  trailing?: string
  disabled?: boolean
  loading?: boolean
  fullWidth?: boolean
  accessibilityLabel?: string
}

export function Button({ label, onPress, variant = 'primary', size = 'md', icon: Icon, trailing, disabled, loading, fullWidth, accessibilityLabel }: Props) {
  const l = look[variant]
  const inactive = disabled || loading
  const fg = color(l.tone === 'default' ? 'text' : l.tone === 'accent' ? 'accent' : 'on-accent')
  return (
    <Touchable
      onPress={inactive ? undefined : onPress}
      disabled={inactive}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ disabled: !!disabled, busy: !!loading }}
      style={({ pressed }) => [
        {
          height: heights[size],
          minWidth: tokens.size['tap-min'],
          paddingHorizontal: size === 'sm' ? 16 : 24,
          borderRadius: tokens.radius.pill,
          backgroundColor: pressed && !inactive ? l.pressed : l.bg,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: trailing ? 'space-between' : 'center',
          gap: 8,
          opacity: disabled ? 0.4 : variant === 'danger' && pressed ? 0.85 : 1,
          alignSelf: fullWidth || size === 'lg' ? 'stretch' : 'flex-start',
        },
      ]}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        {loading ? <ActivityIndicator color={fg} size="small" /> : Icon ? <Icon color={fg} size={tokens.size.icon} /> : null}
        <Text variant={size === 'sm' ? 'sm' : 'base'} weight={500} tone={l.tone}>{label}</Text>
      </View>
      {trailing ? <Text variant={size === 'sm' ? 'sm' : 'base'} weight={700} tone={l.tone} tabular>{trailing}</Text> : null}
    </Touchable>
  )
}

type IconButtonProps = {
  icon: LucideIcon
  label: string
  onPress?: () => void
  variant?: 'surface' | 'ghost' | 'accent'
  size?: 40 | 48
  disabled?: boolean
}

export function IconButton({ icon: Icon, label, onPress, variant = 'surface', size = 48, disabled }: IconButtonProps) {
  const bg = variant === 'accent' ? color('accent') : variant === 'surface' ? color('bg') : 'transparent'
  const fg = variant === 'accent' ? color('on-accent') : color('text')
  return (
    <Touchable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: !!disabled }}
      hitSlop={size < 48 ? (48 - size) / 2 : 0}
      style={({ pressed }) => [
        { width: size, height: size, borderRadius: tokens.radius.pill, alignItems: 'center', justifyContent: 'center', backgroundColor: pressed ? color('surface-2') : bg, opacity: disabled ? 0.4 : 1 },
        variant === 'surface' && shadow('card'),
      ]}
    >
      <Icon color={fg} size={tokens.size['icon-lg']} />
    </Touchable>
  )
}
