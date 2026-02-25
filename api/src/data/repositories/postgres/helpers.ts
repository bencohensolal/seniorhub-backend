import { createHash } from 'node:crypto';
import type { HouseholdRole, Member } from '../../../domain/entities/Member.js';
import type { HouseholdInvitation } from '../../../domain/entities/Invitation.js';

// Date and time helpers
export const nowIso = (): string => new Date().toISOString();

export const addHours = (isoDate: string, hours: number): string => {
  const date = new Date(isoDate);
  date.setHours(date.getHours() + hours);
  return date.toISOString();
};

export const toIso = (value: string | Date): string => new Date(value).toISOString();

// Normalization helpers
export const normalizeEmail = (email: string): string => email.trim().toLowerCase();

export const normalizeName = (value: string): string => value.trim();

export const hashToken = (token: string): string => createHash('sha256').update(token).digest('hex');

// Database row mappers
export const mapMember = (row: {
  id: string;
  household_id: string;
  user_id: string;
  email: string;
  first_name: string;
  last_name: string;
  role: HouseholdRole;
  status: 'active' | 'pending';
  joined_at: string | Date;
  created_at: string | Date;
}): Member => ({
  id: row.id,
  householdId: row.household_id,
  userId: row.user_id,
  email: row.email,
  firstName: row.first_name,
  lastName: row.last_name,
  role: row.role,
  status: row.status,
  joinedAt: toIso(row.joined_at),
  createdAt: toIso(row.created_at),
});

export const mapInvitation = (row: {
  id: string;
  household_id: string;
  inviter_user_id: string;
  invitee_email: string;
  invitee_first_name: string;
  invitee_last_name: string;
  assigned_role: HouseholdRole;
  token_hash: string;
  token_expires_at: string | Date;
  status: 'pending' | 'accepted' | 'expired' | 'cancelled';
  created_at: string | Date;
  accepted_at: string | Date | null;
}): HouseholdInvitation => ({
  id: row.id,
  householdId: row.household_id,
  inviterUserId: row.inviter_user_id,
  inviteeEmail: row.invitee_email,
  inviteeFirstName: row.invitee_first_name,
  inviteeLastName: row.invitee_last_name,
  assignedRole: row.assigned_role,
  tokenHash: row.token_hash,
  tokenExpiresAt: toIso(row.token_expires_at),
  status: row.status,
  createdAt: toIso(row.created_at),
  acceptedAt: row.accepted_at ? toIso(row.accepted_at) : null,
});
