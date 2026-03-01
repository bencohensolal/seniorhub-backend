# Prompt de Refactoring Complet du Backend SeniorHub

## Contexte

Le projet backend SeniorHub est une API Node.js/TypeScript suivant les principes de Clean Architecture. Le code fonctionne mais nécessite un refactoring approfondi pour améliorer la maintenabilité, la lisibilité et la séparation des responsabilités.

## Objectifs Principaux

1. **Fichiers courts et focalisés** : Aucun fichier ne doit dépasser 200-250 lignes
2. **Séparation stricte des responsabilités** : Un fichier = une responsabilité claire
3. **Organisation intuitive** : Structure de dossiers logique et prévisible
4. **Réduction de la duplication** : Code DRY partout
5. **Testabilité maximale** : Architecture facilitant les tests unitaires

---

## Phase 1 : Analyse et Identification (1-2h)

### Tâches
1. **Lister tous les fichiers > 200 lignes**
   ```bash
   find src -name "*.ts" -exec wc -l {} \; | sort -rn | head -20
   ```

2. **Identifier les responsabilités multiples**
   - Fichiers faisant à la fois validation, logique métier, et accès données
   - Fonctions faisant plus d'une chose
   - Classes avec trop de méthodes

3. **Repérer la duplication de code**
   - Patterns de validation répétés
   - Logique de mapping répétée
   - Gestion d'erreurs dupliquée

4. **Analyser les dépendances**
   - Identifier les couplages forts
   - Repérer les imports circulaires potentiels

### Livrables
- Liste des fichiers à refactorer avec priorité (P0, P1, P2)
- Document listant les duplications identifiées
- Schéma de la nouvelle architecture proposée

---

## Phase 2 : Refactoring Couche Domain (3-4h)

### 2.1 Entities - Séparation Types/Interfaces/Validations

**Avant** (tout dans un fichier) :
```
src/domain/entities/Medication.ts (150 lignes)
```

**Après** (séparation claire) :
```
src/domain/entities/medication/
├── Medication.ts              # Type principal (20 lignes)
├── MedicationForm.ts          # Enum des formes (10 lignes)
├── CreateMedicationDTO.ts     # DTO de création (15 lignes)
├── UpdateMedicationDTO.ts     # DTO de mise à jour (15 lignes)
├── MedicationValidation.ts    # Schémas Zod (30 lignes)
└── index.ts                   # Exports centralisés (5 lignes)
```

**Actions** :
- Extraire chaque enum dans son propre fichier
- Séparer les DTOs des entités
- Créer des fichiers de validation dédiés
- Ajouter un fichier index.ts pour exports propres

### 2.2 UseCases - Extraction des helpers et validations

**Problèmes actuels** :
- UseCases > 150 lignes avec logique de validation inline
- Duplication de logique d'accès et de vérification des permissions

**Solutions** :
```
src/domain/usecases/medication/
├── CreateMedicationUseCase.ts           # Use case pur (50 lignes)
├── UpdateMedicationUseCase.ts           # Use case pur (50 lignes)
├── DeleteMedicationUseCase.ts           # Use case pur (40 lignes)
├── ListMedicationsUseCase.ts            # Use case pur (40 lignes)
└── shared/
    ├── MedicationAccessValidator.ts     # Validation d'accès (30 lignes)
    ├── MedicationMapper.ts              # Mapping entité/DTO (40 lignes)
    └── MedicationBusinessRules.ts       # Règles métier (50 lignes)
```

**Actions** :
- Extraire la validation d'accès dans un helper réutilisable
- Créer des mappers dédiés pour conversions DTO ↔ Entity
- Isoler les règles métier complexes dans des classes de rules
- Réduire chaque UseCase à sa logique essentielle

### 2.3 Repositories - Séparation des queries

**Avant** :
```
src/data/repositories/PostgresHouseholdRepository.ts (1200+ lignes)
```

**Après** :
```
src/data/repositories/household/
├── PostgresHouseholdRepository.ts       # Orchestrateur (100 lignes)
├── queries/
│   ├── HouseholdQueries.ts             # SELECT queries (80 lignes)
│   ├── InvitationQueries.ts            # Invitation queries (100 lignes)
│   ├── MemberQueries.ts                # Member queries (80 lignes)
│   ├── MedicationQueries.ts            # Medication queries (90 lignes)
│   └── ReminderQueries.ts              # Reminder queries (70 lignes)
├── mutations/
│   ├── HouseholdMutations.ts           # INSERT/UPDATE/DELETE (80 lignes)
│   ├── InvitationMutations.ts          # Invitation mutations (90 lignes)
│   ├── MemberMutations.ts              # Member mutations (70 lignes)
│   ├── MedicationMutations.ts          # Medication mutations (80 lignes)
│   └── ReminderMutations.ts            # Reminder mutations (60 lignes)
├── mappers/
│   ├── HouseholdMapper.ts              # DB row → Entity (40 lignes)
│   ├── InvitationMapper.ts             # DB row → Entity (40 lignes)
│   ├── MemberMapper.ts                 # DB row → Entity (30 lignes)
│   ├── MedicationMapper.ts             # DB row → Entity (40 lignes)
│   └── ReminderMapper.ts               # DB row → Entity (30 lignes)
└── helpers/
    ├── TransactionManager.ts           # Gestion transactions (50 lignes)
    ├── QueryBuilder.ts                 # Construction requêtes dynamiques (80 lignes)
    └── SqlHelpers.ts                   # Helpers SQL réutilisables (60 lignes)
```

**Actions** :
- Séparer TOUTES les requêtes SQL dans des fichiers queries/
- Isoler les mutations (INSERT/UPDATE/DELETE) dans mutations/
- Extraire les mappers dans mappers/
- Créer des helpers pour transactions et construction de requêtes
- Repository principal devient un orchestrateur léger

---

## Phase 3 : Refactoring Couche API/Routes (2-3h)

### 3.1 Routes - Séparation handlers/validation/schemas

**Avant** :
```
src/routes/households/invitationRoutes.ts (600+ lignes)
```

**Après** :
```
src/routes/households/invitations/
├── invitationRoutes.ts                  # Définition routes (80 lignes)
├── handlers/
│   ├── createBulkInvitations.ts        # Handler création (60 lignes)
│   ├── acceptInvitation.ts             # Handler acceptation (50 lignes)
│   ├── resendInvitation.ts             # Handler renvoi (40 lignes)
│   ├── cancelInvitation.ts             # Handler annulation (40 lignes)
│   ├── listInvitations.ts              # Handler liste (30 lignes)
│   └── resolveInvitation.ts            # Handler résolution (30 lignes)
├── schemas/
│   ├── createInvitationSchema.ts       # Schéma Zod création (40 lignes)
│   ├── acceptInvitationSchema.ts       # Schéma Zod acceptation (30 lignes)
│   ├── invitationParamsSchema.ts       # Schémas params (20 lignes)
│   └── invitationResponseSchema.ts     # Schémas réponse OpenAPI (50 lignes)
├── middleware/
│   ├── invitationAuth.ts               # Auth spécifique (30 lignes)
│   ├── rateLimit.ts                    # Rate limiting (40 lignes)
│   └── deviceDetection.ts              # Détection mobile (20 lignes)
└── utils/
    ├── invitationHelpers.ts            # Helpers métier (40 lignes)
    └── invitationTransformers.ts       # Transformations réponse (30 lignes)
```

**Actions** :
- Extraire chaque handler dans son propre fichier
- Séparer tous les schémas Zod dans schemas/
- Isoler les middlewares spécifiques
- Créer des transformers pour formater les réponses
- Routes deviennent juste une déclaration de routes

### 3.2 Error Handling - Centralisation

**Créer** :
```
src/api/errors/
├── DomainErrors.ts                      # Erreurs métier (40 lignes)
│   ├── NotFoundError
│   ├── ForbiddenError
│   ├── UnauthorizedError
│   ├── ValidationError
│   └── ConflictError
├── ErrorHandler.ts                      # Handler central (60 lignes)
├── ErrorMapper.ts                       # Mapping erreur → HTTP (40 lignes)
└── ErrorResponses.ts                    # Formats de réponse (30 lignes)
```

**Actions** :
- Créer des classes d'erreur typées
- Centraliser le mapping erreur → status HTTP
- Remplacer tous les `throw new Error(string)` par erreurs typées
- Supprimer toute duplication de gestion d'erreur

### 3.3 Validation - Centralisation Zod

**Créer** :
```
src/api/validation/
├── common/
│   ├── emailSchema.ts                  # Validation email (15 lignes)
│   ├── uuidSchema.ts                   # Validation UUID (10 lignes)
│   ├── dateSchema.ts                   # Validation dates (20 lignes)
│   └── paginationSchema.ts             # Pagination (15 lignes)
├── household/
│   ├── householdSchemas.ts             # Schémas household (40 lignes)
│   └── memberSchemas.ts                # Schémas member (40 lignes)
├── invitation/
│   └── invitationSchemas.ts            # Schémas invitation (50 lignes)
├── medication/
│   └── medicationSchemas.ts            # Schémas medication (60 lignes)
└── helpers/
    ├── zodHelpers.ts                   # Helpers Zod réutilisables (40 lignes)
    └── customValidators.ts             # Validateurs custom (50 lignes)
```

**Actions** :
- Extraire TOUS les schémas Zod des routes
- Créer des schémas réutilisables pour types communs
- Regrouper par domaine métier
- Ajouter des helpers Zod pour patterns courants

---

## Phase 4 : Refactoring Services (1-2h)

### 4.1 Email Services - Séparation responsabilités

**Après** :
```
src/services/email/
├── EmailService.ts                      # Interface service (20 lignes)
├── providers/
│   ├── ConsoleEmailProvider.ts         # Dev provider (40 lignes)
│   ├── GmailSmtpProvider.ts            # Gmail (60 lignes)
│   ├── ResendEmailProvider.ts          # Resend (50 lignes)
│   └── MailDevEmailProvider.ts         # MailDev (40 lignes)
├── queue/
│   ├── EmailQueue.ts                   # Queue principale (80 lignes)
│   ├── EmailJobProcessor.ts            # Traitement jobs (60 lignes)
│   └── EmailRetryStrategy.ts           # Stratégie retry (40 lignes)
├── templates/
│   ├── TemplateLoader.ts               # Chargement templates (40 lignes)
│   ├── TemplateRenderer.ts             # Rendu templates (50 lignes)
│   └── invitation/
│       ├── InvitationTemplate.ts       # Template invitation (60 lignes)
│       └── InvitationVariables.ts      # Variables template (20 lignes)
├── metrics/
│   ├── EmailMetrics.ts                 # Métriques (40 lignes)
│   └── EmailMetricsCollector.ts        # Collecteur (30 lignes)
└── config/
    ├── EmailConfig.ts                  # Configuration (30 lignes)
    └── EmailProviderFactory.ts         # Factory providers (40 lignes)
```

**Actions** :
- Séparer queue, retry, et processing
- Extraire le système de templates
- Isoler les métriques
- Créer des factories pour providers

---

## Phase 5 : Configuration et Infrastructure (1h)

### 5.1 Configuration - Séparation par domaine

**Créer** :
```
src/config/
├── env.ts                               # Variables d'environnement (100 lignes)
├── constants/
│   ├── BusinessConstants.ts            # Constantes métier (40 lignes)
│   │   ├── INVITATION_TTL_DAYS
│   │   ├── MAX_BULK_INVITATIONS
│   │   └── ...
│   ├── TechnicalConstants.ts           # Constantes techniques (40 lignes)
│   │   ├── DB_CONNECTION_POOL_SIZE
│   │   ├── RATE_LIMIT_WINDOW_MS
│   │   └── ...
│   └── ErrorMessages.ts                # Messages d'erreur (50 lignes)
├── database/
│   ├── DatabaseConfig.ts               # Config DB (30 lignes)
│   └── ConnectionPool.ts               # Pool connexions (40 lignes)
└── server/
    ├── ServerConfig.ts                 # Config serveur (30 lignes)
    └── CorsConfig.ts                   # Config CORS (20 lignes)
```

**Actions** :
- Extraire TOUTES les constantes magiques
- Regrouper par type (métier vs technique)
- Séparer config DB, serveur, CORS
- Centraliser les messages d'erreur

### 5.2 Helpers - Réorganisation

**Créer** :
```
src/utils/
├── date/
│   ├── dateFormatters.ts               # Formatage dates (30 lignes)
│   ├── dateCalculations.ts             # Calculs dates (40 lignes)
│   └── dateValidators.ts               # Validation dates (20 lignes)
├── string/
│   ├── stringNormalizers.ts            # Normalisation (30 lignes)
│   ├── stringValidators.ts             # Validation (30 lignes)
│   └── stringFormatters.ts             # Formatage (25 lignes)
├── crypto/
│   ├── hashing.ts                      # Hashing (20 lignes)
│   ├── tokenGeneration.ts              # Génération tokens (30 lignes)
│   └── encryption.ts                   # Chiffrement (40 lignes)
└── http/
    ├── statusCodes.ts                  # Constantes HTTP (20 lignes)
    ├── headers.ts                      # Helpers headers (25 lignes)
    └── responseBuilders.ts             # Construction réponses (40 lignes)
```

**Actions** :
- Regrouper helpers par type (date, string, crypto, http)
- Créer des fichiers mono-responsabilité
- Ajouter JSDoc détaillée partout
- Tester chaque helper unitairement

---

## Phase 6 : Tests (2-3h)

### 6.1 Structure de tests

**Créer** :
```
src/
├── domain/
│   └── usecases/
│       ├── medication/
│       │   ├── CreateMedicationUseCase.ts
│       │   └── __tests__/
│       │       ├── CreateMedicationUseCase.test.ts
│       │       ├── CreateMedicationUseCase.integration.test.ts
│       │       └── fixtures/
│       │           └── medicationFixtures.ts
│       └── invitation/
│           ├── AcceptInvitationUseCase.ts
│           └── __tests__/
│               ├── AcceptInvitationUseCase.test.ts
│               └── fixtures/
│                   └── invitationFixtures.ts
├── data/
│   └── repositories/
│       └── __tests__/
│           ├── PostgresHouseholdRepository.test.ts
│           └── helpers/
│               └── testDatabase.ts
└── routes/
    └── __tests__/
        ├── e2e/
        │   ├── invitations.e2e.test.ts
        │   └── medications.e2e.test.ts
        └── fixtures/
            └── routeFixtures.ts
```

**Actions** :
- Créer __tests__ à côté du code testé
- Séparer tests unitaires / intégration / e2e
- Créer des fixtures réutilisables
- Viser 80%+ de couverture

---

## Phase 7 : Documentation (1h)

### 7.1 Documentation du code

**Ajouter** :
```typescript
/**
 * Creates a new medication for a senior in a household.
 * 
 * @param input - The medication creation data
 * @param input.householdId - The household ID
 * @param input.seniorId - The senior member ID
 * @param input.name - The medication name
 * @param input.requester - The authenticated user creating the medication
 * 
 * @returns The created medication entity
 * 
 * @throws {ForbiddenError} If the requester is not a caregiver of the household
 * @throws {NotFoundError} If the household or senior doesn't exist
 * @throws {ValidationError} If the medication data is invalid
 * 
 * @example
 * ```typescript
 * const medication = await createMedicationUseCase.execute({
 *   householdId: 'uuid-123',
 *   seniorId: 'uuid-456',
 *   name: 'Aspirin',
 *   dosage: '100mg',
 *   requester: { userId: 'uuid-789', ... }
 * });
 * ```
 */
```

**Actions** :
- Ajouter JSDoc sur TOUTES les fonctions publiques
- Documenter les paramètres, retours, et exceptions
- Ajouter des exemples d'usage
- Documenter les cas limites

### 7.2 Documentation architecture

**Mettre à jour** :
- `ARCHITECTURE.md` : Refléter la nouvelle structure
- `CONTRIBUTING.md` : Guidelines de structure de fichiers
- `README.md` : Mettre à jour exemples
- Créer `PATTERNS.md` : Patterns de code à suivre

---

## Phase 8 : Qualité et Conformité (1h)

### 8.1 Linting et Formatting

**Actions** :
- Activer ESLint rules strictes :
  - `max-lines` (200 lignes max par fichier)
  - `max-lines-per-function` (50 lignes max)
  - `complexity` (complexité cyclomatique < 10)
  - `max-depth` (profondeur < 4)
- Configurer Prettier pour cohérence
- Ajouter pre-commit hooks pour vérifications

### 8.2 Type Safety

**Actions** :
- Activer `strict: true` dans tsconfig.json (déjà fait ✓)
- Éliminer tous les `any` restants
- Ajouter `noUncheckedIndexedAccess` (déjà fait ✓)
- Utiliser `unknown` au lieu de `any` quand nécessaire

---

## Checklist de Qualité Post-Refactoring

### Structure
- [ ] Aucun fichier > 250 lignes
- [ ] Chaque fichier a une responsabilité unique et claire
- [ ] Nomenclature cohérente (verbes pour fonctions, noms pour types)
- [ ] Exports centralisés via index.ts

### Code
- [ ] Pas de duplication (DRY)
- [ ] Fonctions < 50 lignes
- [ ] Complexité cyclomatique < 10
- [ ] Pas de magic numbers/strings
- [ ] Tous les types explicites (pas d'inférence ambiguë)

### Tests
- [ ] Couverture > 80%
- [ ] Tests unitaires pour toute logique métier
- [ ] Tests d'intégration pour repositories
- [ ] Tests E2E pour endpoints critiques

### Documentation
- [ ] JSDoc sur toutes les fonctions publiques
- [ ] README à jour
- [ ] ARCHITECTURE.md reflète la structure
- [ ] Exemples d'usage documentés

### Performance
- [ ] Pas de N+1 queries
- [ ] Indexes DB appropriés
- [ ] Transactions pour opérations multiples
- [ ] Rate limiting en place

---

## Ordre d'Exécution Recommandé

1. **Jour 1 (8h)** : Phases 1-2 (Analyse + Domain)
2. **Jour 2 (8h)** : Phase 3 (API/Routes)
3. **Jour 3 (6h)** : Phases 4-5 (Services + Config)
4. **Jour 4 (8h)** : Phases 6-7 (Tests + Documentation)
5. **Jour 5 (2h)** : Phase 8 (Qualité) + Review

**Total estimé : 32 heures sur 5 jours**

---

## Règles d'Or à Respecter

1. **Un commit par fichier refactoré** : Facilite le review et le rollback
2. **Tests d'abord** : Créer/adapter tests avant de refactorer
3. **Pas de feature creep** : C'est du refactoring, pas du développement
4. **Documentation au fur et à mesure** : Ne pas laisser pour la fin
5. **Review après chaque phase** : Valider avant de passer à la suivante
6. **Utiliser un fichier pour les messages de commit longs** : `.git/COMMIT_EDITMSG`

---

## Métriques de Succès

**Avant refactoring** :
- Fichiers moyens : ~400 lignes
- Fichiers > 200 lignes : ~15 fichiers
- Duplication estimée : 20%
- Couverture tests : ~30%
- Time to understand : ~2h pour un nouveau dev

**Après refactoring** :
- Fichiers moyens : <150 lignes
- Fichiers > 200 lignes : 0
- Duplication : <5%
- Couverture tests : >80%
- Time to understand : <30min pour un nouveau dev

---

## Outils Recommandés

- **Analyse** : `cloc` (count lines of code)
- **Duplication** : `jscpd` (copy-paste detector)
- **Complexité** : `plato` (complexity analysis)
- **Coverage** : `vitest --coverage`
- **Linting** : `eslint --max-warnings 0`

---

## Notes Importantes

⚠️ **Ce refactoring est massif** - Prévoir du temps buffer (+20%)
⚠️ **Tester continuellement** - Ne jamais casser le build
⚠️ **Communiquer** - Tenir l'équipe informée de l'avancement
⚠️ **Documenter les décisions** - Tenir un log des choix architecturaux

**Bonne chance ! 🚀**
