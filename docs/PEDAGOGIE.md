# Pédagogie

## Principes retenus

1. **Action avant théorie** : le premier succès consiste à ouvrir, fermer puis jouer quelques notes. Le vocabulaire musical arrive au moment où il sert l’action.
2. **Une difficulté nouvelle** : bouton, direction, note, rythme, enchaînement, doigté, soufflet, basses, coordination, nuances, tempo puis interprétation.
3. **Retour précis** : hauteur, bouton, direction, avance/retard, durée et coordination sont des dimensions distinctes. L’interface formule une correction et l’action suivante.
4. **Pratique distribuée** : les gestes fragiles reviennent tôt ; les gestes maîtrisés sont espacés. Une séance courte alterne rappel, nouveauté, application et mini-performance.
5. **Démonstration puis retrait de l’aide** : démonstration, guidage, attente de la bonne note, boucle ralentie, puis performance sans repères.

Chaque nouveau départ peut être précédé d’une mesure de décompte adaptée à la signature rythmique. Une reprise après pause repart immédiatement. Après validation de la dernière note, toute la phrase passe à l’état accompli et le microphone s’arrête ; `Commencer` ou `Espace` relance ensuite le morceau depuis le début en une seule action. La tablature recentre progressivement la note active pour rester lisible à distance sans demander d’action manuelle.

L’interface expose quatre modes principaux seulement : démonstration, lecture guidée, attente de la bonne note et performance. La partie de l’instrument est un réglage orthogonal — mélodie, basses ou deux mains — qui reconstruit la frise à partir des événements réellement disponibles. Les exercices de rythme et de soufflet restent des ateliers ciblés, accessibles sans être imposés pendant la découverte. Le jeu des touches est un accès principal au même titre que le parcours et la bibliothèque.

## Premier tutoriel instrument en main

La première leçon réutilise les composants et le vocabulaire de la future interface d’entraînement. Elle ne présente que les quatre modes principaux et fait vivre leur progression dans l’ordre : observer en démonstration, rejouer trois notes en lecture guidée, avancer note par note dans une mini-mélodie, puis rappeler trois notes sans aide visuelle en performance.

- les exercices actifs se réalisent sur l’accordéon ; le dessin ne valide un clic qu’en solution de repli si le microphone est indisponible ;
- après les trois premières notes justes, une animation confirme la réussite, le microphone est arrêté et le tutoriel passe automatiquement à la suite ;
- le mode « attendre la bonne note » emploie une phrase de sept notes inspirée du début d’« Au clair de la lune » et ignore volontairement le rythme ;
- la frise, le clavier, la direction de soufflet et le conseil contextuel sont ceux que l’élève retrouvera ensuite en séance ;
- démonstration et lecture guidée sont considérées comme expérimentées dans les deux premières étapes ; attente et performance doivent être réellement réussies avant de continuer.

Le tutoriel ne prétend pas déduire la direction mécanique du soufflet à partir du son seul : la hauteur valide la note tandis que le mouvement pousser/tirer reste indiqué explicitement. Aucun son brut n’est conservé.

## Défi des touches

Le jeu de mémorisation transforme la lecture verticale en anticipation motrice, sans introduire toutes les difficultés à la fois :

- niveau 1 : trois boutons centraux de l’accordéon configuré, uniquement en poussant et à tempo lent ;
- niveau 2 : les mêmes repères avec alternance pousser/tirer ;
- niveau 3 : cinq boutons et une fenêtre rythmique plus précise.

La direction utilise simultanément une flèche, un verbe, une lettre et une forme de tuile. Au micro, l’app évalue la hauteur et l’écart temporel, mais ne prétend pas déduire la direction mécanique du soufflet à partir du son seul. Le mode tactile de repli vérifie le bouton et la direction choisis ; son temps est enregistré, mais ses réussites ne gonflent pas les statistiques de précision micro.

La recherche sur l’apprentissage moteur musical montre que l’alternance et l’espacement peuvent réduire l’aisance ressentie pendant la séance tout en améliorant la rétention. L’app ne doit donc pas optimiser seulement le score immédiat. Référence : [Optimizing Music Learning: Blocked and Interleaved Practice](https://pmc.ncbi.nlm.nih.gov/articles/PMC4989027/).

## Vérification de l’instrument

L’accordeur sépare la mesure acoustique de la cartographie. La dernière hauteur fiable reste visible pendant que l’utilisateur sélectionne un bouton, mais elle n’est jamais enregistrée automatiquement dans la configuration.

Le parcours ordonne chaque bouton en deux gestes : pousser, puis tirer. Une note conforme peut être validée avant de continuer ; une note différente demande une correction explicite, crée si nécessaire une configuration personnelle et avance ensuite vers le geste suivant. Le bouton courant reçoit un contour distinct de la détection audio, et un sélecteur textuel garantit l’accès aux rangs intérieurs sur les petits écrans.

## Modèle adaptatif prévu

Chaque tentative produit des observations :

```text
compétence + difficulté + exactitude + latence + stabilité + contexte
```

Le planificateur calculera la prochaine date de révision par compétence, pas seulement par morceau. Une maîtrise n’est validée qu’après des réussites espacées, dans au moins deux contextes et avec une aide réduite. Les doigtés et stratégies de soufflet restent modifiables : il existe souvent plusieurs solutions musicales valables.

## Progression complète

- Niveau 1 : repérage, pousser/tirer, trois à cinq notes ;
- Niveau 2 : pulsation, valeurs simples, petits enchaînements ;
- Niveau 3 : doigtés, préparation du doigt suivant, changements de soufflet ;
- Niveau 4 : basses et accords isolés ;
- Niveau 5 : coordination des mains et motifs de danse ;
- Niveau 6 : phrasé, nuances et contrôle d’air ;
- niveaux suivants : tempo progressif, tonalités, ornements, répertoire et interprétation.

## Suivi professeur

Le mode professeur prévu partagera une version figée de l’exercice, les dimensions d’erreur et des commentaires horodatés, sans exposer d’enregistrement brut par défaut. L’élève contrôlera chaque partage.
