# Backend TODO

## ✅ COMPLETED - Photo Screens for Display Tablets

**Status:** COMPLETED on 2026-03-06

**Description:**
Implemented complete photo gallery screens feature for display tablets allowing caregivers to create custom photo displays (up to 5 screens per tablet, each with up to 6 photos).

**Features Implemented:**
- Database schema with `photo_screens` and `photos` tables (migration 018)
- Complete entity definitions and business logic
- S3 + GCS storage services with image processing (Sharp)
- All 9 REST API endpoints for photo management
- Integration with tablet config system (photoGallery screen type)
- Error handling with 6 new domain errors
- Multipart form-data handling for photo uploads
- Image compression and resizing (5MB max → 1MB target)

**Endpoints:**
- Photo screen CRUD (5 endpoints)
- Photo management (4 endpoints)
- Config integration (photo screens included in tablet config)

**Documentation:**
- `docs/PHOTO_SCREENS_IMPLEMENTATION_COMPLETE.md` - Full implementation guide
- `docs/PHOTO_SCREENS_FEATURE.md` - Feature specification
- `docs/S3_CLOUDFRONT_SETUP.md` - AWS setup
- `docs/GCS_SETUP.md` - Google Cloud setup

---

## ✅ FIXED - Appointment Reminder Creation Bug

**Status:** FIXED on 2026-03-03

**Description:**
L'app mobile recevait une erreur "Invalid request payload" lors de la création de reminders pour les rendez-vous quand le champ `enabled` n'était pas envoyé.

**Root Cause:**
Dans `appointmentRoutes.ts`, ligne 427, le code assignait toujours `enabled: body.enabled` sans gérer le cas où ce champ est `undefined`. Même si le schéma Zod avait `.optional().default(true)`, la valeur par défaut n'était pas correctement appliquée dans la route.

**Solution:**
Utilisation de l'opérateur de coalescence nulle (`??`) pour garantir que `enabled` vaut `true` par défaut:
```typescript
enabled: body.enabled ?? true, // Default to true if not provided
```

**File Fixed:**
- ✅ `src/routes/households/appointmentRoutes.ts` (ligne 427)

**Priority:** HIGH - Bloquait la création de rendez-vous avec reminders

---

## ✅ FIXED - URGENT BUG - GET /v1/households/:householdId/members

**Status:** FIXED on 2026-01-03

**Root Cause:** Multiple use cases had swapped parameters when calling `HouseholdAccessValidator.ensureMember()`.
- Expected signature: `ensureMember(userId: string, householdId: string)`
- Incorrect calls were passing: `ensureMember(householdId, userId)` ❌

**Files Fixed:**
1. ✅ `src/domain/usecases/households/ListHouseholdMembersUseCase.ts`
2. ✅ `src/domain/usecases/invitations/ListHouseholdInvitationsUseCase.ts`
3. ✅ `src/domain/usecases/households/GetHouseholdOverviewUseCase.ts`
4. ✅ `src/domain/usecases/households/EnsureHouseholdRoleUseCase.ts`

**Already Correct:**
- ✅ `src/domain/usecases/households/LeaveHouseholdUseCase.ts`
- ✅ `src/domain/usecases/reminders/ListMedicationRemindersUseCase.ts`
- ✅ `src/domain/usecases/medications/ListHouseholdMedicationsUseCase.ts`

---

## ✅ COMPLETED - Appointment Recurrence with Individual Occurrence Management

**Status:** Backend implementation completed on 2026-03-03

### Overview
Gestion complète de la récurrence des rendez-vous avec possibilité de modifier/annuler des occurrences individuelles sans affecter les autres occurrences de la série.

### ✅ Completed (2026-03-03)

#### Foundation
1. **Migration 010** - Table `appointment_occurrences` créée
2. **Entity** - `AppointmentOccurrence` avec types complets (status, overrides, etc.)
3. **Service** - `occurrenceGenerator.ts` pour générer les occurrences depuis les règles de récurrence
4. **Repository Interface** - Méthodes ajoutées à `HouseholdRepository` pour les occurrences:
   - `getOccurrenceById(occurrenceId, householdId)`
   - `getOccurrenceByDate(appointmentId, occurrenceDate, householdId)`
   - `listOccurrences(appointmentId, householdId, fromDate?, toDate?)`
   - `createOccurrence(input)`
   - `updateOccurrence(occurrenceId, householdId, data)`
   - `deleteOccurrence(occurrenceId, householdId)`
5. **Mapper** - `mapOccurrence()` ajouté dans `helpers.ts`
6. **PostgresHouseholdRepository** - Toutes les méthodes d'occurrences implémentées avec gestion JSONB
7. **InMemoryHouseholdRepository** - Méthodes stub ajoutées pour compatibilité des tests

#### Use Cases
1. ✅ `ListAppointmentOccurrencesUseCase` - Liste les occurrences d'un rendez-vous récurrent avec merge des overrides
2. ✅ `ModifyOccurrenceUseCase` - Modifie une occurrence spécifique (crée ou met à jour un override)
3. ✅ `CancelOccurrenceUseCase` - Annule une occurrence spécifique (status=cancelled)

#### API Endpoints  
1. ✅ `GET /v1/households/:householdId/appointments/:appointmentId/occurrences?from=YYYY-MM-DD&to=YYYY-MM-DD` - Liste les occurrences avec overrides fusionnés
2. ✅ `PATCH /v1/households/:householdId/appointments/:appointmentId/occurrences/:occurrenceDate` - Modifie une occurrence
3. ✅ `DELETE /v1/households/:householdId/appointments/:appointmentId/occurrences/:occurrenceDate` - Annule une occurrence

#### Validation Schemas
1. ✅ `occurrenceParamsSchema` - Validation des paramètres URL (householdId, appointmentId, occurrenceDate)
2. ✅ `occurrenceQuerySchema` - Validation des query params (from, to dates)
3. ✅ `modifyOccurrenceBodySchema` - Validation des champs modifiables d'une occurrence

### 🚧 Remaining Work (Optional Enhancements)

#### Future Enhancements
1. `ListUpcomingAppointmentsUseCase` - Endpoint unifié listant tous les rendez-vous à venir (récurrents + uniques) dans l'ordre chronologique
   - `GET /v1/households/:householdId/appointments/upcoming?from=YYYY-MM-DD&to=YYYY-MM-DD`
2. Batch operations pour modifier/annuler plusieurs occurrences d'un coup
3. Restauration d'occurrences annulées

### Use Cases (Detailed)
1. **Créer un rendez-vous récurrent** (ex: "Kiné tous les lundis et mercredi à 10h")
2. **Annuler une occurrence spécifique** (ex: "Pas de kiné le 15 mars car férié")
3. **Modifier une occurrence spécifique** (ex: "Le 22 mars, kiné à 14h au lieu de 10h")
4. **Voir toutes les occurrences futures** (avec indication des occurrences modifiées/annulées)

### Architecture Proposée

#### 1. Tables/Entities
```typescript
// Table existante: appointments (renommer en recurring_appointments)
interface RecurringAppointment {
  id: string;
  householdId: string;
  title: string;
  type: string;
  // ... autres champs existants
  
  // Nouvelle règle de récurrence
  recurrence: {
    frequency: 'daily' | 'weekly' | 'monthly' | 'yearly';
    interval: number;
    daysOfWeek?: number[]; // Pour weekly
    dayOfMonth?: number;   // Pour monthly
    endDate?: string;
    occurrences?: number;
  } | null;
  
  createdAt: string;
  updatedAt: string;
}

// NOUVELLE TABLE: appointment_occurrences
interface AppointmentOccurrence {
  id: string;
  recurringAppointmentId: string; // FK vers recurring_appointments
  householdId: string;
  
  // Date de cette occurrence spécifique
  occurrenceDate: string; // YYYY-MM-DD
  occurrenceTime: string; // HH:MM
  
  // Statut de l'occurrence
  status: 'scheduled' | 'modified' | 'cancelled' | 'completed' | 'missed';
  
  // Overrides optionnels (si modification)
  overrides?: {
    title?: string;
    time?: string;
    duration?: number;
    locationName?: string;
    address?: string;
    phoneNumber?: string;
    professionalName?: string;
    description?: string;
    preparation?: string;
    documentsToTake?: string;
    transportArrangement?: string;
    notes?: string;
  };
  
  createdAt: string;
  updatedAt: string;
}
```

#### 2. Nouveaux Endpoints

```typescript
// GET /v1/households/:householdId/appointments/recurring/:appointmentId/occurrences
// Query params: ?from=YYYY-MM-DD&to=YYYY-MM-DD
// Génère et retourne toutes les occurrences dans la période
{
  status: "success",
  data: [
    {
      id: "occurrence-uuid",
      recurringAppointmentId: "appointment-uuid",
      occurrenceDate: "2026-03-10",
      occurrenceTime: "10:00",
      status: "scheduled",
      // ... merged data from recurring appointment + overrides
    }
  ]
}

// PATCH /v1/households/:householdId/appointments/recurring/:appointmentId/occurrences/:occurrenceDate
// Modifier une occurrence spécifique
{
  status: "modified", // ou "cancelled"
  overrides: {
    time: "14:00",
    locationName: "Nouveau cabinet"
  }
}

// DELETE /v1/households/:householdId/appointments/recurring/:appointmentId/occurrences/:occurrenceDate
// Annuler une occurrence spécifique (crée un record avec status=cancelled)

// GET /v1/households/:householdId/appointments/upcoming
// Liste TOUTES les occurrences futures (récurrentes + uniques) dans l'ordre chronologique
```

#### 3. Logique de Génération des Occurrences

**Option A - Génération à la volée (recommandé pour MVP):**
- Générer les occurrences dynamiquement lors des requêtes GET
- Stocker uniquement les modifications/annulations dans `appointment_occurrences`
- Avantages: Pas de données redondantes, flexible
- Inconvénients: Calcul à chaque requête

**Option B - Pré-génération:**
- Créer les occurrences à l'avance (ex: 3-6 mois)
- Job CRON pour générer les nouvelles occurrences
- Avantages: Queries plus rapides, reminders plus simples
- Inconvénients: Plus complexe, données redondantes

### App Mobile - Changes Required

1. **Liste des rendez-vous:**
   - Appeler nouveau endpoint `/appointments/upcoming` qui retourne occurrences + uniques
   - Afficher badge "Récurrent" sur les occurrences
   - Regrouper visuellement les occurrences d'une même série

2. **Détail d'une occurrence:**
   - Afficher info "Fait partie de: [Série] Tous les lundis"
   - Boutons d'action:
     - "Modifier cette occurrence uniquement"
     - "Modifier toute la série"
     - "Annuler cette occurrence"
     - "Annuler toute la série"

3. **Création/Edition:**
   - Section récurrence dans le formulaire
   - Choix: Aucune / Quotidien / Hebdomadaire / Mensuel / Annuel
   - Si hebdomadaire: sélection jours de la semaine
   - Fin: Date limite OU Nombre d'occurrences

### Migration Path

1. ✅ **Phase 1 (Actuelle):** Rendez-vous simples sans récurrence
2. **Phase 2:** Backend - Ajouter table `appointment_occurrences` + endpoints
3. **Phase 3:** App - UI pour créer/modifier récurrence
4. **Phase 4:** App - UI pour modifier/annuler occurrences individuelles

### Priorité
**Medium** - Feature importante mais non bloquante pour MVP

### Estimation
- Backend: 3-4 jours
- App: 2-3 jours
- Total: ~1 semaine
