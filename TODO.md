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

### 9) Household member management

- [x] `DELETE /v1/households/:householdId/members/:memberId` - Remove member
	- [x] Authorization: only caregivers can remove other members
	- [x] Validation: cannot remove self, cannot remove if last member
	- [x] Response: `{ status: 'success' }`
	- [x] App usage: HouseholdManagementScreen remove button

- [x] `PATCH /v1/households/:householdId/members/:memberId` - Update member role
	- [x] Authorization: only caregivers can update roles
	- [x] Body: `{ role: 'senior' | 'caregiver' | 'family' | 'intervenant' }`
	- [x] Validation: cannot demote self if last caregiver
	- [x] Response: `{ status: 'success', data: updatedMember }`
	- [x] App usage: HouseholdManagementScreen edit button

- [x] `DELETE /v1/households/:householdId/members/me` - Leave household
	- [x] Authorization: authenticated user
	- [x] Validation: cannot leave if last caregiver or last member
	- [x] Response: `{ status: 'success' }`
	- [x] App usage: HouseholdManagementScreen leave button

### 10) Invitation data enrichment

- [x] **IMPORTANT:** `GET /v1/households/invitations/my-pending` should include household name
	- Current response only has `householdId` but not the household name
	- Add `householdName` field to the response for each invitation
	- This allows app to display meaningful invitation cards like:
	  "Invitation to join 'Smith Family Household'" instead of just showing an ID
	- App currently shows: "Invitation from John Doe" + "ID: abc123..."
	- Should show: "Invitation to 'Smith Family' from John Doe"

### 11) Email delivery configuration

- [x] **IMPLEMENTED:** Gmail SMTP provider added as free alternative ✅
	- Gmail SMTP provider fully implemented and tested
	- 100% free (500 emails/day)
	- No domain verification required
	- Works immediately with Gmail App Password
	- Complete setup guide: `docs/GMAIL_SMTP_SETUP.md`

- [x] **DEPLOYED:** Gmail SMTP configured and running in Railway ✅
	- Service successfully using Gmail SMTP provider
	- Railway environment variables configured:
		- `EMAIL_PROVIDER=gmail`
		- `GMAIL_USER` (configured)
		- `GMAIL_APP_PASSWORD` (configured)
		- `EMAIL_FROM` (configured)
	- Production logs confirm: `[Email] Using Gmail SMTP provider`
	- **Status:** Real email delivery is now ACTIVE in production

- [ ] **OPTIONAL:** Migrate to Resend for production (when ready)
	- Set `EMAIL_PROVIDER=resend`
	- Set `RESEND_API_KEY=re_your_key`
	- Set `EMAIL_FROM=Senior Hub <noreply@your-domain.com>`
	- See: `docs/RESEND_SETUP.md`
	- Benefits: Better deliverability, analytics, domain reputation

### 12) Invitation management for household admins

- [x] **RESOLVED:** Bulk invitation endpoint now working - invitations persisted successfully
	- Root cause: App was sending empty lastName which backend rejected with 400 error
	- Fix: App now sends fallback "User" for lastName when email has no dot separator
	- Result: Invitations are now successfully created in `household_invitations` table
	- Status: Backend accepts invitations and returns `acceptedCount: 1`

- [x] **DIAGNOSED:** Email delivery not working - Expected behavior in development mode
	- **Root Cause:** Backend is configured with `EMAIL_PROVIDER=console` (development mode)
	- **Current Behavior:** Invitations created successfully, but emails only logged to console
	- **System Status:** ✅ Working as designed - email queue, templates, and providers all functional
	- **To Enable Real Emails:** Choose one option:
		1. **Resend (Recommended for production)** - Already implemented
			- Set Railway env: `EMAIL_PROVIDER=resend`
			- Set Railway env: `RESEND_API_KEY=re_your_key`
			- Set Railway env: `EMAIL_FROM=Senior Hub <noreply@domain.com>`
			- See: `docs/RESEND_SETUP.md` for complete guide
			- Cost: Free tier (100/day, 3000/month), then $20/month
		2. **Gmail SMTP (Best for testing)** - Not yet implemented
			- Would need to create `GmailEmailProvider` class
			- Free: 500 emails/day
			- Simple setup with app password
			- See: `docs/EMAIL_OPTIONS.md` for all options
	- **Next Steps:** 
		- For production: Configure Resend API key in Railway
		- For testing: Can implement Gmail SMTP provider if needed

- [x] `GET /v1/households/:householdId/invitations` - List sent invitations
	- Authorization: only household members can view
	- Response: `{ data: [{ id, inviteeEmail, inviteeFirstName, inviteeLastName, assignedRole, status, createdAt, expiresAt }] }`
	- Include invitation status: pending, accepted, expired, cancelled
	- Needed for app to show "Sent Invitations" section in HouseholdManagementScreen

- [x] **Revoke invitation endpoint - IMPLEMENTED AS POST**
	- `POST /v1/households/:householdId/invitations/:invitationId/cancel` already implemented
	- Authorization: only caregivers can cancel invitations
	- Sets status to 'cancelled'
	- Response: `{ status: 'success', data: { cancelled: true } }`
	- App can use this endpoint for "Revoke" button in sent invitations list
	- **Note**: Using POST instead of DELETE is acceptable for this action (cancel is an operation, not a deletion)

- [x] `POST /v1/households/:householdId/invitations/:invitationId/resend` - Resend invitation email
	- Authorization: only caregivers or invitation sender
	- Validation: only resend if status is 'pending' and not expired
	- Generate new token and extend expiry
	- Queue email job
	- Response: `{ status: 'success', newExpiresAt: '...' }`
	- App usage: "Resend Email" button in sent invitations list

### 13) 🐛 CRITICAL BUG: 403 Access denied after invitation acceptance

- [ ] **URGENT:** User gets 403 "Access denied to this household" after accepting invitation
	- **Symptom:** User successfully accepts invitation but cannot access household
	- **Household ID:** 3617e173-d359-492b-94b7-4c32622e7526
	- **Invitation ID:** 22db9a60-6852-4b6c-a5a9-49d216f5b89e
	- **Errors:**
		- GET /v1/households/:id → 403 "Access denied to this household"
		- GET /v1/households/:id/members → 403 "Access denied to this household"
	
	**Root Cause Investigation:**
	1. Check `POST /households/invitations/accept` - does it create membership?
	2. Verify membership has status='active' after acceptance
	3. Check user_id matches authenticated user in membership
	4. Query household_members table after invitation acceptance
	5. Check authorization guard queries for status='active'
	
	**Expected Flow:**
	- User accepts invitation (by invitationId)
	- Membership created: {user_id, household_id, role, status='active'}
	- User can immediately access household resources
	
	**Current Broken Flow:**
	- User accepts invitation ✅
	- Household ID saved in app ✅
	- Membership NOT created or NOT active ❌
	- 403 on all household endpoints ❌
	
	**Impact:** CRITICAL - Users cannot use household after accepting invitation

### 14) Household details endpoint

- [x] **IMPLEMENTED:** `GET /v1/households/:householdId` - Get household details
	- **Status:** Endpoint successfully implemented ✅
	- **Authorization:** household members only
	- **Response:** 
		```json
		{
			"status": "success",
			"data": {
				"id": "uuid",
				"name": "Smith Family",
				"createdAt": "2026-02-26T...",
				"createdByUserId": "uuid",
				"memberCount": 3
			}
		}
		```
	- **Implementation:** Uses existing GetHouseholdOverviewUseCase, returns simplified format
	- **App usage:** 
		- Display household name in header
		- Show creation date
		- Show member count
	- **Note:** `/overview` endpoint still available for more detailed stats

### 15) Medications management

- [x] **Data model & migrations**
	- [x] Add `medications` table:
		- `id` (uuid, primary key)
		- `household_id` (uuid, foreign key to households)
		- `name` (string, medication name)
		- `dosage` (string, e.g., "500mg", "10ml")
		- `form` (enum: tablet, capsule, syrup, injection, drops, cream, patch, inhaler, suppository, other)
		- `frequency` (string, e.g., "2 times daily", "Once a day")
		- `schedule` (jsonb array of times, e.g., ["08:00", "20:00"])
		- `prescribed_by` (string, nullable, doctor's name)
		- `prescription_date` (date, nullable)
		- `start_date` (date, required)
		- `end_date` (date, nullable, for limited treatments)
		- `instructions` (text, nullable, special instructions)
		- `created_at`, `updated_at` (timestamps)
		- `created_by_user_id` (uuid, foreign key to users, who added it)
	- [x] Add indexes on `household_id`, `created_at`
	- [x] Add constraint: household members can only access their household's medications

- [x] **API endpoints**
	- [x] `GET /v1/households/:householdId/medications`
		- Authorization: household members only
		- Response: `{ data: [...medications] }`
		- Sort by name or created_at (configurable)
		
	- [x] `POST /v1/households/:householdId/medications`
		- Authorization: caregivers only
		- Body: `{ name, dosage, form, frequency, schedule, prescribedBy?, prescriptionDate?, startDate, endDate?, instructions? }`
		- Validation: validate form enum, required fields, date formats
		- Response: `{ data: createdMedication }`
		
	- [x] `PATCH /v1/households/:householdId/medications/:medicationId`
		- Authorization: caregivers only
		- Body: partial update (any medication field)
		- Response: `{ data: updatedMedication }`
		
	- [x] `DELETE /v1/households/:householdId/medications/:medicationId`
		- Authorization: caregivers only
		- Hard delete implementation
		- Response: `{ status: 'success' }`

- [x] **Domain rules**
	- [x] Only household members can view medications
	- [x] Only caregivers can add/edit/delete medications
	- [x] Schedule times validated with HH:MM regex format
	- [x] End date must be after start date if provided (validated at domain level)
	- [x] Repository enforces household_id constraint

- [ ] **Tests** (ready for implementation)
	- [ ] Unit tests for medication validation rules
	- [ ] Integration tests for CRUD operations
	- [ ] Authorization tests (member vs caregiver permissions)
	- [ ] Edge cases: invalid dates, empty schedule, etc.

- [ ] **Future enhancements**
	- [ ] Medication reminders/notifications
	- [ ] Track medication adherence (taken/missed)
	- [ ] Medication interactions warnings
	- [ ] Photo upload for medication (pill identification)
	- [ ] Barcode scanning for medication details
