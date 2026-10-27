import type { ReactNode } from 'react'
import { ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { router } from 'expo-router'
import { ArrowLeft, X } from 'lucide-react-native'
import { color, shadow, tokens } from '@/theme'
import { Text } from './Text'
import { IconButton } from './Button'
import { Banner } from './primitives'

// Colonne centrée : pleine largeur au téléphone, 480 px max sur un grand écran.
const column = { width: '100%', maxWidth: tokens.layout['max-content'], alignSelf: 'center' } as const

export function Header({ title, onBack, close }: { title?: string; onBack?: () => void; close?: boolean }) {
  const back = onBack ?? (() => (router.canGoBack() ? router.back() : router.replace('/home')))
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: tokens.layout.header, paddingHorizontal: 8 }}>
      <IconButton icon={close ? X : ArrowLeft} label={close ? 'Fermer' : 'Retour'} variant="ghost" onPress={back} />
      {title ? <Text variant="lg" heading numberOfLines={1} style={{ flex: 1 }}>{title}</Text> : null}
    </View>
  )
}

// Écran avec en-tête et contenu défilant ; `footer` reste collé en bas (bouton principal).
export function Screen({ title, children, footer, close, onBack, scroll = true, tone = 'bg' }: {
  title?: string; children: ReactNode; footer?: ReactNode; close?: boolean; onBack?: () => void; scroll?: boolean; tone?: 'bg' | 'surface'
}) {
  const body = <View style={[column, { padding: tokens.layout.gutter, gap: 16, flexGrow: 1 }]}>{children}</View>
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: color(tone) }} edges={['top', 'bottom']}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={column}><Header title={title} close={close} onBack={onBack} /></View>
        {scroll ? <ScrollView contentContainerStyle={{ flexGrow: 1 }} keyboardShouldPersistTaps="handled">{body}</ScrollView> : body}
        {footer ? <View style={[column, { padding: tokens.layout.gutter, gap: 8 }]}>{footer}</View> : null}
      </KeyboardAvoidingView>
    </SafeAreaView>
  )
}

// Carte plein écran + panneau du bas (S05, S09, S11, S14).
export function MapScreen({ map, children, top }: { map: ReactNode; children: ReactNode; top?: ReactNode }) {
  return (
    <View style={{ flex: 1, backgroundColor: color('surface-2') }}>
      <View style={{ flex: 1 }}>{map}</View>
      {top ? (
        <SafeAreaView edges={['top']} pointerEvents="box-none" style={{ position: 'absolute', left: 0, right: 0, top: 0 }}>
          <View pointerEvents="box-none" style={[column, { padding: tokens.layout.gutter, gap: 8 }]}>{top}</View>
        </SafeAreaView>
      ) : null}
      <SafeAreaView edges={['bottom']} style={[{ backgroundColor: color('bg'), borderTopLeftRadius: tokens.radius.xl, borderTopRightRadius: tokens.radius.xl, marginTop: -tokens.radius.xl }, shadow('sheet')]}>
        <View style={[column, { padding: tokens.layout.gutter, paddingTop: 8, gap: 16 }]}>
          <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={{ alignSelf: 'center', width: 40, height: tokens.layout['sheet-handle'], borderRadius: 2, backgroundColor: color('border'), marginBottom: 4 }} />
          {children}
        </View>
      </SafeAreaView>
    </View>
  )
}

export function Loading({ label = 'Chargement…' }: { label?: string }) {
  return (
    <View accessibilityRole="progressbar" accessibilityLabel={label} style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, padding: 32, backgroundColor: color('bg') }}>
      <ActivityIndicator color={color('accent')} size="large" />
      <Text tone="muted">{label}</Text>
    </View>
  )
}

// Squelette gris pour les listes en chargement.
export function Skeleton({ height = 64, radius = tokens.radius.md }: { height?: number; radius?: number }) {
  return <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={{ height, borderRadius: radius, backgroundColor: color('surface-2') }} />
}

export function ErrorBlock({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <View style={{ gap: 12 }}>
      <Banner kind="danger" title="Impossible de charger" body={message} />
      {onRetry ? <Text tone="accent" weight={600} accessibilityRole="button" onPress={onRetry}>Réessayer</Text> : null}
    </View>
  )
}
