# Contribuer à Soufflet

Chaque évolution passe par une branche courte et une pull request vers `main`. Une PR n’est fusionnée que lorsque le lint, le typage, les tests, le build web et le build Docker sont verts.

## Commits et titres de PR

Format obligatoire : `<type>(<scope>): <gitmoji> <titre impératif>`.

Types autorisés : `feat`, `fix`, `docs`, `refactor`, `perf`, `test`, `build`, `ci`, `chore`, `revert`. Le sujet reste inférieur ou égal à 72 caractères. Exemples :

- `feat(tuner): ✨ Calibrate an accordion button`
- `fix(audio): 🐛 Ignore ambiguous microphone input`
- `ci(release): 🚀 Publish the production image`

Les changements incompatibles utilisent un footer `BREAKING CHANGE:` et documentent la migration.

## Migrations et données

- Une base existante doit rester lisible après chaque déploiement.
- Toute évolution de schéma reçoit une migration incrémentale dans `server/database.ts`.
- Une migration appliquée n’est jamais réécrite ; une correction reçoit une nouvelle version.
- Les données utilisateur vivent dans le volume `/app/data` et ne doivent jamais être placées dans l’image.
- Les morceaux communs doivent préciser licence et provenance. Une œuvre protégée ne contient ni partition ni transcription intégrale sans autorisation.

## Vérifications locales

```bash
npm ci
npm run lint
npm run typecheck
npm test
npm run build
docker build -t soufflet:test .
```

## Livraison

Semantic Release analyse les commits fusionnés dans `main`. Chaque commit de `main` construit et pousse `registry.robin-joseph.fr/soufflet:latest` et un tag `sha-*`. Les changements fonctionnels obtiennent également un tag `v*`. La stack Portainer est mise à jour par la Watchtower globale grâce au label `com.centurylinklabs.watchtower.enable=true`.
