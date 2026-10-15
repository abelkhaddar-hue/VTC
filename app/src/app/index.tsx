import { Redirect } from 'expo-router'

// Pas encore d'écrans : la vitrine du design system sert d'accueil.
export default function Index() {
  return <Redirect href="/design" />
}
