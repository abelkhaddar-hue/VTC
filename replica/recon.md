# Recon map : inDrive (Android, aussi iOS)

Périmètre : course en ville côté passager (le passager propose son prix, les chauffeurs acceptent ou contre-proposent, il choisit, suivi, paiement, note).
Pour : un vrai produit à lancer (marché visé : Maroc, d'après les sources).
Date : 2026-10-15

Méthode : sources publiques uniquement (fiche Play Store, site officiel, centre d'aide). Aucun compte utilisé, aucun code de l'app lu, aucun appel réseau copié. Les captures dans `screens/` servent de référence et ne vont jamais dans le produit.

## Sources

| # | source | URL | notes |
| --- | --- | --- | --- |
| 1 | fiche Google Play | https://play.google.com/store/apps/details?id=sinet.startup.inDriver&hl=fr | 4,7★, 16,3 M avis, 100 M+ téléchargements, MAJ 14/10/2026. 6 captures (S05, S07, S10, S11, services, véhicules). Avis récents lus. |
| 2 | page Courses en ville (Maroc) | https://indrive.com/fr-ma/city-rides | les 3 étapes du cœur, Confort, sécurité, FAQ (demander, suivre, note, historique) |
| 3 | sécurité passagers | https://indrive.com/fr-ma/safety/passengers | chauffeurs vérifiés, numéro masqué, partage de course, urgences, contacts d'urgence, gestion d'incident |
| 4 | index aide passagers | https://indrive.com/fr-ma/help/passengers | liste complète des sujets d'aide = liste des fonctions |
| 5 | aide : modes de paiement | https://indrive.com/fr-ma/help/passengers/what-are-the-payment-methods-on-indrive | espèces, carte, portefeuilles selon la ville, choisi dans le formulaire |
| 6 | aide : calcul des tarifs | https://indrive.com/fr-ma/help/passengers/how-fares-are-calculated | prix recommandé = plancher, contre-offres illimitées, prix figé après acceptation, péages à part |
| 7 | aide : annuler | https://indrive.com/fr-ma/help/passengers/how-to-cancel-a-ride | libre avant acceptation, motif obligatoire après, sanctions si abus |
| 8 | aide : modifier l'itinéraire | https://indrive.com/fr-ma/help/passengers/how-to-change-route-details | pas modifiable pendant la course (contradiction avec la page sécurité, voir notes) |
| 9 | aide : planifier | https://indrive.com/fr-ma/help/passengers/how-to-schedule-a-ride-in-advance | pas de réservation à l'avance en ville |
| 10 | aide : Confort / XL | https://indrive.com/fr-ma/help/passengers/what-are-the-special-ride-types-comfort-xl | types de course au-dessus du formulaire, options + commentaire |
| 11 | aide : inscription | https://indrive.com/fr-ma/help/passengers/how-to-register-as-a-passenger-in-the-indrive-app | téléphone + code SMS + e-mail |
| 12 | aide : reçus | https://indrive.com/fr-ma/help/passengers/how-to-get-receipts | bouton Reçu dans l'historique, selon pays |

Non utilisés : compte personnel (aucun), vidéos de démonstration (à regarder pour confirmer les écrans marqués « supposé »).

## Boucle centrale

Le passager fixe lui-même son prix, plusieurs chauffeurs répondent (accepter ou contre-offre), et il choisit son chauffeur sur prix + note + temps d'arrivée. C'est ce qui distingue inDrive d'Uber/Careem/Yango (prix imposé, attribution automatique).

## Écrans

« vu » = visible sur une capture ou décrit pas à pas dans l'aide. « supposé » = déduit, à confirmer.

| ID | écran | comment on y arrive | rôle | composants clés | états vus |
| --- | --- | --- | --- | --- | --- |
| S01 | Accueil / présentation | 1er lancement | pitch + choix de la langue | carrousel, bouton principal | supposé |
| S02 | Numéro de téléphone | S01 → Continuer | inscription / connexion | champ téléphone avec indicatif pays | vu (aide 11) ; erreur numéro invalide supposée |
| S03 | Code SMS | S02 → Envoyer | vérifier le numéro | champ code 4-6 chiffres, renvoyer le code, compte à rebours | supposé : code faux, code expiré |
| S04 | Création du profil | après S03 si nouveau | nom, e-mail, photo | champs texte, photo | vu (aide 11 : e-mail) |
| S05 | Accueil carte + formulaire de demande | écran principal | créer la demande | carte plein écran, onglets de service (Course, Confort, XL, Moto, Livraison…), champs « De » / « À », champ « Proposer votre tarif », mode de paiement, bouton « Trouver un chauffeur » | vu (capture 1, aide 2/10) ; vide, rempli, service indisponible dans la ville |
| S06 | Recherche d'adresse | S05 → champ « De » ou « À » | choisir départ/arrivée | barre de recherche, suggestions, adresses récentes, « choisir sur la carte » (épingle déplaçable) | vu (aide 8 : glisser la carte) ; aucun résultat supposé |
| S07 | Proposer votre tarif | S05 → champ tarif | saisir le prix | prix recommandé affiché, pavé numérique, aide « péages non inclus », choix du paiement | vu (capture « Prix », aide 6) ; prix sous le minimum refusé (supposé) |
| S08 | Options et commentaire | S05 → options | prévenir le chauffeur | cases : siège enfant, bagages, animal ; nombre de passagers ; commentaire libre | vu (aide 3/10) |
| S09 | Recherche de chauffeurs | S05 → Trouver un chauffeur | attendre les réponses | animation de recherche sur carte, prix affiché, « augmenter le prix », annuler | supposé (aide 6 : « faire une nouvelle offre ») ; aucune réponse après X min |
| S10 | Liste des offres | des réponses arrivent dans S09 | choisir son chauffeur | cartes d'offre empilées : prix, distance/ETA, photo, prénom, note ★, véhicule ; boutons Accepter / Refuser, compte à rebours par offre | vu (capture « Conducteur ») ; 1 offre, plusieurs, offre expirée |
| S11 | Chauffeur en route | S10 → Accepter | attendre la prise en charge | carte avec position du chauffeur en direct, ETA, nom, photo, note, modèle + couleur + plaque, Contacter, Sécurité, Annuler | vu (capture « Sécurité », aide 2) ; chauffeur immobile (aide 2), chauffeur arrivé |
| S12 | Messagerie / appel | S11 → Contacter | parler au chauffeur sans donner son numéro | chat in-app, appel masqué | vu (aide 3) |
| S13 | Centre de sécurité | S11 / S14 → Sécurité | se protéger | Partager ma course, Appeler les urgences, Contacter l'assistance, contacts d'urgence | vu (aide 2/3) |
| S14 | Course en cours | chauffeur démarre | suivre le trajet | carte + itinéraire, ETA d'arrivée, bouton sécurité | vu (aide 2) |
| S15 | Fin de course : paiement + note | arrivée | payer et noter | montant, mode de paiement, étoiles 1-5, commentaire/étiquettes | vu (aide 2 : « évaluez ») ; étiquettes supposées |
| S16 | Annulation | S09/S10/S11 → Annuler | annuler proprement | liste de motifs, « Autre raison » + texte, avertissement si après acceptation | vu (aide 7) |
| S17 | Menu latéral | S05 → avatar / menu | navigation | nom + note du passager, services, Historique, Sécurité, Support, Paramètres | vu (aide 2) |
| S18 | Historique des demandes + détail | S17 → Historique | revoir ses courses | liste par date, détail (trajet, prix, chauffeur), bouton Reçu | vu (aide 2/12) ; vide, délai 24 h |
| S19 | Profil et paramètres | S17 → profil | gérer son compte | photo, nom, e-mail, ville par défaut, langue, contacts d'urgence, supprimer le compte | vu (aide 4/8) |
| S20 | Support | S17 → Support / S13 | obtenir de l'aide | chat support 24/7, catégories (objet oublié, litige prix…) | vu (réponses Play, aide 3) |
| S21 | Page de suivi partagée (web) | lien envoyé à un proche | voir la course sans l'app | carte live, chauffeur, voiture, plaque | vu (aide 2) ; lien expiré supposé |
| S22 | Compte bloqué | trop d'annulations / incident | informer | message + contacter le support | vu (aide 3/4/7) |

Total : 22 écrans.

## Parcours

```
F01 Passager commande une course (le cœur)
    S05 -> S06 (À) -> S07 (prix) -> S09 -> S10 (accepter) -> S11 -> S14 -> S15
    clics du parcours idéal : 8 (champ À, taper, choisir suggestion, champ prix,
      valider, Trouver un chauffeur, Accepter, noter + terminer) — chiffre à battre
    cas limites : aucune offre, toutes les offres plus chères (contre-offre),
      offre qui expire pendant qu'on hésite, chauffeur qui annule après acceptation,
      GPS imprécis (cité dans les avis), départ hors zone desservie, prix sous le minimum

F02 Inscription
    S01 -> S02 -> S03 -> S04 -> S05
    clics : ~5
    cas limites : SMS non reçu, mauvais code, numéro déjà utilisé, compte supprimé à récupérer

F03 Contre-offre et relance
    S09 (pas de réponse) -> S07 (augmenter le prix) -> S09 -> S10
    cas limites : relance pendant que des offres arrivent, plafond de relances

F04 Annuler
    S09/S10 -> S16 (sans pénalité)  |  S11 -> S16 (motif obligatoire, effet sur la note)
    cas limites : annulations répétées -> S22

F05 Partager sa course / urgence
    S11 ou S14 -> S13 -> Partager ma course -> contact -> S21 côté proche
    S13 -> Appeler les urgences (numéro local, 19 police / 15 SAMU au Maroc à vérifier)

F06 Contacter le chauffeur
    S11 -> S12 (chat ou appel masqué)

F07 Revoir une course, obtenir un reçu, signaler un problème
    S17 -> S18 -> détail -> Reçu | Support (S20)
    cas limites : objet oublié, chauffeur qui a demandé plus (aide 6)

F08 Gérer son compte
    S17 -> S19 -> modifier / ajouter contact d'urgence / changer de ville / supprimer
```

## Composants

| composant | variantes | états | utilisé sur |
| --- | --- | --- | --- |
| Bouton | principal (pleine largeur, très visible), secondaire, texte, danger (annuler) | normal, appuyé, désactivé, chargement | partout |
| Carte (map) | plein écran, demi-écran, mini dans historique | chargement, sans réseau, position refusée | S05, S06, S09, S11, S14, S18, S21 |
| Épingle / marqueurs | départ, arrivée, chauffeur (voiture orientée), moi | en mouvement | S05, S06, S11, S14, S21 |
| Champ d'adresse « De / À » | avec point de couleur départ/arrivée | vide, rempli, focus | S05, S06, S10, S11 |
| Onglets de service | Course, Confort, XL, Moto… (icône + nom) | actif, inactif, indisponible | S05 |
| Champ prix + pavé numérique | avec prix recommandé | sous le minimum, valide | S07 |
| Sélecteur de paiement | espèces, carte, portefeuille | indisponible dans la ville | S05, S07, S15 |
| Carte d'offre chauffeur | prix, ETA/distance, photo, nom, note, véhicule, Accepter/Refuser | nouvelle (arrive en animation), expirante (barre de temps), expirée | S10 |
| Fiche chauffeur | compacte (S11), détaillée | — | S11, S14, S18, S21 |
| Feuille du bas (bottom sheet) | repliée, à mi-hauteur, dépliée | glisser | S05, S09, S11, S14 |
| Liste de choix | motifs d'annulation, options de course | sélectionné | S08, S16 |
| Étoiles de note | 1-5 + étiquettes | — | S15 |
| Chat | bulles, saisie, messages rapides | envoi, échec | S12, S20 |
| Menu latéral | — | — | S17 |
| Champ téléphone + code | indicatif pays, code à cases | erreur, compte à rebours | S02, S03 |
| Bannière / toast | info, erreur, alerte | — | partout (avis Play : bannière « autres tarifs » jugée envahissante) |
| État vide | historique vide, aucune offre | — | S09, S18 |

## Modèle de données déduit

```
Utilisateur  id, téléphone (unique), e-mail, prénom, photo_url, langue, ville_id,
             note_moyenne, nb_notes, statut (actif | bloqué | supprimé), créé_le
             preuves : S02-S04, S17 (note sous le nom), aide 3/4/11
             confiance : haute

Ville        id, nom, pays, devise (MAD), zone (polygone), services_actifs,
             modes_paiement_actifs, numéros_urgence
             preuves : fiche Play (8 villes), page city-rides (34 villes), aide 5/10
             confiance : haute (champs exacts supposés)

TypeCourse   id, ville_id, code (course | confort | xl | moto), nom, places_max,
             critères_véhicule
             preuves : S05, aide 10      confiance : haute

Demande      id, passager_id, type_course_id, départ (lat, lng, adresse),
             arrivée (lat, lng, adresse), distance_m, durée_estimée_s,
             prix_recommandé, prix_proposé, mode_paiement, options (enfant,
             bagages, animal), nb_passagers, commentaire,
             statut (recherche | offre_acceptée | annulée | expirée), créée_le
             preuves : S05-S09, aide 6/10      confiance : haute

Offre        id, demande_id, chauffeur_id, prix, type (accepte | contre_offre),
             eta_s, distance_m, statut (envoyée | acceptée | refusée | expirée),
             expire_le
             preuves : S10, aide 6 (« pas de limite aux offres »)      confiance : haute

Course       id, demande_id, offre_id, chauffeur_id, véhicule_id, prix_final,
             statut (en_route | arrivé | en_cours | terminée | annulée),
             annulée_par, motif_annulation, heures (acceptée, arrivée,
             début, fin), péages_hors_tarif
             preuves : S11, S14-S16, aide 6/7      confiance : haute

PositionChauffeur  chauffeur_id, course_id, lat, lng, cap, horodatage
             preuves : S11 (position en direct)  confiance : haute (stockage = supposé)

Chauffeur    id, utilisateur_id, statut_vérification, permis, pièce_identité,
             selfie_vérifié, note_moyenne
             preuves : page sécurité (vérifications, selfie en direct)  confiance : haute

Véhicule     id, chauffeur_id, marque, modèle, couleur, plaque, année, catégorie
             preuves : S10, S11, S21      confiance : haute

Note         id, course_id, auteur_id, cible_id, étoiles, étiquettes, commentaire
             preuves : S15, aide 2 (le chauffeur note aussi le passager)  confiance : haute

Message      id, course_id, expéditeur_id, texte, envoyé_le
             preuves : S12      confiance : moyenne

Paiement     id, course_id, mode, montant, statut, référence_prestataire
             preuves : aide 5, S15      confiance : moyenne (espèces = pas de transaction)

ContactUrgence  id, utilisateur_id, nom, téléphone
             preuves : S13, page sécurité      confiance : haute

LienPartage  id, course_id, jeton, expire_le
             preuves : S21, aide 2      confiance : haute (expiration supposée)

Incident / TicketSupport  id, utilisateur_id, course_id, catégorie, statut, messages
             preuves : S20, page sécurité (blocage temporaire)  confiance : moyenne

Reçu         course_id, numéro, montant, pdf_url
             preuves : aide 12      confiance : moyenne
```

Relations : Ville 1-n TypeCourse ; Utilisateur 1-n Demande ; Demande 1-n Offre ; Demande 1-0..1 Course ; Offre 1-0..1 Course ; Chauffeur 1-n Véhicule ; Course 1-n PositionChauffeur, Message ; Course 1-2 Note ; Utilisateur 1-n ContactUrgence ; Course 1-n LienPartage.

## Matrice des fonctions

Voir `features.csv`. Indispensable (must) : 25, souhaitable (should) : 13, bonus (could) : 7, hors champ (skip) : 7.

## Hors périmètre (impossible ou à ne pas copier)

- **Le réseau de chauffeurs.** inDrive a ses chauffeurs ; vous devrez recruter les vôtres. Sans chauffeurs, l'app passager ne sert à rien : prévoir une app chauffeur (même minimale) et un back-office de vérification avant tout lancement, hors de cette tranche.
- **La marque, le logo, le vert « citron », les illustrations, les textes.** À remplacer (étape `/replica-brand`).
- **Les données** : notes, historique, prix recommandés appris sur des millions de courses. Votre prix recommandé partira d'une simple formule (base + km + minute).
- **Le cadre légal.** Le transport de personnes rémunéré au Maroc (taxis, VTC) est encadré ; inDrive se présente comme « agrégateur » qui ne participe pas aux courses. Faire valider le statut par un avocat marocain avant le lancement.
- **Partenariats** : assurance, prestataires de paiement locaux déjà négociés.
- **Les autres services** (ville à ville, livraison, fret, moto, inDrive.Money) : hors de cette tranche, gardés en `could`/`skip`.

## Notes

- Contradiction dans l'aide : la page sécurité dit qu'on peut modifier l'arrivée pendant la course, l'aide « itinéraire » dit que non. À trancher pour votre version.
- Avis Play récents (sept. 2026) : liste des commandes devenue plus lente côté chauffeur, bannières qui reviennent, géolocalisation imprécise, prix jugés trop bas par les chauffeurs. Pistes à creuser avec `/replica-entrepreneur`.

## Taille

Écrans 22, parcours 8, entités 15. Parties difficiles : enchères en temps réel (offres qui arrivent en quelques secondes, expirations), suivi GPS en direct + cartes/itinéraires/recherche d'adresses (coût des API), vérification des chauffeurs et paiement local (CMI / portefeuilles). Taille : **L** (un trimestre) pour l'app passager + le minimum chauffeur/back-office indispensable au lancement ; l'app passager seule sur données factices : M.
