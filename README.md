# seniorhub-backend

Backend API platform for Senior Hub — securely sharing household data across family members, caregivers and display tablets.

## Objective

Build a robust API that can:
- Manage households, members and roles
- Share care information across a household (appointments, medications, tasks, documents)
- Enforce clear access boundaries and full traceability
- Drive display tablets with real-time updates via SSE

## Stack

- Node.js + TypeScript
- Fastify
- Zod (request validation)
- OpenAPI via Fastify Swagger
- Vitest (unit and integration tests)
- PostgreSQL (pg driver, plain SQL migrations)
- Sharp (image processing)
- `@fastify/multipart` (file uploads)
- Google Cloud Storage (photo and document file storage)

## Engineering principles

- Strict layering: `api` (routes) → `domain` (use-cases, entities) → `data` (repositories, services)
- Explicit household-level access checks on every protected resource
- Strongly typed contracts and DTO validation with Zod
- Maintainability-first with proactive refactoring

## Project structure

```
src/
├── config/         # Environment and feature config
├── data/
│   ├── db/         # PostgreSQL connection
│   ├── repositories/  # Concrete repository implementations
│   └── services/   # Email and storage providers
├── domain/
│   ├── entities/   # Domain entities (TypeScript interfaces)
│   ├── errors/     # Typed domain error classes
│   ├── repositories/  # Repository interfaces (ports)
│   ├── security/   # Token generation and verification
│   ├── services/   # Domain services (occurrence generator, notifier…)
│   └── usecases/   # Business logic, organized by domain
├── plugins/        # Fastify plugins (authContext)
├── routes/         # HTTP route handlers, organized by domain
│   └── households/ # All household-scoped routes
├── scripts/        # Utility scripts (migrate, clearDatabase, startRailway)
└── types/          # Fastify type augmentations
migrations/         # Versioned SQL migrations
templates/          # Email HTML/text templates
docs/               # Feature and operational documentation
scripts/            # Python scripts (agents_proof, docs_guard)
scripts-db/         # DB utility scripts
```

Key root files:
- `AGENTS.md`: cross-cutting engineering directives
- `ARCHITECTURE.md`: technical source of truth
- `CONTRIBUTING.md`: workflow, commit and hook expectations
- `CHANGELOG.md`: release and change history
- `TODO.md`: active backlog
- `IDEAS.md`: product and technical ideas

## Quick start

```bash
npm install
npm run dev
```

API runs on `http://localhost:4000` by default.

## PostgreSQL configuration

```bash
cp .env.example .env
```

Set:
- `PERSISTENCE_DRIVER=postgres`
- `DATABASE_URL=postgres://<user>:<password>@<host>:<port>/<database>`

Then run migrations:

```bash
npm run migrate
```

## OpenAPI contract

- Swagger UI: `GET /docs`
- OpenAPI JSON: `GET /documentation/json`

## Install contribution hooks

```bash
python3 -m pip install --user pre-commit
pre-commit install --install-hooks --hook-type pre-commit --hook-type commit-msg
```

## Quality checks

```bash
npm run lint
npm run typecheck
npm run test
npm run quality:check
```

## Commit requirements

- Format: `type(name): summary`, blank line, description
- Allowed types: `feat`, `fix`, `refactor`, `test`, `docs`, `chore`
- Mandatory before commit:

```bash
python3 scripts/agents_proof.py --refresh
```

## API endpoints

### Core

| Method | Path | Description |
|--------|------|-------------|
| GET | `/health` | Health check |
| GET | `/docs` | Swagger UI |

### Households & members

| Method | Path | Description |
|--------|------|-------------|
| POST | `/v1/households` | Create household |
| GET | `/v1/households` | List user households |
| GET | `/v1/households/:householdId/overview` | Household overview |
| GET | `/v1/households/:householdId/members` | List members |
| PATCH | `/v1/households/:householdId/members/:memberId/role` | Update member role |
| DELETE | `/v1/households/:householdId/members/:memberId` | Remove member |
| POST | `/v1/households/:householdId/leave` | Leave household |

### Invitations

| Method | Path | Description |
|--------|------|-------------|
| POST | `/v1/households/:householdId/invitations/bulk` | Bulk invite |
| GET | `/v1/households/invitations/my-pending` | My pending invitations |
| GET | `/v1/households/invitations/resolve` | Resolve invitation by token |
| POST | `/v1/households/invitations/accept` | Accept invitation |
| POST | `/v1/households/:householdId/invitations/:invitationId/cancel` | Cancel invitation |
| POST | `/v1/households/:householdId/invitations/:invitationId/resend` | Resend invitation |
| GET | `/v1/households/:householdId/invitations` | List household invitations |

### Appointments

| Method | Path | Description |
|--------|------|-------------|
| GET | `/v1/households/:householdId/appointments` | List appointments |
| POST | `/v1/households/:householdId/appointments` | Create appointment |
| PATCH | `/v1/households/:householdId/appointments/:appointmentId` | Update appointment |
| DELETE | `/v1/households/:householdId/appointments/:appointmentId` | Delete appointment |
| GET | `/v1/households/:householdId/appointments/:appointmentId/occurrences` | List occurrences |
| PATCH | `/v1/households/:householdId/appointments/:appointmentId/occurrences/:date` | Modify occurrence |
| DELETE | `/v1/households/:householdId/appointments/:appointmentId/occurrences/:date` | Cancel occurrence |
| POST/PATCH/DELETE | `/v1/households/:householdId/appointments/:appointmentId/reminders` | Manage reminders |

### Medications

| Method | Path | Description |
|--------|------|-------------|
| GET | `/v1/households/:householdId/medications` | List medications |
| POST | `/v1/households/:householdId/medications` | Create medication |
| PATCH | `/v1/households/:householdId/medications/:medicationId` | Update medication |
| DELETE | `/v1/households/:householdId/medications/:medicationId` | Delete medication |
| GET | `/v1/medications/autocomplete` | Medication name autocomplete |
| POST/PATCH/DELETE | `/v1/households/:householdId/medications/:medicationId/reminders` | Manage reminders |

### Tasks

| Method | Path | Description |
|--------|------|-------------|
| GET | `/v1/households/:householdId/tasks` | List tasks |
| POST | `/v1/households/:householdId/tasks` | Create task |
| PATCH | `/v1/households/:householdId/tasks/:taskId` | Update task |
| DELETE | `/v1/households/:householdId/tasks/:taskId` | Delete task |
| POST | `/v1/households/:householdId/tasks/:taskId/complete` | Complete task |

### Documents

| Method | Path | Description |
|--------|------|-------------|
| GET | `/v1/households/:householdId/documents/roots` | List root folders |
| GET | `/v1/households/:householdId/documents/folders` | List folder content |
| POST | `/v1/households/:householdId/documents/folders` | Create folder |
| PATCH | `/v1/households/:householdId/documents/folders/:folderId` | Update folder |
| DELETE | `/v1/households/:householdId/documents/folders/:folderId` | Delete folder |
| GET | `/v1/households/:householdId/documents/search` | Search documents |
| POST | `/v1/households/:householdId/documents` | Create document |
| PATCH | `/v1/households/:householdId/documents/:documentId` | Update document |
| DELETE | `/v1/households/:householdId/documents/:documentId` | Delete document |

### Display tablets

| Method | Path | Description |
|--------|------|-------------|
| GET | `/v1/households/:householdId/display-tablets` | List tablets |
| POST | `/v1/households/:householdId/display-tablets` | Create tablet |
| PATCH | `/v1/households/:householdId/display-tablets/:tabletId` | Update tablet |
| DELETE | `/v1/households/:householdId/display-tablets/:tabletId` | Delete tablet |
| POST | `/v1/households/:householdId/display-tablets/:tabletId/revoke` | Revoke tablet |
| POST | `/v1/households/:householdId/display-tablets/:tabletId/regenerate-token` | Regenerate setup token |
| GET | `/v1/households/:householdId/display-tablets/:tabletId/config` | Get tablet config |
| GET | `/v1/households/:householdId/display-tablets/:tabletId/sse` | SSE stream |
| POST | `/v1/display-tablets/authenticate` | Authenticate tablet (no user auth) |
| POST | `/v1/display-tablets/session/refresh` | Refresh tablet session |

### Photo screens (display tablets)

| Method | Path | Description |
|--------|------|-------------|
| GET/POST | `/v1/households/:householdId/display-tablets/:tabletId/photo-screens` | List/Create screens |
| GET/PUT/DELETE | `/v1/households/:householdId/display-tablets/:tabletId/photo-screens/:screenId` | Manage screen |
| POST | `/v1/.../photo-screens/:screenId/photos` | Upload photo |
| PUT/DELETE | `/v1/.../photo-screens/:screenId/photos/:photoId` | Update/Delete photo |
| PUT | `/v1/.../photo-screens/:screenId/photos/reorder` | Reorder photos |

### User & privacy

| Method | Path | Description |
|--------|------|-------------|
| GET/PATCH | `/v1/users/profile` | User profile |
| GET/PATCH | `/v1/users/privacy-settings` | Privacy settings |

### Observability

| Method | Path | Description |
|--------|------|-------------|
| GET | `/v1/observability/invitations/email-metrics` | Invitation email metrics |

## Authentication

All non-health endpoints require authentication context via headers:

- `x-user-id`
- `x-user-email`
- `x-user-first-name`
- `x-user-last-name`

Display tablets authenticate via two methods:
1. `x-tablet-session-token` — signed JWT returned by `POST /v1/display-tablets/authenticate`
2. `x-tablet-id` + `x-tablet-token` — raw credentials (DB-validated on each request)

See `docs/TABLET_AUTHENTICATION_FLOW.md` for the full tablet auth flow.

## Mobile deep-link integration

- Invitation deep-link: `seniorhub://invite?type=household-invite&token=<signed_token>`
- Optional web fallback: configure `INVITATION_WEB_FALLBACK_URL` in `.env`

## Railway deployment

### Required environment variables

| Variable | Description |
|----------|-------------|
| `PERSISTENCE_DRIVER` | `postgres` |
| `DATABASE_URL` | Provided automatically by Railway PostgreSQL |
| `TOKEN_SIGNING_SECRET` | Strong secret, at least 16 chars |
| `HOST` | `0.0.0.0` |
| `EMAIL_PROVIDER` | `resend` (or `console` for dev) |
| `RESEND_API_KEY` | From resend.com |
| `EMAIL_FROM` | e.g. `Senior Hub <noreply@yourdomain.com>` |
| `INVITATION_WEB_FALLBACK_URL` | Mobile/web invite fallback URL |
| `GCS_BUCKET_NAME` | Google Cloud Storage bucket |
| `GCS_PROJECT_ID` | GCS project ID |
| `GOOGLE_CLOUD_CREDENTIALS` | GCS service account JSON (base64 or inline) |

`PORT` is provided by Railway automatically.

### Build and start

- Build: `npm ci && npm run build`
- Start: `npm run start:railway` (runs migrations automatically when `PERSISTENCE_DRIVER=postgres`)
- Healthcheck: `GET /health`

### Database operations

```bash
# Reset Railway database (destructive)
npm run db:clear:railway
```

## Governance

Before every commit:

```bash
python3 scripts/agents_proof.py --refresh
npm run quality:check
```
