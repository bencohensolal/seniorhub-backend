# Changelog

All notable changes to `seniorhub` will be documented in this file.

The format is inspired by Keep a Changelog.

## [Unreleased]

### Added
- **Photo Screens for Display Tablets** - Complete photo gallery feature:
  - Added `photo_screens` and `photos` tables (migration 018) with proper constraints and indexes.
  - PhotoScreen and Photo domain entities with full TypeScript type definitions.
  - Storage service abstraction supporting AWS S3 and Google Cloud Storage.
  - Image processing with Sharp library (compression, resizing, format conversion).
  - 9 REST API endpoints for complete photo management:
    - POST/GET/PUT/DELETE photo screens
    - POST/PUT/DELETE individual photos
    - PUT photo reordering
  - Integration with tablet config system:
    - Added `photoGallery` screen type to TabletDisplayConfig
    - Full validation support in config schemas
    - Photo screens appear in tablet config responses
  - Security and validation:
    - Caregiver-only permissions for create/update/delete
    - File type validation (JPEG, PNG, WebP only)
    - File size validation (5MB max upload, 1MB target after compression)
    - Limit enforcement (5 screens per tablet, 6 photos per screen)
    - 6 new domain errors (MaxPhotoScreensReached, MaxPhotosReached, FileTooLarge, etc.)
  - Features:
    - 3 display modes (slideshow, mosaic, single)
    - Slideshow configuration (duration, transition, order)
    - Photo captions (optional, max 100 chars)
    - Photo reordering within screens
    - Automatic image optimization
  - Documentation:
    - Complete implementation guide
    - AWS S3 + CloudFront setup guide
    - Google Cloud Storage setup guide
    - API documentation with examples
- **Display Tablet Configuration** for customizing tablet display settings:
  - Added `config` JSONB column to `display_tablets` table (migration 017) for persisting display preferences.
  - TabletDisplayConfig TypeScript types with comprehensive screen configuration interfaces.
  - Support for 6 screen types: summary, datetime, appointments, tasks, weekCalendar, monthCalendar.
  - Type-specific settings for each screen with full validation (colors, fonts, time formats, display modes).
  - Configuration validation schemas with Zod ensuring data integrity.
  - 2 new REST API endpoints:
    - GET `/v1/households/:householdId/display-tablets/:tabletId/config` - Retrieve tablet configuration
    - PUT `/v1/households/:householdId/display-tablets/:tabletId/config` - Update tablet configuration
  - Configuration features:
    - General settings: slideDuration (1-60s), dataCacheDuration (1-60min), dataRefreshInterval (1-60min)
    - Screen ordering with unique consecutive indices (0, 1, 2...)
    - Per-screen enable/disable toggles
    - Automatic `lastUpdated` timestamp tracking
    - Returns `null` for unconfigured tablets (mobile app uses built-in defaults)
  - Access control: all household members can read, only caregivers can modify.
- **Display Tablets feature** for read-only household monitoring:
  - `display_tablets` table (migration 016) with secure token storage (SHA-256 hashing).
  - DisplayTablet domain entity with token security infrastructure.
  - 7 REST API endpoints for tablet management:
    - GET `/v1/households/:householdId/display-tablets` - List tablets
    - POST `/v1/households/:householdId/display-tablets` - Create tablet (returns token once)
    - PATCH `/v1/households/:householdId/display-tablets/:tabletId` - Update tablet name/description
    - POST `/v1/households/:householdId/display-tablets/:tabletId/revoke` - Revoke tablet access
    - DELETE `/v1/households/:householdId/display-tablets/:tabletId` - Delete revoked tablet
    - POST `/v1/households/:householdId/display-tablets/:tabletId/regenerate-token` - Generate new token
    - POST `/v1/display-tablets/authenticate` - Authenticate tablet (no user auth required)
  - Security features:
    - 64-character hexadecimal tokens generated with crypto.randomBytes(32)
    - SHA-256 token hashing for secure storage (plain token never stored)
    - Token returned only once at creation/regeneration
    - Immediate revocation support with status tracking
    - Maximum 10 active tablets per household limit
    - Role-based access: only caregivers and family can create/manage tablets (not seniors)
  - Read-only access infrastructure ready for implementation
  - Token format validation and authentication flow with last_active_at tracking
- 
- Comprehensive authentication documentation (`docs/AUTHENTICATION.md`) covering unified middleware architecture, JWT and header-based auth, security considerations, and migration guide.
- Authentication test script (`test-auth-middleware.sh`) for validating both authentication methods.
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
- POST `/v1/households/:householdId/invitations/:invitationId/reactivate` endpoint to reactivate expired invitations with new tokens and automatic email delivery.
- `ListHouseholdInvitationsUseCase` for retrieving sent invitations with caregiver authorization.
- `CancelInvitationUseCase` for cancelling pending invitations.
- `ResendInvitationUseCase` for regenerating invitation tokens and resending emails.
- `ReactivateInvitationUseCase` for reactivating expired invitations with rate limiting (max 3 reactivations).
- Invitation reactivation tracking with `reactivation_count` column in database (migration 014).
- `invitation_reactivated` audit event action for tracking invitation reactivations.
- Railway deployment resolution guide (`DEPLOYMENT_RESOLUTION.md`) documenting Docker cache mount conflict fixes.

### Changed
- Renamed `GET /v1/households/my-memberships` to `GET /v1/households/my-households` for app integration compatibility.
- Updated email provider configuration to support 'gmail' option alongside 'console' and 'resend'.
- Railway deployment now uses pure Nixpacks build process without custom buildCommand to prevent cache mount conflicts.

### Fixed
- **Critical: Appointment occurrences missing start/end fields**: Fixed tablet display showing `start: undefined`.
  - Added `start` and `end` ISO datetime fields to `GeneratedOccurrence` entity.
  - Implemented `computeISODateTime()` and `computeEndDateTime()` helpers in `ListAppointmentOccurrencesUseCase`.
  - All occurrence responses now include properly formatted ISO datetime strings (e.g., `"2026-03-09T11:00:00.000Z"`).
  - End time is computed from start + duration when duration is present, null otherwise.
- **Critical: One-time appointments not generating occurrences**: Fixed tablet display not showing non-recurring appointments.
  - Updated `ListAppointmentOccurrencesUseCase` to handle `recurrence: 'none'` appointments.
  - One-time appointments now generate a single occurrence if their date falls within the requested range.
  - Previously returned empty array for all non-recurring appointments.
- **Display Tablets access denied issue**: Tablets can now successfully read household data after authentication.
  - Updated `HouseholdAccessValidator.ensureMember()` to recognize tablet requests (synthetic userId format `"tablet:{tabletId}"`) and skip member validation.
  - Tablets are validated at the route level via `verifyTabletHouseholdAccess()` before reaching use-cases.
  - All read operations (appointments, medications, tasks, occurrences) now accept tablet authentication.
  - Write operations properly reject tablet requests with appropriate error messages.
  - Fixed TypeScript null handling in use-cases that expect member entities.
- Railway deployment Docker cache mount conflict ("Device or resource busy" errors) by removing custom buildCommand.
- Service deployment stability by letting Nixpacks manage build phases natively through nixpacks.toml.
- Gmail SMTP now successfully sending invitation emails in production (500 emails/day free tier).
- Medication creation error with Google OAuth user IDs by changing `medications.created_by_user_id` column type from UUID to TEXT (migration 005).
- Medication deletion endpoint response serialization error by changing to REST-compliant 204 No Content status.
- Fastify JSON parser rejecting DELETE requests with empty body by implementing custom parser that allows empty bodies for DELETE method.
- Invalid UUID parameter validation causing 500 errors when non-UUID values (e.g., Google user IDs) were passed as householdId, medicationId, or reminderId. All UUID parameters now validated with `.uuid()` Zod schema before database queries.
- Database constraint violation error when creating invitations with 'family' or 'intervenant' roles. Updated CHECK constraints on `household_members.role` and `household_invitations.assigned_role` to include all four valid roles: 'senior', 'caregiver', 'family', 'intervenant' (migration 015).

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

## [2026-01-03] - Code Quality & Architecture Improvements

### Added
- Typed domain errors system (`src/domain/errors/DomainErrors.ts`) with 5 error classes:
  - `NotFoundError`, `ForbiddenError`, `ConflictError`, `ValidationError`, `BusinessRuleError`
- Centralized error handler (`src/routes/errorHandler.ts`) with `handleDomainError()` function
- Shared access validator (`src/domain/usecases/shared/HouseholdAccessValidator.ts`) reducing code duplication
- Domain-based UseCase organization with subdirectories:
  - `usecases/households/` (10 files) - Household management
  - `usecases/invitations/` (10 files) - Invitation lifecycle
  - `usecases/medications/` (5 files) - Medication management
  - `usecases/reminders/` (4 files) - Medication reminders
  - `usecases/shared/` (2 files) - Shared utilities

### Changed
- Migrated 20/20 UseCases from `throw new Error()` to typed domain errors (100% coverage)
- Migrated 23/24 API routes to use centralized `handleDomainError()` (96% coverage)
- Reorganized 29 UseCase files from flat structure into domain-based subdirectories
- Updated all import paths across routes and UseCases to reflect new structure
- Improved error handling consistency across all layers

### Removed
- 4 obsolete documentation files (~1,400 lines): `REFACTORING_*.md` files
- Duplicate error handling code from individual routes
- Temporary debug logs from validation flows

### Impact
- **Maintainability:** Clearer code organization with max 10 files per domain folder
- **Type Safety:** Explicit error contracts with type checking
- **Code Quality:** -1,600 lines of duplicate/obsolete code removed
- **Architecture:** Clean separation between domain logic and transport layer
- **Developer Experience:** Better code discoverability and navigation
