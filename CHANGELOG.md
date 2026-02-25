# Changelog

All notable changes to `seniorhub` will be documented in this file.

The format is inspired by Keep a Changelog.

## [Unreleased]

### Added
- Initial governance and architecture baseline.
- API scaffolding for household data sharing.
- Strong pre-commit and commit-msg hooks (docs guard, quality gate, commit format).
- CONTRIBUTING guide with mandatory workflow and checks.
- PostgreSQL persistence implementation for household onboarding flows.
- SQL migration baseline for households, members, and invitations.
- Migration runner command (`npm run migrate`) with applied-version tracking.
- Strict request auth context middleware and explicit household role guard usage.
- Invitation lifecycle completion: cancellation endpoint, signed token validation, and acceptance fallback by authenticated email.
- Invitation email delivery pipeline with template, deep-link/fallback URLs, retry queue, and observability metrics endpoint.
- Audit event storage for invitation creation, acceptance, and cancellation.
- OpenAPI contract generation and Swagger UI exposure.
- CI workflow for lint, typecheck, tests, docs guard, and AGENTS proof checks.
- Expanded test suite with invitation lifecycle unit tests and onboarding integration tests.
- Separated email templates from code into `api/templates/emails/` directory structure with text-based template files supporting variable substitution and conditional blocks.
- GET `/v1/households/:householdId/members` endpoint to retrieve household member list with access control.
- `ListHouseholdMembersUseCase` for fetching household members with role-based authorization.
- Database clearing scripts: TypeScript script (`api/src/scripts/clearDatabase.ts`) and shell helper (`api/scripts/clear-railway-db.sh`) for Railway deployments.
- Real email sending with Resend integration (`ResendEmailProvider`) for production invitation delivery.
- Configurable email provider system with `EMAIL_PROVIDER` environment variable (supports 'console' for dev and 'resend' for production).

### Changed
- Renamed `GET /v1/households/my-memberships` to `GET /v1/households/my-households` for app integration compatibility.
