# TODO.md

## Immediate priorities

- [ ] Add persistent repository implementation (PostgreSQL)
- [ ] Add auth middleware and role-based guards
- [ ] Add OpenAPI generation for API contracts
- [ ] Add CI pipeline (lint, typecheck, tests)

## Household onboarding API (mobile-first flow)

### 1) Data model & migrations

- [ ] Add `households` table (`id`, `name`, `created_by_user_id`, `created_at`, `updated_at`)
- [ ] Add `household_members` table (`id`, `household_id`, `user_id`, `role`, `status`, `joined_at`, `created_at`)
- [ ] Add `household_invitations` table:
	- [ ] `id`, `household_id`, `inviter_user_id`, `invitee_email`, `invitee_first_name`, `invitee_last_name`
	- [ ] `assigned_role` (`senior` | `caregiver`)
	- [ ] `token_hash`, `token_expires_at`, `status` (`pending` | `accepted` | `expired` | `cancelled`)
	- [ ] `created_at`, `accepted_at`
- [ ] Add unique constraints and indexes:
	- [ ] one active membership per user per household
	- [ ] indexes on `invitee_email`, `status`, `token_expires_at`
	- [ ] prevent duplicate pending invitation for same `household + email + role`

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

- [ ] Add invitation email template (simple, high-readability copy)
- [ ] Generate signed single-use invitation token (store hash only)
- [ ] Build deep link URL for app:
	- [ ] `seniorhub://invite?type=household-invite&token=...`
	- [ ] optional web fallback if app not installed
- [ ] Add background job/retry for email provider failures
- [ ] Track delivery/send failures and expose observability metrics

### 5) Security, privacy, and compliance

- [x] Rate-limit invitation creation endpoints
- [x] Enforce strict role validation (`senior`, `caregiver`) server-side
- [ ] Audit log for invitation creation, acceptance, cancellation
- [ ] Never leak whether an arbitrary email exists as an account
- [ ] Redact personal data in logs (email partial masking)

### 6) Tests

- [ ] Unit tests for invitation lifecycle domain rules
- [ ] Integration tests:
	- [ ] creator becomes caregiver automatically
	- [ ] bulk invite creates records and triggers email job
	- [ ] deep-link token resolves assigned role without profile selection
	- [ ] accept by email pending invitation when no token provided
	- [ ] expired token and duplicate acceptance are handled correctly
- [x] Auth/access tests for caregiver-only invitation endpoints

### 7) API contract & docs

- [ ] Document onboarding endpoints and payloads in OpenAPI
- [ ] Add sequence diagram in backend docs (create household, invite, accept)
- [ ] Provide mobile integration notes for deep-link and fallback flow
