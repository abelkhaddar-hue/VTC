import { Platform } from 'react-native'
import { tokens, type ColorRole } from './tokens'

export { tokens, type ColorRole }

export const color = (role: ColorRole) => tokens.color[role]
export const space = (step: number) => tokens.space[step] ?? 0

// Inter est chargé par poids (voir app/_layout.tsx) : la graisse passe par la famille.
const families = {
  400: 'Inter_400Regular',
  500: 'Inter_500Medium',
  600: 'Inter_600SemiBold',
  700: 'Inter_700Bold',
  800: 'Inter_800ExtraBold',
} as const
export type Weight = keyof typeof families
export const fontFamily = (weight: Weight) => families[weight]

export type TypeStep = keyof typeof tokens.type
export const typeStyle = (step: TypeStep, weight?: Weight) => {
  const t = tokens.type[step]
  return { fontSize: t.size, lineHeight: t.line, fontFamily: fontFamily(weight ?? (t.weight as Weight)) }
}

export const shadow = (kind: keyof typeof tokens.shadow) => {
  const s = tokens.shadow[kind]
  return Platform.select({
    web: { boxShadow: `0px ${s.y}px ${s.blur}px rgba(23,23,23,${s.opacity})` },
    default: {
      shadowColor: tokens.color.overlay,
      shadowOffset: { width: 0, height: s.y },
      shadowOpacity: s.opacity,
      shadowRadius: s.blur / 2,
      elevation: Math.round(s.blur / 3),
    },
  })
}

// Anneau de focus clavier (web et clavier externe).
export const focusRing = {
  outlineColor: tokens.color.focus,
  outlineWidth: 2,
  outlineStyle: 'solid',
  outlineOffset: 2,
} as const

export const formatMAD = (cents: number) => {
  const mad = cents / 100
  const text = Number.isInteger(mad)
    ? mad.toLocaleString('fr-MA')
    : mad.toLocaleString('fr-MA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  return `${text} MAD`
}

export const formatRating = (value: number) => value.toLocaleString('fr-MA', { minimumFractionDigits: 1, maximumFractionDigits: 1 })
