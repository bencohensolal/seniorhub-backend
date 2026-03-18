# TODO.md

## Active backlog

### Optional enhancements — Appointments

- `ListUpcomingAppointmentsUseCase`: unified endpoint returning all upcoming occurrences (recurring + one-time) in chronological order
  - `GET /v1/households/:householdId/appointments/upcoming?from=YYYY-MM-DD&to=YYYY-MM-DD`
- Batch modify/cancel occurrences in a single call
- Restore cancelled occurrences

---

### Technical debt — Repository

`PostgresHouseholdRepository.ts` is 4 500+ lines and handles all domains in a single class (households, members, invitations, appointments, medications, tasks, display tablets, photo screens, documents). This violates SRP and makes isolated reads/changes risky.

Planned split:
- `PostgresHouseholdRepository.ts` → household + member core (~300 lines)
- `PostgresInvitationRepository.ts`
- `PostgresAppointmentRepository.ts`
- `PostgresMedicationRepository.ts`
- `PostgresTaskRepository.ts`
- `PostgresDisplayTabletRepository.ts`
- `PostgresPhotoScreenRepository.ts`
- `PostgresDocumentRepository.ts`

Each should implement a dedicated interface extracted from `HouseholdRepository.ts`.

---

### Technical debt — Route file sizes

Several route files exceed 700 lines and handle many endpoints. They are readable but could be split by resource sub-type if they grow further:
- `appointmentRoutes.ts` (870 lines) — could split occurrences into `occurrenceRoutes.ts`
- `householdRoutes.ts` (797 lines) — could split member management into `memberRoutes.ts`
- `displayTabletRoutes.ts` (773 lines) — could split config/SSE into `tabletConfigRoutes.ts`

Not urgent while individual endpoints stay focused, but worth tracking.

---

## Ideas backlog

See `IDEAS.md` for product and technical directions not yet scheduled.
