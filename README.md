# Soufflet

Soufflet est une web-app d’apprentissage de l’accordéon diatonique pensée comme un professeur numérique pour grands débutants. L’expérience présente une difficulté à la fois, montre le clavier du point de vue du musicien et combine animation, texte, forme et couleur pour distinguer pousser et tirer.

## Ce qui fonctionne aujourd’hui

- onboarding en cinq étapes : instrument, notation, micro et premier geste ;
- création et gestion de compte, mot de passe dérivé avec scrypt, renouvellement sécurisé et session HttpOnly ;
- espace personnel pour le profil, les accordéons enregistrés et les futurs profils de calibration audio ;
- migrations SQLite incrémentales et données persistantes dans un volume Docker ;
- configurations SQLite préchargées : variante Hohner Club I C/F 10+9+2 (P1 = F♯5) avec Gleichton, G/C 21+8 et D/G 21+8 ;
- lecteur animé au tempo avec partition interactive, synthèse locale et soufflet synchronisé ;
- modes démonstration, lecture guidée, attente de la bonne note, notes, rythme, soufflet, chaque main et performance ;
- accordeur monophonique réel avec fréquence, cents, confiance, localisation et correction guidée de chaque bouton ;
- détection de hauteur pendant l’entraînement, évaluation automatique et conseils de note et de rythme ;
- suivi personnel persistant : temps actif, séances, séries, notes et rythme évalués, tempo, tendances, répertoire, historique et insights sans données de démonstration ;
- bibliothèque commune de 12 airs du domaine public ou traditionnels, dont le Brise-pieds en 12 mesures, plus une référence protégée sans transcription ;
- bibliothèque, import audio/vidéo/PDF/image/tablature, liens YouTube et références Spotify ;
- transcription Gemini 3.5 Flash côté serveur avec scores de confiance ;
- parseur déterministe des tablatures simples et structurées (`4P`, `4′T`, ornements, subdivisions, mesures et notes tenues) sans IA ;
- studio de correction des notes, boutons, directions, doigtés et durées avec annulation et autosauvegarde locale ;
- interface responsive, priorité tablette paysage, plein écran, raccourcis `Espace`, `R` et `L` ;
- image Docker non-root, healthcheck, volume SQLite persistant.
- CI de qualité, Semantic Release, images immuables et déploiement Portainer suivi par Watchtower.

Les fonctions encore en validation sont explicitement signalées dans l’interface. Une transcription musicale automatique n’est jamais présentée comme certaine.

## Démarrer en développement

Prérequis : Node.js 22.5 ou supérieur.

```bash
cp .env.example .env.local
# Ajouter GEMINI_API_KEY si la transcription IA est souhaitée
npm install
npm run dev
```

Ouvrir [http://localhost:5173](http://localhost:5173). L’API écoute sur le port 8787.

La clé Gemini doit rester dans `.env.local`, déjà ignoré par Git. Une clé personnelle peut aussi être saisie dans Réglages : elle reste dans `sessionStorage`, est transmise à l’API pour la requête et n’est pas enregistrée en base.

## Lancer avec Docker

```bash
docker compose up --build
```

L’application est alors disponible sur [http://localhost:8787](http://localhost:8787). En production, placer un reverse proxy HTTPS devant le conteneur : l’accès micro du navigateur exige un contexte sécurisé hors `localhost`.

## Vérifications

```bash
npm run typecheck
npm run lint
npm test
npm run build
curl http://localhost:8787/api/health
```

## Import : règles importantes

- **Spotify** : un lien est conservé comme référence seulement. La politique Spotify interdit l’analyse de son contenu, son ingestion dans une IA et la synchronisation d’un enregistrement Spotify avec un visuel. L’utilisateur doit fournir un fichier qu’il a le droit d’utiliser. Voir la [Spotify Developer Policy](https://developer.spotify.com/policy).
- **YouTube** : l’app ne télécharge ni ne sépare la piste audio. Elle contrôle d’abord les métadonnées publiques et réutilise une édition vérifiée lorsqu’un titre de la bibliothèque correspond. Pour les autres vidéos, Gemini produit uniquement une ébauche marquée « à vérifier », dont la confiance est plafonnée à 60 %. Le lecteur YouTube devra rester conforme aux [YouTube Developer Policies](https://developers.google.com/youtube/terms/developer-policies) lors de son ajout.
- **Gemini** : le modèle par défaut est `gemini-3.5-flash`, qui accepte audio, vidéo et PDF et produit des sorties structurées. Voir la [documentation Gemini 3.5 Flash](https://ai.google.dev/gemini-api/docs/models/gemini-3.5-flash) et [Video understanding](https://ai.google.dev/gemini-api/docs/video-understanding).

## Documentation technique

- [Architecture et sécurité](docs/ARCHITECTURE.md)
- [Pédagogie et feuille de route](docs/PEDAGOGIE.md)
- [État de production et limites](docs/PRODUCTION.md)

## Licence et contenu

Le code ne contient aucun audio tiers. Les mélodies jouables incluses sont traditionnelles ou dans le domaine public et portent une provenance. Les œuvres protégées, comme *Vesoul*, ne sont présentes que sous forme de référence sans notes ni partition. Avant une diffusion commerciale, faire valider les éditions musicales, choisir une licence de code et publier les conditions d’utilisation ainsi que la politique de confidentialité.
