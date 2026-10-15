// Génère, depuis tokens.json (seule source) :
//   replica/design/tokens.css             variables CSS (web : suivi partagé, back-office)
//   replica/design/tailwind.tokens.cjs    thème Tailwind (bg-surface, text-muted, rounded-pill…)
//   app/src/theme/tokens.ts               thème typé pour l'app mobile
// Lancer après chaque changement de tokens.json : `npm run tokens` dans app/.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const t = JSON.parse(readFileSync(join(here, 'tokens.json'), 'utf8'))
const banner = 'Généré par replica/design/build-tokens.mjs depuis tokens.json. Ne pas modifier à la main.'

const rgb = (hex) => {
  const h = hex.replace('#', '')
  return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16)).join(' ')
}

// tokens.css
const css = [`/* ${banner} */`, ':root {']
for (const [k, v] of Object.entries(t.color)) css.push(`  --color-${k}: ${rgb(v)};`)
for (const [k, v] of Object.entries(t.radius)) css.push(`  --radius-${k}: ${v}px;`)
t.space.forEach((v, i) => css.push(`  --space-${i}: ${v}px;`))
for (const [k, v] of Object.entries(t.type)) {
  css.push(`  --text-${k}: ${v.size}px;`, `  --leading-${k}: ${v.line}px;`, `  --weight-${k}: ${v.weight};`)
}
css.push(`  --font-sans: "${t.font.sans}", ${t.font.fallback};`)
css.push(`  --font-arabic: "${t.font['sans-arabic']}", ${t.font.fallback};`)
for (const [k, v] of Object.entries(t.motion)) css.push(`  --motion-${k}: ${typeof v === 'number' ? v + 'ms' : v};`)
css.push('}', '')
writeFileSync(join(here, 'tokens.css'), css.join('\n'))

// tailwind.tokens.cjs (à étendre dans tailwind.config : theme.extend = require(...))
const tw = {
  colors: Object.fromEntries(Object.keys(t.color).map((k) => [k, `rgb(var(--color-${k}) / <alpha-value>)`])),
  borderRadius: Object.fromEntries(Object.keys(t.radius).map((k) => [k, `var(--radius-${k})`])),
  spacing: Object.fromEntries(t.space.map((v, i) => [String(i), `${v}px`])),
  fontSize: Object.fromEntries(Object.entries(t.type).map(([k, v]) => [k, [`${v.size}px`, { lineHeight: `${v.line}px`, fontWeight: String(v.weight) }]])),
  fontFamily: { sans: ['var(--font-sans)'], arabic: ['var(--font-arabic)'] },
}
writeFileSync(join(here, 'tailwind.tokens.cjs'), `// ${banner}\nmodule.exports = ${JSON.stringify(tw, null, 2)}\n`)

// app/src/theme/tokens.ts
const out = join(here, '..', '..', 'app', 'src', 'theme')
mkdirSync(out, { recursive: true })
const { _about, _measured, pairs, ...rest } = t
writeFileSync(join(out, 'tokens.ts'), `// ${banner}\nexport const tokens = ${JSON.stringify(rest, null, 2)} as const\n\nexport type ColorRole = keyof typeof tokens.color\n`)

console.log('tokens → tokens.css, tailwind.tokens.cjs, app/src/theme/tokens.ts')
