# Pipeline 3D de l’accordéon

Cette première fondation transforme le Hohner Club Modell I en asset applicatif vérifiable. Elle ne remplace pas encore l’accordéon HTML dans le lecteur : la migration reste volontairement derrière une page de laboratoire tant que le modèle n’a pas été validé sur les appareils cibles.

## Contrat livré

- source canonique : `blender/accordion-club-i.blend` ;
- modèle web : `public/models/hohner-club-i.glb` ;
- manifeste : `public/models/hohner-club-i.manifest.json` ;
- racine stable `AccordionRoot`, corps `Body_Left` et `Body_Right`, racine du soufflet `BellowsRoot` ;
- 21 commandes de mélodie reliées aux identifiants `c1-out-*`, `c1-in-*` et `c1-help-*` ;
- 8 commandes main gauche reliées aux identifiants `bass-*` et `chord-*` ;
- positions fermées et ouvertes enregistrées dans les extras glTF ;
- axe et profondeur de pression enregistrés sur chaque bouton ;
- page de validation manuelle : `/dev/accordion-3d`.

Le rendu 3D est chargé dynamiquement. Si WebGL ou le modèle échoue, l’interface HTML `AccordionView` reste disponible et fonctionnelle.

## Audit initial du modèle fourni

Le fichier de travail contenait plusieurs générations de la scène. La version sélectionnée possédait déjà une base solide : 21 commandes mélodiques, 8 commandes de basses, 18 plis pilotables et des matériaux dédiés. Avant normalisation, elle comptait 546 objets dans l’ensemble du fichier, dont des collections historiques et un studio de rendu.

La scène canonique exporte uniquement 375 objets utiles. Les corrections automatiques couvrent :

- suppression des anciennes itérations et des éléments de studio dans la copie canonique ;
- noms stables et métadonnées compatibles avec les identifiants de la base ;
- UV manquants ;
- transformations négatives ;
- capture réelle des frames fermée et ouverte de l’action Blender ;
- exclusion des drivers Blender au runtime au profit de valeurs continues explicites.

Budget mesuré lors de cette livraison : 4,4 Mo et environ 129 000 triangles. Le seuil CI est de 5 Mo et 150 000 triangles.

## Commandes

Validation du GLB, exécutée aussi en CI :

```bash
npm run validate:model
```

Validation approfondie de la scène Blender :

```bash
/Applications/Blender.app/Contents/MacOS/Blender \
  --background blender/accordion-club-i.blend \
  --python blender/scripts/validate_scene.py
```

Nouvel export à partir de la scène canonique :

```bash
/Applications/Blender.app/Contents/MacOS/Blender \
  --background blender/accordion-club-i.blend \
  --python blender/scripts/export_accordion.py
```

Si l’animation Blender du soufflet change, recalculer d’abord les états extrêmes :

```bash
/Applications/Blender.app/Contents/MacOS/Blender \
  --background blender/accordion-club-i.blend \
  --python blender/scripts/capture_motion_contract.py
```

`normalize_club_i.py` sert à recréer la scène canonique depuis le fichier de travail ouvert dans Blender. Il sauvegarde d’abord une copie et ne remplace pas le fichier source.

## Étapes suivantes avant activation dans le lecteur

1. valider les proportions et matériaux sur téléphone Android, tablette et ordinateur ;
2. profiler la cadence et la mémoire GPU sur les appareils bas de gamme ;
3. produire un niveau de détail plus léger pour le mobile ;
4. brancher `bellowsAmount` sur le moteur musical continu, sans le confondre avec `direction` ;
5. synchroniser les pressions main droite et main gauche avec les événements du morceau ;
6. conduire une validation pédagogique et visuelle avant d’activer le feature flag en production.
