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
