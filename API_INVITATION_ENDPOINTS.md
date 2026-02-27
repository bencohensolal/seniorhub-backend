# API Invitation Management Endpoints

## ✅ TOUS LES ENDPOINTS SONT DÉJÀ IMPLÉMENTÉS ET EN PRODUCTION

Les 3 endpoints demandés sont **déjà fonctionnels** en production depuis le commit `927d53c`.

---

## 1. GET /v1/households/:householdId/invitations

**Liste toutes les invitations envoyées par un household**

### URL
```
GET https://seniorhub-backend-production.up.railway.app/v1/households/:householdId/invitations
```

### Headers requis
```
x-user-id: <userId>
x-user-email: <email>
x-user-first-name: <firstName>
x-user-last-name: <lastName>
```

### Autorisation
- L'utilisateur doit être **membre du household** (n'importe quel rôle)
- Retourne 403 "Access denied to this household" si non membre

### Réponse 200
```json
{
  "status": "success",
  "data": [
    {
      "id": "uuid",
      "inviteeEmail": "user@example.com",
      "inviteeFirstName": "John",
      "inviteeLastName": "Doe",
      "inviteeEmailMasked": "jo***@ex***.com",
      "assignedRole": "senior",
      "status": "pending",
      "createdAt": "2026-02-26T12:00:00Z",
      "tokenExpiresAt": "2026-03-05T12:00:00Z"
    }
  ]
}
```

### Status possibles
- `pending` - En attente d'acceptation
- `accepted` - Acceptée
- `expired` - Expirée
- `cancelled` - Révoquée

### Implémentation
- Use case: `ListHouseholdInvitationsUseCase`
- Route: `api/src/routes/households/invitationRoutes.ts` ligne ~179

---

## 2. POST /v1/households/:householdId/invitations/:invitationId/resend

**Renvoyer une invitation (nouveau token, nouvel email)**

### URL
```
POST https://seniorhub-backend-production.up.railway.app/v1/households/:householdId/invitations/:invitationId/resend
```

### Headers requis
```
x-user-id: <userId>
x-user-email: <email>
x-user-first-name: <firstName>
x-user-last-name: <lastName>
```

### Body
Aucun body requis

### Autorisation
- L'utilisateur doit être **caregiver** du household
- Retourne 403 "Only caregivers can resend invitations" sinon

### Comportement
1. Génère un nouveau token d'invitation
2. Prolonge la date d'expiration (+7 jours)
3. Met l'email en file d'attente pour envoi
4. Ne peut renvoyer que les invitations en status `pending`

### Réponse 200
```json
{
  "status": "success",
  "data": {
    "newExpiresAt": "2026-03-05T12:00:00Z"
  }
}
```

### Erreurs possibles
- 403 - Pas caregiver
- 404 - Invitation introuvable
- 409 - Status invalide (déjà acceptée, expirée, etc.)

### Implémentation
- Use case: `ResendInvitationUseCase`
- Route: `api/src/routes/households/invitationRoutes.ts` ligne ~305
- Email automatiquement envoyé via Gmail SMTP

---

## 3. POST /v1/households/:householdId/invitations/:invitationId/cancel

**Révoquer/annuler une invitation**

### URL
```
POST https://seniorhub-backend-production.up.railway.app/v1/households/:householdId/invitations/:invitationId/cancel
```

### Headers requis
```
x-user-id: <userId>
x-user-email: <email>
x-user-first-name: <firstName>
x-user-last-name: <lastName>
```

### Body
Aucun body requis

### Autorisation
- L'utilisateur doit être **caregiver** du household
- Retourne 403 "Only caregivers can cancel invitations" sinon

### Comportement
1. Change le status de l'invitation à `cancelled`
2. Enregistre un audit event
3. L'invitation ne peut plus être acceptée

### Réponse 200
```json
{
  "status": "success",
  "data": {
    "cancelled": true
  }
}
```

### Erreurs possibles
- 403 - Pas caregiver
- 404 - Invitation introuvable
- 409 - Status invalide (déjà acceptée, etc.)

### Implémentation
- Use case: `CancelInvitationUseCase`
- Route: `api/src/routes/households/invitationRoutes.ts` ligne ~378

---

## Notes importantes

### Pourquoi POST au lieu de DELETE pour cancel?
C'est une **bonne pratique REST** :
- DELETE = suppression de ressource
- POST = opération/action sur une ressource
- Annuler est une opération métier (change status), pas une suppression

### Tests de production
```bash
# Remplacer :householdId et les headers par de vraies valeurs

# 1. Lister les invitations
curl -H "x-user-id: YOUR_ID" \
     -H "x-user-email: YOUR_EMAIL" \
     -H "x-user-first-name: YOUR_NAME" \
     -H "x-user-last-name: YOUR_LAST" \
     "https://seniorhub-backend-production.up.railway.app/v1/households/YOUR_HOUSEHOLD_ID/invitations"

# 2. Renvoyer une invitation
curl -X POST \
     -H "x-user-id: YOUR_ID" \
     -H "x-user-email: YOUR_EMAIL" \
     -H "x-user-first-name: YOUR_NAME" \
     -H "x-user-last-name: YOUR_LAST" \
     "https://seniorhub-backend-production.up.railway.app/v1/households/YOUR_HOUSEHOLD_ID/invitations/INVITATION_ID/resend"

# 3. Annuler une invitation
curl -X POST \
     -H "x-user-id: YOUR_ID" \
     -H "x-user-email: YOUR_EMAIL" \
     -H "x-user-first-name: YOUR_NAME" \
     -H "x-user-last-name: YOUR_LAST" \
     "https://seniorhub-backend-production.up.railway.app/v1/households/YOUR_HOUSEHOLD_ID/invitations/INVITATION_ID/cancel"
```

### Audit events
Toutes ces opérations génèrent des audit events :
- `invitation_resent` pour resend
- `invitation_cancelled` pour cancel
- Consultables dans la table `audit_events`

---

## Status du déploiement

✅ **Service en ligne** - https://seniorhub-backend-production.up.railway.app
✅ **Gmail SMTP actif** - Emails réellement envoyés (500/jour gratuit)
✅ **Tous les endpoints fonctionnels** - Testés en production
✅ **Base de données PostgreSQL** - Railway

### Dernière mise à jour
27 février 2026 - 00:04 CET
