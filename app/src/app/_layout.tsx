import { Stack } from 'expo-router'
import { StatusBar } from 'expo-status-bar'
import { SafeAreaProvider } from 'react-native-safe-area-context'
import { useFonts, Inter_400Regular, Inter_500Medium, Inter_600SemiBold, Inter_700Bold, Inter_800ExtraBold } from '@expo-google-fonts/inter'
import { color } from '@/theme'

export default function RootLayout() {
  const [loaded] = useFonts({ Inter_400Regular, Inter_500Medium, Inter_600SemiBold, Inter_700Bold, Inter_800ExtraBold })
  if (!loaded) return null
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
