# Migration 003: invitation_resent Action - Status

## Problème identifié

L'endpoint `POST /v1/households/:householdId/invitations/:invitationId/resend` retournait une erreur 500 lors de l'audit log car l'action `'invitation_resent'` n'était pas dans la liste autorisée de la contrainte CHECK sur `audit_events.action`.

## Solution implémentée

### Fichier créé: `migrations/003_add_invitation_resent_action.sql`

```sql
-- Drop the existing CHECK constraint
ALTER TABLE audit_events DROP CONSTRAINT IF EXISTS audit_events_action_check;

-- Add the new CHECK constraint with the additional action
ALTER TABLE audit_events ADD CONSTRAINT audit_events_action_check 
  CHECK (action IN (
    'invitation_created',
    'invitation_accepted',
    'invitation_cancelled',
    'invitation_resent'
  ));
```

### Commit
- Commit: `8550041`
- Message: "feat(audit): add invitation_resent action to audit_events"
- Pushed to GitHub: ✅

## Déploiement Railway

### Comportement automatique
Le script `startRailway.ts` applique **automatiquement** toutes les migrations au démarrage:
- Détecte `PERSISTENCE_DRIVER=postgres`
- Exécute `node dist/scripts/migrate.js`
- Retry jusqu'à 12 fois avec délai de 5s
- Démarre le serveur seulement si migrations OK

### Status actuel
⏳ **En attente du redéploiement Railway**

Railway devrait détecter le push git et déclencher automatiquement un nouveau build/deploy.

## Vérification du déploiement

### 1. Attendre le nouveau conteneur
```bash
# Surveiller les logs pour voir "Starting Container"
railway logs 2>&1 | grep "Starting Container"

# Le hostname doit changer (actuellement: 1d6defb2b0c6)
```

### 2. Vérifier l'application de la migration
```bash
# Chercher "Applied migration" dans les logs
railway logs 2>&1 | grep -i migration

# Devrait voir:
# Applied migration 003_add_invitation_resent_action.sql
```

### 3. Tester l'endpoint resend
```bash
# Remplacer avec de vrais IDs et headers
curl -X POST \
  -H "x-user-id: YOUR_USER_ID" \
  -H "x-user-email: YOUR_EMAIL" \
  -H "x-user-first-name: YOUR_NAME" \
  -H "x-user-last-name: YOUR_LASTNAME" \
  "https://seniorhub-backend-production.up.railway.app/v1/households/HOUSEHOLD_ID/invitations/INVITATION_ID/resend"

# Devrait retourner 200:
# {"status":"success","data":{"newExpiresAt":"2026-03-05T..."}}
```

## Si le déploiement ne se lance pas

### Option 1: Forcer via Railway Dashboard
1. Ouvrir https://railway.app
2. Aller dans le projet "Senior Hub"
3. Service "seniorhub-backend"
4. Onglet "Deployments"
5. Cliquer "Deploy" > "Redeploy"

### Option 2: Forcer via CLI
```bash
railway up
```

### Option 3: Trigger via commit vide
```bash
git commit --allow-empty -m "chore: trigger Railway redeploy"
git push
```

## Timeline estimée

- ⏱️ **0-2 min**: Railway détecte le push GitHub
- ⏱️ **2-4 min**: Build du nouveau conteneur
- ⏱️ **4-5 min**: Migration appliquée + démarrage serveur
- ✅ **5 min**: Service opérationnel avec la migration

## Actions suivantes

1. ⏳ Attendre ~5 minutes pour le redéploiement automatique
2. ✅ Vérifier les logs Railway
3. ✅ Tester l'endpoint resend
4. ✅ Confirmer que l'audit log fonctionne

## Endpoints concernés

Une fois la migration appliquée, ces endpoints seront **100% fonctionnels**:

- ✅ `GET /v1/households/:householdId/invitations` - Liste invitations (déjà OK)
- ⏳ `POST /v1/households/:householdId/invitations/:invitationId/resend` - Renvoyer (nécessite migration)
- ✅ `POST /v1/households/:householdId/invitations/:invitationId/cancel` - Annuler (déjà OK)

---

**Date:** 27 février 2026 - 00:10 CET  
**Status:** ⏳ En attente du redéploiement Railway
