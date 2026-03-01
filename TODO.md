# TODO Backend

## ✅ Completed

- [x] Initial project setup with TypeScript, Fastify, and PostgreSQL
- [x] Household onboarding endpoints (create household, list households)
- [x] Invitation system (create, accept, cancel, resend invitations)
- [x] Email delivery with Resend and Gmail SMTP providers
- [x] Deep link handling for mobile app invitations
- [x] Audit events for tracking invitation lifecycle
- [x] Member management (list, remove, update role)
- [x] Medication CRUD endpoints (create, read, update, delete)
- [x] Medication autocomplete with French drug database integration
- [x] Migration 005: Fix UUID issue for Google OAuth user IDs in medications
- [x] Fix DELETE endpoint to return 204 No Content
- [x] Fix Fastify JSON parser to allow empty body on DELETE requests

## 🔍 In Progress / Debug

### Invitation Acceptance Flow Investigation
- [x] Add detailed logs in PostgresHouseholdRepository.acceptInvitation()
- [x] Logs show requester info, token validation, invitation found, member creation
- [ ] Monitor Railway logs to identify if issue is in app or backend
- [ ] Verify members are created correctly in production database
- [ ] Document findings in INVITATION_DEBUGGING_SUMMARY.md

**Debug checklist:**
- [x] Verify endpoint is called from mobile app
- [x] Check token validation works
- [x] Confirm invitation is found in database
- [x] Validate email matching logic
- [x] Ensure member INSERT/UPDATE executes
- [x] Confirm transaction commits successfully

---

## 📝 Reference Documentation

### Existing Endpoints

#### POST /v1/households/invitations/accept
- [x] Endpoint implemented and tested
- **URL:** `https://seniorhub-backend-production.up.railway.app/v1/households/invitations/accept`
- **Authentication:** Required (x-user-id, x-user-email, x-user-first-name, x-user-last-name headers)
- **Functionality:** Validates token, creates member, updates invitation status

#### GET /v1/invitations/accept-link (PUBLIC)
- [x] Endpoint implemented and tested
- **URL:** `https://seniorhub-backend-production.up.railway.app/v1/invitations/accept-link?token=XXX`
- **Functionality:** Handles deep link redirection for mobile app (seniorhub://) or web

---

## 📅 Future Features

### Advanced Medication Reminders System

**Status:** ✅ Implemented (migration pending)

- [x] Create `medication_reminders` table (migration 006)
- [x] Domain entities and repository methods
- [x] Use cases (List, Create, Update, Delete)
- [x] Zod validation schemas
- [x] API endpoints (4 routes)
- [ ] Apply migration 006 to production database
- [ ] Test endpoints in production
- [ ] Mobile app integration

**Endpoints Available:**
- GET `/v1/households/:householdId/medications/:medicationId/reminders`
- POST `/v1/households/:householdId/medications/:medicationId/reminders`
- PUT `/v1/households/:householdId/medications/:medicationId/reminders/:reminderId`
- DELETE `/v1/households/:householdId/medications/:medicationId/reminders/:reminderId`

**Features:**
- Day-of-week selection (0=Sunday to 6=Saturday)
- Multiple reminders per medication
- Enable/disable individual reminders
- Time in HH:MM format (00:00 to 23:59)

---

## 🎯 Additional Future Endpoints

### Medication Tracking & History
- [ ] POST `/v1/households/:householdId/medications/:medicationId/doses` - Log dose taken
- [ ] GET `/v1/households/:householdId/medications/:medicationId/history` - View dose history
- [ ] GET `/v1/households/:householdId/medications/:medicationId/adherence` - Calculate adherence rate

### Health Monitoring
- [ ] POST `/v1/households/:householdId/health-records` - Add vital signs, symptoms
- [ ] GET `/v1/households/:householdId/health-records` - Retrieve health timeline
- [ ] GET `/v1/households/:householdId/health-reports` - Generate health summary reports

### Document Management
- [ ] POST `/v1/households/:householdId/documents` - Upload medical documents
- [ ] GET `/v1/households/:householdId/documents` - List documents
- [ ] DELETE `/v1/households/:householdId/documents/:documentId` - Remove document

### Caregiver Coordination
- [ ] POST `/v1/households/:householdId/tasks` - Create care tasks
- [ ] GET `/v1/households/:householdId/tasks` - List tasks with assignments
- [ ] PATCH `/v1/households/:householdId/tasks/:taskId` - Update task status
- [ ] POST `/v1/households/:householdId/notes` - Share care notes between caregivers
