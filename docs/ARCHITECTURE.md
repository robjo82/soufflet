# Architecture et sécurité

## Vue d’ensemble

```text
Navigateur React
├── moteur de lecture / synthèse Web Audio
├── détection monophonique locale par autocorrélation
├── préférences et autosauvegarde locale
└── API HTTPS
    ├── configurations d’accordéons (SQLite)
    ├── comptes et sessions opaques (SQLite)
    ├── séances et agrégats de progression par utilisateur (SQLite)
    ├── bibliothèque commune licenciée (SQLite)
    ├── parseur de tablature déterministe
    └── transcription multimodale Gemini
```

Le front est construit par Vite. Express sert l’API et le build statique en production. SQLite utilise le module natif `node:sqlite`, le journal WAL et un volume Docker persistant. Les migrations sont enregistrées dans `schema_migrations`. Les configurations et morceaux intégrés sont réappliqués de façon idempotente ; les configurations personnelles portent un propriétaire et ne sont jamais écrasées par un seed.

## Android

La cible Android est une coque Capacitor native qui charge exclusivement l’origine HTTPS de production. Ce choix conserve les cookies de session en contexte propriétaire, évite un second système d’authentification et rend immédiatement disponibles les mêmes données sur le web, le téléphone et la tablette. Le socle commun fournit le microphone, le maintien de l’écran, la barre d’état, le retour système et les retours haptiques. Sur Android 15 et versions ultérieures, `SystemBars` injecte les insets réels de la barre d’état, de la navigation gestuelle et des découpes d’écran ; les surfaces interactives les consomment via les variables CSS `--safe-area-inset-*`.

Le front détecte `Capacitor.getPlatform() === 'android'` pour activer la navigation basse, les zones sûres et le mode entraînement immersif. Les liens externes quittent la WebView dans un onglet système. Seul `soufflet.robin-joseph.fr` est autorisé dans la navigation interne et les connexions HTTP non chiffrées sont refusées.

Le flavor `github` ajoute l’autorisation d’installer un paquet et `SouffletUpdaterPlugin`. Celui-ci accepte uniquement une URL HTTPS sur `github.com` et un nom `soufflet-android-vX.Y.Z.apk`. Android contrôle ensuite que la signature de la mise à jour correspond à celle de l’application installée. Le flavor `play`, construit en AAB, ne compile ni ce plugin ni cette autorisation : les mises à jour sont entièrement confiées à Google Play. `SouffletDistributionPlugin` expose le canal au front afin qu’il n’interroge jamais GitHub dans la version Play. Un repli explicite vers `github` préserve la mise à jour des APK antérieurs à cette séparation.

## Audio local

`usePitchDetector` demande un flux `getUserMedia` sans annulation d’écho ni gain automatique, calcule le RMS, puis une autocorrélation normalisée entre 55 et 1 200 Hz. Une note n’est publiée qu’au-dessus d’un seuil de clarté. Le flux n’est ni enregistré, ni uploadé, et ses pistes sont arrêtées à la fermeture de l’écran.

Ce détecteur est adapté aux notes isolées. Il ne prétend pas distinguer de manière fiable une mélodie au sein d’un accord polyphonique ; cette capacité devra employer un modèle audio local spécialisé et être validée sur un corpus d’accordéons réels.

## Gemini

La clé serveur vient de `GEMINI_API_KEY`. Une clé de session facultative arrive dans l’en-tête `x-gemini-key` et n’est jamais journalisée ni stockée. Les uploads utilisent une mémoire temporaire limitée à 25 Mo et ne sont pas écrits sur disque. Le délai d’appel est limité à 120 secondes et la réponse est assainie : bornes de tempo, MIDI, confiance, taille et tri chronologique.

Pour YouTube, le serveur récupère d’abord le titre et l’auteur via oEmbed. Un titre correspondant à une édition intégrée prête à jouer réutilise cette transcription contrôlée, avec un avertissement explicite sur la synchronisation de l’enregistrement. Sans correspondance, la vidéo précède le prompt dans la requête Gemini, son type MIME est explicite et toutes les confiances sont plafonnées à 60 %. Cette branche reste une ébauche à corriger, pas une transcription certifiée.

Avant une exposition publique intensive, ajouter au reverse proxy : quota par compte, limitation de débit distribuée, journal d’audit sans contenu musical et analyse antivirus des fichiers. Les mutations restent sur la même origine avec des cookies `SameSite=Lax`; le cookie passe en mode `Secure` derrière HTTPS.

## Progression et données utilisateur

Les comptes, sessions d’authentification, configurations d’instruments, séances de pratique et morceaux communs vivent dans SQLite. Une séance de pratique porte un identifiant client idempotent et est sauvegardée pendant la lecture, à la pause et à la fermeture. Seul le temps de lecture actif est cumulé ; les pauses ne gonflent pas les statistiques. Les démonstrations contribuent au temps mais pas aux métriques de précision. La série est calculée dans le fuseau horaire du navigateur et les comptes sans séance restent strictement à zéro.

Le profil et le mot de passe se modifient depuis l’espace personnel. Un changement de mot de passe invalide toutes les sessions existantes, puis crée une nouvelle session pour l’appareil courant. Les profils audio restent annoncés comme absents jusqu’à ce qu’une calibration réelle ait été enregistrée : aucune valeur de microphone ou de latence n’est simulée.

L’instrument actif, la notation et le décompte sont synchronisés dans `user_preferences`, tout en restant copiés localement pour un démarrage immédiat. L’avancement du tutoriel reste propre à l’appareil afin que l’expérience Android puisse être découverte séparément. Les morceaux importés et leurs corrections restent local-first dans `localStorage` et ne sont pas encore synchronisés. Le passage long terme prévu est un journal d’opérations versionné côté serveur avec IndexedDB comme outbox, identifiants idempotents et résolution de conflits.

## Accessibilité

- contrastes principaux conformes à une lecture à distance ;
- focus visible et commandes clavier ;
- alternatives textuelles sur le clavier ;
- pousser/tirer exprimé par mouvement, flèche, mot, forme de badge et couleur ;
- réduction des animations via `prefers-reduced-motion` ;
- zones tactiles principales de 44 à 56 px.
