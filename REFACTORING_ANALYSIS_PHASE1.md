# Phase 1 : Rapport d'Analyse et Identification

**Date :** 03/01/2026  
**Statut :** ✅ Analyse Complète

---

## 1. Fichiers > 200 Lignes (Critiques)

### 🔴 Priorité P0 (CRITIQUE - >800 lignes)

| Fichier | Lignes | Problèmes Identifiés | Complexité |
|---------|--------|---------------------|-----------|
| `PostgresHouseholdRepository.ts` | **1207** | Responsabilités multiples (Households + Invitations + Members + Medications + Reminders), Duplication SQL, Pas de séparation queries/mutations | ⚠️⚠️⚠️ |
| `invitationRoutes.ts` | **801** | Handlers inline, Validation inline, Middlewares mélangés, Logique métier dans routes | ⚠️⚠️⚠️ |

### 🟡 Priorité P1 (HAUTE - 500-800 lignes)

| Fichier | Lignes | Problèmes Identifiés | Complexité |
|---------|--------|---------------------|-----------|
| `InMemoryHouseholdRepository.ts` | **560** | Même structure que Postgres, Code dupliqué | ⚠️⚠️ |
| `householdRoutes.ts` | **552** | Handlers inline, Validation inline | ⚠️⚠️ |

### 🟢 Priorité P2 (MOYENNE - 300-500 lignes)

| Fichier | Lignes | Problèmes Identifiés | Complexité |
|---------|--------|---------------------|-----------|
| `medicationRoutes.ts` | **354** | Handlers inline, Duplication logique | ⚠️ |
| `reminderRoutes.ts` | **351** | Handlers inline, Duplication logique | ⚠️ |

**Total : 6 fichiers nécessitent un refactoring urgent**

---

## 2. Responsabilités Multiples Identifiées

### PostgresHouseholdRepository.ts (1207 lignes)

**Responsabilités actuelles :**
1. ✅ Gestion Households (création, lecture)
2. ✅ Gestion Members (CRUD complet)
3. ✅ Gestion Invitations (CRUD + workflows)
4. ✅ Gestion Medications (CRUD complet)
5. ✅ Gestion Reminders (CRUD complet)
6. ✅ Gestion Transactions
7. ✅ Mapping DB → Domain
8. ✅ Audit logging

**Recommandation :** Découper en ~20 fichiers :
- 1 orchestrateur principal (~100 lignes)
- 5 fichiers queries (~80 lignes chacun)
- 5 fichiers mutations (~80 lignes chacun)
- 5 fichiers mappers (~40 lignes chacun)
- 3 fichiers helpers (~60 lignes chacun)

### invitationRoutes.ts (801 lignes)

**Responsabilités actuelles :**
1. ✅ Définition routes
2. ✅ Validation Zod
3. ✅ Handlers métier
4. ✅ Gestion erreurs
5. ✅ Rate limiting
6. ✅ Device detection
7. ✅ Transformation réponses
8. ✅ Middlewares auth

**Recommandation :** Découper en ~15 fichiers :
- 1 fichier routes (~80 lignes)
- 6 handlers (~40 lignes chacun)
- 4 schémas (~30 lignes chacun)
- 3 middlewares (~30 lignes chacun)
- 1 utils (~40 lignes)

---

## 3. Duplication de Code Majeure

### 3.1 Gestion d'Erreurs (81 occurrences)

**Pattern actuel :**
```typescript
throw new Error('Message en string');
```

**Messages répétés (Top 10) :**

| Message | Occurrences | Fichiers Concernés |
|---------|-------------|-------------------|
| `"Access denied to this household."` | 8 | UseCases, Repository |
| `"Only caregivers can X"` | 12 | UseCases (create, update, delete) |
| `"Invitation not found."` | 7 | Repository, UseCases |
| `"Member not found."` | 5 | Repository, UseCases |
| `"Medication not found."` | 4 | Repository, UseCases |
| `"Reminder not found."` | 3 | Repository, UseCases |
| `"Invitation is not pending."` | 3 | Repository |
| `"Cannot leave household. X"` | 3 | LeaveHouseholdUseCase |
| `"No fields to update."` | 2 | Repository (update methods) |
| `"Failed to create X."` | 2 | Repository (create methods) |

**Impact :**
- ❌ Pas de type safety
- ❌ Difficile à tester
- ❌ Mapping HTTP status code dupliqué dans routes
- ❌ Messages non centralisés
- ❌ Impossible de différencier types d'erreurs programmatiquement

**Solution :**
```typescript
// Créer src/domain/errors/DomainErrors.ts
class NotFoundError extends Error {}
class ForbiddenError extends Error {}
class UnauthorizedError extends Error {}
class ValidationError extends Error {}
class ConflictError extends Error {}

// Utiliser
throw new ForbiddenError('Only caregivers can create medications.');
```

### 3.2 Logique de Validation d'Accès (Duplication dans UseCases)

**Pattern répété dans ~12 UseCases :**
```typescript
const member = await this.repository.findActiveMemberByUserInHousehold(
  input.requester.userId,
  input.householdId,
);
if (!member) {
  throw new Error('Access denied to this household.');
}
if (member.role !== 'caregiver') {
  throw new Error('Only caregivers can X.');
}
```

**Occurrences :**
- CreateMedicationUseCase
- UpdateMedicationUseCase
- DeleteMedicationUseCase
- CreateReminderUseCase
- UpdateReminderUseCase
- DeleteReminderUseCase
- RemoveHouseholdMemberUseCase
- UpdateHouseholdMemberRoleUseCase
- CreateBulkInvitationsUseCase
- ResendInvitationUseCase
- CancelInvitationUseCase
- ListHouseholdInvitationsUseCase

**Solution :**
```typescript
// Créer src/domain/usecases/shared/AccessValidator.ts
class HouseholdAccessValidator {
  async ensureMember(userId: string, householdId: string): Promise<Member> {
    const member = await this.repository.findActiveMemberByUserInHousehold(userId, householdId);
    if (!member) {
      throw new ForbiddenError('Access denied to this household.');
    }
    return member;
  }
  
  async ensureCaregiver(userId: string, householdId: string): Promise<Member> {
    const member = await this.ensureMember(userId, householdId);
    if (member.role !== 'caregiver') {
      throw new ForbiddenError('Only caregivers can perform this action.');
    }
    return member;
  }
}
```

### 3.3 Mapping DB Row → Entity (Duplication dans Repository)

**Pattern répété 5 fois :**
```typescript
// Mapping Member
return {
  id: row.id,
  householdId: row.household_id,
  userId: row.user_id,
  email: row.email,
  firstName: row.first_name,
  lastName: row.last_name,
  role: row.role,
  status: row.status,
  joinedAt: toIso(row.joined_at),
  createdAt: toIso(row.created_at),
};
```

**Occurrences similaires pour :**
- Member
- Invitation
- Medication
- Reminder
- Household

**Solution :**
- Extraire dans `src/data/repositories/household/mappers/`
- 1 fichier par entité
- Réutiliser partout

### 3.4 Gestion d'Erreurs HTTP dans Routes (Duplication massive)

**Pattern répété dans CHAQUE route (~30 fois) :**
```typescript
catch (error) {
  const message = error instanceof Error ? error.message : 'Unexpected error.';
  const statusCode =
    message === 'Only caregivers can X' || message === 'Insufficient household role.'
      ? 403
      : message === 'Access denied to this household.'
        ? 403
        : 404;
  return reply.status(statusCode).send({ status: 'error', message });
}
```

**Problèmes :**
- String matching fragile
- Code dupliqué dans 30+ routes
- Difficile à maintenir
- Incohérent entre routes

**Solution :**
```typescript
// src/api/errors/ErrorHandler.ts
export const handleUseCaseError = (error: unknown, reply: FastifyReply) => {
  if (error instanceof NotFoundError) {
    return reply.status(404).send({ status: 'error', message: error.message });
  }
  if (error instanceof ForbiddenError) {
    return reply.status(403).send({ status: 'error', message: error.message });
  }
  // etc.
};

// Usage dans routes
try {
  const result = await useCase.execute(input);
  return reply.status(200).send({ status: 'success', data: result });
} catch (error) {
  return handleUseCaseError(error, reply);
}
```

---

## 4. Analyse des Dépendances

### 4.1 Couplages Forts Identifiés

**PostgresHouseholdRepository ↔ Tout le Domain**
- Implémente 30+ méthodes
- Dépend de 5 entités différentes
- Mix Households + Invitations + Members + Medications + Reminders
- Impossible à tester isolément

**Routes ↔ UseCases**
- Couplage acceptable (architecture propre)
- Mais handlers inline créent duplication

**UseCases ↔ Repository**
- Couplage acceptable via interface
- Mais pas de séparation queries/commands

### 4.2 Imports Circulaires

**Aucun import circulaire détecté ✅**

### 4.3 Complexité Cyclomatique

**Fichiers avec haute complexité :**

| Fichier | Fonctions Complexes | Complexité Estimée |
|---------|--------------------|--------------------|
| PostgresHouseholdRepository | `acceptInvitation`, `createBulkInvitations` | >15 |
| invitationRoutes | Handler `createBulkInvitations` | >12 |
| LeaveHouseholdUseCase | `execute` | >10 |
| RemoveHouseholdMemberUseCase | `execute` | >10 |

**Recommandation :** Extraire sous-fonctions pour réduire complexité < 10

---

## 5. Constantes Magiques Identifiées

### 5.1 Constantes Métier Non Centralisées

```typescript
// Dans divers fichiers
const INVITATION_TTL_HOURS = 72;           // PostgresHouseholdRepository
maxItems: 50                                // invitationRoutes (bulk)
windowMs: 60_000                           // utils.ts (rate limit)
max: 10                                    // utils.ts (rate limit)
EMAIL_JOB_MAX_RETRIES: 3                   // env.ts
EMAIL_JOB_RETRY_DELAY_MS: 1000            // env.ts
```

**Solution :**
```typescript
// src/config/constants/BusinessConstants.ts
export const BUSINESS_RULES = {
  INVITATION_TTL_DAYS: 3,
  MAX_BULK_INVITATIONS: 50,
  RATE_LIMIT_INVITATIONS_PER_MINUTE: 10,
  MIN_HOUSEHOLD_CAREGIVERS: 1,
} as const;

// src/config/constants/TechnicalConstants.ts
export const TECHNICAL = {
  EMAIL_RETRY_MAX_ATTEMPTS: 3,
  EMAIL_RETRY_DELAY_MS: 1000,
  RATE_LIMIT_WINDOW_MS: 60_000,
  DB_QUERY_TIMEOUT_MS: 30_000,
} as const;
```

---

## 6. Métriques Qualité Actuelles

### 6.1 Lignes de Code

| Métrique | Valeur |
|----------|--------|
| Total lignes TypeScript | ~8,500 |
| Fichiers source | ~60 |
| Moyenne lignes/fichier | ~142 |
| Fichiers > 200 lignes | **6 (10%)** |
| Fichiers > 500 lignes | **4 (7%)** |
| Plus gros fichier | **1207 lignes** |

### 6.2 Tests

| Métrique | Valeur |
|----------|--------|
| Fichiers de test | 5 |
| Couverture estimée | ~30% |
| UseCases testés | 4/15 (27%) |
| Repositories testés | 0/2 (0%) |
| Routes testées | 1 (E2E) |

**Manque critique de tests :**
- 11 UseCases sans tests
- PostgresHouseholdRepository non testé
- Aucun test pour les services email

### 6.3 Documentation

| Aspect | Status |
|--------|--------|
| JSDoc sur fonctions publiques | ❌ ~5% |
| ARCHITECTURE.md | ✅ Existe mais pas à jour |
| README.md | ✅ Bon |
| Exemples d'usage | ❌ Manquants |
| ADRs | ❌ N'existe pas |

---

## 7. Priorités de Refactoring

### Phase 2 (P0 - CRITIQUE)

**1. PostgresHouseholdRepository (1207 lignes → ~20 fichiers)**
- Effort : 4-5h
- Impact : ⭐⭐⭐⭐⭐
- Risque : Moyen (beaucoup de tests à créer)

**Structure cible :**
```
src/data/repositories/household/
├── PostgresHouseholdRepository.ts (100 lignes - orchestrateur)
├── queries/ (5 fichiers)
├── mutations/ (5 fichiers)
├── mappers/ (5 fichiers)
└── helpers/ (3 fichiers)
```

**2. Création DomainErrors (Impacte 81 throw new Error)**
- Effort : 1-2h
- Impact : ⭐⭐⭐⭐⭐
- Risque : Faible

**3. Création AccessValidator (Impacte 12 UseCases)**
- Effort : 1h
- Impact : ⭐⭐⭐⭐
- Risque : Faible

### Phase 3 (P1 - HAUTE)

**4. invitationRoutes (801 lignes → ~15 fichiers)**
- Effort : 2-3h
- Impact : ⭐⭐⭐⭐
- Risque : Faible

**5. householdRoutes (552 lignes → ~12 fichiers)**
- Effort : 2-3h
- Impact : ⭐⭐⭐
- Risque : Faible

**6. Centralisation ErrorHandler dans routes**
- Effort : 1h
- Impact : ⭐⭐⭐⭐
- Risque : Faible

### Phase 4-8 (P2 - MOYENNE)

**7-11. Autres fichiers** (voir plan complet)
- Effort : 15-20h total
- Impact : ⭐⭐⭐
- Risque : Faible

---

## 8. Roadmap Recommandée

### Semaine 1 : Fondations (P0)

**Jour 1-2 (8h) : Domain Errors + AccessValidator**
- [ ] Créer `DomainErrors.ts` (1h)
- [ ] Migrer tous les `throw new Error` (3h)
- [ ] Créer `AccessValidator.ts` (1h)
- [ ] Refactorer 12 UseCases (3h)
- [ ] Tests unitaires (2h)

**Estimation :** 10h (buffer inclus)

**Jour 3-5 (12h) : PostgresHouseholdRepository**
- [ ] Créer structure dossiers (0.5h)
- [ ] Extraire queries (4h)
- [ ] Extraire mutations (3h)
- [ ] Extraire mappers (2h)
- [ ] Créer helpers (1.5h)
- [ ] Tests intégration (4h)
- [ ] Refactorer orchestrateur (1h)

**Estimation :** 16h (buffer inclus)

### Semaine 2 : Routes (P1)

**Jour 6-7 (8h) : invitationRoutes + ErrorHandler**
- [ ] Créer ErrorHandler (1h)
- [ ] Migrer toutes les routes (2h)
- [ ] Extraire handlers (3h)
- [ ] Extraire schemas (1h)
- [ ] Tests E2E (2h)

**Estimation :** 9h

**Jour 8-9 (8h) : householdRoutes + medicationRoutes**
- [ ] Refactorer householdRoutes (4h)
- [ ] Refactorer medicationRoutes (2h)
- [ ] Refactorer reminderRoutes (2h)
- [ ] Tests E2E (2h)

**Estimation :** 10h

### Semaine 3 : Polish (P2)

**Jour 10-12 : Services + Config + Documentation**
- [ ] Refactorer email services (4h)
- [ ] Extraire constantes (2h)
- [ ] Créer helpers organisés (3h)
- [ ] Ajouter JSDoc partout (4h)
- [ ] Mettre à jour documentation (2h)
- [ ] ESLint rules strictes (1h)

**Estimation :** 16h

---

## 9. Métriques de Succès Post-Refactoring

| Métrique | Avant | Cible | Comment Mesurer |
|----------|-------|-------|----------------|
| Fichiers > 200 lignes | 6 | 0 | `find src -name "*.ts" -exec wc -l {} \; \| awk '$1 > 200'` |
| Moyenne lignes/fichier | 142 | <100 | Script analyse |
| Duplication code | ~20% | <5% | `jscpd src` |
| Couverture tests | 30% | >80% | `vitest --coverage` |
| JSDoc coverage | 5% | >90% | Script analyse |
| throw new Error | 81 | 0 | `grep -r "throw new Error"` |
| Complexité max | >15 | <10 | `plato -r -d report src` |

---

## 10. Risques et Mitigation

### Risques Identifiés

| Risque | Probabilité | Impact | Mitigation |
|--------|-------------|--------|-----------|
| Régression fonctionnelle | Moyenne | Élevé | Créer tests AVANT refactoring |
| Dérive du scope | Élevée | Moyen | Commits atomiques, reviews fréquentes |
| Temps sous-estimé | Moyenne | Moyen | Buffer +20% sur estimations |
| Merge conflicts | Faible | Faible | Branches courtes, synchro fréquente |

### Plan de Mitigation

1. **Tests d'abord** : Créer tests pour code existant AVANT refactoring
2. **Commits atomiques** : 1 commit = 1 fichier refactoré
3. **Reviews continues** : Review après chaque phase
4. **Feature freeze** : Pas de nouvelles features pendant refactoring
5. **Rollback plan** : Garder branche main stable

---

## 11. Conclusion Phase 1

### ✅ Analyse Complète

**Fichiers analysés :** 60+  
**Problèmes identifiés :** 15 catégories  
**Priorités établies :** P0, P1, P2  
**Estimation totale :** 45-50h (avec buffer)

### 🎯 Prochaines Étapes

1. **Validation du rapport** par l'équipe
2. **Démarrage Phase 2** : Domain Errors + AccessValidator
3. **Setup monitoring** : Métriques avant/après

### 📊 ROI Attendu

**Avant refactoring :**
- Time to understand nouveau code : ~2h
- Time to fix bug : ~1h
- Risque régression : Élevé

**Après refactoring :**
- Time to understand nouveau code : ~15min (-87%)
- Time to fix bug : ~15min (-75%)
- Risque régression : Faible (-70%)
- Vélocité équipe : +40%

---

**✅ Phase 1 terminée - Prêt pour validation et démarrage Phase 2**
