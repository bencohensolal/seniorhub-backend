# ARCHITECTURE.md

## 1. Technical vision

`seniorhub` is a backend platform that powers data sharing across members of the same household (senior, caregiver, relatives, trusted contacts).

## 2. Core principles

- strict layer separation (`api`, `domain`, `data`)
- domain-driven business rules for access and sharing
- explicit household scoping for all sensitive resources
- testability and maintainability from day one
- secure-by-default design for personal/health-related data

## 3. Target system context

```mermaid
flowchart LR
  M[Mobile Apps]
  API[SeniorHub API]
  DB[(Database)]
  AUTH[Auth Provider]

  M --> API
  API --> DB
  API --> AUTH
```

## 4. API decomposition (initial)

```mermaid
flowchart TB
  API --> Routes[HTTP Routes]
  Routes --> UseCases[Domain Use Cases]
  UseCases --> RepoPorts[Repository Interfaces]
  RepoPorts --> DataRepos[Data Repositories]
```

### 4.1 Layer responsibilities

- `routes`: transport-only logic (HTTP parse/validate/map), no business rules
- `domain/usecases`: access control decisions and business orchestration
- `domain/repositories`: abstract ports for persistence and external data
- `data/repositories`: concrete implementations behind ports

### 4.2 Contract and DTO policy

- request and response DTOs must remain explicit and stable
- contract changes must be documented in `CHANGELOG.md`
- sensitive fields must never be returned unless explicitly required and authorized

## 5. Functional modules (initial)

- `households`: create/read households
- `members`: manage household membership and roles
- `shared-overview`: retrieve shared household dashboard data

## 6. Initial API flow: household shared overview

1. Client calls `GET /v1/households/:householdId/overview`
2. Route validates input and context
3. Use-case checks membership and role eligibility
4. Repository fetches household + members
5. API returns safe aggregated DTO

## 7. Security and privacy constraints

- every household resource access must validate membership
- no cross-household access is allowed
- only minimal required data is returned in overview endpoints
- errors must avoid leaking sensitive internals

## 8. Quality constraints

- mandatory quality command: `cd api && npm run quality:check`
- mutation endpoints must include explicit Zod payload validation
- household membership checks are mandatory in use-cases for protected resources

## 9. Near-term decisions

- persistence is implemented with a driver switch:
  - `in-memory` for lightweight local development
  - `postgres` for persistent household/membership/invitation data
- auth integration strategy (JWT/session)
- audit trail model for sensitive mutations

## 10. Persistence and migrations

- DB access is encapsulated in `data/repositories/PostgresHouseholdRepository.ts`
- runtime repository selection is handled by `data/repositories/createHouseholdRepository.ts`
- PostgreSQL schema is versioned in `api/migrations/*.sql`
- migration execution uses `npm run migrate` and stores applied versions in `schema_migrations`

## 11. Onboarding sequence (create household, invite, accept)

```mermaid
sequenceDiagram
  participant M as Mobile App
  participant API as SeniorHub API
  participant DB as PostgreSQL
  participant Q as Email Queue

  M->>API: POST /v1/households
  API->>DB: create household + caregiver membership
  DB-->>API: household created
  API-->>M: household context

  M->>API: POST /v1/households/:id/invitations/bulk
  API->>DB: persist invitation(s) with token hash
  API->>DB: write invitation_created audit event(s)
  API->>Q: enqueue invitation email jobs
  API-->>M: accepted/skipped/errors + deepLink/fallback URLs

  M->>API: POST /v1/households/invitations/accept
  API->>DB: validate pending invitation, activate membership
  API->>DB: write invitation_accepted audit event
  API-->>M: final household + role context
```

## 12. Contracts and observability

- OpenAPI is generated and exposed through Fastify Swagger (`/docs`, `/documentation/json`)
- invitation email delivery metrics are exposed at `GET /v1/observability/invitations/email-metrics`
- audit events are persisted in `audit_events` for invitation create/accept/cancel actions

## 13. Route module structure (refactored)

Routes are organized by domain in modular subdirectories following SRP:

```
api/src/routes/households/
├── index.ts                  # Plugin entry point, dependency injection
├── schemas.ts                # Zod and JSON Schema definitions
├── utils.ts                  # Shared utilities (rate limiting, sanitization)
├── householdRoutes.ts        # Household CRUD endpoints
├── invitationRoutes.ts       # Invitation lifecycle endpoints
├── observabilityRoutes.ts    # Metrics and monitoring endpoints
└── README.md                 # Module documentation
```

**Benefits:**
- Single Responsibility: each file has one clear purpose
- Maintainability: smaller, focused files easier to navigate
- Testability: utilities and schemas testable independently
- Scalability: clear pattern for adding new domains

## 14. Repository structure and helpers

Database repositories share common helpers to eliminate duplication:

```
api/src/data/repositories/
├── postgres/
│   └── helpers.ts            # Shared DB utilities (mappers, normalizers)
├── PostgresHouseholdRepository.ts
├── InMemoryHouseholdRepository.ts
└── createHouseholdRepository.ts
```

**Helpers include:**
- Date/time utilities (`nowIso`, `toIso`, `addHours`)
- Normalization functions (`normalizeEmail`, `normalizeName`)
- Security utilities (`hashToken`)
- Database row mappers (`mapMember`, `mapInvitation`)

This structure reduces code duplication and centralizes data transformation logic.

## 15. Domain error handling (typed errors)

The domain layer uses typed errors for explicit, type-safe error handling:

```
api/src/domain/errors/
├── DomainErrors.ts           # Typed error classes
└── index.ts                  # Public exports
```

**Error types:**
- `NotFoundError`: Resource not found (404)
- `ForbiddenError`: Access denied (403)
- `ConflictError`: Resource conflict (409)
- `ValidationError`: Invalid input (400)
- `BusinessRuleError`: Business rule violation (422)

**Benefits:**
- Type-safe error handling in use cases
- Explicit error contracts
- Centralized error-to-HTTP mapping in routes via `handleDomainError()`
- No implicit `throw new Error()` in domain layer

## 16. UseCase organization (domain-based structure)

UseCases are organized into domain-specific subdirectories for better discoverability:

```
api/src/domain/usecases/
├── households/               # Household management (10 files)
│   ├── CreateHouseholdUseCase.ts
│   ├── GetHouseholdOverviewUseCase.ts
│   ├── ListUserHouseholdsUseCase.ts
│   ├── EnsureHouseholdRoleUseCase.ts
│   ├── ListHouseholdMembersUseCase.ts
│   ├── RemoveHouseholdMemberUseCase.ts
│   ├── UpdateHouseholdMemberRoleUseCase.ts
│   ├── LeaveHouseholdUseCase.ts
│   └── ...tests
├── invitations/              # Invitation lifecycle (10 files)
│   ├── AcceptInvitationUseCase.ts
│   ├── AutoAcceptPendingInvitationsUseCase.ts
│   ├── CancelInvitationUseCase.ts
│   ├── CreateBulkInvitationsUseCase.ts
│   ├── ListHouseholdInvitationsUseCase.ts
│   ├── ListPendingInvitationsUseCase.ts
│   ├── ResendInvitationUseCase.ts
│   ├── ResolveInvitationUseCase.ts
│   └── ...tests
├── medications/              # Medication management (5 files)
│   ├── CreateMedicationUseCase.ts
│   ├── UpdateMedicationUseCase.ts
│   ├── DeleteMedicationUseCase.ts
│   ├── ListHouseholdMedicationsUseCase.ts
│   └── MedicationAutocompleteUseCase.ts
├── reminders/                # Medication reminders (4 files)
│   ├── CreateReminderUseCase.ts
│   ├── UpdateReminderUseCase.ts
│   ├── DeleteReminderUseCase.ts
│   └── ListMedicationRemindersUseCase.ts
└── shared/                   # Shared utilities
    ├── HouseholdAccessValidator.ts
    └── index.ts
```

**Benefits:**
- Clear domain boundaries
- Better code discoverability (max 10 files per folder vs 29 flat)
- Easier navigation and maintenance
- Scalable pattern for future domains

## 17. Display tablet authentication architecture

The display tablet feature uses a dedicated authentication flow separate from normal user authentication. This is necessary because a household display tablet is a read-only device and should not store caregiver credentials.

### 17.1 Current model

The backend currently supports two tablet authentication mechanisms:

- `tablet token`:
  - long-lived secret generated when a display tablet is created
  - hashed at rest in the database
  - returned only once to the caregiver app
  - encoded in the QR code and in setup deep links
  - accepted by the backend both for initial authentication and, today, as a fallback credential on normal tablet requests
- `tablet session token`:
  - short-lived signed token generated after successful tablet authentication
  - valid for 8 hours
  - verified without a database lookup for signature/expiry
  - accepted through the `x-tablet-session-token` header

This means the backend already has a notion of "bootstrap credential" and "runtime session", but they are not yet strictly isolated.

```mermaid
flowchart TD
  Create["Create display tablet"] --> Secret["Generate raw tablet token"]
  Secret --> Hash["Store only token hash"]
  Secret --> QR["Return raw token once for QR / setup link"]
  QR --> Auth["POST /v1/display-tablets/authenticate"]
  Auth --> Session["Generate signed tablet session token (8h)"]
  Session --> Runtime1["Runtime requests with x-tablet-session-token"]
  QR --> Runtime2["Runtime requests still possible with x-tablet-id + x-tablet-token"]
```

### 17.2 Why there are effectively two tokens today

From a product perspective, the two credentials are often described as:

- an installation or provisioning secret
- an authentication/session secret

That description is directionally true, but not fully true in the current implementation:

- the raw tablet token acts like a provisioning secret because it is distributed through the QR code
- the session token acts like a runtime session because it expires after 8 hours
- however, the raw tablet token is still accepted on regular tablet API calls, so it is also a live access credential

In short:

- `yes`, the backend currently manages two tablet-related credentials
- `no`, the raw tablet token is not yet limited to installation only

### 17.3 Current request paths

```mermaid
sequenceDiagram
  participant Tablet as Tablet App
  participant API as API
  participant Repo as HouseholdRepository
  participant DB as Database

  Tablet->>API: POST /v1/display-tablets/authenticate (tabletId, token)
  API->>Repo: authenticateDisplayTablet(tabletId, token)
  Repo->>DB: compare SHA-256(token) with stored token_hash
  DB-->>Repo: tablet auth info
  Repo-->>API: householdId, permissions
  API-->>Tablet: sessionToken, expiresAt

  alt Preferred runtime path
    Tablet->>API: request with x-tablet-session-token
    API-->>Tablet: authorized if signature valid and not expired
  else Legacy runtime path still supported
    Tablet->>API: request with x-tablet-id + x-tablet-token
    API->>Repo: authenticateDisplayTablet(tabletId, token)
    API-->>Tablet: authorized if token hash matches and tablet is active
  end
```

### 17.4 Security properties of the current model

What is already good:

- the raw tablet token is generated securely
- only a hash is stored at rest
- revocation and regeneration are supported
- the tablet session token is short-lived
- the tablet permission model is read-only

What remains imperfect:

- the provisioning secret is still reusable after setup
- a leaked QR code or setup link exposes a credential that is stronger than a pure one-shot installer token
- runtime requests can still avoid the short-lived session path
- session revocation semantics are weaker than a fully stateful server-side session store

### 17.5 Recommended target model

The preferred long-term design is:

- `setup token`:
  - short-lived
  - single-use
  - only accepted by the pairing endpoint
- `session token`:
  - short-lived
  - used for all runtime tablet requests
  - renewable when needed
- no runtime use of the setup token after pairing

```mermaid
flowchart TD
  Setup["One-shot setup token"] --> Pair["Pairing endpoint only"]
  Pair --> Session["Issue short-lived session token"]
  Session --> Runtime["All tablet reads use session token only"]
  Runtime --> Refresh["Optional renew / re-enroll flow"]
```

### 17.6 Why the raw tablet token should not simply become single-use by itself

Making the current long-lived raw tablet token single-use without changing the flow would create UX issues:

- a tablet reboot would force a full re-scan
- app reinstall or local storage loss would require caregiver intervention every time
- temporary connectivity issues would become operationally painful

So the right split is usually:

- one-shot secret for installation
- renewable short-lived session for normal operation

### 17.7 Implementation guidance for future hardening

Recommended order of improvements:

1. Stop using `x-tablet-token` on normal tablet API calls after the initial authentication flow.
2. Use only `x-tablet-session-token` for read-only tablet requests and SSE subscriptions.
3. Introduce a dedicated `setupToken` model distinct from the current long-lived tablet secret.
4. Add explicit revocation checks so an already-issued session can be rejected quickly after tablet revocation when required.
5. Add rate limiting and audit logging to the pairing endpoint.
