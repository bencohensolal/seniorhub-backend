import type { MedicationReminder } from './MedicationReminder.js';

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
  seniorId: string; // ID of the household member this medication is for
  name: string;
  dosage: string;
  form: MedicationForm;
  frequency: string;
  prescribedBy: string | null;
  prescriptionDate: string | null; // ISO date string
  startDate: string; // ISO date string
  endDate: string | null; // ISO date string
  instructions: string | null;
  createdByUserId: string;
  createdAt: string;
  updatedAt: string;
}

export interface MedicationWithReminders extends Medication {
  reminders: MedicationReminder[];
}

export interface CreateMedicationInput {
  householdId: string;
  seniorId: string; // Required: medication must be assigned to a senior
  name: string;
  dosage: string;
  form: MedicationForm;
  frequency: string;
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
  prescribedBy?: string | null;
  prescriptionDate?: string | null;
  startDate?: string;
  endDate?: string | null;
  instructions?: string | null;
}
