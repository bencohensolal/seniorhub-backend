# Fix manuel Railway - Déploiement bloqué

## Problème
Railway continue de tourner avec une **ancienne version** du code:
- Structure OLD: `/app/api/dist/` (code dans sous-dossier `api/`)
- Structure ACTUELLE: `/app/dist/` (code à la racine)
- Résultat: Endpoint GET invitations manquant (404)

## Solution: Intervention manuelle sur Railway Dashboard

### Étape 1: Aller sur Railway Dashboard
1. Ouvrez https://railway.com/project/6facfae9-0ed8-4fb2-8f03-3fee48e2cd05
2. Sélectionnez l'environnement **production**
3. Cliquez sur le service **seniorhub-backend**

### Étape 2: Vérifier les Settings
Dans l'onglet **Settings**:

1. **Root Directory**: Doit être **VIDE** ou `/`
   - Si vous voyez `api` ou `/api`, SUPPRIMEZ-LE
   
2. **Build Command**: Devrait être dans `railway.toml` (pas besoin de changer)

3. **Start Command**: Devrait être dans `railway.toml` (pas besoin de changer)

### Étape 3: Forcer un nouveau déploiement

**Option A: Redeploy depuis Dashboard**
1. Allez dans l'onglet **Deployments**
2. Trouvez le dernier déploiement (commit `e83cf1a` ou plus récent)
3. Cliquez sur les `...` (three dots)
4. Cliquez sur **"Redeploy"**

**Option B: Trigger manuel**
1. Allez dans l'onglet **Settings**
2. Section **Service**
3. Cliquez sur **"Redeploy Latest"**

### Étape 4: Vérifier le nouveau déploiement

Attendez 2-3 minutes, puis testez:

```bash
# Test 1: Vérifier que le service répond
curl https://seniorhub-backend-production.up.railway.app/health

# Test 2: Vérifier l'endpoint invitations
curl -H "x-user-id: test" -H "x-user-email: test@test.com" \
  -H "x-user-first-name: Test" -H "x-user-last-name: Test" \
  "https://seniorhub-backend-production.up.railway.app/v1/households/3617e173-d359-492b-94b7-4c32622e7526/invitations"

# Devrait retourner {"status":"error","message":"..."} (403 ou autre)
# et PAS {"message":"Route GET:... not found","statusCode":404}
```

### Étape 5: Vérifier les logs
```bash
cd /Users/benjamincohensolal/workspaces/seniorhub/backend
railway logs | grep "Email"
```

Vous devriez voir:
```
[Email] Using Gmail SMTP provider
[GmailSmtpProvider] SMTP connection verified successfully
```

## Si le problème persiste

### Option drastique: Supprimer et recréer le service

1. **Avant de supprimer**, notez toutes les variables d'environnement:
   ```bash
   railway variables > variables-backup.txt
   ```

2. Dans Railway Dashboard:
   - Settings > Danger Zone
   - "Remove Service from Project"
   
3. Créer un nouveau service:
   - "New Service" > "GitHub Repo"
   - Sélectionner `seniorhub-backend`
   - Branch: `main`
   - Environment: `production`

4. Reconfigurer les variables (depuis `variables-backup.txt`)

5. Le déploiement devrait maintenant utiliser la structure correcte

## Debugging supplémentaire

Si vous voulez voir exactement ce qui est déployé:

1. Dans Railway Dashboard > Deployments
2. Cliquer sur le dernier déploiement
3. Voir les "Build Logs"
4. Chercher `COPY` et `RUN` pour voir quel code est copié

Vous devriez voir:
```
COPY . /app/.
RUN npm ci && npm run build
```

Et PAS:
```
COPY . /app/api/.
RUN cd api && npm ci
```
