import { ActivityIndicator, View } from 'react-native'
import type { LucideIcon } from 'lucide-react-native'
import { color, tokens, shadow, type ColorRole, type TypeStep } from '@/theme'
import { Text } from './Text'
import { Touchable } from './Pressable'

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger'
type Size = 'sm' | 'md' | 'lg'

// Base Web : primaire noir, secondaire gris clair, tertiaire transparent, danger rouge.
// Appui = voile (blanc 20 % sur le noir, noir 8 % sur le clair), aplati en couleurs dans les tokens.
const look: Record<Variant, { bg: ColorRole | 'transparent'; pressed: ColorRole; fg: ColorRole }> = {
  primary: { bg: 'accent', pressed: 'accent-pressed', fg: 'on-accent' },
  secondary: { bg: 'surface', pressed: 'surface-pressed', fg: 'text' },
  ghost: { bg: 'transparent', pressed: 'surface-2', fg: 'text' },
  danger: { bg: 'danger-fill', pressed: 'danger', fg: 'on-accent' },
}
// Hauteur, marge horizontale et style de libellé par taille (compact / default / large).
const sizes: Record<Size, { height: number; padX: number; label: TypeStep }> = {
  sm: { height: tokens.size['button-sm'], padX: 12, label: 'label-sm' },
  md: { height: tokens.size['button-md'], padX: 16, label: 'label' },
  lg: { height: tokens.size['button-lg'], padX: 20, label: 'label-lg' },
}

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
  const z = sizes[size]
  const inactive = disabled || loading
  // Désactivé : fond et texte gris (pas de transparence), comme Base.
  const fg = color(disabled ? 'disabled-text' : l.fg)
  const labelStyle = { color: fg }
  return (
    <Touchable
      onPress={inactive ? undefined : onPress}
      disabled={inactive}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ disabled: !!disabled, busy: !!loading }}
      style={({ pressed }) => ({
        height: z.height,
        minWidth: tokens.size['tap-min'],
        paddingHorizontal: z.padX,
        borderRadius: tokens.radius.pill,
        backgroundColor: disabled ? color('disabled-bg') : pressed && !inactive ? color(l.pressed) : l.bg === 'transparent' ? 'transparent' : color(l.bg),
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: trailing ? 'space-between' : 'center',
        gap: 8,
        alignSelf: fullWidth || size === 'lg' ? 'stretch' : 'flex-start',
      })}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        {loading ? <ActivityIndicator color={fg} size="small" /> : Icon ? <Icon color={fg} size={tokens.size.icon} /> : null}
        <Text variant={z.label} style={labelStyle}>{label}</Text>
      </View>
      {trailing ? <Text variant={z.label} weight={700} style={labelStyle} tabular>{trailing}</Text> : null}
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
  const fg = disabled ? color('disabled-text') : variant === 'accent' ? color('on-accent') : color('text')
  return (
    <Touchable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: !!disabled }}
      hitSlop={size < 48 ? (48 - size) / 2 : 0}
      style={({ pressed }) => [
        { width: size, height: size, borderRadius: tokens.radius.pill, alignItems: 'center', justifyContent: 'center', backgroundColor: pressed ? color('surface-2') : bg },
        variant === 'surface' && shadow('card'),
      ]}
    >
      <Icon color={fg} size={tokens.size['icon-lg']} />
    </Touchable>
  )
}
