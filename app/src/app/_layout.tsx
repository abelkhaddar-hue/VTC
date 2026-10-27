import { useEffect, useState } from 'react'
import { Stack, router, useSegments } from 'expo-router'
import { auth } from '@/data/api'
import { StatusBar } from 'expo-status-bar'
import { SafeAreaProvider } from 'react-native-safe-area-context'
import { useFonts, Inter_400Regular, Inter_500Medium, Inter_600SemiBold, Inter_700Bold, Inter_800ExtraBold } from '@expo-google-fonts/inter'
import { color } from '@/theme'

const FONTS_INLINED = !!(globalThis as { __RIDE_FONTS_INLINED__?: boolean }).__RIDE_FONTS_INLINED__

// Écrans ouverts sans compte : accueil, connexion, lien de suivi partagé, vitrine du design.
const PUBLIC = new Set(['welcome', 'login', 's', 'design', 'index'])

function useSessionGuard(ready: boolean) {
  const segments = useSegments()
  const first = (segments[0] as string | undefined) ?? 'index'
  useEffect(() => {
    if (ready && !PUBLIC.has(first) && !auth.session()) router.replace('/welcome')
  }, [first, ready])
  useEffect(() => auth.onSession((s) => { if (!s) router.replace('/welcome') }), [])
}

export default function RootLayout() {
  // Version web autonome (lien de démo) : les polices sont déjà embarquées dans la page.
  const [loaded] = useFonts(FONTS_INLINED ? {} : { Inter_400Regular, Inter_500Medium, Inter_600SemiBold, Inter_700Bold, Inter_800ExtraBold })
  const [sessionReady, setSessionReady] = useState(false)
  useEffect(() => { auth.ready().catch(() => {}).finally(() => setSessionReady(true)) }, [])
  useSessionGuard(sessionReady)
  if (!loaded || !sessionReady) return null
  return (
    <SafeAreaProvider>
      <StatusBar style="dark" />
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: color('bg') } }}>
        <Stack.Screen name="place" options={{ presentation: 'modal' }} />
        <Stack.Screen name="fare" options={{ presentation: 'modal' }} />
        <Stack.Screen name="options" options={{ presentation: 'modal' }} />
        <Stack.Screen name="ride/[id]/cancel" options={{ presentation: 'modal' }} />
        <Stack.Screen name="request/[id]" options={{ gestureEnabled: false }} />
        <Stack.Screen name="ride/[id]/index" options={{ gestureEnabled: false }} />
      </Stack>
    </SafeAreaProvider>
  )
}
