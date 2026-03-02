// Domain entity for appointment reminders

export interface AppointmentReminder {
  id: string;
  appointmentId: string;
  triggerBefore: number; // minutes before appointment
  customMessage: string | null;
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreateAppointmentReminderInput {
  appointmentId: string;
  triggerBefore: number;
  customMessage?: string;
  enabled?: boolean;
}

export interface UpdateAppointmentReminderInput {
  triggerBefore?: number;
  customMessage?: string | null;
  enabled?: boolean;
}
