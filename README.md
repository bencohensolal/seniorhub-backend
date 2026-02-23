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

## Project structure

- `api/`: API service
- `AGENTS.md`: cross-cutting engineering directives
- `ARCHITECTURE.md`: technical source of truth
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

## Quality checks

```bash
cd api
npm run lint
npm run typecheck
npm run test
```

## Governance checklist

Before commit:

```bash
python3 scripts/agents_proof.py --refresh
```
