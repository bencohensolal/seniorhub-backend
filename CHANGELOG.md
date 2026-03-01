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

- Gmail SMTP email provider (`GmailSmtpProvider`) for free invitation email delivery using nodemailer.
- Gmail SMTP configuration support with `GMAIL_USER` and `GMAIL_APP_PASSWORD` environment variables.
- Complete Gmail SMTP setup guide (`docs/GMAIL_SMTP_SETUP.md`) with app password configuration instructions.
- GET `/v1/households/:householdId/invitations` endpoint to list sent invitations for household admins.
- POST `/v1/households/:householdId/invitations/:invitationId/cancel` endpoint to cancel pending invitations.
- POST `/v1/households/:householdId/invitations/:invitationId/resend` endpoint to resend invitation emails with new tokens.
- `ListHouseholdInvitationsUseCase` for retrieving sent invitations with caregiver authorization.
- `CancelInvitationUseCase` for cancelling pending invitations.
- `ResendInvitationUseCase` for regenerating invitation tokens and resending emails.
- Railway deployment resolution guide (`DEPLOYMENT_RESOLUTION.md`) documenting Docker cache mount conflict fixes.

### Changed
- Renamed `GET /v1/households/my-memberships` to `GET /v1/households/my-households` for app integration compatibility.
- Updated email provider configuration to support 'gmail' option alongside 'console' and 'resend'.
- Railway deployment now uses pure Nixpacks build process without custom buildCommand to prevent cache mount conflicts.

### Fixed
- Railway deployment Docker cache mount conflict ("Device or resource busy" errors) by removing custom buildCommand.
- Service deployment stability by letting Nixpacks manage build phases natively through nixpacks.toml.
- Gmail SMTP now successfully sending invitation emails in production (500 emails/day free tier).
- Medication creation error with Google OAuth user IDs by changing `medications.created_by_user_id` column type from UUID to TEXT (migration 005).
- Medication deletion endpoint response serialization error by changing to REST-compliant 204 No Content status.
- Fastify JSON parser rejecting DELETE requests with empty body by implementing custom parser that allows empty bodies for DELETE method.

## [2026-01-03] - Advanced Medication Reminders

### Added
- `medication_reminders` table (migration 006) with day-of-week scheduling support.
- MedicationReminder domain entity with TypeScript type definitions.
- Repository methods for reminder CRUD operations in HouseholdRepository interface.
- Complete PostgreSQL implementation of reminder methods in PostgresHouseholdRepository.
- Four new use cases: ListMedicationRemindersUseCase, CreateReminderUseCase, UpdateReminderUseCase, DeleteReminderUseCase.
- Zod validation schemas for reminder creation and updates with time format (HH:MM) and days-of-week validation.
- Four REST API endpoints for medication reminders:
  - GET `/v1/households/:householdId/medications/:medicationId/reminders` - List all reminders
  - POST `/v1/households/:householdId/medications/:medicationId/reminders` - Create reminder
  - PUT `/v1/households/:householdId/medications/:medicationId/reminders/:reminderId` - Update reminder
  - DELETE `/v1/households/:householdId/medications/:medicationId/reminders/:reminderId` - Delete reminder
- Flexible reminder configuration: multiple reminders per medication, day-of-week selection (0=Sunday to 6=Saturday), enable/disable toggle.
- Proper access control: all members can view reminders, only caregivers can create/update/delete.
- Database constraints ensuring at least one day selected and unique day values in arrays.
