import { Text as RNText, type TextProps } from 'react-native'
import { color, typeStyle, type TypeStep, type Weight, type ColorRole } from '@/theme'

const tones = {
  default: 'text',
  muted: 'text-muted',
  subtle: 'text-subtle',
  accent: 'accent',
  danger: 'danger',
  success: 'success',
  warning: 'warning',
  'on-accent': 'on-accent',
  'on-accent-soft': 'on-accent-soft',
} as const satisfies Record<string, ColorRole>

export type Tone = keyof typeof tones

type Props = TextProps & {
  variant?: TypeStep
  weight?: Weight
  tone?: Tone
  heading?: boolean
  tabular?: boolean
  center?: boolean
}

export function Text({ variant = 'base', weight, tone = 'default', heading, tabular, center, style, ...rest }: Props) {
  return (
    <RNText
      accessibilityRole={heading ? 'header' : rest.accessibilityRole}
      style={[
        typeStyle(variant, weight),
        { color: color(tones[tone]) },
        tabular && { fontVariant: ['tabular-nums'] },
        center && { textAlign: 'center' },
        style,
      ]}
      {...rest}
    />
  )
}
