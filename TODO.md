# TODO.md

## Immediate priorities

- [x] Add persistent repository implementation (PostgreSQL)
- [x] Add auth middleware and role-based guards
- [x] Add OpenAPI generation for API contracts
- [x] Add CI pipeline (lint, typecheck, tests)

## Household onboarding API (mobile-first flow)

### 1) Data model & migrations

- [x] Add `households` table (`id`, `name`, `created_by_user_id`, `created_at`, `updated_at`)
- [x] Add `household_members` table (`id`, `household_id`, `user_id`, `role`, `status`, `joined_at`, `created_at`)
- [x] Add `household_invitations` table:
	- [x] `id`, `household_id`, `inviter_user_id`, `invitee_email`, `invitee_first_name`, `invitee_last_name`
	- [x] `assigned_role` (`senior` | `caregiver`)
	- [x] `token_hash`, `token_expires_at`, `status` (`pending` | `accepted` | `expired` | `cancelled`)
	- [x] `created_at`, `accepted_at`
- [x] Add unique constraints and indexes:
	- [x] one active membership per user per household
	- [x] indexes on `invitee_email`, `status`, `token_expires_at`
	- [x] prevent duplicate pending invitation for same `household + email + role`

### 2) Domain rules

- [x] Household creator is automatically added as `caregiver` member (`active`)
- [x] Invitations can only be sent by household caregivers (or owner)
- [x] Invitation role is pre-assigned and immutable at acceptance time
- [x] Accepting invitation creates/activates membership with assigned role (no role prompt)
- [x] If invite is accepted after expiration, return explicit actionable error
- [x] Joining without deep-link token should resolve pending invitation by authenticated user email

### 3) API endpoints

- [x] `POST /households`
	- [x] body: `{ name: string }`
	- [x] behavior: create household + add authenticated user as caregiver

- [x] `POST /households/:householdId/invitations/bulk`
	- [x] body: `{ users: [{ firstName, lastName, email, role }] }`
	- [x] behavior: validate payload, create invitations, send emails asynchronously
	- [x] response: accepted count, skipped duplicates, per-user errors

- [x] `GET /households/invitations/my-pending`
	- [x] behavior: list pending invitations for authenticated email
	- [x] use case: app flow when user is not coming from deep link

- [x] `GET /households/invitations/resolve?token=...`
	- [x] behavior: validate token and return invitation summary (household, inviter, assigned role)
	- [x] do not expose sensitive data beyond what UI needs

- [x] `POST /households/invitations/accept`
	- [x] body: `{ token?: string, invitationId?: string }`
	- [x] behavior: accept by token OR by selected pending invitation
	- [x] response: final role + household context for app bootstrap

### 4) Email invitation system

- [x] Add invitation email template (simple, high-readability copy)
- [x] Generate signed single-use invitation token (store hash only)
- [x] Build deep link URL for app:
	- [x] `seniorhub://invite?type=household-invite&token=...`
	- [x] optional web fallback if app not installed
- [x] Add background job/retry for email provider failures
- [x] Track delivery/send failures and expose observability metrics

### 5) Security, privacy, and compliance

- [x] Rate-limit invitation creation endpoints
- [x] Enforce strict role validation (`senior`, `caregiver`) server-side
- [x] Audit log for invitation creation, acceptance, cancellation
- [x] Never leak whether an arbitrary email exists as an account
- [x] Redact personal data in logs (email partial masking)

### 6) Tests

- [x] Unit tests for invitation lifecycle domain rules
- [x] Integration tests:
	- [x] creator becomes caregiver automatically
	- [x] bulk invite creates records and triggers email job
	- [x] deep-link token resolves assigned role without profile selection
	- [x] accept by email pending invitation when no token provided
	- [x] expired token and duplicate acceptance are handled correctly
- [x] Auth/access tests for caregiver-only invitation endpoints

### 7) API contract & docs

- [x] Document onboarding endpoints and payloads in OpenAPI
- [x] Add sequence diagram in backend docs (create household, invite, accept)
- [x] Provide mobile integration notes for deep-link and fallback flow

### 8) User household memberships endpoint

- [x] Add `GET /households/my-memberships` endpoint
	- [x] behavior: list all households where authenticated user is an active member
	- [x] response: `{ data: [{ householdId, householdName, myRole, joinedAt, memberCount }] }`
	- [x] sorted by most recently joined or most recently used
	- [x] needed for app startup (show "Use my household" button vs create household)

- [x] **URGENT - App integration:** Verify endpoint is deployed and accessible
	- App was calling `GET /v1/households/my-households` (was getting 404)
	- Renamed endpoint from `/my-memberships` to `/my-households` to match app expectation
	- Endpoint now returns proper format: `{ status: 'success', data: [...] }`
