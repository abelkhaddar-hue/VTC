# Journal de construction

Données : couche factice `app/src/data/fake.ts` (mêmes fonctions que la future API Supabase, voir architecture.md). Testé le 2026-10-15 dans le navigateur à 390 px et 1440 px, aucune erreur console. Captures : `replica/clone-screens/`.

| écran | date | état | ce qui manque | plus dur que prévu |
| --- | --- | --- | --- | --- |
| S01 Accueil | 2026-10-15 | fait | nom et logo provisoires (/replica-brand) | — |
| S02 Téléphone | 2026-10-15 | fait | vrai envoi SMS (Twilio) | — |
| S03 Code SMS | 2026-10-15 | fait | — | vider la pile de navigation après connexion (sinon « retour » ramenait à la connexion) |
| S04 Profil | 2026-10-15 | partiel | photo de profil | — |
| S05 Accueil carte | 2026-10-15 | partiel | vraie carte Google, refus de localisation | le bloc prix tronquait le mode de paiement : corrigé |
| S06 Adresse | 2026-10-15 | partiel | Google Places ; glisser l'épingle (on touche la carte) | la position du toucher n'existe pas sur le web avec Pressable : passé aux événements tactiles bruts |
| S07 Prix | 2026-10-15 | fait | — | libellé « prix conseillé » faux en mode relance : corrigé en « au moins » |
| S08 Options | 2026-10-15 | fait | — | — |
| S09 Recherche | 2026-10-15 | fait | — | — |
| S10 Offres | 2026-10-15 | partiel | offres simulées tant que l'app chauffeur n'existe pas | — |
| S11 Chauffeur en route | 2026-10-15 | partiel | position réelle (Realtime Broadcast) | — |
| S12 Messagerie | 2026-10-15 | partiel | appel masqué ; pas de capture (la course de test s'est terminée pendant le test) | — |
| S13 Sécurité | 2026-10-15 | fait | SMS aux contacts d'urgence | — |
| S14 Course en cours | 2026-10-15 | fait | — | — |
| S15 Fin et note | 2026-10-15 | fait | — | — |
| S16 Annulation | 2026-10-15 | fait | — | — |
| S17 Menu | 2026-10-15 | fait | — | icônes : une destination = une icône, revu |
| S18 Historique | 2026-10-15 | partiel | reçu PDF ; les courses de démo disparaissent au rechargement | — |
| S19 Réglages | 2026-10-15 | partiel | langues ar/en, autres villes | contacts d'urgence déplacés sur un écran à eux |
| S20 Aide | 2026-10-15 | partiel | vraie équipe support (back-office) | — |
| S21 Suivi partagé | 2026-10-15 | partiel | lien utilisable hors du navigateur de démo (vraie base) | — |
| S22 Compte suspendu | 2026-10-15 | fait | — | — |

## Points à retenir

- **Session de démo** : gardée dans le navigateur (localStorage) pour survivre au rechargement ; partagée entre onglets. Le reste des données de démo (courses, offres) est en mémoire et repart à zéro au rechargement.
- **Garde de session** : tout écran protégé renvoie à S01 sans session (ajouté après un écran resté vide au rechargement).
- **Fuseau horaire** : l'app affiche les heures via `Intl` en `Africa/Casablanca`, sans « +1 » codé en dur. Le navigateur de test donne GMT+0 pour Casablanca en octobre 2026 : c'est sa base des fuseaux qui décide, à vérifier sur un vrai téléphone.
- **Pas encore vérifié** : sur un vrai téléphone Android / iOS (seulement le web), lecteur d'écran réel (seulement les libellés d'accessibilité), parcours complet au clavier (vérifié sur la connexion uniquement).
