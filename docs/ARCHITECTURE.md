# Architecture et sécurité

## Vue d’ensemble

```text
Navigateur React
├── moteur de lecture Web Audio à échantillons réels
├── détection monophonique locale par autocorrélation
├── analyse harmonique locale des basses et accords
├── préférences et autosauvegarde locale
└── API HTTPS
    ├── configurations d’accordéons (SQLite)
    ├── comptes et sessions opaques (SQLite)
    ├── séances, agrégats et profils acoustiques compacts (SQLite)
    ├── bibliothèque commune licenciée (SQLite)
    ├── parseur de tablature déterministe
    └── transcription multimodale Gemini
```

Le front est construit par Vite. Express sert l’API et le build statique en production. SQLite utilise le module natif `node:sqlite`, le journal WAL et un volume Docker persistant. Les migrations sont enregistrées dans `schema_migrations`. Les configurations et morceaux intégrés sont réappliqués de façon idempotente ; les configurations personnelles portent un propriétaire et ne sont jamais écrasées par un seed.

## Rendu de l’instrument

`AccordionInstrument` constitue la frontière unique entre les écrans pédagogiques et la représentation de l’instrument. Pour un Hohner Club I compatible, il charge paresseusement le moteur React Three Fiber et le GLB ; pour tout autre modèle, WebGL indisponible ou erreur de chargement, il rend `AccordionView`. Le paquet Three.js et le modèle de 1,7 Mo restent donc hors du bundle initial et ne sont téléchargés que lorsqu’ils sont utiles.

Les deux moteurs consomment le même `AccordionConfig`, le même `SongEvent` et le même plan de soufflet. Les identifiants du contrat glTF correspondent directement aux boutons SQLite. Les états « suggéré », « enfoncé », « détecté par le micro » et « sélectionné dans l’accordeur » sont calculés séparément ; cette distinction empêche une touche seulement attendue d’apparaître déjà jouée. Une pression dans le canevas ou son clavier DOM accessible traverse la même fonction que la vue HTML et joue la même banque d’échantillons.

La rotation et le zoom sont désactivés dans l’application pour préserver la coordination spatiale et le défilement tactile. Ils restent disponibles dans `/dev/accordion-3d`. Les dimensions sont définies par contexte (tutoriel, lecteur, studio, accordeur, réglages) et par breakpoint ; le canevas adapte ensuite sa caméra à la surface réellement mesurée.

## Android

La cible Android est une coque Capacitor native qui charge exclusivement l’origine HTTPS de production. Ce choix conserve les cookies de session en contexte propriétaire, évite un second système d’authentification et rend immédiatement disponibles les mêmes données sur le web, le téléphone et la tablette. Le socle commun fournit le microphone, le maintien de l’écran, la barre d’état, le retour système et les retours haptiques. Sur Android 15 et versions ultérieures, `SystemBars` injecte les insets réels de la barre d’état, de la navigation gestuelle et des découpes d’écran ; les surfaces interactives les consomment via les variables CSS `--safe-area-inset-*`.

Le front détecte `Capacitor.getPlatform() === 'android'` pour activer la navigation basse, les zones sûres et le mode entraînement immersif. Les liens externes quittent la WebView dans un onglet système. Seul `soufflet.robin-joseph.fr` est autorisé dans la navigation interne et les connexions HTTP non chiffrées sont refusées.

Le flavor `github` ajoute l’autorisation d’installer un paquet et `SouffletUpdaterPlugin`. Celui-ci accepte uniquement une URL HTTPS sur `github.com` et un nom `soufflet-android-vX.Y.Z.apk`. Android contrôle ensuite que la signature de la mise à jour correspond à celle de l’application installée. L’identifiant DownloadManager en cours est conservé dans les préférences natives : si Android recrée l’activité ou si Soufflet redémarre pendant le téléchargement, l’installation reprend dès que l’APK est prêt. Le flavor `play`, construit en AAB, ne compile ni ce plugin ni cette autorisation : les mises à jour sont entièrement confiées à Google Play. `SouffletDistributionPlugin` expose le canal au front afin qu’il n’interroge jamais GitHub dans la version Play. Un repli explicite vers `github` préserve la mise à jour des APK antérieurs à cette séparation.

## Audio local

Les sons produits par l’application utilisent la banque **Button Accordion HN** de FreePats : 17 notes stéréo enregistrées sur un véritable accordéon Hohner, publiées sous CC0. Le manifeste TypeScript reprend les régions, corrections d’accordage et points de boucle du fichier SFZ original. Web Audio choisit l’échantillon le plus proche, le transpose à la hauteur demandée et applique une attaque, un maintien en boucle et un relâchement courts. Une compression légère protège le mix lorsque la mélodie, une basse et un accord se superposent.

Les 5,5 Mo de WAV sont préchargés dans le cache HTTP, puis décodés localement au premier contexte audio. Ils sont servis par la même origine que l’application et mis en cache par la WebView Android ; le mode Android demeure néanmoins connecté à la production, comme le reste de l’interface. Si un fichier ne peut exceptionnellement pas être chargé, un repli par table d’harmoniques reste disponible ; il est volontairement secondaire et ne doit pas masquer une erreur de livraison de la banque. Cette architecture permet d’ajouter plus tard des profils sonores par modèle et des couches pousser/tirer sans modifier le lecteur pédagogique.

`usePitchDetector` demande un flux `getUserMedia` mono sans annulation d’écho, réduction de bruit ni gain automatique, calcule le RMS, puis estime la période avec YIN entre 55 et 2 500 Hz. La première période acoustiquement plausible est privilégiée afin d'éviter les erreurs d'octave produites par les multiples de période. Chaque analyse confronte une fenêtre longue, fiable sur les sons tenus et graves, à sa partie la plus récente : cette seconde vue isole une nouvelle anche lorsque la fenêtre longue contient encore la note précédente. Une note n’est publiée qu’au-dessus d’un seuil de clarté et après deux observations cohérentes, toutes les 38 ms environ. Pendant cette confirmation, l’interface ne publie rien : un harmonique fugitif ne peut donc ni éclairer un faux bouton ni produire une fausse erreur.

La main gauche n’emploie pas cette hauteur unique comme verdict. Une FFT de 8 192 points extrait les maxima spectraux entre 45 et 2 600 Hz, les replie par classe de hauteur et corrige le poids des premiers harmoniques. Une fenêtre tenue combine ensuite ce profil chromatique avec les votes YIN pour une basse, ou compare 24 gabarits de triades majeures et mineures pour un accord. Le résultat contient une confiance et peut rester `uncertain` : il n’entraîne jamais une correction silencieuse de la cartographie. Le scan guidé attend une attaque, observe 1,25 seconde, exige le relâchement avant le geste suivant et suspend l’avancement lorsqu’une mesure est ambiguë.

Une campagne terminée conserve avec le compte uniquement 12 coefficients chromatiques normalisés par geste, les étiquettes attendue/entendue, la confiance et l’éventuel écart d’une basse. Aucun échantillon temporel, spectre détaillé ou fichier audio n’est envoyé. Ce profil compact permet le diagnostic entre appareils sans rendre l’enregistrement reconstructible. Le corpus de non-régression inclut l’empreinte anonymisée des 16 gestes du Club I fourni pour les essais ; le fichier source reste hors du dépôt.

Le lecteur prépare le microphone avant de démarrer le décompte ou la musique. En lecture au tempo, une courte fenêtre de tolérance rattache une mesure retardée à la note précédente au lieu de la déclarer fausse sur la suivante. En mode « attendre la bonne note », une nouvelle attaque autorise la répétition de la même hauteur sans exiger un silence artificiellement long. Pour la gauche, chaque attaque ouvre une fenêtre courte de FFT : `practiceHandDetection.ts` confronte son chroma au modèle harmonique et, s’il existe, aux 16 empreintes synchronisées de l’instrument. En mode deux mains, YIN continue d’évaluer la mélodie tandis que cette fenêtre évalue l’accompagnement ; une note appartenant à l’accord attendu n’est pas comptée comme fausse mélodie lorsque la séparation reste ambiguë. Les deux instants validés alimentent un verdict de coordination. Le flux n’est ni enregistré, ni uploadé, et ses pistes sont arrêtées à la fermeture de l’écran ou dès qu’un exercice est terminé. Dans l’application Android, `SouffletMicrophonePlugin` demande d’abord explicitement l’autorisation native `RECORD_AUDIO`; la WebView dispose aussi de `MODIFY_AUDIO_SETTINGS`, nécessaire à la ressource de capture audio de Capacitor. En cas de refus persistant, le tutoriel permet d’ouvrir la fiche de l’application dans les réglages Android puis de relancer l’écoute.

### Plan de soufflet

`bellowsStrategy.ts` planifie les gestes sur la totalité d’un morceau avec une recherche dynamique. Un état combine bouton, direction et réserve d’air discrétisée ; son coût tient compte des changements de direction, des changements de rangée, de la distance entre boutons, de la main gauche, de la marge restante et des frontières de phrase. Les profils équilibré, poussé-tiré et jeu croisé ne sont donc pas des filtres visuels : ils produisent de véritables doigtés et directions différents.

La réserve commence légèrement fermée, évolue continûment selon la durée et le nombre de voix, et reste entre des limites absolues. Le moteur regarde la consommation de la phrase suivante dès sa frontière : si elle ne tient pas dans la réserve, il insère une action de soupape silencieuse avant la première note. Les mappages vérifiés sont marqués `authorial` et restent verrouillés ; les mappages `optimized` peuvent être recalculés pour un autre style. Le lecteur HTML, le studio et la lecture 3D consomment le même `BellowsPlan`, ce qui évite toute divergence entre la tablature enseignée et l’animation.

YIN reste réservé au canal mélodique. L’analyse harmonique reconnaît séparément la fondamentale ou la qualité majeure/mineure de la gauche, sans prétendre effectuer une séparation de sources audio complète. Le lecteur sait donc ignorer une partielle d’accord ambiguë et exiger les deux gestes, mais deux boutons qui produisent acoustiquement le même son restent indiscernables avec un seul micro. Mesurer séparément les anches d’un même bouton exige toujours un protocole d’accordage professionnel et un corpus plus large.

## Gemini

La clé serveur vient de `GEMINI_API_KEY`. Une clé de session facultative arrive dans l’en-tête `x-gemini-key` et n’est jamais journalisée ni stockée. Les uploads utilisent une mémoire temporaire limitée à 25 Mo et ne sont pas écrits sur disque. La réponse est assainie : bornes de tempo, hauteurs, confiance, taille et tri chronologique. Le MIDI est dérivé du nom scientifique de la note ; une valeur MIDI contradictoire n’est jamais acceptée silencieusement.

Pour YouTube, le serveur récupère d’abord le titre et l’auteur via oEmbed. Un titre correspondant à une édition intégrée prête à jouer réutilise cette transcription contrôlée, main gauche comprise, avec un avertissement explicite sur la synchronisation de l’enregistrement.

Sans correspondance, le pipeline multimodal sépare les responsabilités :

1. une passe documentaire avec Google Search et URL Context cherche les sources musicales publiques et produit un dossier de référence ;
2. une passe audiovisuelle analyse toute la vidéo avec ce dossier, retourne jusqu’à 4096 événements par main et effectue son propre contrôle musical ;
3. le serveur recalcule la durée transcrite depuis le dernier beat et le tempo, rejette les URL provenant de la passe vidéo non outillée et déclenche une réparation lorsque la couverture ou la main gauche sont insuffisantes.

Le registre de sources vérifiées peut pointer vers une notation distante sans intégrer la partition dans le dépôt. Il contient actuellement l’édition ABC publique de *Valse à Ollu*. Une source n’augmente la confiance que si sa notation a réellement été chargée ; une simple page de métadonnées ne suffit pas. Le Studio expose la couverture, la provenance, les avertissements et deux pistes séparées. Une transcription reste une proposition à corriger, jamais une édition certifiée.

Avant une exposition publique intensive, ajouter au reverse proxy : quota par compte, limitation de débit distribuée, journal d’audit sans contenu musical et analyse antivirus des fichiers. Les mutations restent sur la même origine avec des cookies `SameSite=Lax`; le cookie passe en mode `Secure` derrière HTTPS.

## Progression et données utilisateur

Les comptes, sessions d’authentification, configurations d’instruments, séances de pratique et morceaux communs vivent dans SQLite. Une séance de pratique porte un identifiant client idempotent et est sauvegardée pendant la lecture, à la pause et à la fermeture. Elle enregistre séparément le mode pédagogique, la partie travaillée (`right`, `left` ou `both`) et un bilan extensible droite/gauche/coordination. La migration garde les anciennes lignes compatibles avec un bilan vide ; les anciens clients peuvent continuer à envoyer leurs instantanés. Seul le temps de lecture actif est cumulé ; les pauses ne gonflent pas les statistiques. Les démonstrations contribuent au temps mais pas aux métriques de précision. La série est calculée dans le fuseau horaire du navigateur et les comptes sans séance restent strictement à zéro.

Le profil et le mot de passe se modifient depuis l’espace personnel. Un changement de mot de passe invalide toutes les sessions existantes, puis crée une nouvelle session pour l’appareil courant. Les profils main gauche sont synchronisés dans `accordion_audio_profiles` et supprimés en cascade avec le compte ; la signature pousser/tirer du soufflet dépend du micro et reste locale à l’appareil. Les profils restent annoncés comme absents jusqu’à une calibration réelle : aucune valeur de microphone ou de latence n’est simulée.

L’instrument actif, la notation, le décompte et l’achèvement de l’onboarding et du tutoriel sont synchronisés dans `user_preferences`. Une copie locale est isolée par identifiant de compte et sert uniquement de repli lorsque le serveur a déjà été joint au moins une fois sur cet appareil. Le brouillon de la première leçon suit la même isolation par identifiant de compte ; l’ancienne clé locale globale est migrée une fois puis supprimée. Les marqueurs d’achèvement sont monotones : une réponse tardive provenant d’un autre appareil ne peut pas réactiver le tutoriel. À la migration, les comptes qui possèdent déjà une séance active sont considérés comme ayant terminé le tutoriel. Les morceaux importés et leurs corrections restent local-first dans `localStorage` et ne sont pas encore synchronisés. Le passage long terme prévu est un journal d’opérations versionné côté serveur avec IndexedDB comme outbox, identifiants idempotents et résolution de conflits.

## Accessibilité

- contrastes principaux conformes à une lecture à distance ;
- focus visible et commandes clavier ;
- alternatives textuelles sur le clavier ;
- pousser/tirer exprimé par mouvement, flèche, mot, forme de badge et couleur ;
- réduction des animations via `prefers-reduced-motion` ;
- zones tactiles principales de 44 à 56 px.
