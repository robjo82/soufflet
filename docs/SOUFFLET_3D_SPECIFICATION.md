# Soufflet — Spécification de la future représentation 3D de l’accordéon

> Note de cadrage destinée à l’IA chargée de développer le dépôt `robjo82/soufflet` et à l’agent Blender MCP chargé d’améliorer le modèle 3D.

## 1. Objectif

Remplacer progressivement la représentation actuelle de l’accordéon, principalement construite en HTML et CSS, par un véritable instrument 3D :

- visuellement crédible ;
- fidèle au modèle d’accordéon configuré ;
- utilisable comme support pédagogique ;
- interactif depuis React et JavaScript ;
- performant sur ordinateur, tablette, navigateur mobile et application Android Capacitor ;
- exportable depuis Blender sans traitement manuel fragile ;
- compatible avec les données musicales et les interactions déjà présentes dans Soufflet.

La 3D n’est pas uniquement décorative. Elle doit devenir une couche pédagogique pilotée par l’état de l’application :

- enfoncement des boutons ;
- indication pousser/tirer ;
- ouverture du soufflet ;
- visualisation des mains et des doigtés ;
- surbrillance des notes attendues ou détectées ;
- changement de point de vue ;
- démonstration animée ;
- éventuellement visualisation de la pression, du débit d’air et du rythme.

## 2. État actuel du projet

Soufflet est actuellement une application React, TypeScript et Vite, distribuée sur le Web et dans une application Android Capacitor.

La vue `AccordionView` gère déjà :

- la configuration de l’instrument ;
- les boutons mélodiques et les basses ;
- les états actifs et détectés ;
- le sens du soufflet, `push` ou `pull` ;
- la lecture des notes MIDI ;
- les événements de pression ;
- les variantes visuelles d’instrument ;
- l’affichage des doigtés et des libellés.

La représentation actuelle reste une illusion de volume en DOM/CSS :

- deux sections HTML représentent les caisses ;
- les boutons sont des éléments `<button>` ;
- le soufflet est une suite d’éléments HTML ;
- les profondeurs, reflets, ferrures et ornements sont des éléments décoratifs CSS ;
- la variante Hohner Club I est déterminée par le fabricant et le modèle.

Cette logique ne doit pas être supprimée brutalement. Elle constitue une bonne source de vérité fonctionnelle. La migration doit conserver les composants de données et remplacer progressivement la couche de rendu.

## 3. Choix technologique recommandé

### 3.1 Pile principale

Utiliser :

- **Blender** pour la modélisation, les UV, les matériaux, le rig et les animations ;
- **glTF 2.0 / GLB** comme format d’échange ;
- **Three.js** comme moteur 3D ;
- **React Three Fiber** comme intégration React de Three.js ;
- **Drei** pour les utilitaires React Three Fiber ;
- **TypeScript** pour les contrats entre modèle 3D et application ;
- **Web Audio API** et le synthétiseur existant pour le son ;
- **Capacitor** pour conserver la distribution Android actuelle.

Dépendances envisagées :

```bash
npm install three @react-three/fiber @react-three/drei
npm install -D @types/three
```

Dépendances optionnelles :

```bash
npm install zustand
npm install @react-spring/three
npm install three-stdlib
npm install -D @gltf-transform/cli
```

Ne pas introduire Zustand uniquement pour la 3D si l’état actuel peut rester passé par propriétés React. L’ajouter seulement si plusieurs vues 3D, animations et systèmes pédagogiques doivent partager un état temps réel complexe.

### 3.2 Pourquoi React Three Fiber

React Three Fiber permet :

- de conserver l’architecture React existante ;
- de piloter les objets 3D avec les mêmes données que `AccordionView` ;
- d’associer un bouton musical à un mesh Blender ;
- de gérer les événements de pointeur ;
- d’animer une pièce en fonction de propriétés React ;
- de charger un fichier GLB avec `useGLTF` ;
- de réutiliser les composants d’interface HTML autour du canvas.

La logique métier ne doit pas être placée dans Blender. Blender fournit la géométrie, les matériaux, les pivots, les rigs et les animations. React reste responsable de la pédagogie, des notes, des modes de jeu et des interactions.

### 3.3 WebGL et WebGPU

La première version doit fonctionner avec le moteur standard compatible WebGL de Three.js.

Ne pas rendre WebGPU obligatoire. L’application cible des navigateurs mobiles, des tablettes et une WebView Android Capacitor. La compatibilité est plus importante qu’un gain théorique de rendu.

WebGPU pourra être évalué plus tard pour :

- un soufflet procédural complexe ;
- des effets de déformation avancés ;
- des particules ou une visualisation du flux d’air ;
- des calculs de simulation.

## 4. Architecture applicative cible

Créer une séparation claire entre :

1. les données de l’accordéon ;
2. la logique musicale ;
3. la représentation 3D ;
4. les animations ;
5. les contrôles de caméra ;
6. le fallback accessible en HTML.

Structure indicative :

```text
src/
├── components/
│   ├── accordion/
│   │   ├── AccordionExperience.tsx
│   │   ├── Accordion3D.tsx
│   │   ├── AccordionHtmlFallback.tsx
│   │   ├── AccordionCamera.tsx
│   │   ├── AccordionLighting.tsx
│   │   ├── AccordionButton3D.tsx
│   │   ├── AccordionBellows3D.tsx
│   │   ├── AccordionAnnotations.tsx
│   │   └── accordion3d.types.ts
│   └── AccordionView.tsx
├── hooks/
│   ├── useAccordionModel.ts
│   ├── useAccordionAnimations.ts
│   └── useReducedMotion.ts
├── lib/
│   └── three/
│       ├── modelContract.ts
│       ├── modelValidation.ts
│       └── disposeScene.ts
└── assets/
    └── models/
        ├── accordion-club-i-lod0.glb
        ├── accordion-club-i-lod1.glb
        └── accordion-generic-lod1.glb
```

`AccordionExperience` devra choisir entre :

- la version 3D ;
- le fallback HTML actuel ;
- éventuellement une version simplifiée pour les appareils faibles.

## 5. Contrat entre Blender et JavaScript

Le point le plus important du projet est la stabilité du contrat de nommage. L’IA Blender ne doit pas choisir des noms arbitraires.

### 5.1 Convention générale

Tous les objets utilisés par JavaScript doivent avoir :

- un nom stable ;
- un pivot correct ;
- une transformation appliquée ;
- une fonction unique ;
- aucune dépendance à un numéro généré automatiquement par Blender.

Utiliser des noms ASCII, sans espaces ni accents.

Exemple de hiérarchie :

```text
AccordionRoot
├── Body_Left
│   ├── Case_Left
│   ├── Grille_Left
│   ├── Hardware_Left
│   ├── Strap_Left
│   └── BassButtons
│       ├── BassButton_B1
│       ├── BassButton_B2
│       └── ...
├── BellowsRoot
│   ├── Bellows_Frame_Left
│   ├── Bellows_Folds
│   ├── Bellows_Frame_Right
│   └── Bellows_Armature
├── Body_Right
│   ├── Case_Right
│   ├── Grille_Right
│   ├── Hardware_Right
│   ├── Strap_Right
│   └── MelodyButtons
│       ├── MelodyButton_R1_B01
│       ├── MelodyButton_R1_B02
│       ├── MelodyButton_R2_B01
│       └── ...
└── InteractionAnchors
    ├── Anchor_Camera_Player
    ├── Anchor_Camera_Front
    ├── Anchor_Camera_Left
    ├── Anchor_Camera_Right
    └── Anchor_Label_...
```

### 5.2 Correspondance avec les identifiants de Soufflet

Idéalement, le nom de chaque mesh interactif doit être déterminé à partir de l’identifiant présent dans `AccordionConfig`.

Exemple :

```text
AccordionConfig button id : R1-4
Nom Blender              : MelodyButton_R1_4
Identifiant applicatif    : R1-4
```

Éviter de coder la logique musicale dans les noms Blender. Le mesh doit seulement pointer vers l’identifiant applicatif.

Créer une fonction centralisée :

```ts
export function buttonIdToNodeName(buttonId: string): string {
  return `MelodyButton_${buttonId.replaceAll('-', '_')}`;
}
```

Pour les basses :

```ts
export function bassIdToNodeName(buttonId: string): string {
  return `BassButton_${buttonId.replaceAll('-', '_')}`;
}
```

La correspondance doit être validée automatiquement au chargement du GLB.

### 5.3 Métadonnées personnalisées

Lorsque cela améliore la robustesse, ajouter des propriétés personnalisées Blender exportées dans `extras` glTF :

```json
{
  "interactionType": "melody-button",
  "buttonId": "R1-4",
  "defaultDirection": "push"
}
```

Les noms restent nécessaires pour le debug, mais les métadonnées réduisent la dépendance à la chaîne de caractères.

## 6. Travail Blender à réaliser

Le modèle actuel est décrit comme trop basique. Il faut le reprendre comme un véritable asset temps réel, et non comme une simple maquette visuelle.

### 6.1 Références à réunir

Avant de modifier la géométrie :

- photographies avant, arrière, gauche, droite, dessus et dessous ;
- vues rapprochées du clavier, des basses, des ferrures et du soufflet ;
- dimensions principales ;
- nombre exact de boutons par rangée ;
- inclinaison et décalage des rangées ;
- diamètre et course des boutons ;
- largeur fermée et largeur ouverte du soufflet ;
- dimensions des plaques, coins, grilles et sangles ;
- références de matériaux ;
- photos avec une focale suffisamment longue pour limiter la déformation.

Pour le Hohner Club Modell I, prendre le modèle réel configuré dans Soufflet comme référence principale. Ne pas inventer une géométrie générique si des dimensions ou photos réelles peuvent être obtenues.

### 6.2 Échelle et orientation

Dans Blender :

- travailler à l’échelle réelle, de préférence en mètres ;
- définir `AccordionRoot` à l’origine ;
- choisir une convention d’axes compatible glTF ;
- appliquer rotation et échelle sur les meshes finis ;
- éviter les échelles négatives ;
- vérifier les normales ;
- conserver la position relative exacte des deux caisses.

Convention proposée :

- X : axe horizontal d’ouverture du soufflet ;
- Y : profondeur ;
- Z : hauteur ;
- origine : centre de l’accordéon fermé.

Le modèle doit s’ouvrir le long de X sans rotation parasite.

### 6.3 Décomposition de la géométrie

Séparer les éléments suivants :

- caisse gauche ;
- caisse droite ;
- panneaux décoratifs ;
- grilles ;
- plaques ;
- coins et ferrures ;
- boutons mélodiques ;
- boutons de basses ;
- registres ;
- sangles ;
- cadres du soufflet ;
- plis du soufflet ;
- éléments susceptibles d’être animés ;
- éventuels repères pédagogiques.

Ne pas joindre tous les boutons en un mesh unique si chaque bouton doit être animé ou cliqué séparément.

Pour limiter le coût :

- les boutons peuvent partager la même géométrie ;
- les éléments décoratifs répétés peuvent être instanciés ;
- les parties non interactives peuvent être regroupées raisonnablement.

### 6.4 Modélisation des caisses

Les caisses doivent comporter :

- volumes et proportions réalistes ;
- bords légèrement arrondis avec bevel ;
- épaisseur crédible ;
- panneaux avant et arrière ;
- jonctions avec le soufflet ;
- ferrures correctement positionnées ;
- détails lisibles à la distance normale de caméra ;
- aucun détail invisible inutilement modélisé.

Utiliser un bevel réel ou un bevel modifier contrôlé pour capter correctement la lumière. Les arêtes parfaitement vives donnent un rendu artificiel.

Prévoir une topologie propre autour :

- des ouvertures ;
- des grilles ;
- des coins ;
- des surfaces réfléchissantes ;
- des zones où les normales sont visibles.

### 6.5 Boutons mélodiques et basses

Chaque bouton interactif doit :

- être un objet distinct ou une instance distincte ;
- avoir son origine placée sur son axe mécanique ;
- s’enfoncer selon un axe local cohérent ;
- disposer d’une course réaliste ;
- ne pas traverser la caisse ;
- reprendre automatiquement sa position initiale ;
- pouvoir être surligné indépendamment ;
- correspondre à un identifiant de configuration.

Créer une collection de référence pour les boutons, puis utiliser des duplications liées si possible.

La course ne doit pas dépendre d’une animation Blender prédéfinie obligatoire. JavaScript doit pouvoir déplacer localement le bouton en temps réel.

Exemple :

```ts
button.position[pressAxis] = restPosition - pressDepth * progress;
```

Le pivot et l’axe local doivent rendre ce calcul identique pour tous les boutons d’un même type.

### 6.6 Registres et commandes secondaires

Préparer les registres comme objets séparés, même s’ils ne sont pas interactifs dans la première version.

Ils pourront servir plus tard à :

- modifier le timbre ;
- montrer la configuration de l’instrument ;
- guider une manipulation ;
- reproduire un modèle réel.

### 6.7 Soufflet

Le soufflet est l’élément le plus important et le plus difficile.

Il doit :

- s’ouvrir entre les deux caisses ;
- conserver des plis crédibles ;
- ne pas s’étirer comme un simple bloc élastique ;
- rester performant ;
- supporter une ouverture contrôlée continûment par JavaScript ;
- fonctionner en poussant et en tirant ;
- permettre une animation lente ou rapide ;
- éventuellement permettre un léger mouvement vertical ou angulaire plus tard.

#### Option recommandée : rig par armature

Créer :

- un os racine ;
- une chaîne d’os répartie dans la largeur du soufflet ;
- des poids réguliers ;
- des cadres gauche et droit rigides ;
- une déformation répartie sur les plis ;
- des contraintes empêchant les extrémités de se déformer.

Le paramètre JavaScript principal sera une ouverture normalisée :

```ts
bellowsAmount: number // de 0 à 1
```

Deux approches d’export sont possibles :

1. exporter une animation Blender `Bellows_Open` et piloter son temps depuis JavaScript ;
2. exporter l’armature et piloter directement les os.

Pour la première version, préférer une animation Blender propre, pilotée par le temps, car elle est plus facile à stabiliser.

#### Morph targets correctifs

Ajouter si nécessaire des shape keys pour :

- corriger les plis lorsque le soufflet est presque fermé ;
- éviter les intersections au milieu de la course ;
- maintenir les coins ;
- améliorer l’ouverture maximale.

Ne pas utiliser uniquement deux shape keys sur un soufflet détaillé si l’interpolation donne une apparence en caoutchouc.

#### Géométrie du soufflet

Le soufflet doit être optimisé :

- plis suffisamment définis pour la caméra principale ;
- géométrie régulière ;
- absence de faces internes inutiles ;
- normales cohérentes ;
- matériau séparé pour le tissu, les bandes et les coins ;
- possibilité de réduire le nombre de plis sur les LOD inférieurs.

### 6.8 Sangles

Les sangles doivent être séparées et visuellement crédibles.

Pour la première version :

- géométrie statique ;
- courbure naturelle ;
- épaisseur limitée ;
- matériau cuir ou textile.

Une simulation physique en temps réel n’est pas prioritaire. Elle serait coûteuse et peu utile pédagogiquement.

### 6.9 Grilles et détails

Ne pas modéliser chaque perforation si elle peut être représentée avec :

- normal map ;
- alpha mask ;
- texture ;
- grille simplifiée.

Les grands motifs caractéristiques peuvent être modélisés. Les micro-détails doivent être texturés.

### 6.10 UV

Créer des UV propres :

- pas de chevauchement involontaire ;
- texel density homogène ;
- îlots adaptés aux surfaces visibles ;
- espace réservé aux logos et ornements ;
- deuxième canal UV uniquement si nécessaire ;
- marges suffisantes pour les mipmaps.

Les éléments identiques peuvent partager les mêmes UV.

### 6.11 Matériaux PBR

Utiliser des matériaux compatibles avec glTF :

- Principled BSDF ;
- Base Color ;
- Metallic ;
- Roughness ;
- Normal ;
- Ambient Occlusion si nécessaire ;
- Emissive uniquement pour les éléments réellement lumineux ;
- Transmission et shaders Blender complexes à éviter sauf test d’export concluant.

Matériaux attendus :

```text
MAT_Wood_or_Celluloid
MAT_Bellows_Fabric
MAT_Bellows_Edge
MAT_Metal_Dark
MAT_Metal_Chrome
MAT_Button_Pearl
MAT_Leather
MAT_Grille
MAT_Label
```

Réduire le nombre total de matériaux. Trop de matériaux augmentent les draw calls.

Pour la nacre ou le celluloïd :

- base color subtile ;
- roughness contrôlée ;
- normal map légère ;
- éventuellement clearcoat ;
- éviter un matériau miroir parfait.

### 6.12 Textures

Préférer :

- 2K pour le modèle principal sur appareils puissants ;
- 1K ou textures regroupées pour mobile ;
- atlases lorsque pertinent ;
- formats compressés KTX2/Basis après export ;
- normal maps avec intensité raisonnable.

Ne pas intégrer des textures 4K multiples sans justification. L’application doit rester fluide dans une WebView mobile.

### 6.13 Éclairage de validation Blender

Créer dans Blender une scène de validation indépendante :

- éclairage studio neutre ;
- HDRI facultatif ;
- vues avant et musicien ;
- fond simple ;
- caméra avec focale réaliste ;
- aucune lumière nécessaire à l’asset final si elle appartient à la scène d’application.

L’éclairage final doit rester géré dans Three.js. Les lumières de Blender ne doivent pas être considérées comme une dépendance implicite du modèle.

### 6.14 Animations Blender à prévoir

Animations minimales :

```text
Bellows_Open
Bellows_Close
MelodyButton_Test
BassButton_Test
Register_Test
```

`Bellows_Open` doit être une animation propre, sans mouvement des caisses non désiré.

Les animations de boutons peuvent seulement servir de test. En production, les boutons seront probablement animés directement en JavaScript afin de répondre instantanément aux événements musicaux.

### 6.15 Niveaux de détail

Préparer au moins :

- **LOD0** : modèle principal tablette/ordinateur ;
- **LOD1** : modèle mobile standard ;
- **LOD2** facultatif : aperçu, écran éloigné ou appareil faible.

Les LOD doivent conserver les mêmes noms d’objets interactifs.

Exemple de budgets indicatifs, à valider par mesure :

```text
LOD0 : 100 000 à 200 000 triangles maximum
LOD1 : 40 000 à 80 000 triangles
LOD2 : 15 000 à 30 000 triangles
```

Ces chiffres ne sont pas des objectifs à remplir. Le modèle doit rester aussi léger que possible sans perte visuelle notable.

### 6.16 Export glTF/GLB

Exporter en `.glb`.

Paramètres à contrôler :

- uniquement les objets nécessaires ;
- transformations appliquées ;
- animations incluses ;
- shape keys incluses si utilisées ;
- matériaux compatibles glTF ;
- propriétés personnalisées incluses si utilisées ;
- aucune caméra de travail inutile ;
- aucune lumière de travail inutile ;
- aucun objet caché exporté ;
- aucun mesh de référence ;
- noms d’objets conservés.

Créer un script Blender reproductible d’export plutôt que dépendre d’une série de clics manuels.

Exemple de fichier :

```text
blender/scripts/export_accordion.py
```

Le script doit :

1. valider les objets obligatoires ;
2. vérifier les noms en double ;
3. vérifier les transformations ;
4. vérifier l’existence des boutons attendus ;
5. exporter le GLB ;
6. produire un rapport ;
7. échouer explicitement si le contrat n’est pas respecté.

## 7. Intégration React Three Fiber

### 7.1 Chargement du modèle

Créer un composant :

```tsx
function Accordion3D(props: Accordion3DProps) {
  const gltf = useGLTF('/models/accordion-club-i-lod1.glb');

  return (
    <group>
      <primitive object={gltf.scene} />
    </group>
  );
}
```

Ne pas muter directement une scène partagée par `useGLTF` si plusieurs instances peuvent exister. Cloner correctement la scène lorsque nécessaire.

Précharger le modèle :

```ts
useGLTF.preload('/models/accordion-club-i-lod1.glb');
```

### 7.2 Génération de composants typés

Évaluer `gltfjsx` pour générer une première représentation JSX typée du modèle.

Cependant :

- ne pas accepter aveuglément un fichier généré très volumineux ;
- ne pas figer les matériaux et nœuds dans une structure impossible à maintenir ;
- conserver une couche de mapping stable ;
- régénérer seulement lorsque le contrat Blender change.

### 7.3 Animation des boutons

Construire au chargement une table :

```ts
const buttonNodes = new Map<string, THREE.Object3D>();
```

Puis utiliser les identifiants de `AccordionConfig`.

L’animation doit :

- démarrer rapidement ;
- être indépendante du framerate ;
- gérer plusieurs boutons simultanés ;
- revenir naturellement ;
- respecter `prefers-reduced-motion` lorsque pertinent ;
- ne pas déclencher un rendu React complet à chaque frame.

Utiliser `useFrame` et des références Three.js pour les transitions continues.

Pseudo-code :

```ts
useFrame((_, delta) => {
  for (const state of animatedButtons.values()) {
    state.progress = damp(
      state.progress,
      state.pressed ? 1 : 0,
      state.pressed ? 35 : 18,
      delta,
    );

    state.node.position.copy(state.restPosition);
    state.node.position.addScaledVector(state.pressAxis, -PRESS_DEPTH * state.progress);
  }
});
```

### 7.4 Animation du soufflet

L’application doit exposer deux notions distinctes :

```ts
direction: 'push' | 'pull';
bellowsAmount: number;
```

`direction` ne suffit pas à représenter la position. Actuellement, le soufflet semble être considéré comme ouvert lorsque la direction est `pull`. La future 3D doit permettre :

- de tirer tout en partant d’une position presque fermée ;
- de pousser tout en partant d’une position ouverte ;
- de suivre une courbe continue ;
- de représenter un exercice de contrôle du soufflet.

Pour la compatibilité initiale :

```ts
const fallbackBellowsAmount = direction === 'pull' ? 1 : 0;
```

Puis faire évoluer le moteur pédagogique pour fournir une valeur continue.

Si une animation glTF `Bellows_Open` existe :

```ts
action.paused = true;
action.time = bellowsAmount * action.getClip().duration;
mixer.update(0);
```

Ne pas jouer automatiquement l’animation en boucle.

### 7.5 Interaction de pointeur

Les boutons doivent réagir à :

- `pointerdown` ;
- `pointerup` ;
- `pointerleave` ;
- touch ;
- souris ;
- stylet.

La caméra ne doit pas tourner lorsqu’un utilisateur tente de jouer un bouton.

Prévoir :

- arrêt de propagation sur les boutons ;
- désactivation temporaire des contrôles de caméra ;
- seuil de déplacement pour distinguer clic et rotation ;
- retour haptique Capacitor lorsque disponible ;
- zones interactives légèrement plus larges que le mesh visible si nécessaire.

### 7.6 Surbrillance pédagogique

La surbrillance ne doit pas nécessiter un matériau distinct permanent par bouton.

Options :

- cloner seulement les matériaux des boutons actifs ;
- utiliser une propriété emissive ;
- ajouter un halo ou un anneau ;
- afficher une annotation HTML avec Drei `Html` ;
- ajouter un mesh de sélection instancié.

États à gérer :

```ts
type ButtonVisualState =
  | 'idle'
  | 'expected'
  | 'active'
  | 'detected'
  | 'correct'
  | 'incorrect'
  | 'disabled';
```

La couleur seule ne doit pas être l’unique signal. Ajouter une forme, un halo, une pulsation modérée ou un libellé.

### 7.7 Caméras

Prévoir plusieurs points de vue :

- **musicien** : vue principale depuis le joueur ;
- **face** : compréhension générale ;
- **main droite** : apprentissage des boutons mélodiques ;
- **main gauche** : basses ;
- **soufflet** : exercice pousser/tirer ;
- **inspection libre** : facultatif.

Le point de vue musicien doit être prioritaire, car l’application actuelle est pensée du point de vue de l’instrumentiste.

Les transitions de caméra doivent être animées, mais courtes et désactivables.

### 7.8 Éclairage Three.js

Scène de base :

- une lumière principale douce ;
- une lumière de remplissage ;
- une lumière arrière légère ;
- environnement HDRI optimisé ou `Environment` de Drei ;
- ombres limitées et configurables ;
- contact shadow léger sur les vues de présentation.

Sur mobile, prévoir un mode sans ombres dynamiques.

### 7.9 Fond et interface

Le canvas 3D doit rester intégré dans l’interface existante :

- texte et contrôles en DOM ;
- bannières pédagogiques en DOM ;
- canvas pour l’instrument ;
- overlays accessibles ;
- aucune information critique uniquement dans la 3D.

Le composant 3D ne doit pas remplacer les contrôles de lecteur, les réglages ou la tablature.

## 8. Accessibilité et fallback

Conserver une alternative accessible.

Le canvas doit fournir une description générale, mais les boutons 3D ne remplacent pas correctement des boutons HTML pour les lecteurs d’écran.

Conserver ou créer une couche de contrôle accessible :

- liste de boutons HTML hors canvas ou superposée ;
- libellés ARIA ;
- navigation clavier ;
- indication pousser/tirer textuelle ;
- respect de `prefers-reduced-motion`;
- fallback complet si WebGL échoue.

L’ancien `AccordionView` peut devenir `AccordionHtmlFallback`.

## 9. Performance Web et Android

### 9.1 Objectifs

L’application doit viser :

- 60 FPS sur tablette récente ;
- minimum acceptable de 30 FPS sur appareil intermédiaire ;
- interaction bouton-son sans latence perceptible ;
- chargement progressif ;
- absence de blocage du thread principal.

### 9.2 Optimisations obligatoires

- GLB compressé ;
- Meshopt ou Draco selon les résultats mesurés ;
- textures KTX2 ;
- nombre limité de matériaux ;
- nombre limité de lumières ;
- ombres configurables ;
- aucun calcul React par frame ;
- géométrie partagée pour les boutons ;
- LOD adapté ;
- chargement différé de la 3D ;
- placeholder pendant le chargement ;
- libération explicite des ressources si la scène est démontée.

Tester dans :

- Chrome desktop ;
- Firefox ;
- Safari récent ;
- Chrome Android ;
- WebView Capacitor Android ;
- tablette en paysage ;
- appareil avec GPU modeste.

### 9.3 Budget de téléchargement

Définir un budget mesuré, par exemple :

```text
GLB LOD1 compressé        : cible < 5 Mo
Textures compressées      : cible < 5 Mo
Total initial de la scène : cible < 8 à 10 Mo
```

Ce budget doit être ajusté à partir de tests réels. Une expérience d’apprentissage ne doit pas imposer un téléchargement initial excessif.

## 10. Validation automatique du modèle

Créer un validateur Node ou TypeScript exécuté en CI.

Il doit vérifier :

- présence de `AccordionRoot` ;
- présence des caisses ;
- présence du soufflet ;
- présence des animations obligatoires ;
- existence de chaque bouton requis pour le modèle ;
- absence de nom en double ;
- taille du fichier ;
- nombre de triangles ;
- nombre de matériaux ;
- résolution maximale des textures ;
- absence de texture non embarquée ;
- absence de référence externe ;
- conformité des métadonnées.

Exemple :

```bash
npm run validate:model
```

Ajouter au pipeline :

```bash
npm run typecheck
npm run lint
npm test
npm run validate:model
npm run build
```

Créer également une page de test interne :

```text
/dev/accordion-3d
```

Elle doit permettre :

- de déplacer `bellowsAmount` avec un slider ;
- de tester chaque bouton ;
- de lister les nœuds inconnus ;
- de changer de caméra ;
- d’afficher les axes et bounding boxes ;
- de mesurer les FPS ;
- de changer de LOD ;
- d’activer ou désactiver les ombres.

## 11. Workflow Blender MCP attendu

L’agent Blender MCP doit travailler par étapes vérifiables.

### Étape 1 — Audit

Produire un rapport sur :

- objets existants ;
- collections ;
- dimensions ;
- orientation ;
- nombre de faces ;
- matériaux ;
- UV ;
- transformations ;
- objets joints à tort ;
- détails manquants ;
- aptitude actuelle à l’animation.

Ne pas commencer par ajouter des détails sans comprendre la structure existante.

### Étape 2 — Restructuration

- créer les collections ;
- définir `AccordionRoot` ;
- séparer les parties interactives ;
- normaliser les noms ;
- corriger l’échelle ;
- appliquer les transformations ;
- placer les pivots ;
- sauvegarder une version intermédiaire.

### Étape 3 — Amélioration géométrique

- corriger les proportions ;
- ajouter les épaisseurs ;
- créer les bevels ;
- détailler les grilles, plaques et ferrures ;
- améliorer les boutons ;
- corriger la silhouette ;
- éviter les détails invisibles.

### Étape 4 — Soufflet

- reconstruire ou nettoyer les plis ;
- créer l’armature ;
- peser les sommets ;
- créer l’animation d’ouverture ;
- vérifier les intersections ;
- tester plusieurs ouvertures.

### Étape 5 — Matériaux et UV

- nettoyer les UV ;
- créer les matériaux PBR ;
- réduire le nombre de matériaux ;
- créer ou appliquer les textures ;
- tester l’export glTF.

### Étape 6 — Contrat interactif

- renommer tous les objets ;
- ajouter les propriétés personnalisées ;
- vérifier les pivots ;
- créer les animations de test ;
- générer un manifeste des nœuds.

### Étape 7 — Optimisation

- supprimer les faces invisibles ;
- simplifier les détails ;
- créer les LOD ;
- packer les textures ;
- vérifier les normales ;
- réduire la taille.

### Étape 8 — Export et contrôle

- exécuter le script d’export ;
- charger le GLB dans un viewer glTF ;
- tester dans la page React Three Fiber ;
- corriger les différences de matériaux ;
- vérifier les animations ;
- produire le rapport final.

Après chaque étape, l’agent doit sauvegarder le `.blend` et fournir un résumé factuel des modifications.

## 12. Manifest de modèle

Générer avec l’export un manifest JSON :

```json
{
  "model": "hohner-club-i",
  "version": 1,
  "unit": "meter",
  "rootNode": "AccordionRoot",
  "animations": {
    "bellowsOpen": "Bellows_Open"
  },
  "nodes": {
    "leftBody": "Body_Left",
    "rightBody": "Body_Right",
    "bellows": "BellowsRoot"
  },
  "buttons": {
    "R1-1": "MelodyButton_R1_1",
    "R1-2": "MelodyButton_R1_2"
  },
  "basses": {
    "B1": "BassButton_B1"
  }
}
```

Cela permet :

- de détecter les changements de noms ;
- de tester la complétude ;
- de versionner le contrat ;
- de supporter plusieurs modèles d’accordéon.

## 13. Prise en charge de plusieurs accordéons

Ne pas supposer que tous les accordéons partagent exactement la même géométrie.

Créer deux niveaux :

1. un modèle 3D précis pour les instruments explicitement supportés ;
2. un modèle générique paramétrable ou un fallback HTML pour les autres.

Le Hohner Club I peut être la première implémentation précise.

Interface proposée :

```ts
interface Accordion3DAssetDefinition {
  id: string;
  maker: string;
  modelMatcher: RegExp;
  glbUrl: string;
  manifestUrl: string;
  lods?: {
    high?: string;
    medium?: string;
    low?: string;
  };
}
```

`getAccordionVisualVariant` pourra évoluer vers un registre d’assets plutôt qu’un simple choix `club-i` ou `classic`.

## 14. Plan d’implémentation recommandé

### Phase 1 — Infrastructure sans changement visuel majeur

- installer Three.js, React Three Fiber et Drei ;
- créer une page de test 3D ;
- charger un cube puis le GLB actuel ;
- définir le contrat de nommage ;
- créer le validateur ;
- conserver `AccordionView` en production.

### Phase 2 — Instrument statique

- afficher le modèle Blender ;
- ajouter caméra, éclairage et responsive ;
- vérifier Web et Android ;
- implémenter le fallback ;
- mesurer performances et poids.

### Phase 3 — Boutons interactifs

- mapper les identifiants applicatifs aux nœuds Blender ;
- animer l’enfoncement ;
- déclencher `playMidi` ;
- afficher active, detected et expected ;
- gérer touch et haptique.

### Phase 4 — Soufflet animé

- importer `Bellows_Open` ;
- créer `bellowsAmount` ;
- conserver le fallback fondé sur `direction` ;
- synchroniser l’animation avec les modes guidés ;
- tester les transitions rapides.

### Phase 5 — Caméras pédagogiques

- vue musicien ;
- focus main droite ;
- focus main gauche ;
- annotations ;
- transitions ;
- mode mouvement réduit.

### Phase 6 — Qualité et optimisation

- textures finales ;
- LOD ;
- compression ;
- CI de validation ;
- tests visuels ;
- tests de performance ;
- activation progressive dans l’application principale.

## 15. Critères d’acceptation

La première version 3D est acceptable si :

- le Hohner Club I est reconnaissable et correctement proportionné ;
- tous les boutons configurés sont présents et correctement mappés ;
- chaque bouton peut être pressé indépendamment ;
- la pression déclenche la même logique audio que la vue actuelle ;
- le bouton actif, détecté et attendu est identifiable ;
- le soufflet peut être piloté par une valeur continue de 0 à 1 ;
- le modèle est lisible depuis le point de vue du musicien ;
- le rendu reste fluide sur tablette et Android ;
- le fallback HTML reste fonctionnel ;
- le GLB est validé automatiquement ;
- l’export Blender est reproductible ;
- les matériaux ne cassent pas entre Blender et Three.js ;
- aucun nom de nœud interactif ne dépend d’un suffixe Blender automatique ;
- la fonctionnalité peut être désactivée par feature flag.

## 16. Éléments à ne pas faire

- Ne pas supprimer immédiatement la vue HTML actuelle.
- Ne pas coder les notes MIDI directement dans Blender.
- Ne pas utiliser un mesh unique pour tous les boutons interactifs.
- Ne pas animer les boutons uniquement avec des clips Blender.
- Ne pas lier l’ouverture du soufflet exclusivement à `push` ou `pull`.
- Ne pas exporter un fichier Blender brut sans validation glTF.
- Ne pas utiliser des shaders Blender non compatibles glTF sans fallback.
- Ne pas multiplier les textures 4K.
- Ne pas rendre les ombres dynamiques obligatoires.
- Ne pas créer une simulation physique complète du soufflet avant d’avoir une animation contrôlée fiable.
- Ne pas masquer les problèmes de structure derrière davantage de détails visuels.
- Ne pas utiliser l’IA de génération 3D comme source finale sans nettoyage manuel ou procédural dans Blender.

## 17. Usage de l’IA

L’IA peut aider à :

- analyser les photos de référence ;
- proposer une décomposition des pièces ;
- générer des scripts Blender Python ;
- automatiser le renommage ;
- créer des matériaux de départ ;
- contrôler les dimensions ;
- produire les LOD ;
- vérifier le contrat ;
- écrire les composants React Three Fiber ;
- générer les tests.

L’IA ne doit pas être considérée comme fiable sans contrôle pour :

- les dimensions mécaniques ;
- la topologie ;
- les pivots ;
- le rig du soufflet ;
- les UV ;
- les licences de textures ;
- le mapping exact des boutons ;
- la performance mobile.

Le MCP Blender doit être utilisé comme un outil d’automatisation contrôlé. Chaque modification importante doit être inspectable, reproductible et sauvegardée.

## 18. Livrables attendus

### Blender

```text
blender/
├── accordion-club-i.blend
├── references/
├── scripts/
│   ├── validate_scene.py
│   └── export_accordion.py
└── reports/
    └── model-audit.md
```

### Application

```text
public/models/
├── accordion-club-i-lod0.glb
├── accordion-club-i-lod1.glb
├── accordion-club-i-lod2.glb
└── accordion-club-i.manifest.json
```

### Code

- composants React Three Fiber ;
- mapping des boutons ;
- contrôleur du soufflet ;
- contrôleur de caméra ;
- page de debug ;
- fallback ;
- validateur de modèle ;
- tests ;
- documentation du contrat Blender/JavaScript.

## 19. Priorité immédiate

La prochaine action ne doit pas être l’intégration directe du modèle basique dans la vue principale.

Ordre immédiat recommandé :

1. auditer le fichier Blender actuel ;
2. définir l’échelle, les axes et la hiérarchie ;
3. séparer toutes les pièces interactives ;
4. normaliser les noms et pivots ;
5. reconstruire correctement le soufflet ;
6. améliorer les volumes et proportions ;
7. créer un premier export GLB contractuel ;
8. créer une page de test React Three Fiber ;
9. valider les boutons et le soufflet ;
10. seulement ensuite travailler les matériaux et la finition détaillée.

La priorité est d’obtenir un modèle correctement structuré et animable. Un modèle visuellement détaillé mais mal découpé, mal nommé ou impossible à piloter serait à refaire.
