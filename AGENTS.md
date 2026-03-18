# AGENTS.md

> Cross-cutting engineering directives for `seniorhub-backend`.
> Any new transversal directive must be added here in the same work cycle.
> Read this file completely before starting any task.

## Project objective

Build a secure, maintainable backend platform for Senior Hub that reliably shares household data between trusted members, and drives display tablets with real-time updates.

## Codebase orientation

This is a **Node.js + TypeScript + Fastify** backend with strict layering:
- Routes (`src/routes/`) → Use cases (`src/domain/usecases/`) → Repositories (`src/data/repositories/`)
- Entities: `src/domain/entities/`
- Errors: `src/domain/errors/`
- Storage (GCS): `src/data/services/storage/`
- Email: `src/data/services/email/`
- Auth middleware: `src/plugins/authContext.ts`

Active domains: `households`, `invitations`, `appointments`, `medications`, `reminders`, `tasks`, `displayTablets`, `photoScreens`, `photos`, `documents`, `privacySettings`.

The **technical source of truth** is `ARCHITECTURE.md`. Read it when you need structural context.

## General directives

- Prioritize clarity, reliability, and security over shortcuts.
- Maintain strict layering: API, domain, data/infrastructure.
- Keep modules small and composable; avoid god classes/services.
- Keep files short and focused (SRP); extract helpers/types/constants when complexity grows.
- Prioritize maintainability; do not hesitate to perform significant refactors when they reduce complexity.
- Keep business rules in domain/use-case layer, not in route handlers.
- Never expose sensitive/health-related data without explicit access checks.
- Centralize non-sensitive configuration in dedicated config modules.
- Never commit secrets.
- Use explicit naming and strongly typed interfaces.
- Handle `loading`, `success`, and `error` states explicitly in API responses.
- Return errors in an actionable and safe way (no internal stack traces).

## Code conventions

- Technical identifiers must be in English.
- User-facing API messages must be in English.
- Avoid unjustified `any`/implicit types.
- Keep functions focused (SRP) and files cohesive.
- Use explicit DTO validation (Zod) for all externally-exposed payloads.
- Preserve stable API contracts; document every contract-breaking change in `CHANGELOG.md`.

## API and data directives

- All household data must be scoped by `householdId`.
- Membership role checks must be explicit in use-cases via `HouseholdAccessValidator`.
- Any mutation endpoint must validate payloads with Zod.
- Keep transport DTOs separate from domain entities when complexity increases.
- Display tablets are **read-only**; always block write operations at the use-case level for tablet requesters.
- Tablet userId is synthetic (`"tablet:{tabletId}"`); do not attempt member DB lookups for tablet contexts.

## Storage (GCS) directives

- All file uploads (photos, documents) go through the `StorageService` abstraction (`src/data/services/storage/`), never directly through the GCS SDK.
- Photo path: `households/{householdId}/tablets/{tabletId}/photos/{photoId}.{ext}`
- Document path: `documents/{householdId}/{folderId}/{timestamp}_{originalFilename}`
- Always delete files from GCS when the corresponding DB record is deleted.
- Image processing uses Sharp: JPEG/PNG/WebP only, 5 MB max upload, ~1 MB target after compression.

## Domain errors

Always use typed errors from `src/domain/errors/`:
- `NotFoundError` → 404
- `ForbiddenError` → 403
- `ConflictError` → 409
- `ValidationError` → 400
- `BusinessRuleError` → 422
- Photo/document-specific errors for file validation and limit enforcement

Never throw `new Error(...)` directly in the domain layer.

## Minimum quality before merge

- Lint/format checks green.
- Typecheck green.
- Unit tests for sensitive business rules.
- Integration/e2e coverage for access-control critical flows.
- Documentation updated if architecture/flow changes.

## Contribution workflow

- Keep commits small and focused.
- One main intention per commit: `feat`, `fix`, `refactor`, `test`, `docs`, `chore`.
- Commit message format is mandatory: `type(name): summary`, blank line, then commit description.
- **Commit messages must always be written to a file**, never directly on the command line with `-m`.
  - Write the file content incrementally in batches (e.g. 300 characters at a time) to avoid overwhelming the tool.
- Separate functional code, refactor, tests, and docs into distinct commits whenever possible.
- For immediate corrections to the latest commit (small omissions/typos), prefer `git commit --amend --no-edit`.
- `pre-commit` hook is mandatory.
- AGENTS proof is mandatory before commit:
  ```bash
  python3 scripts/agents_proof.py --refresh
  ```
- API quality gate before merge:
  ```bash
  npm run quality:check
  ```

## Cross-project coordination

- If a task requires changes in the mobile app, document it in the app's `TODO.md`.
- When backend changes impact the app (new endpoints, contract changes), add corresponding tasks to the app's TODO.
- Keep backend and app TODOs in sync for coordinated feature delivery.

## Mandatory documentation maintenance

These files are the reference baseline and must stay consistent:

| File | Role |
|------|------|
| `README.md` | Project overview, stack, all endpoints, deployment |
| `ARCHITECTURE.md` | Technical source of truth: layers, domains, flows, constraints |
| `AGENTS.md` | Engineering directives for contributors and AI agents |
| `CHANGELOG.md` | Release and change history |
| `TODO.md` | Active and future backlog only (no completed items) |
| `IDEAS.md` | Product and technical ideas not yet scheduled |
| `CONTRIBUTING.md` | Commit format, hooks, documentation policy |

Feature documentation goes in `docs/`:

| File | Content |
|------|---------|
| `docs/DOCUMENTS_SYSTEM.md` | Documents domain spec and API |
| `docs/PHOTO_SCREENS_FEATURE.md` | Photo screens feature spec |
| `docs/PHOTO_SCREENS_IMPLEMENTATION_COMPLETE.md` | Photo screens implementation guide |
| `docs/TABLET_AUTHENTICATION_FLOW.md` | Full tablet auth flow |
| `docs/TABLET_PHOTO_SCREENS_INTEGRATION.md` | SSE + photo screens integration |
| `docs/AUTHENTICATION.md` | General auth patterns |
| `docs/PRIVACY_SETTINGS.md` | Privacy settings domain |
| `docs/GCS_SETUP.md` | Google Cloud Storage setup |
| `docs/RESEND_SETUP.md` | Resend email provider setup |
| `docs/EMAIL_OPTIONS.md` | Email provider options |

## Architecture maintenance

`ARCHITECTURE.md` is the technical source of truth.
Any structural change (new domain, new route module, new entity, migration) must be reflected there in the same work cycle.
