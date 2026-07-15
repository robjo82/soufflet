# État de production et limites

## Opérationnel

- UI responsive et navigation complète ;
- représentation bisonore et soufflet synchronisé ;
- lecture/synthèse au tempo, boucle et raccourcis ;
- accordeur monophonique navigateur ;
- SQLite, API, validation d’entrée, limite d’upload et conteneur non-root ;
- import de tablature simple et pipeline Gemini réel ;
- correction et autosauvegarde locale.

## À valider avant de revendiquer une qualité de mesure

- constituer un corpus sous licence de véritables accordéons G/C, D/G et Club, plusieurs micros et niveaux de bruit ;
- mesurer précision, faux positifs et latence P50/P95 sur au moins un ordinateur, une tablette iOS/Android et un téléphone ;
- calibrer la compensation de latence par boucle audio et non avec une valeur déclarative ;
- tester les anches avec trémolo et les attaques mécaniques ;
- ajouter un détecteur polyphonique pour les basses/accords, avec état « ambigu » explicite ;
- vérifier les dispositions de chaque Club I réel : les instruments anciens ont des variantes. Le seed C/F est donc marqué non vérifié dans l’interface.

## À construire pour un service public

- authentification, comptes et consentements ;
- PostgreSQL ou service SQLite répliqué selon l’échelle ;
- stockage objet éphémère chiffré et suppression vérifiable ;
- file de travaux pour les médias longs ;
- reprise d’upload et progression réelle du pipeline ;
- journal d’opérations serveur pour versions, annulation et synchronisation hors ligne ;
- limitation de débit, budgets Gemini par utilisateur et alertes de coût ;
- observabilité, sauvegardes restaurées en test, SLO et procédure d’incident ;
- tests end-to-end CI sur Chromium/WebKit, audits axe/Lighthouse ;
- mentions légales, politique de confidentialité, licences musicales et procédure de retrait.

## Critères de sortie proposés

Une fonction audio passe en « stable » seulement si son protocole, son corpus, ses appareils, sa latence et ses erreurs sont publiés. Une transcription automatique doit toujours conserver les scores de confiance, permettre la correction et ne jamais bloquer l’accès à la source d’origine.
