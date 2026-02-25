# seniorhub

Backend-first foundation for Senior Hub, focused on securely sharing household data across family members and caregivers.

## Objective

Build a robust API platform that can:
- manage households
- manage members and roles
- share key care information across the same household
- enforce clear access boundaries and traceability

## Stack (initial)

- Node.js + TypeScript
- Fastify
- Zod for request validation
- OpenAPI via Fastify Swagger
- Vitest for unit testing

## Engineering principles

- strict layering (`api`, `domain`, `data`)
- explicit household-level access checks
- strongly typed contracts
- maintainability-first evolution with proactive refactoring

## Project structure

- `api/`: API service
- `AGENTS.md`: cross-cutting engineering directives
- `ARCHITECTURE.md`: technical source of truth
- `CONTRIBUTING.md`: workflow, commit and hook expectations
- `CHANGELOG.md`: release/change history
- `TODO.md`: actionable backlog
- `IDEAS.md`: product and technical ideas

## Quick start

```bash
cd api
npm install
npm run dev
```

API will run on `http://localhost:4000` by default.

## Persistence configuration

By default, API routes use in-memory repositories.

To enable PostgreSQL persistence:

```bash
cd api
cp .env.example .env
```

Set:

- `PERSISTENCE_DRIVER=postgres`
- `DATABASE_URL=postgres://<user>:<password>@<host>:<port>/<database>`

Then run migrations:

```bash
cd api
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
cd api
npm run lint
npm run typecheck
npm run test
npm run quality:check
```

## Commit requirements

- Commit format: `type(name): summary`, blank line, description
- Allowed types: `feat`, `fix`, `refactor`, `test`, `docs`, `chore`
- Mandatory before commit:

```bash
python3 scripts/agents_proof.py --refresh
```

## API baseline endpoint

- `GET /health`
- `POST /v1/households`
- `POST /v1/households/:householdId/invitations/bulk`
- `GET /v1/households/invitations/my-pending`
- `GET /v1/households/invitations/resolve?token=<token>`
- `POST /v1/households/invitations/accept`
- `POST /v1/households/:householdId/invitations/:invitationId/cancel`
- `GET /v1/households/:householdId/overview`
- `GET /v1/observability/invitations/email-metrics`

Authentication context is currently provided through headers:

- `x-user-id`
- `x-user-email`
- `x-user-first-name`
- `x-user-last-name`

All non-health endpoints require these headers. Missing authentication context returns `401`.

## Mobile integration notes

- Invitation deep-link format:
	- `seniorhub://invite?type=household-invite&token=<signed_token>`
- Optional web fallback:
	- configure `INVITATION_WEB_FALLBACK_URL` in `api/.env`
	- API returns both `deepLinkUrl` and `fallbackUrl` in invitation deliveries
- Invitation acceptance supports:
	- direct token (`POST /v1/households/invitations/accept` with `{ token }`)
	- selected invitation id (`{ invitationId }`)
	- email-based pending selection (`{}` with authenticated invitee email)

## Railway deployment

This repository is monorepo-style. The API service lives in `api/`.

### 1) Create service

- In Railway, create a new project from this GitHub repo.
- For the backend service, set **Root Directory** to `api`.

If you keep the repository root as service root, the repo now includes:

- `railway.toml` at root
- `nixpacks.toml` at root

These files force Railway to build and start from `api/` (no `start.sh` needed).

### 2) Add PostgreSQL

- Add a Railway PostgreSQL service in the same project.
- Railway provides `DATABASE_URL` automatically once linked.

### 3) Required variables

Set these variables on the API service:

- `PERSISTENCE_DRIVER=postgres`
- `TOKEN_SIGNING_SECRET=<strong secret, at least 16 chars>`
- `INVITATION_WEB_FALLBACK_URL=<your mobile/web invite fallback URL>`
- `HOST=0.0.0.0`
- `EMAIL_PROVIDER=resend` (use 'console' for dev/testing)
- `RESEND_API_KEY=<your Resend API key>` (get from https://resend.com)
- `EMAIL_FROM=Senior Hub <noreply@yourdomain.com>` (must use verified domain)

`PORT` is provided by Railway automatically.

### 4) Build and start

`api/railway.json` is already configured to:

- build with `npm ci && npm run build`
- run `npm run start:railway` (migrations run automatically only when `PERSISTENCE_DRIVER=postgres`)
- use `/health` as healthcheck

### 5) Verify deployment

After first deploy:

- `GET /health`
- `GET /docs`
- `GET /documentation/json`

## Railway database operations

### Clear all data from Railway database

To reset the database (useful for testing or fresh starts):

```bash
cd api
./scripts/clear-railway-db.sh
```

This script:
- Fetches the public database URL from Railway
- Truncates all tables (keeps schema and migrations)
- Verifies tables are empty

**Note:** This operation is destructive. All data will be permanently deleted.

## Governance checklist

Before commit:

```bash
python3 scripts/agents_proof.py --refresh
```
