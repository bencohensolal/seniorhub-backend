export interface EmergencyContact {
  id: string;
  householdId: string;
  name: string;
  phone: string;
  relationship: string | null;
  priorityOrder: number;
  createdAt: string;
  updatedAt: string;
}

export interface CreateEmergencyContactInput {
  householdId: string;
  name: string;
  phone: string;
  relationship?: string;
  priorityOrder: number;
}

export interface UpdateEmergencyContactInput {
  name?: string;
  phone?: string;
  relationship?: string;
  priorityOrder?: number;
}
