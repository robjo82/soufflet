# Pipeline 3D de l’accordéon

Cette fondation transforme le Hohner Club Modell I en asset applicatif vérifiable et en instrument pédagogique partagé. Après validation dans le laboratoire, le modèle est désormais utilisé dans les surfaces principales de Soufflet dès que la configuration active est compatible.

## Contrat livré

- source canonique : `blender/accordion-club-i.blend` ;
- modèle web : `public/models/hohner-club-i.glb` ;
- manifeste : `public/models/hohner-club-i.manifest.json` ;
- racine stable `AccordionRoot`, corps `Body_Left` et `Body_Right`, racine du soufflet `BellowsRoot` ;
- 21 commandes de mélodie reliées aux identifiants `c1-out-*`, `c1-in-*` et `c1-help-*` ;
- 8 commandes main gauche reliées aux identifiants `bass-*` et `chord-*` ;
- positions fermées et ouvertes enregistrées dans les extras glTF ;
- ouverture organique : affaissement central, contre-courbe asymétrique, profondeur et inertie transitoire ;
- axe et profondeur de pression enregistrés sur chaque bouton ;
- états visuels distincts : touche à jouer en cyan, note entendue en vert, bouton sélectionné dans l’accordeur en jaune et course physique uniquement pendant une pression réelle ;
- veinage de noyer empaqueté dans le fichier Blender et exporté dans le GLB, sans dépendance à une photo externe ;
- soufflet noir mat plus proche du modèle de référence ;
- page de validation manuelle : `/dev/accordion-3d`.

Le rendu 3D est chargé dynamiquement. Si WebGL ou le modèle échoue, l’interface HTML `AccordionView` reste disponible et fonctionnelle. Les autres modèles d’accordéon restent volontairement en 2D tant qu’un asset 3D fidèle n’existe pas : Soufflet n’affiche jamais un Club I générique à la place de l’instrument configuré.

## Intégration dans l’application

`AccordionInstrument` est la façade commune utilisée par :

- l’onboarding et toute la première leçon ;
- le tableau de bord et l’aperçu de la prochaine séance ;
- le lecteur d’entraînement, y compris le plein écran ;
- le studio de correction ;
- l’accordeur guidé ;
- l’aperçu de l’instrument dans les réglages.

La façade traduit le même événement musical en état 2D ou 3D, déclenche la même banque d’échantillons au clic et transmet les mêmes identifiants de boutons aux exercices. La mélodie, la main gauche, la direction, la réserve et la soupape restent donc coordonnées par les données du morceau, jamais par une animation parallèle.

Chaque contexte possède un cadrage responsive explicite. La vue principale privilégie un instrument grand et lisible à environ un mètre ; l’accordeur emploie un cadrage plus compact afin de conserver le sélecteur et le verdict dans la même hauteur. Sur mobile, le canevas autorise le défilement vertical et ne capture pas les gestes de page. La rotation libre reste réservée au laboratoire.

Le canevas est doublé d’un clavier DOM accessible. Il demeure visuellement discret, apparaît au focus clavier et permet d’écouter chaque touche avec Tab puis Entrée ou Espace. La direction est toujours exprimée par le mouvement, deux flèches, un libellé textuel et une couleur. `prefers-reduced-motion` désactive la pulsation des guides.

## Audit initial du modèle fourni

Le fichier de travail contenait plusieurs générations de la scène. La version sélectionnée possédait déjà une base solide : 21 commandes mélodiques, 8 commandes de basses, 18 plis pilotables et des matériaux dédiés. Avant normalisation, elle comptait 546 objets dans l’ensemble du fichier, dont des collections historiques et un studio de rendu.

La scène canonique exporte uniquement les objets utiles. Les corrections automatiques couvrent :

- suppression des anciennes itérations et des éléments de studio dans la copie canonique ;
- noms stables et métadonnées compatibles avec les identifiants de la base ;
- UV manquants ;
- transformations négatives ;
- capture réelle des frames fermée et ouverte de l’action Blender ;
- mouvement de soufflet reproductible de type `organic-wave`, piloté pli par pli et contrôlé par les propriétés de la racine ;
- peau plissée continue exportée comme morph target glTF, afin que la toile suive la vague sans laisser d'espaces entre les plis ;
- léger recouvrement de cette peau sous les cadres d'extrémité pour éviter un jour au raccord avec les caisses en bois ;
- matériau bois bitmap procédural empaqueté, lisible par le moteur glTF ;
- matériaux de soufflet assombris et moins brillants ;
- exclusion des drivers Blender au runtime au profit de valeurs continues explicites.

Budget mesuré lors de cette livraison : environ 1,7 Mo et 37 000 triangles. Le seuil CI est de 5 Mo et 150 000 triangles. Le validateur refuse aussi un modèle dont les corps s'écartent sans rotation, sans vague verticale, sans profondeur ou sans peau continue animée, afin d'éviter le retour à une ouverture purement latérale.

Le GLB porte une révision explicite dans son URL. Les fichiers de modèle stables sont servis avec revalidation obligatoire : un navigateur ayant chargé une ancienne version ne peut plus conserver silencieusement le binaire pendant un an.

## Laboratoire de lecture

Une session connectée charge tous les morceaux prêts de la bibliothèque commune dans `/dev/accordion-3d`. Le lecteur adapte d'abord la tablature au Club I, puis synchronise :

- les boutons de mélodie et leurs notes synthétisées ;
- les basses ou accords de la main gauche ;
- la direction et l'amplitude du soufflet ;
- la durée de pression et le signal lumineux de chaque touche.

Le laboratoire utilise un pupitre à deux colonnes sur ordinateur : scène carrée à gauche, contrôles et touches compactes à droite. Les halos cyan des touches et les deux flèches de soufflet constituent une couche pédagogique indépendante, désactivable avec « Guides bleus ».

Sans session ou en cas d'indisponibilité de l'API, le laboratoire conserve un exercice local explicite au lieu de simuler une bibliothèque chargée.

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

L’export conserve volontairement les shape keys (`export_apply=False`) : appliquer les modificateurs à l’export supprimerait la peau continue animée du soufflet.

## Évolutions suivantes

1. profiler la cadence et la mémoire GPU sur un panel d’appareils Android bas de gamme ;
2. produire un niveau de détail plus léger si les mesures réelles le nécessitent ;
3. ajouter des assets fidèles pour les autres configurations avant d’étendre leur rendu 3D ;
4. valider le point de vue musicien avec plusieurs accordéonistes et prévoir un choix d’orientation si nécessaire.
