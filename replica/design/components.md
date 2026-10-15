# Composants

Source des valeurs : `tokens.json` (jamais de couleur en dur dans un composant).
Code : `app/src/ui/`. Vitrine : route `/design` de l'app (`app/src/app/design.tsx`).

Règles communes :
- **Tous les boutons sont des pilules** (`radius.pill`), jamais à moitié arrondis.
- **Une icône différente par entrée** : deux entrées d'une même liste ne partagent jamais la même icône. Jeu d'icônes : Lucide (licence ISC/MIT). Aucun symbole « $ » : la devise s'écrit « MAD » / « DH ».
- Zone tactile minimale : 48 × 48 (`size.tap-min`).
- Focus visible au clavier (web, lecteur d'écran, clavier Bluetooth) : anneau 2 px `focus`, décalé de 2 px.
- Montants : `formatMAD(centimes)` → « 44 MAD », pas de décimales quand elles valent zéro.
- Textes réécrits : rien n'est repris d'inDrive.
- Lecteurs d'écran : chaque élément interactif a `accessibilityRole` + `accessibilityLabel` ; les états (`selected`, `disabled`, `busy`) passent par `accessibilityState`.

---

```
Text
  variants  display, xl, lg, base, sm, xs ; ton : default, muted, subtle, accent, danger, success, on-accent
  tokens    type.*, font.sans (Inter), color.text / text-muted / text-subtle
  a11y      allowFontScaling activé ; heading → accessibilityRole="header"
  used on   partout
```

```
Button
  variants  primary (accent), secondary (surface-2), ghost (transparent), danger
  sizes     sm 36, md 48, lg 56 (pleine largeur par défaut en lg)
  shape     pilule, toujours
  states    default, pressed (accent-pressed / opacité), focus-visible (anneau 2 px), disabled (opacité 0,4), loading (spinner + libellé gardé pour le lecteur d'écran)
  slots     icône avant (optionnelle), libellé, valeur à droite (ex. prix)
  tokens    bg accent, text on-accent, type base/600, radius pill
  a11y      accessibilityRole="button", accessibilityState { disabled, busy }
  used on   S02, S03, S05 (Trouver un chauffeur), S07, S10 (Accepter), S11, S15, S16
```

```
IconButton
  variants  surface (fond blanc + ombre, posé sur la carte), ghost
  sizes     40, 48
  shape     cercle
  states    default, pressed, focus-visible, disabled
  a11y      accessibilityLabel obligatoire (pas de texte visible)
  used on   S05 (menu, recentrer), S11 (appeler, message), S12
```

```
Avatar
  sizes     sm 32, md 44, lg 64
  states    photo, initiales (repli), chargement (surface-2)
  a11y      image décorative si le nom est déjà affiché à côté
  used on   S10, S11, S14, S17, S18
```

```
RatingBadge
  look      étoile pleine (color.star) + note « 4,9 » + (option) nombre de courses
  states    note, nouveau (« Nouveau » si moins de 5 notes)
  a11y      label « Note 4,9 sur 5, 312 courses »
  used on   S10, S11, S17
```

```
PlateBadge
  look      plaque en surface-2, chiffres en tabular, bordure border
  a11y      label épelé « plaque 6 7 8 9 B 1 »
  used on   S11, S14, S21
```

```
AddressField
  variants  pickup (point marker-pickup), dropoff (point marker-dropoff)
  states    vide (placeholder), rempli, focus (anneau), erreur (hors zone : texte danger), chargement (position en cours)
  slots     point de couleur, libellé, valeur, action à droite (épingle « choisir sur la carte »)
  a11y      bouton qui ouvre la recherche ; label « Départ : Mosquée Hassan II »
  used on   S05, S06
```

```
RouteSummary
  look      2 lignes départ / arrivée reliées par un trait vertical, distance et durée à droite
  states    complet, arrivée manquante
  used on   S09, S10, S11, S18, S21
```

```
ServiceTabs
  items     Course, Confort, XL, Moto — une icône différente chacune
  states    sélectionné (accent-soft + bordure accent), normal, indisponible (texte subtle, non pressable, « Bientôt »)
  a11y      accessibilityRole="tablist" / "tab", selected
  used on   S05
```

```
FareInput
  look      grand montant (display) + « MAD », ligne d'aide « Prix conseillé : 34 MAD », note péages
  states    vide, valide, sous le minimum (danger + bouton désactivé), en hausse (relance F03)
  pair      Keypad (3×4, touches 56, effacer, pas de virgule)
  a11y      montant annoncé à chaque frappe (accessibilityLiveRegion="polite")
  used on   S07, S09
```

```
Keypad
  keys      0-9, effacer, raccourcis +5 / +10 MAD en option
  states    pressed, disabled
  a11y      chaque touche est un bouton labellisé ; effacer = « Effacer le dernier chiffre »
  used on   S03, S07
```

```
PaymentPicker
  items     Espèces, Carte, Portefeuille — icônes différentes ; seuls ceux de la ville sont actifs
  states    sélectionné, indisponible (masqué ou grisé avec raison)
  a11y      radiogroup
  used on   S05, S07, S15
```

```
OfferCard
  look      prix (xl/700) + mention « votre prix » ou « contre-offre », ETA + distance, avatar, prénom, RatingBadge, véhicule (marque, modèle, couleur), boutons Refuser (secondary sm) / Accepter (primary md)
  states    nouvelle (glisse depuis le haut, motion.offer-in), vivante (barre de temps qui se vide), bientôt expirée (< 10 s : barre warning), expirée (disparaît), acceptation en cours (loading sur Accepter, autres offres désactivées)
  a11y      annonce « Nouvelle offre, 44 MAD, Youssef, 4 minutes » (live region) ; les deux boutons portent le nom du chauffeur dans leur label
  used on   S10
```

```
CountdownBar
  look      barre fine 4 px en bas d'OfferCard, accent → warning sous 10 s
  a11y      masquée au lecteur d'écran (le temps restant est lu dans le label de la carte)
  used on   S10
```

```
DriverCard
  look      avatar lg, prénom, RatingBadge, véhicule, PlateBadge, ETA ; actions Appeler / Écrire (IconButton) + Sécurité
  states    en route, arrivé (bandeau success « Votre chauffeur est là »), en course
  used on   S11, S14
```

```
BottomSheet
  states    repliée (peek 280), mi-hauteur, dépliée ; poignée 4 px ; ombre sheet ; radius xl en haut
  a11y      poignée = bouton « Agrandir le panneau » ; le contenu reste lisible sans glisser
  used on   S05, S07, S09, S11, S14, S16
```

```
ListRow
  look      icône (unique par ligne), libellé, détail muted, chevron ou interrupteur
  states    default, pressed, disabled, danger (supprimer le compte)
  used on   S13, S17, S19, S20
```

```
ChoiceList
  modes     single (radio) — motifs d'annulation, mode de paiement ; multiple (case) — options de course
  states    choisi, non choisi, désactivé ; champ texte « Autre raison » qui apparaît
  a11y      radiogroup / checkbox, état checked
  used on   S08, S16
```

```
StarRating
  look      5 étoiles 40 px, puis étiquettes (chips) selon la note
  states    vide, 1-5, envoyé
  a11y      adjustable : glisser haut/bas change la note ; label « 4 étoiles sur 5 »
  used on   S15
```

```
PhoneInput
  look      sélecteur pays (+212 par défaut), champ numérique, format 06 12 34 56 78
  states    vide, valide, invalide (danger + message), désactivé pendant l'envoi
  a11y      textContentType telephoneNumber, autoComplete tel
  used on   S02
```

```
CodeInput
  look      6 cases, une par chiffre, saisie unique (autofill SMS), compte à rebours « Renvoyer dans 0:42 »
  states    vide, en cours, erreur (cases danger + secousse), vérifiant (loading)
  a11y      textContentType oneTimeCode, autoComplete sms-otp ; un seul champ réel derrière les cases
  used on   S03
```

```
Banner
  variants  info (accent-soft), success, warning, danger
  behaviour fermable ; une fois fermé, ne revient pas pour la même raison (corrige une plainte d'avis)
  a11y      accessibilityRole="alert" pour danger, live region polite sinon
  used on   S05, S09, S11, S22
```

```
EmptyState
  look      illustration maison (à créer, jamais celles d'inDrive), titre lg, texte muted, bouton
  used on   S09 (aucune offre), S18 (aucune course)
```

```
ChatBubble + Composer
  variants  moi (accent, on-accent, aligné droite), l'autre (surface-2), système (centré, subtle)
  states    envoi, envoyé, échec (danger + « Réessayer »)
  extras    messages rapides (« J'arrive », « Je suis devant »)
  used on   S12, S20
```

```
MapView (placeholder dans la vitrine)
  markers   moi (point accent pulsant), départ (marker-pickup), arrivée (marker-dropoff), chauffeur (voiture orientée par heading)
  route     trait 4 px color.route
  states    chargement, position refusée (Banner warning + saisie manuelle), hors zone
  note      vraie carte Google en build natif ; dans la vitrine, un fond quadrillé neutre
  used on   S05, S06, S09, S11, S14, S21
```

```
SearchingPulse
  look      cercles concentriques autour du départ (motion.slow, boucle), texte « On cherche des chauffeurs… »
  a11y      animation coupée si « réduire les animations » est activé
  used on   S09
```
