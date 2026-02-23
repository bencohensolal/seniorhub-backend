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
- `GET /v1/households/:householdId/overview`

Authentication context is currently provided through headers:

- `x-user-id`
- `x-user-email`
- `x-user-first-name`
- `x-user-last-name`

## Governance checklist

Before commit:

```bash
python3 scripts/agents_proof.py --refresh
```
