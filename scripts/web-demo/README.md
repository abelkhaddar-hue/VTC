# Lien de démo en ligne

Version web de l'app en **mode démo** (données et chauffeurs simulés, aucune connexion à Supabase), publiée comme page privée sur claude.ai.

Refaire la page après un changement :

```bash
cd app && EXPO_PUBLIC_DATA_SOURCE=fake EXPO_PUBLIC_SUPABASE_URL= EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY= npx expo export --platform web --output-dir /tmp/ride-web
node ../scripts/web-demo/pack.mjs /tmp/ride-web /tmp/ride-artifact
```

Puis republier `index.html` avec `app.js` et `fonts.css` à la même adresse.
