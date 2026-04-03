/**
 * Exhaustive list of all auditable actions in the system.
 */
export type AuditAction =
  // ── Authentication ─────────────────────────────────────────────────────
  | 'user_registered'
  | 'user_login'
  // ── Household management ───────────────────────────────────────────────
  | 'create_household'
  | 'update_household_name'
  | 'update_household_settings'
  // ── Members ────────────────────────────────────────────────────────────
  | 'leave_household'
  | 'remove_member'
  | 'update_member_role'
  | 'archive_member'
  | 'restore_member'
  // ── Invitations ────────────────────────────────────────────────────────
  | 'invitation_created'
  | 'invitation_accepted'
  | 'invitation_cancelled'
  | 'invitation_resent'
  | 'invitation_reactivated'
  | 'auto_accept_invitations'
  // ── Appointments ───────────────────────────────────────────────────────
  | 'create_appointment'
  | 'update_appointment'
  | 'delete_appointment'
  | 'create_appointment_reminder'
  | 'update_appointment_reminder'
  | 'delete_appointment_reminder'
  | 'modify_occurrence'
  | 'cancel_occurrence'
  | 'restore_occurrence'
  | 'batch_modify_occurrences'
  | 'batch_cancel_occurrences'
  // ── Tasks ──────────────────────────────────────────────────────────────
  | 'create_task'
  | 'update_task'
  | 'delete_task'
  | 'complete_task'
  | 'confirm_task'
  | 'create_task_reminder'
  | 'update_task_reminder'
  | 'delete_task_reminder'
  // ── Caregiver Todos ────────────────────────────────────────────────────
  | 'create_caregiver_todo'
  | 'update_caregiver_todo'
  | 'delete_caregiver_todo'
  | 'complete_caregiver_todo'
  | 'nudge_caregiver_todo'
  | 'add_caregiver_todo_comment'
  // ── Journal ────────────────────────────────────────────────────────────
  | 'create_journal_entry'
  | 'update_journal_entry'
  | 'delete_journal_entry'
  // ── Documents ──────────────────────────────────────────────────────────
  | 'create_folder'
  | 'update_folder'
  | 'delete_folder'
  | 'upload_document'
  | 'update_document'
  | 'delete_document'
  | 'move_to_trash'
  | 'restore_from_trash'
  | 'permanently_delete_document'
  | 'purge_expired_trash'
  // ── Emergency Contacts ─────────────────────────────────────────────────
  | 'create_emergency_contact'
  | 'update_emergency_contact'
  | 'delete_emergency_contact'
  | 'reorder_emergency_contacts'
  | 'trigger_emergency_alert'
  // ── Display Tablets ────────────────────────────────────────────────────
  | 'create_display_tablet'
  | 'update_display_tablet'
  | 'delete_display_tablet'
  | 'revoke_display_tablet'
  | 'regenerate_tablet_token'
  | 'update_tablet_config'
  // ── Photo Screens ──────────────────────────────────────────────────────
  | 'create_photo_screen'
  | 'update_photo_screen'
  | 'delete_photo_screen'
  | 'upload_photo'
  | 'update_photo'
  | 'delete_photo'
  | 'reorder_photos'
  // ── Text Screens ───────────────────────────────────────────────────────
  | 'create_text_screen'
  | 'update_text_screen'
  | 'delete_text_screen'
  // ── Senior Devices ─────────────────────────────────────────────────────
  | 'create_senior_device'
  | 'revoke_senior_device'
  | 'archive_senior'
  // ── Subscriptions ──────────────────────────────────────────────────────
  | 'confirm_subscription_purchase'
  | 'subscription_webhook_event';

export type AuditCategory =
  | 'auth'
  | 'household'
  | 'members'
  | 'invitations'
  | 'appointments'
  | 'tasks'
  | 'caregiver_todos'
  | 'journal'
  | 'documents'
  | 'emergency_contacts'
  | 'display_tablets'
  | 'photo_screens'
  | 'text_screens'
  | 'senior_devices'
  | 'subscriptions';

const ACTION_CATEGORY_MAP: Record<AuditAction, AuditCategory> = {
  user_registered: 'auth',
  user_login: 'auth',
  create_household: 'household',
  update_household_name: 'household',
  update_household_settings: 'household',
  leave_household: 'members',
  remove_member: 'members',
  update_member_role: 'members',
  archive_member: 'members',
  restore_member: 'members',
  invitation_created: 'invitations',
  invitation_accepted: 'invitations',
  invitation_cancelled: 'invitations',
  invitation_resent: 'invitations',
  invitation_reactivated: 'invitations',
  auto_accept_invitations: 'invitations',
  create_appointment: 'appointments',
  update_appointment: 'appointments',
  delete_appointment: 'appointments',
  create_appointment_reminder: 'appointments',
  update_appointment_reminder: 'appointments',
  delete_appointment_reminder: 'appointments',
  modify_occurrence: 'appointments',
  cancel_occurrence: 'appointments',
  restore_occurrence: 'appointments',
  batch_modify_occurrences: 'appointments',
  batch_cancel_occurrences: 'appointments',
  create_task: 'tasks',
  update_task: 'tasks',
  delete_task: 'tasks',
  complete_task: 'tasks',
  confirm_task: 'tasks',
  create_task_reminder: 'tasks',
  update_task_reminder: 'tasks',
  delete_task_reminder: 'tasks',
  create_caregiver_todo: 'caregiver_todos',
  update_caregiver_todo: 'caregiver_todos',
  delete_caregiver_todo: 'caregiver_todos',
  complete_caregiver_todo: 'caregiver_todos',
  nudge_caregiver_todo: 'caregiver_todos',
  add_caregiver_todo_comment: 'caregiver_todos',
  create_journal_entry: 'journal',
  update_journal_entry: 'journal',
  delete_journal_entry: 'journal',
  create_folder: 'documents',
  update_folder: 'documents',
  delete_folder: 'documents',
  upload_document: 'documents',
  update_document: 'documents',
  delete_document: 'documents',
  move_to_trash: 'documents',
  restore_from_trash: 'documents',
  permanently_delete_document: 'documents',
  purge_expired_trash: 'documents',
  create_emergency_contact: 'emergency_contacts',
  update_emergency_contact: 'emergency_contacts',
  delete_emergency_contact: 'emergency_contacts',
  reorder_emergency_contacts: 'emergency_contacts',
  trigger_emergency_alert: 'emergency_contacts',
  create_display_tablet: 'display_tablets',
  update_display_tablet: 'display_tablets',
  delete_display_tablet: 'display_tablets',
  revoke_display_tablet: 'display_tablets',
  regenerate_tablet_token: 'display_tablets',
  update_tablet_config: 'display_tablets',
  create_photo_screen: 'photo_screens',
  update_photo_screen: 'photo_screens',
  delete_photo_screen: 'photo_screens',
  upload_photo: 'photo_screens',
  update_photo: 'photo_screens',
  delete_photo: 'photo_screens',
  reorder_photos: 'photo_screens',
  create_text_screen: 'text_screens',
  update_text_screen: 'text_screens',
  delete_text_screen: 'text_screens',
  create_senior_device: 'senior_devices',
  revoke_senior_device: 'senior_devices',
  archive_senior: 'senior_devices',
  confirm_subscription_purchase: 'subscriptions',
  subscription_webhook_event: 'subscriptions',
};

export function getCategoryForAction(action: AuditAction): AuditCategory {
  return ACTION_CATEGORY_MAP[action];
}

export interface AuditEventInput {
  householdId: string | null;
  actorUserId: string | null;
  action: AuditAction;
  category?: AuditCategory; // auto-derived from action if omitted
  targetId?: string | null;
  metadata?: Record<string, string>;
}

export interface AuditEvent {
  id: string;
  householdId: string;
  actorUserId: string | null;
  actorFirstName: string | null;
  actorLastName: string | null;
  action: string;
  category: string;
  targetId: string | null;
  metadata: Record<string, string>;
  createdAt: string;
}

export interface ListAuditEventsParams {
  householdId: string;
  category?: AuditCategory;
  cursor?: string; // ISO timestamp for keyset pagination
  limit: number;
  sinceDate?: string; // ISO date for historyDays enforcement
}

export interface ListAuditEventsResult {
  events: AuditEvent[];
  nextCursor: string | null;
}
