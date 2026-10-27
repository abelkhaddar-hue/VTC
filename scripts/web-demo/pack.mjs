// Version en plusieurs fichiers : page légère + code de l'app (app.js) + polices embarquées (fonts.css).
import { readFileSync, readdirSync, writeFileSync, mkdirSync, rmSync } from 'node:fs'
import { join } from 'node:path'
const [out, dest] = process.argv.slice(2)
rmSync(dest, { recursive: true, force: true }); mkdirSync(dest, { recursive: true })
const jsDir = join(out, '_expo/static/js/web')
writeFileSync(join(dest, 'app.js'), readFileSync(join(jsDir, readdirSync(jsDir).find((f) => f.endsWith('.js')))))
const fontDir = join(out, 'assets/node_modules/@expo-google-fonts/inter')
const faces = ['400Regular', '500Medium', '600SemiBold', '700Bold', '800ExtraBold'].map((w) => {
  const file = readdirSync(join(fontDir, w)).find((f) => f.endsWith('.ttf'))
  return `@font-face{font-family:"Inter_${w}";src:url(data:font/ttf;base64,${readFileSync(join(fontDir, w, file)).toString('base64')}) format("truetype");font-display:block}`
})
writeFileSync(join(dest, 'fonts.css'), faces.join('\n') + '\n')
writeFileSync(join(dest, 'index.html'), `<meta charset="utf-8">
<title>Ride démo</title>
<link rel="stylesheet" href="fonts.css">
<style>
html,body{height:100%}
body{overflow:hidden;margin:0;background:#ffffff;color:#000000}
#root{display:flex;height:100%;flex:1}
</style>
<div id="root"></div>
<script>
window.__RIDE_FONTS_INLINED__ = true;
// L'adresse du code est calculée AVANT de ramener l'URL à « / » (attendu par la navigation de l'app) :
// sinon le navigateur chercherait app.js à la racine du site, d'où une page blanche.
(function () {
  var src = new URL('app.js', document.baseURI).href;
  try { if (location.pathname !== '/') history.replaceState(null, '', '/'); } catch (e) {}
  var s = document.createElement('script');
  s.src = src;
  document.body.appendChild(s);
})();
</script>
`)
for (const f of readdirSync(dest)) console.log(f, (readFileSync(join(dest, f)).length / 1048576).toFixed(2), 'Mo')
