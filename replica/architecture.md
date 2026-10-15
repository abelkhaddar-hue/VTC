# Architecture : (nom à choisir) — reconstruction de la course en ville d'inDrive

Lit : `recon.md` (S01-S22, F01-F08) et `features.csv`. Schéma : `supabase/migrations/` (4 migrations), testé par `scripts/db-tests.mjs` (56 vérifications, toutes vertes le 2026-10-15). Détail du branchement : `replica/backend.md`.

## Stack

| couche | choix | pourquoi |
| --- | --- | --- |
| app mobile | **Expo (React Native) + TypeScript**, expo-router | un seul code pour Android et iOS ; Android d'abord (largement majoritaire au Maroc) ; build et mise à jour sans Mac grâce à EAS |
| cartes | **Google Maps Platform** : Maps SDK (via react-native-maps), Places Autocomplete (New), Routes API | meilleure couverture des adresses marocaines ; alternative Mapbox si le coût dérape |
| base de données | **Supabase Postgres + PostGIS** | « chauffeurs à moins de 3 km » = une requête PostGIS indexée ; tout le reste (auth, temps réel, fichiers, fonctions) au même endroit ; même outil que Lovable, donc déjà familier |
| temps réel | **Supabase Realtime** : changements de tables (offres, statut de course) + Broadcast (position GPS) | les offres doivent arriver en 1-2 s ; inclus dans Supabase, respecte les règles d'accès |
| auth | **Supabase Auth, connexion par téléphone (code SMS)** via Twilio Verify | c'est ce que fait l'original ; Twilio fonctionne vers les numéros marocains (vérifier le prix par SMS) |
| logique serveur | **fonctions SQL** (règles métier, atomiques) + **Supabase Edge Functions** (appels Google, paiement, notifications) | une seule base, pas de microservices ; les règles critiques vivent à côté des données |
| paiement | **espèces d'abord** (enregistrées, pas de transaction) ; carte ensuite via **CMI** ou un prestataire marocain agréé | Stripe n'accepte pas les entreprises établies au Maroc (à revérifier au moment du choix) ; l'original fonctionne surtout en espèces |
| notifications push | **Expo Notifications** (FCM / APNs) | gratuit, intégré à Expo |
| e-mail | **Resend** | reçus et support seulement ; très faible volume |
| tâches planifiées | **pg_cron** dans Supabase | expirations chaque minute, purges la nuit ; pas d'outil en plus |
| fichiers | **Supabase Storage** : `avatars` (public), `driver-docs` et `receipts` (privés) | même accès que la base |
| web (petit) | **Next.js sur Vercel** : page de suivi partagée (S21), back-office admin, pages légales | le proche sans l'app doit voir la course ; l'équipe doit valider les chauffeurs |
| suivi des erreurs | **Sentry** (Expo + Next.js) | savoir quand une course plante avant que l'utilisateur ne le dise |

Une seule base. Pas de microservices. Pas d'API privée d'inDrive : uniquement Google, Twilio, Supabase, Expo, le prestataire de paiement, avec vos propres clés.

## Schéma

Tables : **19**. Règles d'accès : **RLS Postgres (Supabase)**. Les clients ne font que **lire** les tables (filtrées par RLS) ; tout ce qui change un statut passe par une fonction SQL `security definer` qui vérifie qui appelle. Seules écritures directes autorisées : messages du chat, contacts d'urgence, jetons push, tickets support, et son propre profil (un déclencheur bloque note, statut et téléphone).

| groupe | tables |
| --- | --- |
| référentiel | `cities` (zone desservie en polygone, modes de paiement, numéros d'urgence, rayon de recherche), `ride_types` (Course, Confort, XL, Moto + grille tarifaire) |
| comptes | `profiles`, `admins`, `drivers` (vérification, en ligne, position), `vehicles` |
| enchères | `ride_requests`, `offers` |
| courses | `rides`, `ride_locations`, `messages`, `ratings`, `payments`, `receipts` |
| sécurité | `emergency_contacts`, `share_links` |
| support | `support_tickets`, `support_messages`, `push_tokens` |

Contraintes dures (dans la base, pas dans l'écran) :
- un passager n'a **qu'une demande en recherche** à la fois (index unique partiel) ;
- un chauffeur n'a **qu'une offre vivante par demande** : une nouvelle offre remplace l'ancienne ;
- une demande ne donne **qu'une seule course** (`rides.request_id` unique) : deux acceptations simultanées → une seule passe ;
- un chauffeur et un passager n'ont **qu'une course active** chacun ;
- le prix proposé ne peut pas être **sous le prix recommandé** ; la contre-offre d'un chauffeur ne peut pas être **plus basse** que le prix du passager ;
- le prix est **figé** à l'acceptation (`rides.fare_cents`), personne ne peut le modifier ensuite ;
- une course ne peut avancer que dans l'ordre : en route → arrivé → en cours → terminée ;
- on ne note **qu'une fois** par course, dans les 7 jours ;
- argent en centimes de dirham (`integer`) + devise ; heures en `timestamptz` (UTC).

## API

Sauf mention, « route » = fonction SQL appelée depuis l'app par `supabase.rpc(...)`. Edge = Supabase Edge Function.

### F02 Inscription / compte

| route | fait | qui | entrée | sortie | écrans |
| --- | --- | --- | --- | --- | --- |
| Auth `signInWithOtp({ phone })` | envoie le code SMS | tous | téléphone | — | S02 |
| Auth `verifyOtp` | connecte ; crée le profil (déclencheur `handle_new_user`) | tous | téléphone, code | session | S03 |
| `update profiles` (direct) | prénom, e-mail, photo, langue, ville | soi | champs | profil | S04, S19 |
| Storage `avatars/{uid}.jpg` | photo de profil | soi | image ≤ 2 Mo | chemin | S04, S19 |
| `emergency_contacts` (direct) | ajouter / retirer un proche | soi | nom, téléphone | ligne | S19 |
| `push_tokens` (direct) | enregistrer l'appareil | soi | jeton, plateforme | — | après S03 |
| Edge `POST /delete-account` | anonymise le profil, supprime l'auth, garde les courses pour la compta | soi | — | ok | S19 |

### F01 / F03 Commander, enchères

| route | fait | qui | entrée | sortie | écrans |
| --- | --- | --- | --- | --- | --- |
| Edge `POST /places-autocomplete` | relais vers Google Places (clé cachée, résultats limités au pays, session token) | connecté | texte, position | suggestions | S06 |
| Edge `POST /quote` | itinéraire Google Routes + prix recommandé, sans rien créer | connecté | départ, arrivée, type | distance, durée, tracé, prix recommandé | S05, S07 |
| Edge `POST /create-request` | refait le calcul côté serveur (le client n'est jamais cru) puis `create_ride_request` ; avertit les chauffeurs proches (push) | passager actif | départ, arrivée, type, prix, paiement, options, commentaire | demande | S05 → S09 |
| `raise_fare(request, new_fare)` | augmente le prix, prolonge la recherche | passager propriétaire | montant | demande | S09 |
| `cancel_request(request)` | annule avant acceptation, sans pénalité | passager propriétaire | — | — | S09, S10 |
| `request_offers(request)` | offres vivantes avec prénom, photo, note, nb de courses, véhicule | passager propriétaire | — | liste | S10 |
| Realtime `offers` filtré par `request_id` | signal « nouvelle offre / offre expirée » → l'app relit `request_offers` | passager propriétaire | — | événements | S09, S10 |
| `decline_offer(offer)` | refuse une offre | passager propriétaire | — | — | S10 |
| `accept_offer(offer)` | tout ou rien : ferme les autres offres, crée la course, prix figé | passager propriétaire | — | course | S10 → S11 |

### Côté chauffeur (minimum indispensable, même app en « mode chauffeur »)

| route | fait | qui | entrée | sortie |
| --- | --- | --- | --- | --- |
| `driver_set_online(bool)` | se met en ligne / hors ligne | chauffeur validé | — | — |
| `driver_update_location(lng, lat, cap)` | position toutes les ~5 s ; trace GPS 1 point / 10 s pendant la course | chauffeur validé | coordonnées | — |
| Realtime Broadcast `ride:{id}` | position en direct vers le passager, sans écrire en base à chaque fois | chauffeur de la course | coordonnées | — |
| `driver_nearby_requests()` | demandes dans le rayon de la ville, compatibles avec le véhicule | chauffeur en ligne | — | liste (prénom + note passager, pas de téléphone) |
| `driver_make_offer(request, fare?)` | accepte le prix ou contre-offre plus haute, valable 45 s | chauffeur en ligne | montant | offre |
| `driver_advance_ride(ride, to)` | arrivé → en cours → terminé ; espèces enregistrées à la fin | chauffeur de la course | statut | course |

### F04 Annuler, F06 Contacter, F05 Sécurité, F07 Après la course

| route | fait | qui | entrée | sortie | écrans |
| --- | --- | --- | --- | --- | --- |
| `ride_view(ride)` | tout ce qu'il faut pour S11/S14 : adresses, tracé, contrepartie, véhicule + plaque, position du chauffeur | les 2 participants | — | ligne | S11, S14, S18 |
| Realtime `rides` filtré par `id` | changement de statut | participants | — | événements | S11, S14 |
| `cancel_ride(ride, reason, comment)` | motif obligatoire ; restriction 2 h au-delà de 3 annulations passager en 24 h | participants | motif | course | S16, S22 |
| `messages` (direct, Realtime) | chat pendant la course, sans numéro | participants, course active | texte | message | S12 |
| Edge `POST /masked-call` | appel masqué via fournisseur téléphonie (Twilio Voice ou opérateur local) | participants, course active | — | numéro relais | S12 (should) |
| `create_share_link(ride)` | jeton de suivi, 6 h max, coupé 1 h après la fin | passager | — | jeton | S13 |
| `shared_ride(token)` + web `GET /s/[token]` | page publique de suivi | tout le monde avec le lien | jeton | statut, chauffeur, véhicule, plaque, position | S21 |
| `rate_ride(ride, stars, tags, comment)` | note une fois, met à jour la moyenne de l'autre | participants, course terminée | note | — | S15 |
| `rides` + `ride_requests` (lecture) | historique | soi | pagination | liste | S18 |
| Edge `POST /receipt` | génère le PDF du reçu (une fois), l'envoie par e-mail si demandé | passager de la course | ride_id | lien signé | S18 |
| `support_tickets` / `support_messages` (direct) | ouvrir un ticket, discuter | soi | catégorie, texte | ticket | S20 |
| web `/admin` | valider chauffeurs, traiter tickets, lever une restriction | admins | — | — | back-office |

### Paiement par carte (should, après les espèces)

| route | fait | qui |
| --- | --- | --- |
| Edge `POST /payments/init` | crée un paiement `pending`, renvoie l'URL de paiement du prestataire | passager de la course |
| Edge `POST /payments/callback` (webhook entrant) | vérifie la signature, passe en `succeeded`/`failed` ; idempotent grâce à l'index unique `(provider, provider_ref)` | prestataire |

Webhooks entrants : prestataire de paiement. Webhook base → Edge `notify` (Supabase Database Webhook sur `offers` insert, `rides` update) pour les push.
Webhooks sortants : aucun.

Tâches planifiées (pg_cron) :
| nom | quand | fait |
| --- | --- | --- |
| `expire-stale` | chaque minute | offres échues → expirées ; demandes échues → expirées ; chauffeurs sans position depuis 2 min → hors ligne |
| `purge-locations` | 03:15 chaque nuit | supprime les traces GPS de plus de 90 jours (vie privée) |
| `cleanup-share-links` | chaque nuit | supprime les liens expirés depuis plus de 7 jours |

Total : **17 fonctions SQL**, **9 Edge Functions**, **2 pages web** (+ back-office), **3 tâches**.

## Les parties qui mordent

- **Fuseau horaire du Maroc** : `Africa/Casablanca` est en UTC+1 toute l'année **sauf pendant le Ramadan** (UTC+0), à des dates qui changent chaque année. Tout est stocké en UTC ; l'affichage passe par le fuseau IANA, jamais par un « +1 » codé en dur. Garder Expo / Node à jour pour la base des fuseaux.
- **Courses simultanées** : deux acceptations, ou un chauffeur qui accepte deux courses → réglé dans `accept_offer` (verrou + index uniques), testé.
- **Expiration des offres** : l'app affiche le compte à rebours, mais c'est la base qui décide (`expires_at` vérifié dans `accept_offer`, nettoyage chaque minute). L'horloge du téléphone peut être fausse : afficher à partir de l'heure serveur.
- **Idempotence** : un webhook de paiement arrive parfois deux fois → index unique sur la référence ; le bouton « Trouver un chauffeur » appuyé deux fois → l'index « une seule demande en recherche » renvoie l'erreur, l'app reprend la demande existante.
- **GPS imprécis** (plainte n°1 dans les avis) : laisser l'épingle déplaçable, proposer les entrées connues (gares, malls, mosquées), filtrer les positions avec une précision > 50 m, lisser le marqueur du chauffeur.
- **Coût des cartes** : Places et Routes sont payants à l'appel. Session tokens pour l'autocomplétion, appel `/quote` seulement quand départ et arrivée sont fixés, cache des itinéraires fréquents, quotas et alertes de budget dans Google Cloud dès le premier jour.
- **Temps réel à l'échelle** : position du chauffeur via Broadcast (pas d'écriture base à chaque point) ; surveiller les limites de connexions Realtime du forfait Supabase.
- **Réseau mobile faible** : l'app doit survivre à une coupure pendant la course (reprise de l'état via `ride_view` au retour, pas de perte de la course).
- **SMS** : coût par code, risque de fraude (envois massifs) → limiter les envois par numéro et par IP (Supabase Auth rate limits + captcha si abus).
- **Vie privée** : jamais de numéro de téléphone dans les réponses (testé) ; traces GPS purgées ; suppression du compte depuis l'app (obligatoire Google Play / App Store) ; loi marocaine 09-08 et déclaration à la CNDP à faire.
- **Prix recommandé** : simple formule par ville (base + km + minute, minimum), réglable dans `ride_types` sans republier l'app.

## Ordre de construction

1. **Tranche verticale** (laide mais complète, ~2-3 semaines) — prouve la stack.
   - Écrans : S02, S03, S05, S06 (recherche simple), S07, S09, S10, S11, S14, S15 côté passager ; mode chauffeur brut (en ligne, liste des demandes, offrir, avancer la course).
   - Tables : `cities`, `ride_types`, `profiles`, `drivers`, `vehicles`, `ride_requests`, `offers`, `rides`, `ratings`, `payments`.
   - Routes : OTP, `/quote`, `/create-request`, `request_offers`, `accept_offer`, `driver_*`, `ride_view`, `rate_ride`, Realtime offres + statut + Broadcast position, `expire-stale`.
   - Données : une ville (Casablanca), une gamme (Course), espèces. 2 téléphones de test : un passager, un chauffeur validé à la main.
   - Terminé quand : une vraie course de bout en bout entre deux téléphones dans la rue.
2. **Indispensables restants** (`must` dans features.csv) :
   - Demande : épingle déplaçable, suggestions d'adresses complètes (S06), augmenter le prix (F03), expiration visible.
   - Sécurité : S13 (urgences, partage) + page web S21.
   - Annulation : S16 avec motifs, restriction S22.
   - Compte : S04, S17, S18 (historique).
   - Back-office minimal : valider un chauffeur, lever une restriction.
3. **Souhaitables** (`should`) : chat S12, contacts d'urgence, options et commentaire S08, Confort / XL, reçus, support S20, carte bancaire, suppression du compte, appel masqué.
   Puis **bonus** (`could`) : favoris, langues ar/en, Moto, changer la destination en route, portefeuille.
4. **Corrections tirées des avis** : à remplir après `/replica-entrepreneur` (pistes déjà vues : GPS imprécis, bannières envahissantes, liste des demandes lente côté chauffeur).

Avant tout lancement public (hors de ce plan, mais bloquant) : app chauffeur complète avec inscription et envoi de documents, statut juridique validé par un avocat, déclaration CNDP, assurance.
