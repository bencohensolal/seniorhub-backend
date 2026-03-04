# Instructions pour la migration 016 sur Railway

La migration 016 (Display Tablets) doit être exécutée manuellement sur Railway.

## Étapes à suivre:

1. **Aller sur Railway Dashboard**
   - https://railway.app
   - Ouvrir le projet "Senior Hub"
   - Cliquer sur le service "Postgres"

2. **Ouvrir l'onglet Query**
   - Cliquer sur l'onglet "Query" dans la barre de navigation

3. **Copier-coller le SQL de la migration**
   - Copier tout le contenu du fichier `migrations/016_display_tablets.sql`
   - Coller dans l'éditeur de requêtes Railway

4. **Exécuter la migration**
   - Cliquer sur "Run Query" ou appuyer sur Cmd+Enter (Mac) / Ctrl+Enter (Windows)
   - Vérifier qu'il n'y a pas d'erreurs

5. **Redéclencher le déploiement**
   - Retourner au service "seniorhub-backend"
   - Cliquer sur "Redeploy" (ou attendre le prochain push)

## Vérification

Après le déploiement, vérifier que le healthcheck passe et que le service démarre correctement.

## SQL à exécuter

Voir le fichier `migrations/016_display_tablets.sql` pour le contenu SQL complet.
