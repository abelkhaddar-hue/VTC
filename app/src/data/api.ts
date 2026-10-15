// Point d'entrée unique des écrans.
// EXPO_PUBLIC_DATA_SOURCE=supabase → vraie base ; sinon (par défaut) la démo en mémoire.
import * as fake from './fake'
import { live } from './supabase'

export const dataSource: 'fake' | 'supabase' = process.env.EXPO_PUBLIC_DATA_SOURCE === 'supabase' ? 'supabase' : 'fake'
const impl = dataSource === 'supabase' ? live : fake

export const auth = impl.auth
export const account = impl.account
export const geo = impl.geo
export const rides = impl.rides
export const support = impl.support

// Réglages du mode démo (sans effet avec Supabase).
export { demo, DEMO_CODE, type Scenario } from './fake'
export * from './types'
