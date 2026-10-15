// Point d'entrée unique des écrans. Aujourd'hui : la couche factice.
// Avec /replica-backend : même export, branché sur Supabase.
export { auth, account, geo, rides, support, demo, DEMO_CODE, type Scenario } from './fake'
export * from './types'
