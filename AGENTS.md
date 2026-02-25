# AGENTS.md

## Project objective

Build a secure, maintainable backend platform for Senior Hub that can reliably share household data between trusted members.

## General directives

- Prioritize clarity, reliability, and security over shortcuts.
- Maintain strict layering: API, domain, data/infrastructure.
- Keep modules small and composable; avoid god classes/services.
- Keep files short and focused (SRP), extract helpers/types/constants when complexity grows.
- Prioritize maintainability continuously; do not hesitate to perform significant refactors when they reduce complexity.
- Keep business rules in domain/use-case layer, not in route handlers.
- Never expose sensitive/health-related data without explicit access checks.
- Centralize non-sensitive configuration in dedicated config modules.
- Never commit secrets.
- Use explicit naming and strongly typed interfaces.
- Handle `loading`, `success`, and `error` states explicitly in API responses.
- Display/return errors in an actionable and safe way.

## Code conventions

- Technical identifiers must be in English.
- User-facing API messages must be in English.
- Avoid unjustified `any`/implicit types.
- Keep functions focused (SRP) and files cohesive.
- Use explicit DTO validation for all externally-exposed payloads.
- Preserve stable API contracts and document every contract-breaking change.

## API and data directives

- Household data must be scoped by `householdId`.
- Membership role checks must be explicit in use-cases.
- Any mutation endpoint must validate payloads with Zod.
- Keep transport DTOs separate from domain entities when complexity increases.

## Minimum quality before merge

- Lint/format checks green.
- Typecheck green.
- Unit tests for sensitive business rules.
- Add integration/e2e coverage for access-control critical flows as soon as corresponding endpoints exist.
- Documentation updated if architecture/flow changes.

## Contribution workflow

- Keep commits small and focused.
- One main intention per commit (`feat`, `fix`, `refactor`, `test`, `docs`, `chore`).
- Commit message format is mandatory: `type(name): summary`, blank line, then commit description.
- Separate functional code, refactor, tests, and docs into distinct commits whenever possible.
- For immediate corrections to the latest commit (small omissions/typos), prefer `git commit --amend --no-edit`.
- Any new user directive with transversal impact must be added to `AGENTS.md` in the same work cycle.
- `pre-commit` hook is mandatory.
- AGENTS proof is mandatory before commit:
  - `python3 scripts/agents_proof.py --refresh`
- API quality gate before merge:
  - `cd api && npm run quality:check`

## Cross-project coordination

- If a task requires changes in the mobile app, document it in the app's `TODO.md` file.
- When backend changes impact the app (new endpoints, contract changes, etc.), add corresponding tasks to the app's TODO.
- Keep backend and app TODOs in sync for coordinated feature delivery.

## Mandatory documentation maintenance

These files are the reference baseline and must stay consistent:

- `README.md`
- `CHANGELOG.md`
- `AGENTS.md`
- `ARCHITECTURE.md`
- `TODO.md`
- `IDEAS.md`
- `CONTRIBUTING.md`

## Architecture maintenance

`ARCHITECTURE.md` is the technical source of truth.
Any structural change must be reflected there in the same change.
