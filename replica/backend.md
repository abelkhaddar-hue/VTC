# Backend : Supabase

État au 2026-10-15 : **branché sur le projet de test `ride-test`** (réf. `tziroqkcqlkyciyuvvql`, région Irlande). 5 migrations envoyées, données de Casablanca, réglages SMS, 4 Edge Functions déployées, simulateur et 5 chauffeurs de test installés.

### Vérifié de bout en bout sur le vrai projet (navigateur, 2 courses complètes)

- connexion par SMS avec le numéro de test 06 12 34 56 78 (code 123456, aucun SMS envoyé) → compte créé, prénom demandé ;
- accueil : gammes lues en base ; localisation refusée → message et départ à choisir à la main ;
- recherche d'adresse (Edge Function `places`, lieux connus) et récents lus en base ;
- devis (Edge Function `quote`) : 9 km, 52 MAD conseillés ;
- demande créée (Edge Function `create-request`) → 3 offres reçues **en temps réel** du simulateur, dont une contre-offre ;
- acceptation → chauffeur en route → arrivé → course (heure d'arrivée qui baisse avec les positions en temps réel) → terminée → écran de note automatique ;
- messagerie en temps réel : message envoyé, réponse du chauffeur reçue ;
- note 5 étoiles enregistrée et visible dans l'historique (lu en base, résiste au rechargement) ;
- aucune erreur dans la console.

### Corrigé pendant le branchement

- les migrations ne voyaient pas PostGIS (schéma `extensions`) : `set search_path` ajouté en tête de chaque fichier ;
- la bibliothèque Supabase des Edge Functions passe par npm au lieu de jsr.io (délai dépassé au déploiement) ;
- badge « Nouveau » affiché pour tous les chauffeurs : l'app comptait les courses au lieu des avis (migration `20261015150000_rating_counts.sql`).

### À surveiller

- **acceptation lente** : 6 à 9 s entre « Accepter » et l'écran du chauffeur sur la 2e course. Cause non identifiée (offre gratuite, région Irlande, ou deux appels successifs) : à mesurer.
- 1re course : l'app est revenue à l'accueil au lieu de l'écran de note ; non reproduit à la 2e course (écran de note affiché et stable). Probablement un clic dans l'onglet partagé, sans certitude.

## Ce qui existe

| morceau | où | testé |
| --- | --- | --- |
| Base : tables, règles d'accès, règles métier | `supabase/migrations/` (4 fichiers) | oui, 56 vérifications sur une vraie base Postgres + PostGIS locale (`cd scripts && npm run test:db`) |
| Données de départ (Casablanca, 4 gammes) | `supabase/seed.sql` | oui (chargées par les tests) |
| Connexion par SMS | `supabase/config.toml` → `[auth.sms]` | réglages écrits ; non testé sans projet |
| Edge Functions : `quote`, `create-request`, `places`, `delete-account` | `supabase/functions/` | types vérifiés (Deno) ; encodage des tracés testé ; pas encore exécutées sur Supabase |
| Couche de données réelle de l'app | `app/src/data/supabase.ts` | types vérifiés : mêmes fonctions que la démo (contrôle automatique `satisfies`) ; pas encore exécutée sur Supabase |
| Bascule démo ↔ réel | `EXPO_PUBLIC_DATA_SOURCE` dans `app/.env.local` | démo revérifiée dans le navigateur, aucune erreur |
| Chauffeurs de test + simulateur | `scripts/seed-drivers.mjs`, `scripts/simulate-drivers.mjs`, `supabase/dev/simulator.sql` | SQL testé ; scripts vérifiés (syntaxe), pas encore exécutés |

### Temps réel

Abonnements Supabase Realtime (« postgres_changes »), filtrés par les règles RLS de chaque utilisateur :
- **offres** (`offers`) → la liste S10 se met à jour ;
- **statut de la course** (`rides`) → S11 / S14 / S15 ;
- **position du chauffeur** (`ride_locations`, un point toutes les 3 s) → la voiture bouge sur la carte. Choix plus simple que le « Broadcast » prévu dans architecture.md ; à revoir au-delà de quelques centaines de courses simultanées ;
- **messagerie** (`messages`) et **aide** (`support_messages`).

### Sans clé Google

Les Edge Functions marchent sans Google : itinéraire estimé (vol d'oiseau × 1,3, 22 km/h) et recherche limitée aux 13 lieux connus de Casablanca. Avec la clé : vrais itinéraires (Routes API), vraie recherche (Places API New) et adresse d'un point (Geocoding API).

## Ce que vous devez faire (comptes et clés)

Je ne crée aucun compte et ne tape aucune clé à votre place.

1. **Supabase** : créer un compte sur supabase.com, puis un projet **de test** (région Europe, le plus proche du Maroc). Garder le mot de passe de la base pour vous.
2. **Me donner l'accès en ligne de commande** : je lance `npx supabase login` dans votre terminal, vous validez dans le navigateur. Ensuite j'envoie les migrations, les fonctions et les réglages SMS au projet.
3. **Clés de l'app** : dans Supabase → Project Settings → API, copier l'URL et la *publishable key* dans `app/.env.local` (modèle : `app/.env.example`), avec `EXPO_PUBLIC_DATA_SOURCE=supabase`.
4. **Clé service (scripts de test uniquement)** : la copier dans `scripts/.env` (modèle : `scripts/.env.example`). Elle donne tous les droits : ne jamais la partager ni la mettre dans l'app.
5. **SMS** : pour commencer, rien à faire. Les numéros 06 12 34 56 78 et 06 77 77 77 77 reçoivent le code fixe 123456 sans SMS. Pour de vrais SMS : compte Twilio (Verify), puis Supabase → Authentication → Providers → Phone.
6. **Google (facultatif au début)** : projet Google Cloud, activer Routes API, Places API (New), Geocoding API, créer une clé **restreinte à ces 3 API**, fixer un **quota journalier** et une **alerte de budget**, puis la mettre dans les secrets des Edge Functions (`GOOGLE_MAPS_API_KEY`).

## Liste de sécurité

- [x] secrets seulement dans des variables d'environnement ; `.env*` ignorés par git (vérifié) ; seules l'URL et la publishable key vont dans l'app
- [x] entrées validées côté serveur : zod dans chaque Edge Function, contraintes et contrôles dans chaque fonction SQL
- [x] autorisation vérifiée à chaque lecture et écriture (RLS + droits explicites), testée avec un second utilisateur et un visiteur anonyme
- [x] le client n'est jamais cru : itinéraire et prix minimum recalculés par le serveur à la création de la demande
- [x] numéro de téléphone jamais renvoyé aux chauffeurs ni aux proches (testé)
- [~] limites d'envoi SMS : 1 par numéro toutes les 45 s (config) ; **à faire** : régler les limites globales dans Supabase → Authentication → Rate limits avant le lancement
- [ ] Google : clé restreinte + quota + alerte de budget (à faire en créant la clé)
- [ ] retirer les numéros de test `[auth.sms.test_otp]` et ne **jamais** installer `supabase/dev/simulator.sql` sur le projet de production
- [x] suppression du compte depuis l'app : profil anonymisé, contacts et appareils effacés, identité supprimée côté Auth ; courses gardées sans nom (comptabilité)
- [n/a] webhooks signés : aucun pour l'instant (paiement par carte pas encore branché)
- [n/a] fichiers envoyés : pas encore (photo de profil à venir)
- [~] dépendances : `npm audit` → 0 faille dans les scripts ; 28 alertes dans les **outils de compilation** d'Expo (braces, node-forge, uuid, decode-uri-component), absentes de l'app livrée. Ne pas lancer `npm audit fix --force` (il rétrograderait Expo) ; elles partiront avec une mise à jour d'Expo.
- [ ] sauvegardes : vérifier qu'elles sont actives dans le projet Supabase (quotidiennes sur les offres payantes)
- [ ] politique de confidentialité : lister Supabase (hébergement, base, SMS via Twilio), Google Maps Platform, Expo, Sentry ; déclaration CNDP (loi 09-08)

## Pas fait (et pourquoi)

| sujet | raison |
| --- | --- |
| Paiement par carte | Stripe n'accepte pas les entreprises établies au Maroc ; prestataire local (CMI ou autre) à choisir avec vous. Les espèces marchent. |
| E-mail (reçus) | Pas de domaine à vous pour l'instant ; Resend se branche après /replica-brand. |
| Appel masqué | Fournisseur téléphonie à choisir (Twilio Voice ou opérateur marocain). |
| Notifications push | Nécessitent un build de l'app (EAS) et les comptes Apple / Google Play. |
| App chauffeur | Hors périmètre de cette tranche ; le simulateur la remplace pour les tests. |
