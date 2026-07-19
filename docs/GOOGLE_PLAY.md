# Publication de Soufflet sur Google Play

Ce document permet de passer du dépôt GitHub au canal de test interne Google Play sans changer l’identité Android existante.

## Identité de l’application

- nom : **Soufflet – Accordéon diato** ;
- package immuable : `fr.robinjoseph.soufflet` ;
- catégorie recommandée : **Éducation** ;
- langue principale : français ;
- application gratuite, sans publicité ni achat intégré ;
- politique de confidentialité : `https://soufflet.robin-joseph.fr/privacy` ;
- suppression d’un compte : `https://soufflet.robin-joseph.fr/delete-account`.

La clé de signature de production existe déjà. Ses empreintes publiques sont :

- SHA-1 : `93:C2:11:2F:7C:15:F4:B7:93:EC:50:7B:05:EB:E3:CE:EC:09:A0:86` ;
- SHA-256 : `BE:95:97:9B:A3:76:AB:61:50:A2:7A:C0:E6:ED:70:A9:1E:D9:0C:33:8C:A3:5E:B2:3B:5C:52:38:B2:E7:91:8F`.

## 1. Créer l’application dans Play Console

1. Ouvrir [Google Play Console](https://play.google.com/console), terminer si nécessaire la [validation du compte développeur](https://support.google.com/googleplay/android-developer/answer/10841920) et créer une application nommée **Soufflet – Accordéon diato**.
2. Choisir le français, « Application », « Gratuite », puis accepter les déclarations.
3. Ne jamais recréer un autre package : le premier AAB fixe définitivement `fr.robinjoseph.soufflet`.
4. Dans **Intégrité de l’application → Signature d’application Play**, choisir l’option qui permet de [fournir une copie de la clé de signature existante](https://support.google.com/googleplay/android-developer/answer/9842756). Exporter cette clé avec l’outil PEPK proposé par Google. **Ne pas laisser Google générer une nouvelle clé de signature d’application**, sinon les installations APK existantes ne pourront pas migrer vers la version Play.

Le fichier `.jks`, ses mots de passe et l’archive PEPK sont des secrets. Ils ne doivent être envoyés ni dans une issue, ni dans une PR, ni dans une conversation.

## 2. Première version de test interne

La Release GitHub produite par la CI contient un artefact `soufflet-google-play-vX.Y.Z.aab`. Le premier AAB doit être envoyé manuellement dans **Tests → Test interne** afin d’accepter les conditions et d’initialiser l’application. Ajouter ensuite les adresses des testeurs et ouvrir le lien d’inscription fourni par Google sur le téléphone.

Avant l’envoi en examen :

- créer un compte de démonstration dédié dans Soufflet ;
- saisir ses identifiants uniquement dans **Contenu de l’application → Accès à l’application** ;
- vérifier `/privacy` et `/delete-account` hors connexion ;
- tester création de compte, micro, suppression et reconnexion sur la version installée par Play.

## 3. Autoriser la CI

Après le premier envoi manuel :

1. suivre le [guide officiel de démarrage de l’API](https://developers.google.com/android-publisher/getting_started) : créer ou choisir un projet Google Cloud et activer **Google Play Android Developer API** ;
2. créer un compte de service dédié à Soufflet et télécharger sa clé JSON une seule fois ;
3. dans Play Console, inviter ce compte de service comme utilisateur et lui donner uniquement le droit de publier sur les canaux de test de Soufflet ;
4. enregistrer le JSON complet dans le secret GitHub `GOOGLE_PLAY_SERVICE_ACCOUNT_JSON` ;
5. activer la variable GitHub `GOOGLE_PLAY_ENABLED=true`.

Depuis une machine où le fichier JSON est présent :

```bash
gh secret set GOOGLE_PLAY_SERVICE_ACCOUNT_JSON --repo robjo82/soufflet < /chemin/vers/play-service-account.json
gh variable set GOOGLE_PLAY_ENABLED --repo robjo82/soufflet --body true
```

Ne pas copier le contenu JSON dans le terminal en argument : la redirection évite son apparition dans l’historique. Les releases sémantiques suivantes publieront alors automatiquement l’AAB signé sur le canal `internal`. L’APK GitHub continuera d’être produit séparément.

## 4. Fiche Store proposée

**Description courte**

> Apprends l’accordéon diatonique avec un professeur interactif et le micro.

**Description complète**

> Soufflet accompagne les grands débutants pas à pas dans l’apprentissage de l’accordéon diatonique. Configure ton instrument, découvre pousser et tirer, puis progresse des premières notes jusqu’à la coordination des deux mains.
>
> Pendant une séance, l’accordéon animé montre les boutons, la direction du soufflet et les notes à venir. Le microphone analyse localement les notes isolées et donne un retour précis sur la justesse et le rythme. Tu peux ralentir un morceau, boucler un passage, suivre la tablature et utiliser l’accordeur.
>
> Ton compte synchronise ton accordéon, tes préférences et ta progression entre le web et Android. Les transcriptions automatiques restent signalées comme incertaines et peuvent être corrigées avant apprentissage.
>
> Soufflet est en développement actif : certaines mesures avancées, notamment la reconnaissance polyphonique, sont encore expérimentales et sont clairement identifiées dans l’application.

Ressources à fournir dans la fiche : icône 512 × 512, visuel de présentation 1024 × 500, au moins deux captures de téléphone et idéalement deux captures de tablette. Les captures doivent provenir du build Play réel et ne montrer ni données personnelles ni promesse non disponible.

## 5. Déclarations de contenu

Réponses conservatrices recommandées pour **Sécurité des données** :

- données collectées : adresse e-mail, nom affiché, préférences, matériel et activité d’apprentissage ;
- finalités : fonctionnement du compte, personnalisation et analyse de la progression ;
- aucun partage publicitaire et aucune vente ;
- microphone des exercices traité localement et non collecté ; seules les mesures numériques explicitement validées dans l’accordeur sont conservées avec le compte ;
- fichier envoyé volontairement pour transcription traité temporairement par Google Gemini comme prestataire ;
- données chiffrées en transit ;
- suppression accessible dans l’application et sur la page publique indiquée plus haut.

Pour **Accès à l’application**, indiquer que la connexion est requise et fournir le compte de démonstration. Pour **Public cible**, sélectionner 13 ans et plus tant qu’un audit spécifique aux applications destinées aux enfants n’a pas été mené. Compléter honnêtement le questionnaire de classification ; Soufflet ne contient normalement ni violence, ni sexualité, ni jeu d’argent, ni interaction publique.

La politique publiée décrit le fonctionnement technique actuel. Avant une commercialisation ou une collecte à grande échelle, faire valider les mentions légales, l’adresse de contact et les durées de conservation par un professionnel compétent.

## 6. Passage en production

Conserver d’abord le canal interne, puis utiliser un test fermé. Vérifier les rapports automatiques, les appareils Android récents, le micro, les zones sûres et la suppression de compte. La production peut ensuite être déployée progressivement. Google Play gère les mises à jour de la variante Play ; elle ne contient aucun installateur GitHub.

En cas de rollback, augmenter toujours le `versionCode` : Google Play refuse tout code déjà utilisé. Semantic Release calcule actuellement ce code avec `major × 1 000 000 + minor × 1 000 + patch`.
