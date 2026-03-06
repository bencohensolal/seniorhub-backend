# Solution: Authentification Tablette

## Problème

Vous utilisez le **token brut** (64 caractères) dans le header `x-tablet-session-token`, mais ce header attend un **JWT** (token de session).

```bash
# ❌ INCORRECT - Token brut dans x-tablet-session-token
curl -H 'x-tablet-session-token: 12cd477e89040c0adb89777f8e2342c27a294ce3fa15cf894b06ba5d308a2645'
```

## Solution 1: Utiliser les Headers Corrects pour le Token Brut

Le token de 64 caractères doit être utilisé avec les headers `x-tablet-id` + `x-tablet-token`:

```bash
# ✅ CORRECT - Token brut avec x-tablet-id + x-tablet-token
curl -X GET \
  'https://seniorhub-backend-production.up.railway.app/v1/households/3617e173-d359-492b-94b7-4c32622e7526/members' \
  -H 'x-tablet-id: VOTRE_TABLET_ID' \
  -H 'x-tablet-token: 12cd477e89040c0adb89777f8e2342c27a294ce3fa15cf894b06ba5d308a2645'
```

## Solution 2: Obtenir un JWT Session Token (Recommandé)

Pour utiliser `x-tablet-session-token`, vous devez d'abord obtenir un JWT via l'endpoint d'authentification:

### Étape 1: Authentification

```bash
curl -X POST \
  'https://seniorhub-backend-production.up.railway.app/v1/display-tablets/authenticate' \
  -H 'Content-Type: application/json' \
  -d '{
    "tabletId": "VOTRE_TABLET_ID",
    "token": "12cd477e89040c0adb89777f8e2342c27a294ce3fa15cf894b06ba5d308a2645"
  }'
```

**Réponse:**
```json
{
  "status": "success",
  "data": {
    "householdId": "3617e173-d359-492b-94b7-4c32622e7526",
    "householdName": "Ma Maison",
    "permissions": ["read"],
    "sessionToken": "eyJ0YWJsZXRJZCI6Ii4uLiJ9.YWJjZGVm",
    "expiresAt": "2026-03-06T06:00:00.000Z"
  }
}
```

### Étape 2: Utiliser le Session Token (JWT)

```bash
# ✅ CORRECT - JWT dans x-tablet-session-token
curl -X GET \
  'https://seniorhub-backend-production.up.railway.app/v1/households/3617e173-d359-492b-94b7-4c32622e7526/members' \
  -H 'x-tablet-session-token: eyJ0YWJsZXRJZCI6Ii4uLiJ9.YWJjZGVm'
```

## Les Deux Méthodes d'Authentification

Le backend supporte 2 méthodes d'authentification tablette (voir `src/plugins/authContext.ts`):

### Méthode 1: Session Token JWT (Recommandé)
- **Header:** `x-tablet-session-token`
- **Valeur:** JWT obtenu via `/v1/display-tablets/authenticate`
- **Format:** `payload.signature` (base64url)
- **Durée:** 8 heures
- **Avantage:** Token auto-suffisant, pas besoin de requête DB à chaque appel

### Méthode 2: Raw Credentials
- **Headers:** `x-tablet-id` + `x-tablet-token`
- **Valeur:** Token brut de 64 caractères
- **Format:** Hexadécimal (64 chars)
- **Durée:** Illimitée (jusqu'à révocation)
- **Inconvénient:** Requête DB à chaque appel

## Code d'Authentification Global

Dans `src/plugins/authContext.ts`, lignes 98-174:

```typescript
// Méthode 1: JWT Session Token
const tabletSessionToken = normalize(request.headers['x-tablet-session-token'] as string | undefined);

if (tabletSessionToken) {
  const tabletPayload = verifyTabletSessionToken(tabletSessionToken); // ← Attend un JWT!
  
  if (tabletPayload) {
    request.tabletSession = { ... };
    return; // ✅ Authentifié
  } else {
    return reply.status(401).send({
      status: 'error',
      message: 'Invalid or expired tablet session token.', // ← Votre erreur!
    });
  }
}

// Méthode 2: Raw Credentials (x-tablet-id + x-tablet-token)
const tabletId = normalize(request.headers['x-tablet-id'] as string | undefined);
let tabletToken = normalize(request.headers['x-tablet-token'] as string | undefined);

if (tabletId && tabletToken) {
  const tabletAuth = await repository.authenticateDisplayTablet(tabletId, tabletToken);
  if (tabletAuth) {
    request.tabletSession = { ... };
    return; // ✅ Authentifié
  }
}
```

## Pourquoi Votre Test Échoue

Vous envoyez:
```
x-tablet-session-token: 12cd477e89040c0adb89777f8e2342c27a294ce3fa15cf894b06ba5d308a2645
```

Le backend essaie de vérifier ce token comme un JWT dans `verifyTabletSessionToken()`:

```typescript
// src/domain/security/displayTabletSession.ts
export const verifyTabletSessionToken = (token: string): TabletSessionPayload | null => {
  const parts = token.split('.'); // ← Attend "payload.signature"
  if (parts.length !== 2) {
    return null; // ❌ Votre token n'a pas de '.'
  }
  // ... reste de la vérification JWT
}
```

Votre token de 64 caractères n'a pas de `.` donc `parts.length !== 2` et la fonction retourne `null`.

## Solution Rapide

**Option A: Utilisez x-tablet-id + x-tablet-token**
```bash
curl -X GET \
  'https://seniorhub-backend-production.up.railway.app/v1/households/3617e173-d359-492b-94b7-4c32622e7526/members' \
  -H 'x-tablet-id: VOTRE_TABLET_ID' \
  -H 'x-tablet-token: 12cd477e89040c0adb89777f8e2342c27a294ce3fa15cf894b06ba5d308a2645'
```

**Option B: Authentifiez-vous d'abord**
```bash
# 1. Obtenir le JWT
SESSION_TOKEN=$(curl -X POST \
  'https://seniorhub-backend-production.up.railway.app/v1/display-tablets/authenticate' \
  -H 'Content-Type: application/json' \
  -d '{
    "tabletId": "VOTRE_TABLET_ID",
    "token": "12cd477e89040c0adb89777f8e2342c27a294ce3fa15cf894b06ba5d308a2645"
  }' | jq -r '.data.sessionToken')

# 2. Utiliser le JWT
curl -X GET \
  'https://seniorhub-backend-production.up.railway.app/v1/households/3617e173-d359-492b-94b7-4c32622e7526/members' \
  -H "x-tablet-session-token: $SESSION_TOKEN"
```

## Recommandation

Pour votre application tablette, implémentez ce flux:

1. **Au démarrage:** Authentification avec `POST /v1/display-tablets/authenticate`
2. **Stockez:** Le `sessionToken` (JWT) obtenu
3. **Utilisez:** Ce JWT dans toutes les requêtes avec `x-tablet-session-token`
4. **Renouvelez:** Le JWT avant son expiration (8h)

## Conclusion

✅ **Les deux routes `/appointments` et `/members` sont identiques** au niveau authentification
❌ **Votre problème:** Mauvaise utilisation du header `x-tablet-session-token`
✅ **Solution:** Utilisez `x-tablet-id` + `x-tablet-token` OU obtenez d'abord un JWT
