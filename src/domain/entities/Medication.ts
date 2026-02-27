export type MedicationForm =
  | 'tablet'
  | 'capsule'
  | 'syrup'
  | 'injection'
  | 'drops'
  | 'cream'
  | 'patch'
  | 'inhaler'
  | 'suppository'
  | 'other';

export interface Medication {
  id: string;
  householdId: string;
  name: string;
  dosage: string;
  form: MedicationForm;
  frequency: string;
  schedule: string[]; // Array of time strings in HH:MM format, e.g., ["08:00", "20:00"]
  prescribedBy: string | null;
  prescriptionDate: string | null; // ISO date string
  startDate: string; // ISO date string
  endDate: string | null; // ISO date string
  instructions: string | null;
  createdByUserId: string;
  createdAt: string; // ISO timestamp
  updatedAt: string; // ISO timestamp
}

export interface CreateMedicationInput {
  householdId: string;
  name: string;
  dosage: string;
  form: MedicationForm;
  frequency: string;
  schedule: string[];
  prescribedBy?: string;
  prescriptionDate?: string;
  startDate: string;
  endDate?: string;
  instructions?: string;
  createdByUserId: string;
}

export interface UpdateMedicationInput {
  name?: string;
  dosage?: string;
  form?: MedicationForm;
  frequency?: string;
  schedule?: string[];
  prescribedBy?: string | null;
  prescriptionDate?: string | null;
  startDate?: string;
  endDate?: string | null;
  instructions?: string | null;
}
