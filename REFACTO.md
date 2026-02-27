# REFACTO.md

**Date d'analyse:** 27/02/2026  
**Projet:** SeniorHub Backend API  
**Objectif:** Plan de refactoring pour améliorer la maintenabilité, la structure, et la qualité du code

---

## Table des matières

1. [Résumé exécutif](#résumé-exécutif)
2. [État actuel du projet](#état-actuel-du-projet)
3. [Priorités de refactoring](#priorités-de-refactoring)
4. [Plan détaillé par couche](#plan-détaillé-par-couche)
   - [4.1 Couche Domain (Use Cases & Entités)](#41-couche-domain-use-cases--entités)
   - [4.2 Couche Data (Repositories & Services)](#42-couche-data-repositories--services)
   - [4.3 Couche API (Routes & Validation)](#43-couche-api-routes--validation)
   - [4.4 Configuration & Infrastructure](#44-configuration--infrastructure)
   - [4.5 Tests & Qualité](#45-tests--qualité)
5. [Recommandations transversales](#recommandations-transversales)
6. [Plan d'implémentation](#plan-dimplémentation)

---

## Résumé exécutif

### Points forts actuels ✅

- **Architecture propre:** Séparation claire en 3 couches (API, Domain, Data) respectant les principes Clean Architecture
- **TypeScript strict:** Configuration rigoureuse (`strict`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`)
- **Validation robuste:** Utilisation systématique de Zod pour valider les entrées API
- **Sécurité:** Requêtes paramétrées, masquage des emails, gestion des tokens, redaction des logs sensibles
- **Documentation:** AGENTS.md, ARCHITECTURE.md, TODO.md bien maintenus
- **Qualité gates:** Pre-commit hooks, quality:check script

### Axes d'amélioration prioritaires 🎯

1. **Cohérence des patterns** (Haute priorité)
2. **Couverture de tests** (Haute priorité)
3. **Gestion des erreurs standardisée** (Haute priorité)
4. **Optimisation des requêtes DB** (Moyenne priorité)
5. **Organisation du code** (Moyenne priorité)
6. **Observabilité et logging** (Basse priorité)

---

## État actuel du projet

### Métriques du code

- **Fichiers sources:** ~50 fichiers TypeScript
- **Use cases:** 15 classes
- **Repositories:** 2 implémentations (Postgres, InMemory)
- **Routes:** 16 endpoints répartis sur 3 fichiers
- **Tests:** 5 fichiers (4 unitaires, 1 intégration)
- **Migrations:** 3 fichiers SQL
- **Couverture tests:** ~30% (estimée)

### Architecture actuelle

```
src/
├── app.ts                    # Configuration Fastify
├── server.ts                 # Point d'entrée
├── config/
│   └── env.ts               # Configuration environnement (Zod)
├── plugins/
│   └── authContext.ts       # Plugin d'authentification
├── routes/
│   └── households/          # Routes households/invitations
├── domain/
│   ├── entities/            # Interfaces métier (3 fichiers)
│   ├── repositories/        # Contrat repository (1 fichier)
│   ├── security/            # Token signing/verification
│   ├── services/            # Services domaine (templates, links)
│   └── usecases/            # 15 use cases métier
└── data/
    ├── db/                  # Connection PostgreSQL
    ├── repositories/        # Implémentations repositories (3 fichiers)
    └── services/email/      # Providers email (7 fichiers)
```

---

## Priorités de refactoring

### P0 - Critique (À faire immédiatement)

- [ ] Standardiser la gestion des erreurs avec des classes d'erreur personnalisées
- [ ] Unifier les patterns d'input dans les use cases (interfaces vs inline)
- [ ] Ajouter les tests manquants pour les use cases critiques (11 use cases sans tests)
- [ ] Corriger le problème N+1 dans `createBulkInvitations`

### P1 - Haute priorité (Sprint actuel)

- [ ] Extraire la logique de mapping HTTP status/error des routes vers un handler centralisé
- [ ] Créer des transactions pour toutes les opérations bulk
- [ ] Implémenter des migrations down/rollback
- [ ] Standardiser l'utilisation de `requester` vs `requesterUserId` partout
- [ ] Remplacer les `console.log` par le logger Fastify

### P2 - Moyenne priorité (Sprint suivant)

- [ ] Optimiser les requêtes SQL avec des JOINs au lieu de requêtes séparées
- [ ] Extraire les constantes magiques dans des fichiers de configuration
- [ ] Organiser les types/interfaces dans des fichiers dédiés
- [ ] Améliorer les métriques d'observabilité (structured logging)
- [ ] Ajouter des tests d'intégration pour chaque endpoint

### P3 - Basse priorité (Backlog)

- [ ] Implémenter un système de pagination pour les listes
- [ ] Ajouter des tests de charge/performance
- [ ] Créer des snapshots de schéma DB pour tests
- [ ] Documenter les patterns avec ADRs (Architecture Decision Records)

---

## Plan détaillé par couche

### 4.1 Couche Domain (Use Cases & Entités)

#### 4.1.1 Problèmes identifiés

**Incohérence des patterns d'input ⚠️ PRIORITÉ HAUTE**

12 use cases utilisent des paramètres inline tandis que 3 utilisent des interfaces dédiées:

```typescript
// ❌ Pattern actuel majoritaire (inline)
async execute({
  householdId,
  requester,
}: {
  householdId: string;
  requester: AuthenticatedRequester;
}): Promise<Member[]>

// ✅ Pattern souhaité (interface dédiée)
export interface ListHouseholdMembersInput {
  householdId: string;
  requester: AuthenticatedRequester;
}

async execute(input: ListHouseholdMembersInput): Promise<Member[]>
```

**Fichiers concernés:**
- AcceptInvitationUseCase.ts
- CancelInvitationUseCase.ts
- CreateBulkInvitationsUseCase.ts
- CreateHouseholdUseCase.ts
- EnsureHouseholdRoleUseCase.ts
- GetHouseholdOverviewUseCase.ts
- ListHouseholdInvitationsUseCase.ts
- ListHouseholdMembersUseCase.ts
- ListPendingInvitationsUseCase.ts
- ListUserHouseholdsUseCase.ts
- ResendInvitationUseCase.ts
- ResolveInvitationUseCase.ts

**Incohérence requester/requesterUserId ⚠️ PRIORITÉ HAUTE**

Certains use cases acceptent l'objet complet `requester: AuthenticatedRequester`, d'autres seulement `requesterUserId: string`.

```typescript
// Inconsistant: mélange des deux patterns
GetHouseholdOverviewUseCase: requesterUserId: string  ❌
ListHouseholdMembersUseCase: requester: AuthenticatedRequester  ✅
EnsureHouseholdRoleUseCase: requesterUserId: string  ❌
```

**Gestion d'erreurs hétérogène**

Les use cases lancent des erreurs avec des messages string simples:

```typescript
throw new Error('Access denied to this household.');
throw new Error('Only caregivers can send invitations.');
throw new Error('Household not found.');
```

Problèmes:
- Pas de distinction entre types d'erreurs (business, validation, not found, unauthorized)
- Parsing du message dans les routes pour déterminer le status HTTP
- Impossible de logger/monitorer efficacement par type d'erreur

#### 4.1.2 Solutions recommandées

**✅ Action 1: Créer des classes d'erreur personnalisées**

Fichier: `src/domain/errors/DomainErrors.ts` (à créer)

```typescript
export class DomainError extends Error {
  constructor(message: string) {
    super(message);
    this.name = this.constructor.name;
  }
}

export class NotFoundError extends DomainError {}
export class UnauthorizedError extends DomainError {}
export class ForbiddenError extends DomainError {}
export class ValidationError extends DomainError {}
export class ConflictError extends DomainError {}
```

**✅ Action 2: Standardiser les inputs avec interfaces dédiées**

Pour chaque use case, créer une interface `XyzInput`:

```typescript
export interface ListHouseholdMembersInput {
  householdId: string;
  requester: AuthenticatedRequester;
}

export class ListHouseholdMembersUseCase {
  async execute(input: ListHouseholdMembersInput): Promise<Member[]> {
    // ...
  }
}
```

**✅ Action 3: Utiliser systématiquement `requester` complet**

Remplacer tous les `requesterUserId: string` par `requester: AuthenticatedRequester` pour:
- Cohérence
- Audit trail complet (email, nom)
- Flexibilité future

**✅ Action 4: Extraire les règles métier complexes**

Certains use cases ont trop de responsabilités. Exemple dans `LeaveHouseholdUseCase`:

```typescript
// Extraire dans src/domain/services/HouseholdMembershipRules.ts
export class HouseholdMembershipRules {
  static canLeaveHousehold(member: Member, household: HouseholdOverview): {
    allowed: boolean;
    reason?: string;
  } {
    // Logique de validation
  }
}
```

#### 4.1.3 Fichiers à refactorer (par priorité)

**P0 - Critique:**
1. Créer `src/domain/errors/DomainErrors.ts`
2. Migrer `AcceptInvitationUseCase.ts`
3. Migrer `CreateBulkInvitationsUseCase.ts`
4. Migrer `GetHouseholdOverviewUseCase.ts`

**P1 - Haute:**
5. Migrer `EnsureHouseholdRoleUseCase.ts`
6. Migrer `CancelInvitationUseCase.ts`
7. Migrer `ResendInvitationUseCase.ts`
8. Migrer `LeaveHouseholdUseCase.ts`
9. Migrer `RemoveHouseholdMemberUseCase.ts`

**P2 - Moyenne:**
10-15. Migrer les autres use cases

---

### 4.2 Couche Data (Repositories & Services)

#### 4.2.1 Problèmes identifiés - Repositories

**Problème N+1 dans `createBulkInvitations` ⚠️ PRIORITÉ CRITIQUE**

Fichier: `src/data/repositories/PostgresHouseholdRepository.ts`

Le code actuel exécute une requête SQL par invitation:

```typescript
for (const invitation of validCandidates) {
  const insertResult = await client.query(
    `INSERT INTO household_invitations (...) VALUES ($1, $2, ...) RETURNING id`,
    [householdId, inviterUserId, ...]
  );
}
```

**Impact:** Pour 50 invitations (max autorisé), cela génère 50 requêtes au lieu d'1.

**Solution:** Utiliser une requête bulk avec `unnest()` ou construire un seul INSERT avec VALUES multiples.

```typescript
// ✅ Solution recommandée
const values: any[] = [];
const placeholders: string[] = [];
let paramIndex = 1;

validCandidates.forEach((candidate, idx) => {
  placeholders.push(`($${paramIndex++}, $${paramIndex++}, ...)`);
  values.push(householdId, inviterUserId, ...);
});

const query = `
  INSERT INTO household_invitations (household_id, inviter_user_id, ...)
  VALUES ${placeholders.join(', ')}
  RETURNING id, invitee_email
`;

const result = await client.query(query, values);
```

**Manque de transactions sur opérations critiques**

Ces méthodes devraient utiliser des transactions mais ne le font pas:
- `createBulkInvitations` - Peut créer partiellement les invitations
- `listPendingInvitationsByEmail` - UPDATE puis SELECT sans transaction
- `listHouseholdInvitations` - Même problème

**Solution:** Wrapper dans BEGIN/COMMIT/ROLLBACK.

**Requêtes séparées au lieu de JOINs**

Exemple dans `getOverviewById`:

```typescript
// ❌ 3 requêtes séparées
const householdResult = await pool.query('SELECT * FROM households WHERE id = $1', [householdId]);
const membersResult = await pool.query('SELECT * FROM household_members WHERE household_id = $1', [householdId]);
const seniorsResult = await pool.query('SELECT COUNT(*) FROM household_members WHERE household_id = $1 AND role = $2', [householdId, 'senior']);
// etc.

// ✅ 1 seule requête avec agrégations
const result = await pool.query(`
  SELECT 
    h.*,
    COUNT(m.id) as members_count,
    COUNT(m.id) FILTER (WHERE m.role = 'senior') as seniors_count,
    COUNT(m.id) FILTER (WHERE m.role = 'caregiver') as caregivers_count
  FROM households h
  LEFT JOIN household_members m ON m.household_id = h.id AND m.status = 'active'
  WHERE h.id = $1
  GROUP BY h.id
`, [householdId]);
```

**Code dupliqué dans les helpers**

Fichier: `src/data/repositories/postgres/helpers.ts`

Les fonctions `mapMember` et `mapInvitation` répètent la même logique de mapping. Solution: généraliser avec un mapper générique.

#### 4.2.2 Problèmes identifiés - Email Services

**Duplication de code entre providers**

Les 4 providers (`ConsoleEmailProvider`, `GmailSmtpProvider`, `ResendEmailProvider`, `MailDevEmailProvider`) ont des structures très similaires:

- Même interface `EmailProvider`
- Même logique de retry
- Même gestion d'erreur

**Solution:** Créer une classe abstraite `BaseEmailProvider` avec la logique commune.

**Gestion de retry incohérente**

La queue d'emails (`InvitationEmailQueue`) gère les retries, mais les providers individuels ne le font pas de manière cohérente.

**TODO en français dans le code**

Fichier: `src/data/services/email/MailDevEmailProvider.ts`
```typescript
// TODO: Implémenter l'envoi réel avec nodemailer si besoin
```

#### 4.2.3 Solutions recommandées

**✅ Action 1: Optimiser `createBulkInvitations`**

Priorité: P0 (Critique)
Fichier: `src/data/repositories/PostgresHouseholdRepository.ts`

Remplacer la boucle avec INSERT multiple.

**✅ Action 2: Ajouter transactions manquantes**

Priorité: P1 (Haute)

Wrapper ces méthodes dans des transactions:
```typescript
const client = await this.pool.connect();
try {
  await client.query('BEGIN');
  // ... opérations
  await client.query('COMMIT');
} catch (error) {
  await client.query('ROLLBACK');
  throw error;
} finally {
  client.release();
}
```

**✅ Action 3: Optimiser les requêtes avec JOINs**

Priorité: P2 (Moyenne)

Refactorer:
- `getOverviewById` - 1 requête au lieu de 3-4
- `listUserHouseholds` - JOIN au lieu de sous-requêtes

**✅ Action 4: Créer classe abstraite pour email providers**

Priorité: P2 (Moyenne)

Fichier: `src/data/services/email/BaseEmailProvider.ts` (à créer)

```typescript
export abstract class BaseEmailProvider implements EmailProvider {
  protected abstract sendEmail(params: SendEmailParams): Promise<void>;
  
  async send(params: SendEmailParams): Promise<void> {
    // Logique commune (validation, logging, etc.)
    return this.sendEmail(params);
  }
}
```

**✅ Action 5: Extraire les constantes de configuration**

Créer `src/data/repositories/constants.ts`:

```typescript
export const DB_CONSTANTS = {
  TOKEN_EXPIRATION_DAYS: 7,
  MAX_INVITATIONS_BULK: 50,
  INVITATION_TOKEN_LENGTH: 32,
} as const;
```

#### 4.2.4 Fichiers à refactorer

**P0 - Critique:**
1. `PostgresHouseholdRepository.ts` - Méthode `createBulkInvitations`

**P1 - Haute:**
2. `PostgresHouseholdRepository.ts` - Ajouter transactions
3. `InvitationEmailQueue.ts` - Améliorer gestion d'erreurs

**P2 - Moyenne:**
4. `PostgresHouseholdRepository.ts` - Optimiser requêtes avec JOINs
5. Créer `BaseEmailProvider.ts`
6. Refactorer `helpers.ts`
7. Créer `constants.ts`

---

### 4.3 Couche API (Routes & Validation)

#### 4.3.1 Problèmes identifiés

**Duplication de logique de mapping d'erreurs ⚠️ PRIORITÉ HAUTE**

Chaque route handler répète la même logique pour mapper les erreurs métier vers des status HTTP:

```typescript
// householdRoutes.ts - Pattern répété ~7 fois
catch (error) {
  const message = error instanceof Error ? error.message : 'Unexpected error.';
  const statusCode = message === 'Access denied to this household.' ? 403 : 404;
  return reply.status(statusCode).send({ status: 'error', message });
}

// invitationRoutes.ts - Pattern répété ~6 fois
catch (error) {
  const message = error instanceof Error ? error.message : 'Unexpected error.';
  const statusCode =
    message === 'Only caregivers can send invitations.' || message === 'Insufficient household role.'
      ? 403
      : message === 'Access denied to this household.'
        ? 403
        : 404;
  return reply.status(statusCode).send({ status: 'error', message: 'Unable to create invitations.' });
}
```

**Problème:** 
- Code dupliqué dans 13 route handlers
- Fragile (dépend du texte exact du message d'erreur)
- Difficile à maintenir
- Incohérent (certains masquent le message, d'autres non)

**Console.log dans les routes de production ⚠️ PRIORITÉ HAUTE**

Fichier: `src/routes/households/invitationRoutes.ts`

```typescript
console.log('[INVITE] Received bulk invitation request:', {...});
console.error('[INVITE] Validation failed:', {...});
```

**Problèmes:**
- Pas de structured logging
- Pas de corrélation avec request IDs
- Ne respecte pas le logger Fastify configuré
- Contourne le système de redaction des données sensibles

**Rate limiting en mémoire ⚠️ PRIORITÉ MOYENNE**

Fichier: `src/routes/households/utils.ts`

```typescript
const inviteRateState = new Map<string, { count: number; windowStartMs: number }>();
```

**Problèmes:**
- État perdu au redémarrage
- Ne fonctionne pas avec plusieurs instances (scale horizontal)
- Pas de nettoyage de la Map (memory leak potentiel)

**Schémas OpenAPI dupliqués**

Les schémas de réponse d'erreur sont dupliqués dans chaque route au lieu d'être définis une fois:

```typescript
// Répété ~13 fois
400: errorResponseSchema,
401: errorResponseSchema,
403: errorResponseSchema,
404: errorResponseSchema,
```

#### 4.3.2 Solutions recommandées

**✅ Action 1: Créer un error handler centralisé**

Priorité: P1 (Haute)
Fichier: `src/routes/errorHandler.ts` (à créer)

```typescript
import type { FastifyReply } from 'fastify';
import { 
  NotFoundError, 
  ForbiddenError, 
  UnauthorizedError, 
  ValidationError,
  ConflictError 
} from '../domain/errors/DomainErrors.js';

export const handleUseCaseError = (error: unknown, reply: FastifyReply) => {
  if (error instanceof NotFoundError) {
    return reply.status(404).send({
      status: 'error',
      message: error.message,
    });
  }
  
  if (error instanceof ForbiddenError) {
    return reply.status(403).send({
      status: 'error',
      message: error.message,
    });
  }
  
  if (error instanceof UnauthorizedError) {
    return reply.status(401).send({
      status: 'error',
      message: error.message,
    });
  }
  
  if (error instanceof ValidationError) {
    return reply.status(400).send({
      status: 'error',
      message: error.message,
    });
  }
  
  if (error instanceof ConflictError) {
    return reply.status(409).send({
      status: 'error',
      message: error.message,
    });
  }
  
  // Erreur inattendue
  reply.log.error(error);
  return reply.status(500).send({
    status: 'error',
    message: 'An unexpected error occurred.',
  });
};
```

**Usage dans les routes:**

```typescript
// ✅ Simplifié et cohérent
try {
  const result = await useCase.execute(input);
  return reply.status(200).send({ status: 'success', data: result });
} catch (error) {
  return handleUseCaseError(error, reply);
}
```

**✅ Action 2: Remplacer console.log par logger Fastify**

Priorité: P1 (Haute)

```typescript
// ❌ Avant
console.log('[INVITE] Received bulk invitation request:', {...});

// ✅ Après
request.log.info({
  householdId: paramsResult.data.householdId,
  userCount: payloadResult.data.users.length,
}, 'Received bulk invitation request');
```

**✅ Action 3: Extraire les schémas OpenAPI communs**

Priorité: P2 (Moyenne)
Fichier: `src/routes/households/schemas.ts`

```typescript
export const commonResponses = {
  400: errorResponseSchema,
  401: errorResponseSchema,
  403: errorResponseSchema,
  404: errorResponseSchema,
  409: errorResponseSchema,
} as const;

// Usage
schema: {
  response: {
    200: { /* ... */ },
    ...commonResponses,
  }
}
```

**✅ Action 4: Améliorer le rate limiting**

Priorité: P2 (Moyenne)

Options:
1. Utiliser un plugin Fastify existant (`@fastify/rate-limit`)
2. Déplacer vers Redis pour support multi-instance
3. Ajouter un nettoyage périodique de la Map actuelle

**✅ Action 5: Enrichir les schémas OpenAPI**

Priorité: P3 (Basse)

Ajouter:
- Descriptions détaillées pour chaque endpoint
- Exemples de requêtes/réponses
- Documentation des codes d'erreur possibles

#### 4.3.3 Fichiers à refactorer

**P0 - Critique:**
Aucun (la couche API fonctionne correctement)

**P1 - Haute:**
1. Créer `src/routes/errorHandler.ts`
2. Refactorer `householdRoutes.ts` - Utiliser error handler
3. Refactorer `invitationRoutes.ts` - Utiliser error handler + remplacer console.log
4. Refactorer `observabilityRoutes.ts` - Utiliser error handler si applicable

**P2 - Moyenne:**
5. Améliorer `utils.ts` - Rate limiting
6. Enrichir `schemas.ts` - Schémas communs
7. Améliorer documentation OpenAPI

---

### 4.4 Configuration & Infrastructure

#### 4.4.1 Problèmes identifiés - Migrations

**Pas de migrations down/rollback ⚠️ PRIORITÉ HAUTE**

Fichiers: `migrations/*.sql`

Actuellement:
- Seulement des migrations "up"
- Pas de moyen de revenir en arrière
- Risque élevé en production si une migration échoue partiellement

**Solution recommandée:**

Créer des fichiers `.down.sql` pour chaque migration:
- `001_household_onboarding.down.sql`
- `002_audit_events.down.sql`
- `003_add_invitation_resent_action.down.sql`

**Pas de documentation dans les migrations**

Les fichiers SQL manquent de:
- En-tête expliquant le but de la migration
- Date et auteur
- Dépendances
- Notes sur les impacts potentiels

**Recommandation:**

```sql
-- Migration: 001 - Household Onboarding
-- Date: 2024-XX-XX
-- Author: Team Backend
-- Purpose: Initial schema for households, members, and invitations
-- Dependencies: None
-- Notes: Creates core tables with proper indexes and constraints

-- Previous migrations must be applied: None
```

#### 4.4.2 Problèmes identifiés - Scripts

**Scripts sans documentation**

Fichiers dans `scripts-db/`:
- `clear_database.sql` - Pas de warning sur la dangerosité
- `clear-railway-db.sh` - Pas de confirmation interactive

**Scripts de déploiement mélangés**

Plusieurs fichiers de setup Railway:
- `configure-railway-email.sh`
- `fix-railway-deployment.sh`
- `RAILWAY_EMAIL_SETUP.md`
- `RAILWAY_MANUAL_FIX.md`
- `RAILWAY_SETUP.md`

**Problème:** Information dispersée, duplication, pas clair quel script utiliser.

**TODO dans les scripts Python**

Les scripts de qualité (`agents_proof.py`, `check_commit_message.py`, `docs_guard.py`) sont bons mais pourraient avoir:
- Plus de tests unitaires
- Documentation des cas d'edge
- Meilleure gestion des erreurs

#### 4.4.3 Problèmes identifiés - Configuration

**Constantes magiques dispersées**

Dans le code:
- `7` jours pour expiration token (hardcodé)
- `50` max invitations (hardcodé)
- `10` limite rate limiting (dans utils.ts)
- `60_000` ms fenêtre rate limiting (dans utils.ts)
- `3` max retries email (dans env.ts)

**Solution:** Centraliser dans `src/config/constants.ts`

#### 4.4.4 Solutions recommandées

**✅ Action 1: Créer migrations down**

Priorité: P1 (Haute)

Pour chaque migration, créer le fichier `.down.sql` correspondant:

```sql
-- migrations/001_household_onboarding.down.sql
DROP TABLE IF EXISTS household_invitations CASCADE;
DROP TABLE IF EXISTS household_members CASCADE;
DROP TABLE IF EXISTS households CASCADE;
DROP TABLE IF EXISTS schema_migrations CASCADE;
```

**✅ Action 2: Améliorer le runner de migrations**

Priorité: P1 (Haute)

Fichier: `src/scripts/migrate.ts`

Ajouter:
- Support pour rollback
- Validation pre-flight
- Meilleur logging des étapes
- Backup automatique avant migration (optionnel)

**✅ Action 3: Consolider la documentation Railway**

Priorité: P2 (Moyenne)

Regrouper dans un dossier `docs/deployment/`:
- `docs/deployment/railway-setup.md` (guide principal)
- `docs/deployment/railway-troubleshooting.md`
- Supprimer les fichiers redondants

**✅ Action 4: Centraliser les constantes**

Priorité: P2 (Moyenne)

Créer `src/config/constants.ts`:

```typescript
export const BUSINESS_RULES = {
  INVITATION_EXPIRATION_DAYS: 7,
  MAX_BULK_INVITATIONS: 50,
  RATE_LIMIT_INVITATIONS_PER_MINUTE: 10,
} as const;

export const TECHNICAL = {
  EMAIL_RETRY_MAX_ATTEMPTS: 3,
  EMAIL_RETRY_DELAY_MS: 1000,
  RATE_LIMIT_WINDOW_MS: 60_000,
} as const;
```

**✅ Action 5: Ajouter script de validation**

Priorité: P3 (Basse)

Créer `scripts/validate-setup.ts` qui vérifie:
- Variables d'environnement requises
- Connexion DB
- Migrations appliquées
- Services externes (email) configurés

#### 4.4.5 Fichiers à créer/modifier

**P1 - Haute:**
1. Créer `migrations/*.down.sql` (3 fichiers)
2. Améliorer `src/scripts/migrate.ts`

**P2 - Moyenne:**
3. Créer `src/config/constants.ts`
4. Consolider documentation Railway
5. Ajouter headers aux migrations existantes

---

### 4.5 Tests & Qualité

#### 4.5.1 Problèmes identifiés

**Couverture de tests insuffisante ⚠️ PRIORITÉ HAUTE**

**Use cases testés (4/15):**
- ✅ CreateHouseholdUseCase
- ✅ CreateBulkInvitationsUseCase
- ✅ GetHouseholdOverviewUseCase
- ✅ InvitationLifecycleUseCase (test intégré de plusieurs use cases)

**Use cases NON testés (11/15):**
- ❌ AcceptInvitationUseCase
- ❌ CancelInvitationUseCase
- ❌ EnsureHouseholdRoleUseCase
- ❌ LeaveHouseholdUseCase
- ❌ ListHouseholdInvitationsUseCase
- ❌ ListHouseholdMembersUseCase
- ❌ ListPendingInvitationsUseCase
- ❌ ListUserHouseholdsUseCase
- ❌ RemoveHouseholdMemberUseCase
- ❌ ResendInvitationUseCase
- ❌ ResolveInvitationUseCase
- ❌ UpdateHouseholdMemberRoleUseCase

**Couverture estimée:** ~30% (très insuffisant)

**Pas de tests pour les repositories**

Aucun test pour:
- `PostgresHouseholdRepository`
- `InMemoryHouseholdRepository`

**Pas de tests pour les services**

Aucun test pour:
- Email providers
- Email queue
- Template loader
- Token generation/verification

**Tests d'intégration limités**

Un seul fichier: `households.integration.test.ts`
- Bon coverage du happy path
- Manque de tests d'erreurs
- Manque de tests de sécurité (authorization)

#### 4.5.2 Solutions recommandées

**✅ Action 1: Ajouter tests unitaires use cases critiques**

Priorité: P0 (Critique)

Tests à créer en priorité:
1. `LeaveHouseholdUseCase.test.ts` - Logique métier complexe (dernier caregiver, etc.)
2. `RemoveHouseholdMemberUseCase.test.ts` - Règles d'autorisation
3. `UpdateHouseholdMemberRoleUseCase.test.ts` - Règles d'autorisation
4. `EnsureHouseholdRoleUseCase.test.ts` - Contrôle d'accès critique

**✅ Action 2: Ajouter tests unitaires use cases secondaires**

Priorité: P1 (Haute)

5. `AcceptInvitationUseCase.test.ts`
6. `CancelInvitationUseCase.test.ts`
7. `ResendInvitationUseCase.test.ts`
8. `ResolveInvitationUseCase.test.ts`
9. `ListHouseholdInvitationsUseCase.test.ts`
10. `ListHouseholdMembersUseCase.test.ts`
11. `ListPendingInvitationsUseCase.test.ts`
12. `ListUserHouseholdsUseCase.test.ts`

**✅ Action 3: Ajouter tests des repositories**

Priorité: P1 (Haute)

Créer:
- `PostgresHouseholdRepository.test.ts` - Tests avec DB test
- Tests des méthodes critiques (createBulkInvitations, acceptInvitation, etc.)

**✅ Action 4: Ajouter tests des services email**

Priorité: P2 (Moyenne)

Créer:
- `InvitationEmailQueue.test.ts`
- `ConsoleEmailProvider.test.ts`
- Tests de la logique de retry

**✅ Action 5: Enrichir tests d'intégration**

Priorité: P2 (Moyenne)

Dans `households.integration.test.ts`, ajouter:
- Tests d'erreurs (401, 403, 404, 409)
- Tests de validation (payloads invalides)
- Tests de concurrence (invitations simultanées)
- Tests de sécurité (accès non autorisé)

**✅ Action 6: Configurer coverage reporting**

Priorité: P2 (Moyenne)

Ajouter dans `package.json`:

```json
{
  "scripts": {
    "test:coverage": "vitest run --coverage",
    "test:watch": "vitest",
  }
}
```

Et configurer un seuil minimum de coverage (par exemple 80%).

#### 4.5.3 Stratégie de tests

**Structure recommandée:**

```
src/
├── domain/
│   └── usecases/
│       ├── XyzUseCase.ts
│       └── XyzUseCase.test.ts    # Co-localisé avec le code
├── data/
│   └── repositories/
│       ├── PostgresHouseholdRepository.ts
│       └── PostgresHouseholdRepository.test.ts
└── routes/
    └── households.integration.test.ts
```

**Priorités de tests:**

1. **P0:** Use cases avec logique métier critique
2. **P1:** Use cases restants + repositories
3. **P2:** Services + tests d'intégration enrichis
4. **P3:** Tests de performance + tests E2E

#### 4.5.4 Fichiers de tests à créer

**P0 - Critique (4 fichiers):**
1. `LeaveHouseholdUseCase.test.ts`
2. `RemoveHouseholdMemberUseCase.test.ts`
3. `UpdateHouseholdMemberRoleUseCase.test.ts`
4. `EnsureHouseholdRoleUseCase.test.ts`

**P1 - Haute (9 fichiers):**
5-12. Tests pour les 8 use cases restants
13. `PostgresHouseholdRepository.test.ts`

**P2 - Moyenne (3+ fichiers):**
14. `InvitationEmailQueue.test.ts`
15. `ConsoleEmailProvider.test.ts`
16. Enrichir `households.integration.test.ts`

---

## Recommandations transversales

### 5.1 Organisation du code

**Problème:** Types et interfaces dispersés

**Solution:** Créer des fichiers de types dédiés par domaine:

```
src/
├── domain/
│   ├── types/
│   │   ├── index.ts           # Exports centralisés
│   │   ├── household.types.ts
│   │   ├── member.types.ts
│   │   └── invitation.types.ts
```

### 5.2 Logging et observabilité

**État actuel:** 
- ✅ Logger Fastify configuré avec redaction
- ✅ Métriques email de base
- ❌ Pas de structured logging systématique
- ❌ Pas de correlation IDs
- ❌ Pas de métriques métier (signups/jour, invitations/jour)

**Recommandations:**

1. **Ajouter request ID tracking** (P2)
```typescript
app.register(require('@fastify/request-id'));
```

2. **Structured logging systématique** (P2)
```typescript
request.log.info({
  useCase: 'CreateHousehold',
  householdId: result.id,
  userId: requester.userId,
  duration: Date.now() - startTime,
}, 'Household created successfully');
```

3. **Métriques métier** (P3)
- Compteur d'invitations envoyées/acceptées
- Temps de réponse par endpoint
- Taux d'erreur par use case

### 5.3 Sécurité

**État actuel:**
- ✅ Requêtes SQL paramétrées
- ✅ Masquage des emails dans les logs
- ✅ Redaction des headers sensibles
- ✅ Validation Zod systématique
- ❌ Pas de rate limiting robuste
- ❌ Pas de CORS configuré
- ❌ Pas de helmet (security headers)

**Recommandations:**

1. **Ajouter @fastify/helmet** (P1)
```typescript
app.register(require('@fastify/helmet'));
```

2. **Configurer CORS** (P1)
```typescript
app.register(require('@fastify/cors'), {
  origin: env.ALLOWED_ORIGINS,
});
```

3. **Améliorer rate limiting** (P2)
Voir section 4.3

### 5.4 Documentation du code

**État actuel:**
- ✅ Documentation projet excellente (AGENTS.md, ARCHITECTURE.md)
- ✅ README complet
- ❌ Pas de JSDoc sur les fonctions
- ❌ Pas de documentation inline des algorithmes complexes

**Recommandations:**

1. **Ajouter JSDoc aux fonctions publiques** (P3)
```typescript
/**
 * Creates bulk invitations for a household.
 * 
 * @param input - Household ID, requester info, and list of invitees
 * @returns Result with accepted invitations, duplicates, and delivery status
 * @throws {ForbiddenError} If requester is not a caregiver
 * @throws {NotFoundError} If household doesn't exist
 */
async execute(input: CreateBulkInvitationsInput): Promise<BulkInvitationResult>
```

2. **Documenter les algorithmes complexes** (P3)
Ajouter des commentaires explicatifs dans les parties complexes du code.

### 5.5 Performance

**Points d'attention identifiés:**

1. **Problème N+1** (P0) - Voir section 4.2
2. **Requêtes séparées** (P2) - Voir section 4.2
3. **Pas de pagination** (P3) - Les listes peuvent grandir indéfiniment
4. **Pas de cache** (P3) - Chaque requête tape la DB

**Recommandations:**

1. Résoudre le N+1 immédiatement
2. Optimiser les requêtes avec JOINs
3. Ajouter pagination pour les listes (P3)
4. Considérer un cache Redis pour les données fréquemment lues (P3)

---

## Plan d'implémentation

### Phase 1: Fondations (Sprint 1-2) - P0 + P1 Critique

**Objectif:** Stabiliser les patterns et corriger les problèmes critiques

**Semaine 1-2:**
1. ✅ Créer `src/domain/errors/DomainErrors.ts`
2. ✅ Corriger le N+1 dans `createBulkInvitations`
3. ✅ Créer `src/routes/errorHandler.ts`
4. ✅ Ajouter 4 tests critiques pour use cases

**Semaine 3-4:**
5. ✅ Migrer 4 use cases critiques vers nouvelles erreurs + interfaces
6. ✅ Migrer routes vers error handler centralisé
7. ✅ Remplacer console.log par Fastify logger
8. ✅ Créer migrations down

**Livrables:**
- Gestion d'erreurs standardisée
- Performance optimisée pour bulk invitations
- 4 use cases critiques testés
- Rollback migrations possible

---

### Phase 2: Cohérence (Sprint 3-4) - P1

**Objectif:** Unifier tous les patterns

**Semaine 5-6:**
9. ✅ Migrer les 11 use cases restants (erreurs + interfaces)
10. ✅ Standardiser requester vs requesterUserId partout
11. ✅ Ajouter tests pour 8 use cases secondaires
12. ✅ Créer tests PostgresHouseholdRepository

**Semaine 7-8:**
13. ✅ Ajouter transactions manquantes
14. ✅ Créer `src/config/constants.ts`
15. ✅ Installer @fastify/helmet et @fastify/cors
16. ✅ Documenter les headers de migrations

**Livrables:**
- 100% des use cases suivent les mêmes patterns
- Couverture tests ~70%
- Sécurité renforcée (helmet, CORS)
- Constantes centralisées

---

### Phase 3: Optimisation (Sprint 5) - P2

**Objectif:** Améliorer performance et maintenabilité

**Semaine 9-10:**
17. ✅ Optimiser requêtes avec JOINs
18. ✅ Créer BaseEmailProvider
19. ✅ Améliorer rate limiting
20. ✅ Extraire schémas OpenAPI communs
21. ✅ Ajouter tests email queue
22. ✅ Enrichir tests d'intégration
23. ✅ Consolider documentation Railway

**Livrables:**
- Requêtes DB optimisées
- Code email providers refactoré
- Couverture tests ~85%
- Documentation consolidée

---

### Phase 4: Polish (Sprint 6+) - P3

**Objectif:** Finitions et améliorations long terme

**Backlog P3:**
- Pagination pour les listes
- Request ID tracking
- Métriques métier
- JSDoc comprehensive
- Tests de performance
- Cache Redis (si besoin)
- ADRs pour décisions architecture

---

## Métriques de succès

### Avant refactoring
- ❌ Couverture tests: ~30%
- ❌ Patterns inconsistants: 12/15 use cases
- ❌ Erreurs non typées: 100%
- ❌ Duplication code: ~13 handlers d'erreurs
- ❌ Performance: N+1 queries dans bulk operations

### Après Phase 1 (P0+P1 Critique)
- ⚠️ Couverture tests: ~45%
- ✅ Erreurs typées: 100%
- ✅ Performance: N+1 résolu
- ⚠️ Duplication: réduite mais pas éliminée

### Après Phase 2 (P1)
- ✅ Couverture tests: ~70%
- ✅ Patterns consistants: 15/15 use cases
- ✅ Duplication: éliminée
- ✅ Sécurité: helmet + CORS

### Après Phase 3 (P2)
- ✅ Couverture tests: ~85%
- ✅ Performance: Requêtes optimisées
- ✅ Maintenabilité: Code DRY
- ✅ Documentation: Consolidée

### Target final
- 🎯 Couverture tests: >85%
- 🎯 0 duplication de logique critique
- 🎯 Patterns 100% cohérents
- 🎯 Performance optimale
- 🎯 Documentation complète

---

## Conclusion

Ce plan de refactoring est **ambitieux mais réaliste**. Les priorités sont claires et l'approche est incrémentale.

**Points clés:**
- ✅ Le projet a déjà de bonnes fondations (architecture, TypeScript, validation)
- ⚠️ Les problèmes sont principalement des incohérences et un manque de tests
- 🎯 Phases 1-2 apportent 80% de la valeur (loi de Pareto)
- 📈 Chaque phase améliore concrètement la maintenabilité

**Prochaines étapes immédiates:**
1. Review de ce plan avec l'équipe
2. Validation des priorités
3. Démarrage Phase 1 - Semaine 1

**Engagement qualité:**
- Chaque refactoring doit être testé
- Pas de régression fonctionnelle
- Documentation mise à jour en continu
- Commits atomiques et bien nommés

---

*Document généré le 27/02/2026 par analyse complète du codebase.*
