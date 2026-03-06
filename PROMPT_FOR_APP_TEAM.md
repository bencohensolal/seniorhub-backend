# Correction Authentification Tablette - Instructions pour l'Équipe App

## Problème Actuel

L'application tablette envoie le **token brut** (64 caractères) dans le header `x-tablet-session-token`, mais le backend attend un **JWT** dans ce header.

```typescript
// ❌ CODE ACTUEL (INCORRECT)
const headers = {
  'x-tablet-session-token': '12cd477e89040c0adb89777f8e2342c27a294ce3fa15cf894b06ba5d308a2645'
  // ↑ Token brut dans un header qui attend un JWT
}
```

**Résultat:** Erreur 401 "Invalid or expired tablet session token"

## Solution à Implémenter

### Option 1: Utiliser x-tablet-id + x-tablet-token (Solution Simple)

Changez simplement les headers utilisés pour chaque requête API:

```typescript
// ✅ SOLUTION 1 - Utiliser les headers corrects
const headers = {
  'x-tablet-id': tabletId,        // UUID de la tablette
  'x-tablet-token': rawToken      // Token brut de 64 caractères
}

// Exemple d'utilisation
const response = await fetch(
  `${API_BASE_URL}/v1/households/${householdId}/members`,
  {
    headers: {
      'Content-Type': 'application/json',
      'x-tablet-id': tabletId,
      'x-tablet-token': rawToken
    }
  }
);
```

**Avantages:**
- ✅ Changement minimal du code
- ✅ Fonctionne immédiatement
- ✅ Pas de gestion de session

**Inconvénients:**
- ❌ Requête DB à chaque appel API (légèrement plus lent)
- ❌ Token brut exposé dans chaque requête

---

### Option 2: Obtenir un JWT Session Token (Solution Recommandée)

Implémentez un flow d'authentification en 2 étapes:

#### Étape 1: Fonction d'authentification

```typescript
/**
 * Authentifie la tablette et obtient un JWT session token
 * À appeler au démarrage de l'app et toutes les 7h
 */
async function authenticateTablet(
  tabletId: string,
  rawToken: string
): Promise<{
  sessionToken: string;
  householdId: string;
  householdName: string;
  expiresAt: string;
}> {
  const response = await fetch(
    `${API_BASE_URL}/v1/display-tablets/authenticate`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        tabletId: tabletId,
        token: rawToken  // Token brut de 64 caractères
      })
    }
  );

  if (!response.ok) {
    throw new Error('Tablet authentication failed');
  }

  const result = await response.json();
  return result.data;
}
```

#### Étape 2: Utiliser le JWT

```typescript
// Au démarrage de l'app
let sessionToken: string | null = null;
let sessionExpiresAt: Date | null = null;

async function initializeTablet() {
  const auth = await authenticateTablet(tabletId, rawToken);
  
  sessionToken = auth.sessionToken;
  sessionExpiresAt = new Date(auth.expiresAt);
  
  // Stocker en local (AsyncStorage, SecureStore, etc.)
  await storage.setItem('tablet_session_token', sessionToken);
  await storage.setItem('tablet_session_expires', auth.expiresAt);
  
  // Programmer le renouvellement (avant expiration)
  scheduleTokenRenewal();
}

// Vérifier et renouveler le token si nécessaire
async function ensureValidSession() {
  if (!sessionToken || !sessionExpiresAt) {
    await initializeTablet();
    return;
  }
  
  // Renouveler 1 heure avant expiration
  const renewAt = new Date(sessionExpiresAt.getTime() - 60 * 60 * 1000);
  if (new Date() >= renewAt) {
    await initializeTablet();
  }
}

// Utiliser dans toutes les requêtes API
async function fetchMembers(householdId: string) {
  await ensureValidSession();
  
  const response = await fetch(
    `${API_BASE_URL}/v1/households/${householdId}/members`,
    {
      headers: {
        'Content-Type': 'application/json',
        'x-tablet-session-token': sessionToken!  // ← JWT ici
      }
    }
  );
  
  return response.json();
}
```

**Avantages:**
- ✅ Meilleure performance (pas de requête DB à chaque appel)
- ✅ Plus sécurisé (token à durée limitée)
- ✅ Conforme aux best practices

**Inconvénients:**
- ❌ Nécessite plus de code
- ❌ Gestion de renouvellement de session

---

## Configuration Requise

Vérifiez que vous avez ces informations dans votre configuration:

```typescript
// Configuration tablette
const tabletConfig = {
  tabletId: 'xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx',  // UUID
  rawToken: '64-character-hex-string',                // 64 chars
  apiBaseUrl: 'https://seniorhub-backend-production.up.railway.app'
};
```

---

## Exemple Complet (Option 2 - Recommandé)

```typescript
// tablet-auth.service.ts
class TabletAuthService {
  private sessionToken: string | null = null;
  private sessionExpiresAt: Date | null = null;
  
  constructor(
    private tabletId: string,
    private rawToken: string,
    private apiBaseUrl: string
  ) {}
  
  /**
   * Initialise la session (appeler au démarrage)
   */
  async initialize(): Promise<void> {
    try {
      const response = await fetch(
        `${this.apiBaseUrl}/v1/display-tablets/authenticate`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            tabletId: this.tabletId,
            token: this.rawToken
          })
        }
      );
      
      if (!response.ok) {
        throw new Error(`Auth failed: ${response.status}`);
      }
      
      const result = await response.json();
      this.sessionToken = result.data.sessionToken;
      this.sessionExpiresAt = new Date(result.data.expiresAt);
      
      console.log('✅ Tablet authenticated, session expires at:', this.sessionExpiresAt);
      
      // Programmer le renouvellement
      this.scheduleRenewal();
    } catch (error) {
      console.error('❌ Tablet authentication failed:', error);
      throw error;
    }
  }
  
  /**
   * Obtient un token de session valide (renouvelle si nécessaire)
   */
  async getValidToken(): Promise<string> {
    if (!this.sessionToken || !this.sessionExpiresAt) {
      await this.initialize();
    } else {
      // Renouveler si moins d'1h restante
      const oneHourBeforeExpiry = new Date(this.sessionExpiresAt.getTime() - 60 * 60 * 1000);
      if (new Date() >= oneHourBeforeExpiry) {
        console.log('🔄 Renewing session token...');
        await this.initialize();
      }
    }
    
    return this.sessionToken!;
  }
  
  /**
   * Programme le renouvellement automatique
   */
  private scheduleRenewal(): void {
    if (!this.sessionExpiresAt) return;
    
    // Renouveler 1h avant expiration
    const renewAt = new Date(this.sessionExpiresAt.getTime() - 60 * 60 * 1000);
    const delay = renewAt.getTime() - Date.now();
    
    if (delay > 0) {
      setTimeout(() => {
        console.log('⏰ Auto-renewal triggered');
        this.initialize();
      }, delay);
    }
  }
  
  /**
   * Crée un fetch avec authentification automatique
   */
  async authenticatedFetch(url: string, options: RequestInit = {}): Promise<Response> {
    const token = await this.getValidToken();
    
    return fetch(url, {
      ...options,
      headers: {
        ...options.headers,
        'x-tablet-session-token': token
      }
    });
  }
}

// Utilisation dans l'app
const authService = new TabletAuthService(
  TABLET_ID,
  RAW_TOKEN,
  API_BASE_URL
);

// Au démarrage
await authService.initialize();

// Dans vos composants/services
async function loadMembers(householdId: string) {
  const response = await authService.authenticatedFetch(
    `${API_BASE_URL}/v1/households/${householdId}/members`
  );
  const data = await response.json();
  return data.data;
}
```

---

## Tests de Validation

Après avoir implémenté les changements, testez:

### Test 1: Chargement des membres
```typescript
const members = await loadMembers(householdId);
console.log('✅ Members loaded:', members);
```

### Test 2: Chargement des rendez-vous
```typescript
const appointments = await loadAppointments(householdId);
console.log('✅ Appointments loaded:', appointments);
```

### Test 3: Renouvellement automatique
```typescript
// Attendre que le token arrive proche de l'expiration
// Vérifier qu'il se renouvelle automatiquement
```

---

## Résumé des Changements

**Solution Minimale (Option 1):**
1. ✏️ Changer `x-tablet-session-token` → `x-tablet-id` + `x-tablet-token`
2. ✅ Tester

**Solution Recommandée (Option 2):**
1. ✏️ Créer `TabletAuthService`
2. ✏️ Appeler `authenticateTablet()` au démarrage
3. ✏️ Utiliser le JWT dans `x-tablet-session-token`
4. ✏️ Gérer le renouvellement automatique
5. ✅ Tester

---

## Questions Fréquentes

**Q: Où trouver le tabletId?**
R: Il est retourné lors de la création de la tablette via l'interface admin. Il doit être configuré dans l'app.

**Q: Le rawToken de 64 caractères est stocké où?**
R: Il est montré UNE SEULE FOIS lors de la création de la tablette. Il doit être configuré dans l'app (fichier config ou variables d'environnement).

**Q: Quelle option choisir?**
R: **Option 2** pour la production (meilleure performance et sécurité). **Option 1** pour un fix rapide si urgence.

**Q: Que faire si on a perdu le rawToken?**
R: Utiliser l'endpoint `POST /v1/households/:householdId/display-tablets/:tabletId/regenerate-token` pour en générer un nouveau.

---

## Support Backend

Les deux méthodes sont supportées par le backend:
- ✅ `x-tablet-id` + `x-tablet-token` (Method 2)
- ✅ `x-tablet-session-token` avec JWT (Method 1)

Toutes les routes READ sont accessibles aux tablettes:
- ✅ `/v1/households/:householdId/members`
- ✅ `/v1/households/:householdId/appointments`
- ✅ `/v1/households/:householdId/tasks`
- ✅ `/v1/households/:householdId/medications`
- ✅ etc.

Les routes WRITE sont bloquées pour les tablettes (read-only).
