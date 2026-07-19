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

Le tutoriel ne prétend pas déduire la direction mécanique du soufflet à partir du son seul : la hauteur valide la note tandis que le mouvement pousser/tirer reste indiqué explicitement. Aucun son brut n’est conservé. Dans l’accordeur, seules les mesures numériques explicitement validées sont archivées avec le compte pour conserver le diagnostic et permettre son export.

## Défi des touches

Le jeu de mémorisation transforme la lecture verticale en anticipation motrice, sans introduire toutes les difficultés à la fois :

- niveau 1 : trois boutons centraux de l’accordéon configuré, uniquement en poussant et à tempo lent ;
- niveau 2 : les mêmes repères avec alternance pousser/tirer ;
- niveau 3 : cinq boutons et une fenêtre rythmique plus précise.

La direction utilise simultanément une flèche, un verbe, une lettre et une forme de tuile. Au micro, l’app évalue la hauteur et l’écart temporel, mais ne prétend pas déduire la direction mécanique du soufflet à partir du son seul. Le mode tactile de repli vérifie le bouton et la direction choisis ; son temps est enregistré, mais ses réussites ne gonflent pas les statistiques de précision micro.

La recherche sur l’apprentissage moteur musical montre que l’alternance et l’espacement peuvent réduire l’aisance ressentie pendant la séance tout en améliorant la rétention. L’app ne doit donc pas optimiser seulement le score immédiat. Référence : [Optimizing Music Learning: Blocked and Interleaved Practice](https://pmc.ncbi.nlm.nih.gov/articles/PMC4989027/).

## Vérification de l’instrument

L’accordeur sépare la mesure acoustique de la cartographie. La dernière hauteur fiable reste visible pendant que l’utilisateur sélectionne un bouton, mais elle n’est jamais enregistrée automatiquement dans la configuration. Une validation archive la fréquence, l’écart en cents, la confiance et le geste dans une campagne liée au compte. L’export JSON contient cette campagne et un instantané complet de la cartographie, y compris lorsqu’aucun ancien relevé fin n’est disponible.

Le parcours ordonne chaque bouton en deux gestes : pousser, puis tirer. Une note conforme peut être validée avant de continuer ; une note différente demande une correction explicite, crée si nécessaire une configuration personnelle et avance ensuite vers le geste suivant. Le bouton courant reçoit un contour distinct de la détection audio, et un sélecteur textuel garantit l’accès aux rangs intérieurs sur les petits écrans.

## Respiration et stratégie de soufflet

Chercher le plus petit nombre possible de changements de direction n’est pas une règle universelle. Le **poussé-tiré** exploite les changements pour articuler la pulsation et donner du rebond ; le **jeu croisé** cherche des notes alternatives sur plusieurs rangées pour lier une phrase. Les deux techniques font partie de l’apprentissage professionnel, aux côtés d’exercices dédiés à la soupape et à la gestion d’air ([cours Organetto](https://www.organetto.name/corso_base_eng.htm), [sommaire de la méthode Florence Pinvidic](https://www.florencepinvidic.com/fichiers/methode_sommaire.pdf)).

Le principe commun est de préparer le soufflet comme une respiration : commencer avec une marge des deux côtés, anticiper les phrases, et placer si possible les changements ou reprises d’air à une articulation musicale. Plusieurs enseignants décrivent des plans réguliers de deux à quatre mesures, sans changement au milieu d’une phrase liée, et une ouverture en arc plutôt qu’une translation rigide ([recherche pédagogique de Kaat Vanhaverbeke](https://www.researchcatalogue.net/view/1465318/1715577)). La soupape sert à ouvrir ou fermer le soufflet sans produire de note ; elle permet donc un recentrage silencieux avant la phrase suivante ([fiche instrumentale du COMDT](https://maleta.occitanica.eu/files/13261/original/comdt-acordeon-accordeon_oc-fr.pdf)).

Soufflet applique ces conclusions avec un planificateur sur le morceau entier :

- **Équilibré** conserve une réserve confortable et place les respirations aux limites de phrases ;
- **Poussé-tiré** accepte davantage de changements de direction et limite les sauts de rangée ;
- **Jeu croisé** favorise la continuité du sens et accepte davantage d’alternatives entre rangées ;
- la quantité d’air consommée dépend de la durée et augmente lorsque l’accompagnement main gauche est actif ;
- une soupape n’est proposée qu’à une frontière de phrase ou un silence, jamais arbitrairement au milieu d’une note ;
- une tablature vérifiée manuellement reste prioritaire et n’est pas réécrite par l’optimiseur.

La jauge de réserve, le mouvement 2D/3D et la tablature utilisent le même plan. La position affichée reste une estimation pédagogique : sans capteur physique, le microphone seul ne peut pas connaître l’ouverture réelle du soufflet. L’élève apprend donc où respirer et pourquoi, sans que l’interface prétende mesurer un état mécanique invisible.

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
