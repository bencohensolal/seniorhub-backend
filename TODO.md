# Backend TODO

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

## 🔄 IN PROGRESS - Appointment Recurrence with Individual Occurrence Management

**Status:** Fondations complétées - En attente de l'implémentation finale

### Overview
Ajouter la gestion complète de la récurrence des rendez-vous avec possibilité de modifier/annuler des occurrences individuelles sans affecter les autres occurrences de la série.

### ✅ Completed (2026-03-03)
1. **Migration 010** - Table `appointment_occurrences` créée
2. **Entity** - `AppointmentOccurrence` avec types complets
3. **Service** - `occurrenceGenerator.ts` pour générer les occurrences depuis les règles de récurrence

### 🚧 Remaining Work

#### Repository Methods (HouseholdRepository interface + PostgresHouseholdRepository)
1. `getOccurrence(occurrenceId, householdId)` - Get a specific occurrence
2. `getOccurrenceByDate(appointmentId, occurrenceDate, householdId)` - Get occurrence for a date
3. `createOccurrence(input)` - Create/update occurrence (for modifications/cancellations)
4. `updateOccurrence(occurrenceId, householdId, data)` - Update occurrence
5. `deleteOccurrence(occurrenceId, householdId)` - Delete occurrence
6. `listOccurrences(appointmentId, householdId, fromDate, toDate)` - List occurrences for date range

#### Use Cases
1. `GenerateOccurrencesUseCase` - Generate occurrences for a recurring appointment (uses occurrenceGenerator)
2. `ModifyOccurrenceUseCase` - Modify a specific occurrence
3. `CancelOccurrenceUseCase` - Cancel a specific occurrence
4. `ListUpcomingAppointmentsUseCase` - List all upcoming (recurring occurrences + one-time appointments)

#### API Endpoints
1. `GET /v1/households/:householdId/appointments/upcoming?from=YYYY-MM-DD&to=YYYY-MM-DD`
2. `GET /v1/households/:householdId/appointments/:appointmentId/occurrences?from=YYYY-MM-DD&to=YYYY-MM-DD`
3. `PATCH /v1/households/:householdId/appointments/:appointmentId/occurrences/:occurrenceDate`
4. `DELETE /v1/households/:householdId/appointments/:appointmentId/occurrences/:occurrenceDate`

#### Helper/Mapper Functions
1. `mapOccurrence()` in helpers.ts - Map DB row to AppointmentOccurrence entity
2. `mergeOccurrenceWithAppointment()` - Merge recurring appointment + occurrence overrides

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
