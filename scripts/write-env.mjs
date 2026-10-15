// Écrit app/.env.local (URL + clé publique) et scripts/.env (clé service, projet de TEST uniquement)
// à partir de la sortie JSON de `supabase projects api-keys`, sans jamais afficher les clés.
// Usage : npx supabase projects api-keys --project-ref <ref> -o json | node scripts/write-env.mjs <ref>
import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const ref = process.argv[2]
if (!/^[a-z0-9]{20}$/.test(ref ?? '')) { console.error('Référence de projet manquante ou invalide.'); process.exit(1) }
const raw = readFileSync(0, 'utf8')
let keys
try { keys = JSON.parse(raw.slice(raw.indexOf('['))) } catch { console.error('Sortie inattendue de la CLI Supabase.'); process.exit(1) }

const pick = (...tests) => { for (const t of tests) { const k = keys.find(t); if (k?.api_key && !/[·•*]{4}/.test(k.api_key)) return k } return null }
const publishable = pick((k) => k.type === 'publishable', (k) => k.name === 'anon')
const service = pick((k) => k.name === 'service_role', (k) => k.type === 'secret')
if (!publishable) { console.error('Clé publique introuvable.'); process.exit(1) }

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const url = `https://${ref}.supabase.co`

const appEnv = join(root, 'app', '.env.local')
writeFileSync(appEnv, [
  '# Généré par scripts/write-env.mjs — ne pas publier (ignoré par git).',
  'EXPO_PUBLIC_DATA_SOURCE=supabase',
  `EXPO_PUBLIC_SUPABASE_URL=${url}`,
  `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY=${publishable.api_key}`,
  '',
].join('\n'), { mode: 0o600 })
console.log(`✓ app/.env.local : URL + clé publique (${publishable.type ?? publishable.name})`)

if (service) {
  writeFileSync(join(root, 'scripts', '.env'), [
    '# Généré par scripts/write-env.mjs — clé service du projet de TEST. Ne jamais partager ni mettre dans l’app.',
    `SUPABASE_URL=${url}`,
    `SUPABASE_SERVICE_ROLE_KEY=${service.api_key}`,
    '',
  ].join('\n'), { mode: 0o600 })
  console.log(`✓ scripts/.env : clé service (${service.type ?? service.name}), lisible par vous seul`)
} else {
  console.log('! Clé service masquée par la CLI : à copier depuis le tableau de bord (Project Settings → API Keys) dans scripts/.env')
}
if (!existsSync(join(root, '.gitignore')) || !readFileSync(join(root, '.gitignore'), 'utf8').includes('.env')) {
  console.error('ATTENTION : .env n’est pas ignoré par git.')
}
