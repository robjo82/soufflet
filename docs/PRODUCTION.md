# État de production et limites

## Opérationnel

- UI responsive et navigation complète ;
- comptes, sessions HttpOnly, isolation des configurations personnelles et migrations SQLite ;
- bibliothèque commune avec licence et provenance ;
- représentation bisonore en volume, soufflet plissé synchronisé et touches animées ;
- profil visuel procédural dédié au Hohner Club I, sans réutilisation des photographies de référence ;
- lecture/synthèse au tempo, boucle, reprise en une action et raccourcis découvrables avec `Ctrl` ;
- accordeur monophonique navigateur et cartographie guidée pousser/tirer de toutes les touches mélodiques ;
- première leçon microphone-first : trois notes guidées, mini-mélodie en attente de la bonne note et performance de mémoire ;
- SQLite, API, validation d’entrée, limite d’upload et conteneur non-root ;
- import de tablature simple et pipeline Gemini réel ;
- correction et autosauvegarde locale ;
- séances idempotentes et tableau de bord de progression isolé par compte ;
- CI de PR, Semantic Release, registre privé, stack Portainer et mise à jour Watchtower.

## À valider avant de revendiquer une qualité de mesure

- constituer un corpus sous licence de véritables accordéons G/C, D/G et Club, plusieurs micros et niveaux de bruit ;
- mesurer précision, faux positifs et latence P50/P95 sur au moins un ordinateur, une tablette iOS/Android et un téléphone ;
- calibrer la compensation de latence par boucle audio et non avec une valeur déclarative ;
- tester les anches avec trémolo et les attaques mécaniques ;
- évaluer la classification pousser/tirer avec plusieurs boutons et instruments ; la version actuelle compare uniquement les deux sons d’un bouton de référence préalablement calibré et ne détecte pas un mouvement de soufflet silencieux ;
- ajouter un détecteur polyphonique pour les basses/accords, avec état « ambigu » explicite ;
- vérifier les dispositions de chaque Club I réel : les instruments anciens ont des variantes. Le seed C/F est donc marqué non vérifié dans l’interface.

## À renforcer pour un service public à grande échelle

- PostgreSQL ou service SQLite répliqué selon l’échelle ;
- stockage objet éphémère chiffré et suppression vérifiable ;
- file de travaux pour les médias longs ;
- reprise d’upload et progression réelle du pipeline ;
- journal d’opérations serveur pour versions, annulation et synchronisation hors ligne ;
- budgets Gemini par utilisateur, limitation de débit distribuée et alertes de coût ;
- observabilité, sauvegardes restaurées en test, SLO et procédure d’incident ;
- tests end-to-end CI sur Chromium/WebKit, audits axe/Lighthouse ;
- créer des profils visuels vérifiés pour les autres fabricants ; leur rendu actuel reprend la géométrie et la couleur configurées, mais pas encore chaque détail de carrosserie ;
- conditions d’utilisation, mentions légales complètes, licences musicales et procédure de retrait.

## Livraison actuelle

`main` déclenche les contrôles, Semantic Release et la construction de trois tags : `latest`, `sha-*` et `v*` ou `build-*`. Portainer exécute `registry.robin-joseph.fr/soufflet:latest` sur le port hôte 39484 et conserve `/app/data` dans `soufflet_data`. La Watchtower globale ne suit que les conteneurs portant son label explicite.

## Publication Android

Chaque nouvelle version sémantique construit un APK GitHub signé et un AAB Google Play signé. L’APK et son SHA-256 sont joints à la Release GitHub ; les trois fichiers sont conservés comme artefact CI. Les pushes sans nouvelle release sémantique continuent de publier l’image Docker mais ne produisent pas de binaire Android artificiellement versionné.

Secrets GitHub Actions requis :

- `ANDROID_KEYSTORE_BASE64` ;
- `ANDROID_KEYSTORE_PASSWORD` ;
- `ANDROID_KEY_ALIAS` ;
- `ANDROID_KEY_PASSWORD`.

La clé de production locale est ignorée par Git dans `.android-signing/soufflet-release.jks`. Son mot de passe est conservé dans le trousseau macOS sous le service `fr.robinjoseph.soufflet.android-keystore` et le compte `robjo82`. Cette clé doit être sauvegardée : sans elle, Android refusera toute mise à jour des installations existantes.

La CI utilise Java 21, Android SDK 36 et R8. Le `versionName` vient du tag Semantic Release et le `versionCode` est calculé avec `major × 1 000 000 + minor × 1 000 + patch`. Les PR compilent une APK debug non distribuée afin de détecter les ruptures du projet natif.

La publication sur le canal interne Google Play reste désactivée tant que la variable de dépôt `GOOGLE_PLAY_ENABLED` ne vaut pas `true`. Elle exige alors le secret `GOOGLE_PLAY_SERVICE_ACCOUNT_JSON`. La CI vérifie avant envoi que l’AAB est signé, qu’il ne contient pas `SouffletUpdaterPlugin` et qu’il ne demande pas `REQUEST_INSTALL_PACKAGES`. Le parcours complet est documenté dans [`GOOGLE_PLAY.md`](GOOGLE_PLAY.md).

Le port direct permet la recette initiale. Avant d’ouvrir l’application aux apprenants, ajouter un nom de domaine et un reverse proxy HTTPS, puis passer `COOKIE_SECURE=true` : hors `localhost`, les navigateurs refusent le microphone sur une origine HTTP.

## Critères de sortie proposés

Une fonction audio passe en « stable » seulement si son protocole, son corpus, ses appareils, sa latence et ses erreurs sont publiés. Une transcription automatique doit toujours conserver les scores de confiance, permettre la correction et ne jamais bloquer l’accès à la source d’origine.
