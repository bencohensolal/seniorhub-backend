import { randomUUID } from 'node:crypto';
import type { Pool, PoolClient } from 'pg';
import { env } from '../../config/env.js';
import type { AuthenticatedRequester, Household, HouseholdOverview } from '../../domain/entities/Household.js';
import type { AuditEventInput, HouseholdInvitation } from '../../domain/entities/Invitation.js';
import type { HouseholdRole, Member } from '../../domain/entities/Member.js';
import type { CreateMedicationInput, Medication, MedicationForm, UpdateMedicationInput } from '../../domain/entities/Medication.js';
import type { MedicationReminder, CreateReminderInput, UpdateReminderInput } from '../../domain/entities/MedicationReminder.js';
import type { Appointment, AppointmentWithReminders, CreateAppointmentInput, UpdateAppointmentInput, AppointmentType, AppointmentStatus } from '../../domain/entities/Appointment.js';
import type { AppointmentReminder, CreateAppointmentReminderInput, UpdateAppointmentReminderInput } from '../../domain/entities/AppointmentReminder.js';
import type { AppointmentOccurrence, CreateOccurrenceInput, UpdateOccurrenceInput } from '../../domain/entities/AppointmentOccurrence.js';
import type { Task, TaskWithReminders, CreateTaskInput, UpdateTaskInput, CompleteTaskInput, TaskCategory, TaskPriority, TaskStatus } from '../../domain/entities/Task.js';
import type { TaskReminder, CreateTaskReminderInput, UpdateTaskReminderInput } from '../../domain/entities/TaskReminder.js';
import { isInvitationTokenValid, signInvitationToken } from '../../domain/security/invitationToken.js';
import { buildInvitationLinks } from '../../domain/services/buildInvitationLinks.js';
import type {
  BulkInvitationResult,
  HouseholdRepository,
  InvitationCandidate,
} from '../../domain/repositories/HouseholdRepository.js';
import {
  NotFoundError,
  ForbiddenError,
  ConflictError,
  ValidationError,
} from '../../domain/errors/index.js';
import {
  nowIso,
  addHours,
  toIso,
  hashToken,
  normalizeEmail,
  normalizeName,
  mapMember,
  mapInvitation,
  mapMedication,
  mapReminder,
  mapAppointment,
  mapAppointmentReminder,
  mapOccurrence,
  mapTask,
  mapTaskReminder,
  mapDisplayTablet,
} from './postgres/helpers.js';
import type { DisplayTablet, DisplayTabletWithToken, CreateDisplayTabletInput, UpdateDisplayTabletInput, DisplayTabletAuthInfo, DisplayTabletStatus } from '../../domain/entities/DisplayTablet.js';
import type { TabletDisplayConfig } from '../../domain/entities/TabletDisplayConfig.js';
import type { CreatePhotoInput, CreatePhotoScreenInput, Photo, PhotoScreen, PhotoScreenWithPhotos, UpdatePhotoInput, UpdatePhotoScreenInput } from '../../domain/entities/PhotoScreen.js';
import type { PrivacySettings, UpdatePrivacySettingsInput } from '../../domain/entities/PrivacySettings.js';
import type { UserProfile } from '../../domain/entities/UserProfile.js';
import { generateDisplayTabletToken, hashDisplayTabletToken } from '../../domain/security/displayTabletToken.js';

const INVITATION_TTL_HOURS = 72;
const DISPLAY_TABLET_SETUP_TTL_HOURS = 72;

export class PostgresHouseholdRepository implements HouseholdRepository {
  constructor(private readonly pool: Pool) {}

  async getOverviewById(householdId: string): Promise<HouseholdOverview | null> {
    const result = await this.pool.query<{
      id: string;
      name: string;
      created_by_user_id: string;
      created_at: string | Date;
      updated_at: string | Date;
      members_count: number;
      seniors_count: number;
      caregivers_count: number;
    }>(
      `SELECT
         h.id,
         h.name,
         h.created_by_user_id,
         h.created_at,
         h.updated_at,
         COUNT(m.id) FILTER (WHERE m.status = 'active')::int AS members_count,
         COUNT(m.id) FILTER (WHERE m.status = 'active' AND m.role = 'senior')::int AS seniors_count,
         COUNT(m.id) FILTER (WHERE m.status = 'active' AND m.role = 'caregiver')::int AS caregivers_count
       FROM households h
       LEFT JOIN household_members m ON m.household_id = h.id
       WHERE h.id = $1
       GROUP BY h.id`,
      [householdId],
    );

    const row = result.rows[0];
    if (!row) {
      return null;
    }

    return {
      household: {
        id: row.id,
        name: row.name,
        createdByUserId: row.created_by_user_id,
        createdAt: toIso(row.created_at),
        updatedAt: toIso(row.updated_at),
      },
      membersCount: row.members_count,
      seniorsCount: row.seniors_count,
      caregiversCount: row.caregivers_count,
    };
  }

  async findMemberInHousehold(memberId: string, householdId: string): Promise<Member | null> {
    const result = await this.pool.query<{
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
    }>(
      `SELECT id, household_id, user_id, email, first_name, last_name, role, status, joined_at, created_at
       FROM household_members
       WHERE id = $1 AND household_id = $2 AND status = 'active'`,
      [memberId, householdId],
    );

    const row = result.rows[0];
    return row ? mapMember(row) : null;
  }

  async findActiveMemberByUserInHousehold(userId: string, householdId: string): Promise<Member | null> {
    const result = await this.pool.query<{
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
    }>(
      `SELECT id, household_id, user_id, email, first_name, last_name, role, status, joined_at, created_at
       FROM household_members
       WHERE user_id = $1 AND household_id = $2 AND status = 'active'`,
      [userId, householdId],
    );

    const row = result.rows[0];
    return row ? mapMember(row) : null;
  }

  async listUserHouseholds(userId: string): Promise<Array<{
    householdId: string;
    householdName: string;
    myRole: HouseholdRole;
    joinedAt: string;
    memberCount: number;
  }>> {
    const result = await this.pool.query<{
      household_id: string;
      household_name: string;
      my_role: HouseholdRole;
      joined_at: string | Date;
      member_count: number;
    }>(
      `SELECT
         m.household_id,
         h.name AS household_name,
         m.role AS my_role,
         m.joined_at,
         (SELECT COUNT(*) FROM household_members WHERE household_id = m.household_id AND status = 'active')::int AS member_count
       FROM household_members m
       JOIN households h ON h.id = m.household_id
       WHERE m.user_id = $1 AND m.status = 'active'
       ORDER BY m.joined_at DESC`,
      [userId],
    );

    return result.rows.map((row) => ({
      householdId: row.household_id,
      householdName: row.household_name,
      myRole: row.my_role,
      joinedAt: toIso(row.joined_at),
      memberCount: row.member_count,
    }));
  }

  async listHouseholdMembers(householdId: string): Promise<Member[]> {
    const result = await this.pool.query<{
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
    }>(
      `SELECT id, household_id, user_id, email, first_name, last_name, role, status, joined_at, created_at
       FROM household_members
       WHERE household_id = $1 AND status = 'active'
       ORDER BY joined_at ASC`,
      [householdId],
    );

    return result.rows.map(mapMember);
  }

  async createHousehold(name: string, requester: AuthenticatedRequester): Promise<Household> {
    const client = await this.pool.connect();
    try {
      const createdAt = nowIso();
      const householdId = randomUUID();
      const memberId = randomUUID();

      await client.query('BEGIN');

      await client.query(
        `INSERT INTO households (id, name, created_by_user_id, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $4)`,
        [householdId, name.trim(), requester.userId, createdAt],
      );

      await client.query(
        `INSERT INTO household_members
         (id, household_id, user_id, email, first_name, last_name, role, status, joined_at, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, 'caregiver', 'active', $7, $7)`,
        [
          memberId,
          householdId,
          requester.userId,
          normalizeEmail(requester.email),
          normalizeName(requester.firstName),
          normalizeName(requester.lastName),
          createdAt,
        ],
      );

      await client.query('COMMIT');

      return {
        id: householdId,
        name: name.trim(),
        createdByUserId: requester.userId,
        createdAt,
        updatedAt: createdAt,
      };
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  async createBulkInvitations(input: {
    householdId: string;
    inviterUserId: string;
    users: InvitationCandidate[];
  }): Promise<BulkInvitationResult> {
    const result: BulkInvitationResult = {
      acceptedCount: 0,
      skippedDuplicates: 0,
      perUserErrors: [],
      deliveries: [],
    };

    for (const user of input.users) {
      const email = normalizeEmail(user.email);

      const duplicateCheck = await this.pool.query<{ id: string }>(
        `SELECT id FROM household_invitations
         WHERE household_id = $1
           AND invitee_email = $2
           AND assigned_role = $3
           AND status = 'pending'
         LIMIT 1`,
        [input.householdId, email, user.role],
      );

      if (duplicateCheck.rowCount && duplicateCheck.rowCount > 0) {
        result.skippedDuplicates += 1;
        continue;
      }

      const memberCheck = await this.pool.query<{ id: string }>(
        `SELECT id FROM household_members
         WHERE household_id = $1
           AND email = $2
           AND status = 'active'
         LIMIT 1`,
        [input.householdId, email],
      );

      if (memberCheck.rowCount && memberCheck.rowCount > 0) {
        result.perUserErrors.push({
          email,
          reason: 'Invitation cannot be created for this recipient.',
        });
        continue;
      }

      const createdAt = nowIso();
      const tokenExpiresAt = addHours(createdAt, INVITATION_TTL_HOURS);
      const invitationId = randomUUID();
      const token = signInvitationToken(invitationId, env.TOKEN_SIGNING_SECRET);

      await this.pool.query(
        `INSERT INTO household_invitations
         (id, household_id, inviter_user_id, invitee_email, invitee_first_name, invitee_last_name,
          assigned_role, token_hash, token_expires_at, status, created_at, accepted_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'pending', $10, NULL)`,
        [
          invitationId,
          input.householdId,
          input.inviterUserId,
          email,
          normalizeName(user.firstName),
          normalizeName(user.lastName),
          user.role,
          hashToken(token),
          tokenExpiresAt,
          createdAt,
        ],
      );

      result.acceptedCount += 1;
      const links = buildInvitationLinks({
        token,
        backendBaseUrl: env.BACKEND_URL,
        ...(env.INVITATION_WEB_FALLBACK_URL
          ? { fallbackBaseUrl: env.INVITATION_WEB_FALLBACK_URL }
          : {}),
      });

      result.deliveries.push({
        invitationId,
        inviteeEmail: email,
        status: 'sent',
        acceptLinkUrl: links.acceptLinkUrl,
        deepLinkUrl: links.deepLinkUrl,
        fallbackUrl: links.fallbackUrl,
        reason: null,
      });
    }

    return result;
  }

  async listPendingInvitationsByEmail(email: string): Promise<HouseholdInvitation[]> {
    const normalizedEmail = normalizeEmail(email);

    await this.pool.query(
      `UPDATE household_invitations
       SET status = 'expired'
       WHERE invitee_email = $1
         AND status = 'pending'
         AND token_expires_at <= NOW()`,
      [normalizedEmail],
    );

    const result = await this.pool.query<{
      id: string;
      household_id: string;
      household_name: string;
      inviter_user_id: string;
      invitee_email: string;
      invitee_first_name: string;
      invitee_last_name: string;
      assigned_role: HouseholdRole;
      token_hash: string;
      token_expires_at: string | Date;
      status: 'pending' | 'accepted' | 'expired' | 'cancelled';
      reactivation_count: number;
      created_at: string | Date;
      accepted_at: string | Date | null;
    }>(
      `SELECT i.id, i.household_id, h.name AS household_name, i.inviter_user_id, i.invitee_email,
              i.invitee_first_name, i.invitee_last_name, i.assigned_role, i.token_hash,
              i.token_expires_at, i.status, i.reactivation_count, i.created_at, i.accepted_at
       FROM household_invitations i
       JOIN households h ON h.id = i.household_id
       WHERE i.invitee_email = $1
         AND i.status = 'pending'
       ORDER BY i.created_at DESC`,
      [normalizedEmail],
    );

    return result.rows.map(mapInvitation);
  }

  async listHouseholdInvitations(householdId: string): Promise<HouseholdInvitation[]> {
    // First, expire any pending invitations that have passed their expiry date
    await this.pool.query(
      `UPDATE household_invitations
       SET status = 'expired'
       WHERE household_id = $1
         AND status = 'pending'
         AND token_expires_at <= NOW()`,
      [householdId],
    );

    const result = await this.pool.query<{
      id: string;
      household_id: string;
      household_name: string;
      inviter_user_id: string;
      invitee_email: string;
      invitee_first_name: string;
      invitee_last_name: string;
      assigned_role: HouseholdRole;
      token_hash: string;
      token_expires_at: string | Date;
      status: 'pending' | 'accepted' | 'expired' | 'cancelled';
      reactivation_count: number;
      created_at: string | Date;
      accepted_at: string | Date | null;
    }>(
      `SELECT i.id, i.household_id, h.name AS household_name, i.inviter_user_id, i.invitee_email,
              i.invitee_first_name, i.invitee_last_name, i.assigned_role, i.token_hash,
              i.token_expires_at, i.status, i.reactivation_count, i.created_at, i.accepted_at
       FROM household_invitations i
       JOIN households h ON h.id = i.household_id
       WHERE i.household_id = $1
       ORDER BY i.created_at DESC`,
      [householdId],
    );

    return result.rows.map(mapInvitation);
  }

  async resolveInvitationByToken(token: string): Promise<HouseholdInvitation | null> {
    if (!isInvitationTokenValid(token, env.TOKEN_SIGNING_SECRET)) {
      return null;
    }

    const result = await this.pool.query<{
      id: string;
      household_id: string;
      household_name: string;
      inviter_user_id: string;
      invitee_email: string;
      invitee_first_name: string;
      invitee_last_name: string;
      assigned_role: HouseholdRole;
      token_hash: string;
      token_expires_at: string | Date;
      status: 'pending' | 'accepted' | 'expired' | 'cancelled';
      reactivation_count: number;
      created_at: string | Date;
      accepted_at: string | Date | null;
    }>(
      `SELECT i.id, i.household_id, h.name AS household_name, i.inviter_user_id, i.invitee_email,
              i.invitee_first_name, i.invitee_last_name, i.assigned_role, i.token_hash,
              i.token_expires_at, i.status, i.reactivation_count, i.created_at, i.accepted_at
       FROM household_invitations i
       JOIN households h ON h.id = i.household_id
       WHERE i.token_hash = $1
       LIMIT 1`,
      [hashToken(token)],
    );

    const invitation = result.rows[0];
    if (!invitation) {
      return null;
    }

    if (invitation.status !== 'pending') {
      return null;
    }

    if (new Date(invitation.token_expires_at) <= new Date()) {
      await this.pool.query(
        `UPDATE household_invitations
         SET status = 'expired'
         WHERE id = $1`,
        [invitation.id],
      );
      return null;
    }

    return mapInvitation(invitation);
  }

  async acceptInvitation(input: {
    requester: AuthenticatedRequester;
    token?: string;
    invitationId?: string;
  }): Promise<{ householdId: string; role: HouseholdRole }> {
    const client = await this.pool.connect();
    let transactionCommitted = false;

    try {
      if (input.token && !isInvitationTokenValid(input.token, env.TOKEN_SIGNING_SECRET)) {
        throw new NotFoundError('Invitation not found.');
      }

      const normalizedEmail = normalizeEmail(input.requester.email);

      await client.query('BEGIN');

      const invitation = await this.findInvitationForAccept(client, input, normalizedEmail);

      if (!invitation) {
        throw new NotFoundError('Invitation not found.');
      }

      if (invitation.invitee_email !== normalizedEmail) {
        throw new ForbiddenError('Access denied to this invitation.');
      }

      if (invitation.status !== 'pending') {
        throw new ConflictError('Invitation is not pending.');
      }

      if (new Date(invitation.token_expires_at) <= new Date()) {
        await client.query(
          `UPDATE household_invitations
           SET status = 'expired'
           WHERE id = $1`,
          [invitation.id],
        );
        await client.query('COMMIT');
        transactionCommitted = true;
        throw new ConflictError('Invitation expired. Please request a new invitation.');
      }

      const acceptedAt = nowIso();

      await client.query(
        `UPDATE household_invitations
         SET status = 'accepted', accepted_at = $2
         WHERE id = $1`,
        [invitation.id, acceptedAt],
      );

      await client.query(
        `INSERT INTO household_members
         (id, household_id, user_id, email, first_name, last_name, role, status, joined_at, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, 'active', $8, $8)
         ON CONFLICT (household_id, user_id)
         DO UPDATE SET
           email = EXCLUDED.email,
           first_name = EXCLUDED.first_name,
           last_name = EXCLUDED.last_name,
           role = EXCLUDED.role,
           status = 'active',
           joined_at = EXCLUDED.joined_at`,
        [
          randomUUID(),
          invitation.household_id,
          input.requester.userId,
          normalizedEmail,
          normalizeName(input.requester.firstName),
          normalizeName(input.requester.lastName),
          invitation.assigned_role,
          acceptedAt,
        ],
      );

      await client.query('COMMIT');
      transactionCommitted = true;

      return {
        householdId: invitation.household_id,
        role: invitation.assigned_role,
      };
    } catch (error) {
      if (!transactionCommitted) {
        await client.query('ROLLBACK');
      }
      throw error;
    } finally {
      client.release();
    }
  }

  async cancelInvitation(input: {
    householdId: string;
    invitationId: string;
    requesterUserId: string;
  }): Promise<void> {
    const client = await this.pool.connect();
    let transactionCommitted = false;

    try {
      await client.query('BEGIN');

      const requester = await client.query<{ role: HouseholdRole }>(
        `SELECT role
         FROM household_members
         WHERE household_id = $1 AND user_id = $2 AND status = 'active'
         LIMIT 1`,
        [input.householdId, input.requesterUserId],
      );

      const requesterRole = requester.rows[0]?.role;
      if (requesterRole !== 'caregiver') {
        throw new ForbiddenError('Only caregivers can cancel invitations.');
      }

      const invitation = await client.query<{ id: string; status: 'pending' | 'accepted' | 'expired' | 'cancelled' }>(
        `SELECT id, status
         FROM household_invitations
         WHERE id = $1 AND household_id = $2
         LIMIT 1
         FOR UPDATE`,
        [input.invitationId, input.householdId],
      );

      const invitationRow = invitation.rows[0];
      if (!invitationRow) {
        throw new NotFoundError('Invitation not found.');
      }

      if (invitationRow.status !== 'pending') {
        throw new ConflictError('Invitation is not pending.');
      }

      await client.query(
        `UPDATE household_invitations
         SET status = 'cancelled'
         WHERE id = $1`,
        [invitationRow.id],
      );

      await client.query('COMMIT');
      transactionCommitted = true;
    } catch (error) {
      if (!transactionCommitted) {
        await client.query('ROLLBACK');
      }
      throw error;
    } finally {
      client.release();
    }
  }

  async resendInvitation(input: {
    householdId: string;
    invitationId: string;
    requesterUserId: string;
  }): Promise<{ newToken: string; newExpiresAt: string; acceptLinkUrl: string; deepLinkUrl: string; fallbackUrl: string | null }> {
    const client = await this.pool.connect();
    let transactionCommitted = false;

    try {
      await client.query('BEGIN');

      const requester = await client.query<{ role: HouseholdRole }>(
        `SELECT role
         FROM household_members
         WHERE household_id = $1 AND user_id = $2 AND status = 'active'
         LIMIT 1`,
        [input.householdId, input.requesterUserId],
      );

      const requesterRole = requester.rows[0]?.role;
      if (requesterRole !== 'caregiver') {
        throw new ForbiddenError('Only caregivers can resend invitations.');
      }

      const invitation = await client.query<{
        id: string;
        status: 'pending' | 'accepted' | 'expired' | 'cancelled';
        token_expires_at: string | Date;
      }>(
        `SELECT id, status, token_expires_at
         FROM household_invitations
         WHERE id = $1 AND household_id = $2
         LIMIT 1
         FOR UPDATE`,
        [input.invitationId, input.householdId],
      );

      const invitationRow = invitation.rows[0];
      if (!invitationRow) {
        throw new NotFoundError('Invitation not found.');
      }

      if (invitationRow.status !== 'pending') {
        throw new ConflictError('Can only resend pending invitations.');
      }

      const now = new Date();
      const expiresAt = new Date(invitationRow.token_expires_at);
      if (expiresAt <= now) {
        throw new ConflictError('Cannot resend expired invitation. Please cancel and create a new one.');
      }

      const newExpiresAt = addHours(nowIso(), INVITATION_TTL_HOURS);
      const newToken = signInvitationToken(input.invitationId, env.TOKEN_SIGNING_SECRET);
      const newTokenHash = hashToken(newToken);

      await client.query(
        `UPDATE household_invitations
         SET token_hash = $2, token_expires_at = $3
         WHERE id = $1`,
        [input.invitationId, newTokenHash, newExpiresAt],
      );

      await client.query('COMMIT');
      transactionCommitted = true;

      const links = buildInvitationLinks({
        token: newToken,
        backendBaseUrl: env.BACKEND_URL,
        ...(env.INVITATION_WEB_FALLBACK_URL ? { fallbackBaseUrl: env.INVITATION_WEB_FALLBACK_URL } : {}),
      });

      return {
        newToken,
        newExpiresAt,
        acceptLinkUrl: links.acceptLinkUrl,
        deepLinkUrl: links.deepLinkUrl,
        fallbackUrl: links.fallbackUrl,
      };
    } catch (error) {
      if (!transactionCommitted) {
        await client.query('ROLLBACK');
      }
      throw error;
    } finally {
      client.release();
    }
  }

  async reactivateInvitation(input: {
    householdId: string;
    invitationId: string;
    requesterUserId: string;
  }): Promise<{
    id: string;
    inviteeFirstName: string;
    inviteeLastName: string;
    inviteeEmail: string;
    assignedRole: HouseholdRole;
    newToken: string;
    newExpiresAt: string;
    acceptLinkUrl: string;
    deepLinkUrl: string;
    fallbackUrl: string | null;
  }> {
    const client = await this.pool.connect();
    let transactionCommitted = false;
    const MAX_REACTIVATIONS = 3;

    try {
      await client.query('BEGIN');

      const requester = await client.query<{ role: HouseholdRole }>(
        `SELECT role
         FROM household_members
         WHERE household_id = $1 AND user_id = $2 AND status = 'active'
         LIMIT 1`,
        [input.householdId, input.requesterUserId],
      );

      const requesterRole = requester.rows[0]?.role;
      if (requesterRole !== 'caregiver') {
        throw new ForbiddenError('Only caregivers can reactivate invitations.');
      }

      const invitation = await client.query<{
        id: string;
        invitee_first_name: string;
        invitee_last_name: string;
        invitee_email: string;
        assigned_role: HouseholdRole;
        status: 'pending' | 'accepted' | 'expired' | 'cancelled';
        reactivation_count: number;
      }>(
        `SELECT id, invitee_first_name, invitee_last_name, invitee_email, assigned_role, status, reactivation_count
         FROM household_invitations
         WHERE id = $1 AND household_id = $2
         LIMIT 1
         FOR UPDATE`,
        [input.invitationId, input.householdId],
      );

      const invitationRow = invitation.rows[0];
      if (!invitationRow) {
        throw new NotFoundError('Invitation not found.');
      }

      if (invitationRow.status !== 'expired') {
        throw new ConflictError('Can only reactivate expired invitations.');
      }

      if (invitationRow.reactivation_count >= MAX_REACTIVATIONS) {
        throw new ConflictError(`Maximum reactivation limit (${MAX_REACTIVATIONS}) reached. Please create a new invitation.`);
      }

      const newExpiresAt = addHours(nowIso(), INVITATION_TTL_HOURS);
      const newToken = signInvitationToken(input.invitationId, env.TOKEN_SIGNING_SECRET);
      const newTokenHash = hashToken(newToken);

      await client.query(
        `UPDATE household_invitations
         SET token_hash = $2, token_expires_at = $3, status = 'pending', reactivation_count = reactivation_count + 1
         WHERE id = $1`,
        [input.invitationId, newTokenHash, newExpiresAt],
      );

      await client.query('COMMIT');
      transactionCommitted = true;

      const links = buildInvitationLinks({
        token: newToken,
        backendBaseUrl: env.BACKEND_URL,
        ...(env.INVITATION_WEB_FALLBACK_URL ? { fallbackBaseUrl: env.INVITATION_WEB_FALLBACK_URL } : {}),
      });

      return {
        id: invitationRow.id,
        inviteeFirstName: invitationRow.invitee_first_name,
        inviteeLastName: invitationRow.invitee_last_name,
        inviteeEmail: invitationRow.invitee_email,
        assignedRole: invitationRow.assigned_role,
        newToken,
        newExpiresAt,
        acceptLinkUrl: links.acceptLinkUrl,
        deepLinkUrl: links.deepLinkUrl,
        fallbackUrl: links.fallbackUrl,
      };
    } catch (error) {
      if (!transactionCommitted) {
        await client.query('ROLLBACK');
      }
      throw error;
    } finally {
      client.release();
    }
  }

  async logAuditEvent(input: AuditEventInput): Promise<void> {
    await this.pool.query(
      `INSERT INTO audit_events (id, household_id, actor_user_id, action, target_id, metadata, created_at)
       VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7)`,
      [randomUUID(), input.householdId, input.actorUserId, input.action, input.targetId, JSON.stringify(input.metadata), nowIso()],
    );
  }

  async findMemberById(memberId: string): Promise<Member | null> {
    const result = await this.pool.query<{
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
    }>(
      `SELECT id, household_id, user_id, email, first_name, last_name, role, status, joined_at, created_at
       FROM household_members
       WHERE id = $1 AND status = 'active'
       LIMIT 1`,
      [memberId],
    );

    const row = result.rows[0];
    return row ? mapMember(row) : null;
  }

  async removeMember(memberId: string): Promise<void> {
    await this.pool.query(
      `DELETE FROM household_members
       WHERE id = $1`,
      [memberId],
    );
  }

  async updateMemberRole(memberId: string, newRole: HouseholdRole): Promise<Member> {
    const result = await this.pool.query<{
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
    }>(
      `UPDATE household_members
       SET role = $2
       WHERE id = $1 AND status = 'active'
       RETURNING id, household_id, user_id, email, first_name, last_name, role, status, joined_at, created_at`,
      [memberId, newRole],
    );

    const row = result.rows[0];
    if (!row) {
      throw new NotFoundError('Member not found or already removed.');
    }

    return mapMember(row);
  }

  private async findInvitationForAccept(
    client: PoolClient,
    input: { requester: AuthenticatedRequester; token?: string; invitationId?: string },
    normalizedEmail: string,
  ): Promise<{
    id: string;
    household_id: string;
    invitee_email: string;
    assigned_role: HouseholdRole;
    status: 'pending' | 'accepted' | 'expired' | 'cancelled';
    token_expires_at: string | Date;
  } | null> {
    if (input.token) {
      const byToken = await client.query<{
        id: string;
        household_id: string;
        invitee_email: string;
        assigned_role: HouseholdRole;
        status: 'pending' | 'accepted' | 'expired' | 'cancelled';
        token_expires_at: string | Date;
      }>(
        `SELECT id, household_id, invitee_email, assigned_role, status, token_expires_at
         FROM household_invitations
         WHERE token_hash = $1
         LIMIT 1
         FOR UPDATE`,
        [hashToken(input.token)],
      );

      return byToken.rows[0] ?? null;
    }

    if (input.invitationId) {
      const byId = await client.query<{
        id: string;
        household_id: string;
        invitee_email: string;
        assigned_role: HouseholdRole;
        status: 'pending' | 'accepted' | 'expired' | 'cancelled';
        token_expires_at: string | Date;
      }>(
        `SELECT id, household_id, invitee_email, assigned_role, status, token_expires_at
         FROM household_invitations
         WHERE id = $1
         LIMIT 1
         FOR UPDATE`,
        [input.invitationId],
      );

      return byId.rows[0] ?? null;
    }

    const byEmail = await client.query<{
      id: string;
      household_id: string;
      invitee_email: string;
      assigned_role: HouseholdRole;
      status: 'pending' | 'accepted' | 'expired' | 'cancelled';
      token_expires_at: string | Date;
    }>(
      `SELECT id, household_id, invitee_email, assigned_role, status, token_expires_at
       FROM household_invitations
       WHERE invitee_email = $1 AND status = 'pending'
       ORDER BY created_at DESC
       LIMIT 1
       FOR UPDATE`,
      [normalizedEmail],
    );

    return byEmail.rows[0] ?? null;
  }

  // Medications

  async listHouseholdMedications(householdId: string): Promise<Medication[]> {
    const result = await this.pool.query<{
      id: string;
      household_id: string;
      senior_id: string;
      name: string;
      dosage: string;
      form: MedicationForm;
      frequency: string;
      prescribed_by: string | null;
      prescription_date: string | Date | null;
      start_date: string | Date;
      end_date: string | Date | null;
      instructions: string | null;
      created_by_user_id: string;
      created_at: string | Date;
      updated_at: string | Date;
    }>(
      `SELECT id, household_id, senior_id, name, dosage, form, frequency,
              prescribed_by, prescription_date, start_date, end_date, instructions,
              created_by_user_id, created_at, updated_at
       FROM medications
       WHERE household_id = $1
       ORDER BY name ASC`,
      [householdId],
    );

    return result.rows.map(mapMedication);
  }

  async getMedicationById(medicationId: string, householdId: string): Promise<Medication | null> {
    const result = await this.pool.query<{
      id: string;
      household_id: string;
      senior_id: string;
      name: string;
      dosage: string;
      form: MedicationForm;
      frequency: string;
      prescribed_by: string | null;
      prescription_date: string | Date | null;
      start_date: string | Date;
      end_date: string | Date | null;
      instructions: string | null;
      created_by_user_id: string;
      created_at: string | Date;
      updated_at: string | Date;
    }>(
      `SELECT id, household_id, senior_id, name, dosage, form, frequency,
              prescribed_by, prescription_date, start_date, end_date, instructions,
              created_by_user_id, created_at, updated_at
       FROM medications
       WHERE id = $1 AND household_id = $2
       LIMIT 1`,
      [medicationId, householdId],
    );

    const row = result.rows[0];
    return row ? mapMedication(row) : null;
  }

  async createMedication(input: CreateMedicationInput): Promise<Medication> {
    const id = randomUUID();
    const now = nowIso();

    const result = await this.pool.query<{
      id: string;
      household_id: string;
      senior_id: string;
      name: string;
      dosage: string;
      form: MedicationForm;
      frequency: string;
      prescribed_by: string | null;
      prescription_date: string | Date | null;
      start_date: string | Date;
      end_date: string | Date | null;
      instructions: string | null;
      created_by_user_id: string;
      created_at: string | Date;
      updated_at: string | Date;
    }>(
      `INSERT INTO medications (
         id, household_id, senior_id, name, dosage, form, frequency,
         prescribed_by, prescription_date, start_date, end_date, instructions,
         created_by_user_id, created_at, updated_at
       )
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $14)
       RETURNING id, household_id, senior_id, name, dosage, form, frequency,
                 prescribed_by, prescription_date, start_date, end_date, instructions,
                 created_by_user_id, created_at, updated_at`,
      [
        id,
        input.householdId,
        input.seniorId,
        input.name,
        input.dosage,
        input.form,
        input.frequency,
        input.prescribedBy ?? null,
        input.prescriptionDate ?? null,
        input.startDate,
        input.endDate ?? null,
        input.instructions ?? null,
        input.createdByUserId,
        now,
      ],
    );

    const row = result.rows[0];
    if (!row) {
      throw new NotFoundError('Failed to create medication.');
    }

    return mapMedication(row);
  }

  async updateMedication(medicationId: string, householdId: string, input: UpdateMedicationInput): Promise<Medication> {
    const updates: string[] = [];
    const values: (string | number | null)[] = [];
    let paramIndex = 1;

    if (input.name !== undefined) {
      updates.push(`name = $${paramIndex++}`);
      values.push(input.name);
    }
    if (input.dosage !== undefined) {
      updates.push(`dosage = $${paramIndex++}`);
      values.push(input.dosage);
    }
    if (input.form !== undefined) {
      updates.push(`form = $${paramIndex++}`);
      values.push(input.form);
    }
    if (input.frequency !== undefined) {
      updates.push(`frequency = $${paramIndex++}`);
      values.push(input.frequency);
    }
    if (input.prescribedBy !== undefined) {
      updates.push(`prescribed_by = $${paramIndex++}`);
      values.push(input.prescribedBy);
    }
    if (input.prescriptionDate !== undefined) {
      updates.push(`prescription_date = $${paramIndex++}`);
      values.push(input.prescriptionDate);
    }
    if (input.startDate !== undefined) {
      updates.push(`start_date = $${paramIndex++}`);
      values.push(input.startDate);
    }
    if (input.endDate !== undefined) {
      updates.push(`end_date = $${paramIndex++}`);
      values.push(input.endDate);
    }
    if (input.instructions !== undefined) {
      updates.push(`instructions = $${paramIndex++}`);
      values.push(input.instructions);
    }

    if (updates.length === 0) {
      throw new ValidationError('No fields to update.');
    }

    const now = nowIso();
    updates.push(`updated_at = $${paramIndex++}`);
    values.push(now);

    values.push(medicationId);
    values.push(householdId);

    const result = await this.pool.query<{
      id: string;
      household_id: string;
      senior_id: string;
      name: string;
      dosage: string;
      form: MedicationForm;
      frequency: string;
      prescribed_by: string | null;
      prescription_date: string | Date | null;
      start_date: string | Date;
      end_date: string | Date | null;
      instructions: string | null;
      created_by_user_id: string;
      created_at: string | Date;
      updated_at: string | Date;
    }>(
      `UPDATE medications
       SET ${updates.join(', ')}
       WHERE id = $${paramIndex++} AND household_id = $${paramIndex++}
       RETURNING id, household_id, senior_id, name, dosage, form, frequency,
                 prescribed_by, prescription_date, start_date, end_date, instructions,
                 created_by_user_id, created_at, updated_at`,
      values,
    );

    const row = result.rows[0];
    if (!row) {
      throw new NotFoundError('Medication not found.');
    }

    return mapMedication(row);
  }

  async deleteMedication(medicationId: string, householdId: string): Promise<void> {
    const result = await this.pool.query(
      `DELETE FROM medications
       WHERE id = $1 AND household_id = $2`,
      [medicationId, householdId],
    );

    if (result.rowCount === 0) {
      throw new NotFoundError('Medication not found.');
    }
  }

  // Medication Reminders

  async listMedicationReminders(medicationId: string, householdId: string): Promise<MedicationReminder[]> {
    const result = await this.pool.query<{
      id: string;
      medication_id: string;
      time: string;
      days_of_week: number[];
      enabled: boolean;
      created_at: string | Date;
      updated_at: string | Date;
    }>(
      `SELECT r.id, r.medication_id, r.time, r.days_of_week, r.enabled, r.created_at, r.updated_at
       FROM medication_reminders r
       JOIN medications m ON m.id = r.medication_id
       WHERE r.medication_id = $1 AND m.household_id = $2
       ORDER BY r.time ASC`,
      [medicationId, householdId],
    );

    return result.rows.map(mapReminder);
  }

  async getReminderById(reminderId: string, medicationId: string, householdId: string): Promise<MedicationReminder | null> {
    const result = await this.pool.query<{
      id: string;
      medication_id: string;
      time: string;
      days_of_week: number[];
      enabled: boolean;
      created_at: string | Date;
      updated_at: string | Date;
    }>(
      `SELECT r.id, r.medication_id, r.time, r.days_of_week, r.enabled, r.created_at, r.updated_at
       FROM medication_reminders r
       JOIN medications m ON m.id = r.medication_id
       WHERE r.id = $1 AND r.medication_id = $2 AND m.household_id = $3
       LIMIT 1`,
      [reminderId, medicationId, householdId],
    );

    const row = result.rows[0];
    return row ? mapReminder(row) : null;
  }

  async createReminder(input: CreateReminderInput): Promise<MedicationReminder> {
    const id = randomUUID();
    const now = nowIso();
    const enabled = input.enabled ?? true;

    const result = await this.pool.query<{
      id: string;
      medication_id: string;
      time: string;
      days_of_week: number[];
      enabled: boolean;
      created_at: string | Date;
      updated_at: string | Date;
    }>(
      `INSERT INTO medication_reminders (id, medication_id, time, days_of_week, enabled, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $6)
       RETURNING id, medication_id, time, days_of_week, enabled, created_at, updated_at`,
      [id, input.medicationId, input.time, input.daysOfWeek, enabled, now],
    );

    const row = result.rows[0];
    if (!row) {
      throw new NotFoundError('Failed to create reminder.');
    }

    return mapReminder(row);
  }

  async updateReminder(reminderId: string, medicationId: string, householdId: string, input: UpdateReminderInput): Promise<MedicationReminder> {
    const updates: string[] = [];
    const values: unknown[] = [];
    let paramIndex = 1;

    if (input.time !== undefined) {
      updates.push(`time = $${paramIndex++}`);
      values.push(input.time);
    }
    if (input.daysOfWeek !== undefined) {
      updates.push(`days_of_week = $${paramIndex++}`);
      values.push(input.daysOfWeek);
    }
    if (input.enabled !== undefined) {
      updates.push(`enabled = $${paramIndex++}`);
      values.push(input.enabled);
    }

    if (updates.length === 0) {
      throw new ValidationError('No fields to update.');
    }

    const now = nowIso();
    updates.push(`updated_at = $${paramIndex++}`);
    values.push(now);

    values.push(reminderId);
    values.push(medicationId);

    const result = await this.pool.query<{
      id: string;
      medication_id: string;
      time: string;
      days_of_week: number[];
      enabled: boolean;
      created_at: string | Date;
      updated_at: string | Date;
    }>(
      `UPDATE medication_reminders r
       SET ${updates.join(', ')}
       FROM medications m
       WHERE r.id = $${paramIndex++} AND r.medication_id = $${paramIndex++} AND m.id = r.medication_id AND m.household_id = $${paramIndex++}
       RETURNING r.id, r.medication_id, r.time, r.days_of_week, r.enabled, r.created_at, r.updated_at`,
      [...values, householdId],
    );

    const row = result.rows[0];
    if (!row) {
      throw new NotFoundError('Reminder not found.');
    }

    return mapReminder(row);
  }

  async deleteReminder(reminderId: string, medicationId: string, householdId: string): Promise<void> {
    const result = await this.pool.query(
      `DELETE FROM medication_reminders r
       USING medications m
       WHERE r.id = $1 AND r.medication_id = $2 AND m.id = r.medication_id AND m.household_id = $3`,
      [reminderId, medicationId, householdId],
    );

    if (result.rowCount === 0) {
      throw new NotFoundError('Reminder not found.');
    }
  }

  // Appointments

  async listHouseholdAppointments(householdId: string): Promise<AppointmentWithReminders[]> {
    // Fetch all appointments for the household
    const appointmentsResult = await this.pool.query<{
      id: string;
      household_id: string;
      title: string;
      type: AppointmentType;
      date: string | Date;
      time: string;
      duration: number | null;
      senior_ids: string;
      caregiver_id: string | null;
      address: string | null;
      location_name: string | null;
      phone_number: string | null;
      description: string | null;
      professional_name: string | null;
      preparation: string | null;
      documents_to_take: string | null;
      transport_arrangement: string | null;
      recurrence: string | null;
      status: AppointmentStatus;
      notes: string | null;
      created_at: string | Date;
      updated_at: string | Date;
    }>(
      `SELECT id, household_id, title, type, date, time, duration,
              senior_ids::text, caregiver_id, address, location_name, phone_number,
              description, professional_name, preparation, documents_to_take,
              transport_arrangement, recurrence::text, status, notes,
              created_at, updated_at
       FROM appointments
       WHERE household_id = $1
       ORDER BY date ASC, time ASC`,
      [householdId],
    );

    // Fetch all reminders for these appointments
    const appointmentIds = appointmentsResult.rows.map(row => row.id);
    let remindersMap: Map<string, AppointmentReminder[]> = new Map();

    if (appointmentIds.length > 0) {
      const remindersResult = await this.pool.query<{
        id: string;
        appointment_id: string;
        trigger_before: number;
        custom_message: string | null;
        enabled: boolean;
        created_at: string | Date;
        updated_at: string | Date;
      }>(
        `SELECT id, appointment_id, trigger_before, custom_message, enabled, created_at, updated_at
         FROM appointment_reminders
         WHERE appointment_id = ANY($1)
         ORDER BY trigger_before DESC`,
        [appointmentIds],
      );

      // Group reminders by appointment_id
      for (const row of remindersResult.rows) {
        const reminder = mapAppointmentReminder(row);
        if (!remindersMap.has(row.appointment_id)) {
          remindersMap.set(row.appointment_id, []);
        }
        remindersMap.get(row.appointment_id)!.push(reminder);
      }
    }

    // Combine appointments with their reminders
    return appointmentsResult.rows.map(row => ({
      ...mapAppointment(row),
      reminders: remindersMap.get(row.id) || [],
    }));
  }

  async getAppointmentById(appointmentId: string, householdId: string): Promise<AppointmentWithReminders | null> {
    const appointmentResult = await this.pool.query<{
      id: string;
      household_id: string;
      title: string;
      type: AppointmentType;
      date: string | Date;
      time: string;
      duration: number | null;
      senior_ids: string;
      caregiver_id: string | null;
      address: string | null;
      location_name: string | null;
      phone_number: string | null;
      description: string | null;
      professional_name: string | null;
      preparation: string | null;
      documents_to_take: string | null;
      transport_arrangement: string | null;
      recurrence: string | null;
      status: AppointmentStatus;
      notes: string | null;
      created_at: string | Date;
      updated_at: string | Date;
    }>(
      `SELECT id, household_id, title, type, date, time, duration,
              senior_ids::text, caregiver_id, address, location_name, phone_number,
              description, professional_name, preparation, documents_to_take,
              transport_arrangement, recurrence::text, status, notes,
              created_at, updated_at
       FROM appointments
       WHERE id = $1 AND household_id = $2
       LIMIT 1`,
      [appointmentId, householdId],
    );

    const row = appointmentResult.rows[0];
    if (!row) {
      return null;
    }

    // Fetch reminders for this appointment
    const remindersResult = await this.pool.query<{
      id: string;
      appointment_id: string;
      trigger_before: number;
      custom_message: string | null;
      enabled: boolean;
      created_at: string | Date;
      updated_at: string | Date;
    }>(
      `SELECT id, appointment_id, trigger_before, custom_message, enabled, created_at, updated_at
       FROM appointment_reminders
       WHERE appointment_id = $1
       ORDER BY trigger_before DESC`,
      [appointmentId],
    );

    return {
      ...mapAppointment(row),
      reminders: remindersResult.rows.map(mapAppointmentReminder),
    };
  }

  async createAppointment(input: CreateAppointmentInput): Promise<Appointment> {
    const id = randomUUID();
    const now = nowIso();
    const status = input.status || 'scheduled';

    const result = await this.pool.query<{
      id: string;
      household_id: string;
      title: string;
      type: AppointmentType;
      date: string | Date;
      time: string;
      duration: number | null;
      senior_ids: string;
      caregiver_id: string | null;
      address: string | null;
      location_name: string | null;
      phone_number: string | null;
      description: string | null;
      professional_name: string | null;
      preparation: string | null;
      documents_to_take: string | null;
      transport_arrangement: string | null;
      recurrence: string | null;
      status: AppointmentStatus;
      notes: string | null;
      created_at: string | Date;
      updated_at: string | Date;
    }>(
      `INSERT INTO appointments (
         id, household_id, title, type, date, time, duration,
         senior_ids, caregiver_id, address, location_name, phone_number,
         description, professional_name, preparation, documents_to_take,
         transport_arrangement, recurrence, status, notes,
         created_at, updated_at
       )
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $21)
       RETURNING id, household_id, title, type, date, time, duration,
                 senior_ids::text, caregiver_id, address, location_name, phone_number,
                 description, professional_name, preparation, documents_to_take,
                 transport_arrangement, recurrence::text, status, notes,
                 created_at, updated_at`,
      [
        id,
        input.householdId,
        input.title,
        input.type,
        input.date,
        input.time,
        input.duration ?? null,
        JSON.stringify(input.seniorIds),
        input.caregiverId ?? null,
        input.address ?? null,
        input.locationName ?? null,
        input.phoneNumber ?? null,
        input.description ?? null,
        input.professionalName ?? null,
        input.preparation ?? null,
        input.documentsToTake ?? null,
        input.transportArrangement ?? null,
        input.recurrence ? JSON.stringify(input.recurrence) : null,
        status,
        input.notes ?? null,
        now,
      ],
    );

    const row = result.rows[0];
    if (!row) {
      throw new NotFoundError('Failed to create appointment.');
    }

    return mapAppointment(row);
  }

  async updateAppointment(appointmentId: string, householdId: string, input: UpdateAppointmentInput): Promise<Appointment> {
    const updates: string[] = [];
    const values: unknown[] = [];
    let paramIndex = 1;

    if (input.title !== undefined) {
      updates.push(`title = $${paramIndex++}`);
      values.push(input.title);
    }
    if (input.type !== undefined) {
      updates.push(`type = $${paramIndex++}`);
      values.push(input.type);
    }
    if (input.date !== undefined) {
      updates.push(`date = $${paramIndex++}`);
      values.push(input.date);
    }
    if (input.time !== undefined) {
      updates.push(`time = $${paramIndex++}`);
      values.push(input.time);
    }
    if (input.duration !== undefined) {
      updates.push(`duration = $${paramIndex++}`);
      values.push(input.duration);
    }
    if (input.seniorIds !== undefined) {
      updates.push(`senior_ids = $${paramIndex++}`);
      values.push(JSON.stringify(input.seniorIds));
    }
    if (input.caregiverId !== undefined) {
      updates.push(`caregiver_id = $${paramIndex++}`);
      values.push(input.caregiverId);
    }
    if (input.address !== undefined) {
      updates.push(`address = $${paramIndex++}`);
      values.push(input.address);
    }
    if (input.locationName !== undefined) {
      updates.push(`location_name = $${paramIndex++}`);
      values.push(input.locationName);
    }
    if (input.phoneNumber !== undefined) {
      updates.push(`phone_number = $${paramIndex++}`);
      values.push(input.phoneNumber);
    }
    if (input.description !== undefined) {
      updates.push(`description = $${paramIndex++}`);
      values.push(input.description);
    }
    if (input.professionalName !== undefined) {
      updates.push(`professional_name = $${paramIndex++}`);
      values.push(input.professionalName);
    }
    if (input.preparation !== undefined) {
      updates.push(`preparation = $${paramIndex++}`);
      values.push(input.preparation);
    }
    if (input.documentsToTake !== undefined) {
      updates.push(`documents_to_take = $${paramIndex++}`);
      values.push(input.documentsToTake);
    }
    if (input.transportArrangement !== undefined) {
      updates.push(`transport_arrangement = $${paramIndex++}`);
      values.push(input.transportArrangement);
    }
    if (input.recurrence !== undefined) {
      updates.push(`recurrence = $${paramIndex++}`);
      values.push(input.recurrence ? JSON.stringify(input.recurrence) : null);
    }
    if (input.status !== undefined) {
      updates.push(`status = $${paramIndex++}`);
      values.push(input.status);
    }
    if (input.notes !== undefined) {
      updates.push(`notes = $${paramIndex++}`);
      values.push(input.notes);
    }

    if (updates.length === 0) {
      throw new ValidationError('No fields to update.');
    }

    const now = nowIso();
    updates.push(`updated_at = $${paramIndex++}`);
    values.push(now);

    values.push(appointmentId);
    values.push(householdId);

    const result = await this.pool.query<{
      id: string;
      household_id: string;
      title: string;
      type: AppointmentType;
      date: string | Date;
      time: string;
      duration: number | null;
      senior_ids: string;
      caregiver_id: string | null;
      address: string | null;
      location_name: string | null;
      phone_number: string | null;
      description: string | null;
      professional_name: string | null;
      preparation: string | null;
      documents_to_take: string | null;
      transport_arrangement: string | null;
      recurrence: string | null;
      status: AppointmentStatus;
      notes: string | null;
      created_at: string | Date;
      updated_at: string | Date;
    }>(
      `UPDATE appointments
       SET ${updates.join(', ')}
       WHERE id = $${paramIndex++} AND household_id = $${paramIndex++}
       RETURNING id, household_id, title, type, date, time, duration,
                 senior_ids::text, caregiver_id, address, location_name, phone_number,
                 description, professional_name, preparation, documents_to_take,
                 transport_arrangement, recurrence::text, status, notes,
                 created_at, updated_at`,
      values,
    );

    const row = result.rows[0];
    if (!row) {
      throw new NotFoundError('Appointment not found.');
    }

    return mapAppointment(row);
  }

  async deleteAppointment(appointmentId: string, householdId: string): Promise<void> {
    const result = await this.pool.query(
      `DELETE FROM appointments
       WHERE id = $1 AND household_id = $2`,
      [appointmentId, householdId],
    );

    if (result.rowCount === 0) {
      throw new NotFoundError('Appointment not found.');
    }
  }

  // Appointment Reminders

  async listAppointmentReminders(appointmentId: string, householdId: string): Promise<AppointmentReminder[]> {
    const result = await this.pool.query<{
      id: string;
      appointment_id: string;
      trigger_before: number;
      custom_message: string | null;
      enabled: boolean;
      created_at: string | Date;
      updated_at: string | Date;
    }>(
      `SELECT r.id, r.appointment_id, r.trigger_before, r.custom_message, r.enabled, r.created_at, r.updated_at
       FROM appointment_reminders r
       JOIN appointments a ON a.id = r.appointment_id
       WHERE r.appointment_id = $1 AND a.household_id = $2
       ORDER BY r.trigger_before DESC`,
      [appointmentId, householdId],
    );

    return result.rows.map(mapAppointmentReminder);
  }

  async getAppointmentReminderById(reminderId: string, appointmentId: string, householdId: string): Promise<AppointmentReminder | null> {
    const result = await this.pool.query<{
      id: string;
      appointment_id: string;
      trigger_before: number;
      custom_message: string | null;
      enabled: boolean;
      created_at: string | Date;
      updated_at: string | Date;
    }>(
      `SELECT r.id, r.appointment_id, r.trigger_before, r.custom_message, r.enabled, r.created_at, r.updated_at
       FROM appointment_reminders r
       JOIN appointments a ON a.id = r.appointment_id
       WHERE r.id = $1 AND r.appointment_id = $2 AND a.household_id = $3
       LIMIT 1`,
      [reminderId, appointmentId, householdId],
    );

    const row = result.rows[0];
    return row ? mapAppointmentReminder(row) : null;
  }

  async createAppointmentReminder(input: CreateAppointmentReminderInput): Promise<AppointmentReminder> {
    const id = randomUUID();
    const now = nowIso();
    const enabled = input.enabled ?? true;

    const result = await this.pool.query<{
      id: string;
      appointment_id: string;
      trigger_before: number;
      custom_message: string | null;
      enabled: boolean;
      created_at: string | Date;
      updated_at: string | Date;
    }>(
      `INSERT INTO appointment_reminders (id, appointment_id, trigger_before, custom_message, enabled, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $6)
       RETURNING id, appointment_id, trigger_before, custom_message, enabled, created_at, updated_at`,
      [id, input.appointmentId, input.triggerBefore, input.customMessage ?? null, enabled, now],
    );

    const row = result.rows[0];
    if (!row) {
      throw new NotFoundError('Failed to create appointment reminder.');
    }

    return mapAppointmentReminder(row);
  }

  async updateAppointmentReminder(reminderId: string, appointmentId: string, householdId: string, input: UpdateAppointmentReminderInput): Promise<AppointmentReminder> {
    const updates: string[] = [];
    const values: unknown[] = [];
    let paramIndex = 1;

    if (input.triggerBefore !== undefined) {
      updates.push(`trigger_before = $${paramIndex++}`);
      values.push(input.triggerBefore);
    }
    if (input.customMessage !== undefined) {
      updates.push(`custom_message = $${paramIndex++}`);
      values.push(input.customMessage);
    }
    if (input.enabled !== undefined) {
      updates.push(`enabled = $${paramIndex++}`);
      values.push(input.enabled);
    }

    if (updates.length === 0) {
      throw new ValidationError('No fields to update.');
    }

    const now = nowIso();
    updates.push(`updated_at = $${paramIndex++}`);
    values.push(now);

    values.push(reminderId);
    values.push(appointmentId);

    const result = await this.pool.query<{
      id: string;
      appointment_id: string;
      trigger_before: number;
      custom_message: string | null;
      enabled: boolean;
      created_at: string | Date;
      updated_at: string | Date;
    }>(
      `UPDATE appointment_reminders r
       SET ${updates.join(', ')}
       FROM appointments a
       WHERE r.id = $${paramIndex++} AND r.appointment_id = $${paramIndex++} AND a.id = r.appointment_id AND a.household_id = $${paramIndex++}
       RETURNING r.id, r.appointment_id, r.trigger_before, r.custom_message, r.enabled, r.created_at, r.updated_at`,
      [...values, householdId],
    );

    const row = result.rows[0];
    if (!row) {
      throw new NotFoundError('Appointment reminder not found.');
    }

    return mapAppointmentReminder(row);
  }

  async deleteAppointmentReminder(reminderId: string, appointmentId: string, householdId: string): Promise<void> {
    const result = await this.pool.query(
      `DELETE FROM appointment_reminders r
       USING appointments a
       WHERE r.id = $1 AND r.appointment_id = $2 AND a.id = r.appointment_id AND a.household_id = $3`,
      [reminderId, appointmentId, householdId],
    );

    if (result.rowCount === 0) {
      throw new NotFoundError('Appointment reminder not found.');
    }
  }

  // Appointment Occurrences

  async getOccurrenceById(occurrenceId: string, householdId: string): Promise<AppointmentOccurrence | null> {
    const result = await this.pool.query<{
      id: string;
      recurring_appointment_id: string;
      household_id: string;
      occurrence_date: string | Date;
      occurrence_time: string;
      status: 'scheduled' | 'modified' | 'cancelled' | 'completed' | 'missed';
      overrides: string | null;
      created_at: string | Date;
      updated_at: string | Date;
    }>(
      `SELECT id, recurring_appointment_id, household_id, occurrence_date, occurrence_time,
              status, overrides::text, created_at, updated_at
       FROM appointment_occurrences
       WHERE id = $1 AND household_id = $2
       LIMIT 1`,
      [occurrenceId, householdId],
    );

    const row = result.rows[0];
    return row ? mapOccurrence(row) : null;
  }

  async getOccurrenceByDate(appointmentId: string, occurrenceDate: string, householdId: string): Promise<AppointmentOccurrence | null> {
    const result = await this.pool.query<{
      id: string;
      recurring_appointment_id: string;
      household_id: string;
      occurrence_date: string | Date;
      occurrence_time: string;
      status: 'scheduled' | 'modified' | 'cancelled' | 'completed' | 'missed';
      overrides: string | null;
      created_at: string | Date;
      updated_at: string | Date;
    }>(
      `SELECT id, recurring_appointment_id, household_id, occurrence_date, occurrence_time,
              status, overrides::text, created_at, updated_at
       FROM appointment_occurrences
       WHERE recurring_appointment_id = $1 AND occurrence_date = $2 AND household_id = $3
       LIMIT 1`,
      [appointmentId, occurrenceDate, householdId],
    );

    const row = result.rows[0];
    return row ? mapOccurrence(row) : null;
  }

  async listOccurrences(appointmentId: string, householdId: string, fromDate?: string, toDate?: string): Promise<AppointmentOccurrence[]> {
    let query = `
      SELECT id, recurring_appointment_id, household_id, occurrence_date, occurrence_time,
             status, overrides::text, created_at, updated_at
      FROM appointment_occurrences
      WHERE recurring_appointment_id = $1 AND household_id = $2
    `;

    const params: unknown[] = [appointmentId, householdId];
    let paramIndex = 3;

    if (fromDate) {
      query += ` AND occurrence_date >= $${paramIndex++}`;
      params.push(fromDate);
    }

    if (toDate) {
      query += ` AND occurrence_date <= $${paramIndex++}`;
      params.push(toDate);
    }

    query += ` ORDER BY occurrence_date ASC, occurrence_time ASC`;

    const result = await this.pool.query<{
      id: string;
      recurring_appointment_id: string;
      household_id: string;
      occurrence_date: string | Date;
      occurrence_time: string;
      status: 'scheduled' | 'modified' | 'cancelled' | 'completed' | 'missed';
      overrides: string | null;
      created_at: string | Date;
      updated_at: string | Date;
    }>(query, params);

    return result.rows.map(mapOccurrence);
  }

  async createOccurrence(input: CreateOccurrenceInput): Promise<AppointmentOccurrence> {
    const id = randomUUID();
    const now = nowIso();

    const result = await this.pool.query<{
      id: string;
      recurring_appointment_id: string;
      household_id: string;
      occurrence_date: string | Date;
      occurrence_time: string;
      status: 'scheduled' | 'modified' | 'cancelled' | 'completed' | 'missed';
      overrides: string | null;
      created_at: string | Date;
      updated_at: string | Date;
    }>(
      `INSERT INTO appointment_occurrences (
         id, recurring_appointment_id, household_id, occurrence_date, occurrence_time,
         status, overrides, created_at, updated_at
       )
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $8)
       RETURNING id, recurring_appointment_id, household_id, occurrence_date, occurrence_time,
                 status, overrides::text, created_at, updated_at`,
      [
        id,
        input.recurringAppointmentId,
        input.householdId,
        input.occurrenceDate,
        input.occurrenceTime,
        input.status,
        input.overrides ? JSON.stringify(input.overrides) : null,
        now,
      ],
    );

    const row = result.rows[0];
    if (!row) {
      throw new NotFoundError('Failed to create occurrence.');
    }

    return mapOccurrence(row);
  }

  async updateOccurrence(occurrenceId: string, householdId: string, input: UpdateOccurrenceInput): Promise<AppointmentOccurrence> {
    const updates: string[] = [];
    const values: unknown[] = [];
    let paramIndex = 1;

    if (input.status !== undefined) {
      updates.push(`status = $${paramIndex++}`);
      values.push(input.status);
    }
    if (input.overrides !== undefined) {
      updates.push(`overrides = $${paramIndex++}`);
      values.push(input.overrides ? JSON.stringify(input.overrides) : null);
    }

    if (updates.length === 0) {
      throw new ValidationError('No fields to update.');
    }

    const now = nowIso();
    updates.push(`updated_at = $${paramIndex++}`);
    values.push(now);

    values.push(occurrenceId);
    values.push(householdId);

    const result = await this.pool.query<{
      id: string;
      recurring_appointment_id: string;
      household_id: string;
      occurrence_date: string | Date;
      occurrence_time: string;
      status: 'scheduled' | 'modified' | 'cancelled' | 'completed' | 'missed';
      overrides: string | null;
      created_at: string | Date;
      updated_at: string | Date;
    }>(
      `UPDATE appointment_occurrences
       SET ${updates.join(', ')}
       WHERE id = $${paramIndex++} AND household_id = $${paramIndex++}
       RETURNING id, recurring_appointment_id, household_id, occurrence_date, occurrence_time,
                 status, overrides::text, created_at, updated_at`,
      values,
    );

    const row = result.rows[0];
    if (!row) {
      throw new NotFoundError('Occurrence not found.');
    }

    return mapOccurrence(row);
  }

  async deleteOccurrence(occurrenceId: string, householdId: string): Promise<void> {
    const result = await this.pool.query(
      `DELETE FROM appointment_occurrences
       WHERE id = $1 AND household_id = $2`,
      [occurrenceId, householdId],
    );

    if (result.rowCount === 0) {
      throw new NotFoundError('Occurrence not found.');
    }
  }

  // Tasks

  async listHouseholdTasks(householdId: string, filters?: {
    status?: string;
    seniorId?: string;
    category?: string;
    fromDate?: string;
    toDate?: string;
  }): Promise<TaskWithReminders[]> {
    let query = `
      SELECT id, household_id, senior_id, caregiver_id, title, description,
             category, priority, status, due_date, due_time, duration, recurrence::text,
             completed_at, completed_by, created_at, updated_at, created_by
      FROM tasks
      WHERE household_id = $1
    `;

    const params: unknown[] = [householdId];
    let paramIndex = 2;

    if (filters?.status) {
      query += ` AND status = $${paramIndex++}`;
      params.push(filters.status);
    }

    if (filters?.seniorId) {
      query += ` AND senior_id = $${paramIndex++}`;
      params.push(filters.seniorId);
    }

    if (filters?.category) {
      query += ` AND category = $${paramIndex++}`;
      params.push(filters.category);
    }

    if (filters?.fromDate) {
      query += ` AND due_date >= $${paramIndex++}`;
      params.push(filters.fromDate);
    }

    if (filters?.toDate) {
      query += ` AND due_date <= $${paramIndex++}`;
      params.push(filters.toDate);
    }

    query += ` ORDER BY due_date ASC NULLS LAST, priority DESC, created_at DESC`;

    const tasksResult = await this.pool.query<{
      id: string;
      household_id: string;
      senior_id: string;
      caregiver_id: string | null;
      title: string;
      description: string | null;
      category: TaskCategory;
      priority: TaskPriority;
      status: TaskStatus;
      due_date: string | Date | null;
      due_time: string | null;
      duration: number | null;
      recurrence: string | null;
      completed_at: string | Date | null;
      completed_by: string | null;
      created_at: string | Date;
      updated_at: string | Date;
      created_by: string;
    }>(query, params);

    // Fetch all reminders for these tasks
    const taskIds = tasksResult.rows.map(row => row.id);
    let remindersMap: Map<string, TaskReminder[]> = new Map();

    if (taskIds.length > 0) {
      const remindersResult = await this.pool.query<{
        id: string;
        task_id: string;
        time: string | null;
        days_of_week: number[] | null;
        trigger_before: number | null;
        custom_message: string | null;
        enabled: boolean;
        created_at: string | Date;
        updated_at: string | Date;
      }>(
        `SELECT id, task_id, time, days_of_week, trigger_before, custom_message, enabled, created_at, updated_at
         FROM task_reminders
         WHERE task_id = ANY($1)
         ORDER BY time ASC NULLS LAST, trigger_before DESC NULLS LAST`,
        [taskIds],
      );

      // Group reminders by task_id
      for (const row of remindersResult.rows) {
        const reminder = mapTaskReminder(row);
        if (!remindersMap.has(row.task_id)) {
          remindersMap.set(row.task_id, []);
        }
        remindersMap.get(row.task_id)!.push(reminder);
      }
    }

    // Combine tasks with their reminders
    return tasksResult.rows.map(row => ({
      ...mapTask(row),
      reminders: remindersMap.get(row.id) || [],
    }));
  }

  async getTaskById(taskId: string, householdId: string): Promise<TaskWithReminders | null> {
    const taskResult = await this.pool.query<{
      id: string;
      household_id: string;
      senior_id: string;
      caregiver_id: string | null;
      title: string;
      description: string | null;
      category: TaskCategory;
      priority: TaskPriority;
      status: TaskStatus;
      due_date: string | Date | null;
      due_time: string | null;
      duration: number | null;
      recurrence: string | null;
      completed_at: string | Date | null;
      completed_by: string | null;
      created_at: string | Date;
      updated_at: string | Date;
      created_by: string;
    }>(
      `SELECT id, household_id, senior_id, caregiver_id, title, description,
              category, priority, status, due_date, due_time, duration, recurrence::text,
              completed_at, completed_by, created_at, updated_at, created_by
       FROM tasks
       WHERE id = $1 AND household_id = $2
       LIMIT 1`,
      [taskId, householdId],
    );

    const row = taskResult.rows[0];
    if (!row) {
      return null;
    }

    // Fetch reminders for this task
    const remindersResult = await this.pool.query<{
      id: string;
      task_id: string;
      time: string | null;
      days_of_week: number[] | null;
      trigger_before: number | null;
      custom_message: string | null;
      enabled: boolean;
      created_at: string | Date;
      updated_at: string | Date;
    }>(
      `SELECT id, task_id, time, days_of_week, trigger_before, custom_message, enabled, created_at, updated_at
       FROM task_reminders
       WHERE task_id = $1
       ORDER BY time ASC NULLS LAST, trigger_before DESC NULLS LAST`,
      [taskId],
    );

    return {
      ...mapTask(row),
      reminders: remindersResult.rows.map(mapTaskReminder),
    };
  }

  async createTask(input: CreateTaskInput): Promise<Task> {
    const id = randomUUID();
    const now = nowIso();
    const priority = input.priority || 'normal';

    const result = await this.pool.query<{
      id: string;
      household_id: string;
      senior_id: string;
      caregiver_id: string | null;
      title: string;
      description: string | null;
      category: TaskCategory;
      priority: TaskPriority;
      status: TaskStatus;
      due_date: string | Date | null;
      due_time: string | null;
      duration: number | null;
      recurrence: string | null;
      completed_at: string | Date | null;
      completed_by: string | null;
      created_at: string | Date;
      updated_at: string | Date;
      created_by: string;
    }>(
      `INSERT INTO tasks (
         id, household_id, senior_id, caregiver_id, title, description,
         category, priority, status, due_date, due_time, duration, recurrence,
         created_at, updated_at, created_by
       )
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'pending', $9, $10, $11, $12, $13, $13, $14)
       RETURNING id, household_id, senior_id, caregiver_id, title, description,
                 category, priority, status, due_date, due_time, duration, recurrence::text,
                 completed_at, completed_by, created_at, updated_at, created_by`,
      [
        id,
        input.householdId,
        input.seniorId,
        input.caregiverId ?? null,
        input.title,
        input.description ?? null,
        input.category,
        priority,
        input.dueDate ?? null,
        input.dueTime ?? null,
        input.duration ?? null,
        input.recurrence ? JSON.stringify(input.recurrence) : null,
        now,
        input.createdBy,
      ],
    );

    const row = result.rows[0];
    if (!row) {
      throw new NotFoundError('Failed to create task.');
    }

    return mapTask(row);
  }

  async updateTask(taskId: string, householdId: string, input: UpdateTaskInput): Promise<Task> {
    const updates: string[] = [];
    const values: unknown[] = [];
    let paramIndex = 1;

    if (input.title !== undefined) {
      updates.push(`title = $${paramIndex++}`);
      values.push(input.title);
    }
    if (input.description !== undefined) {
      updates.push(`description = $${paramIndex++}`);
      values.push(input.description);
    }
    if (input.category !== undefined) {
      updates.push(`category = $${paramIndex++}`);
      values.push(input.category);
    }
    if (input.priority !== undefined) {
      updates.push(`priority = $${paramIndex++}`);
      values.push(input.priority);
    }
    if (input.status !== undefined) {
      updates.push(`status = $${paramIndex++}`);
      values.push(input.status);

      // Auto-set completedAt if status becomes 'completed' and completedAt not explicitly provided
      if (input.status === 'completed' && input.completedAt === undefined) {
        updates.push(`completed_at = $${paramIndex++}`);
        values.push(nowIso());
      }
    }
    if (input.dueDate !== undefined) {
      updates.push(`due_date = $${paramIndex++}`);
      values.push(input.dueDate);
    }
    if (input.dueTime !== undefined) {
      updates.push(`due_time = $${paramIndex++}`);
      values.push(input.dueTime);
    }
    if (input.duration !== undefined) {
      updates.push(`duration = $${paramIndex++}`);
      values.push(input.duration);
    }
    if (input.recurrence !== undefined) {
      updates.push(`recurrence = $${paramIndex++}`);
      values.push(input.recurrence ? JSON.stringify(input.recurrence) : null);
    }
    if (input.caregiverId !== undefined) {
      updates.push(`caregiver_id = $${paramIndex++}`);
      values.push(input.caregiverId);
    }
    if (input.completedAt !== undefined) {
      updates.push(`completed_at = $${paramIndex++}`);
      values.push(input.completedAt);
    }
    if (input.completedBy !== undefined) {
      updates.push(`completed_by = $${paramIndex++}`);
      values.push(input.completedBy);
    }

    if (updates.length === 0) {
      throw new ValidationError('No fields to update.');
    }

    const now = nowIso();
    updates.push(`updated_at = $${paramIndex++}`);
    values.push(now);

    values.push(taskId);
    values.push(householdId);

    const result = await this.pool.query<{
      id: string;
      household_id: string;
      senior_id: string;
      caregiver_id: string | null;
      title: string;
      description: string | null;
      category: TaskCategory;
      priority: TaskPriority;
      status: TaskStatus;
      due_date: string | Date | null;
      due_time: string | null;
      duration: number | null;
      recurrence: string | null;
      completed_at: string | Date | null;
      completed_by: string | null;
      created_at: string | Date;
      updated_at: string | Date;
      created_by: string;
    }>(
      `UPDATE tasks
       SET ${updates.join(', ')}
       WHERE id = $${paramIndex++} AND household_id = $${paramIndex++}
       RETURNING id, household_id, senior_id, caregiver_id, title, description,
                 category, priority, status, due_date, due_time, duration, recurrence::text,
                 completed_at, completed_by, created_at, updated_at, created_by`,
      values,
    );

    const row = result.rows[0];
    if (!row) {
      throw new NotFoundError('Task not found.');
    }

    return mapTask(row);
  }

  async deleteTask(taskId: string, householdId: string): Promise<void> {
    const result = await this.pool.query(
      `DELETE FROM tasks
       WHERE id = $1 AND household_id = $2`,
      [taskId, householdId],
    );

    if (result.rowCount === 0) {
      throw new NotFoundError('Task not found.');
    }
  }

  async completeTask(taskId: string, householdId: string, input: CompleteTaskInput, completedBy: string): Promise<Task> {
    const completedAt = input.completedAt || nowIso();
    const now = nowIso();

    const result = await this.pool.query<{
      id: string;
      household_id: string;
      senior_id: string;
      caregiver_id: string | null;
      title: string;
      description: string | null;
      category: TaskCategory;
      priority: TaskPriority;
      status: TaskStatus;
      due_date: string | Date | null;
      due_time: string | null;
      duration: number | null;
      recurrence: string | null;
      completed_at: string | Date | null;
      completed_by: string | null;
      created_at: string | Date;
      updated_at: string | Date;
      created_by: string;
    }>(
      `UPDATE tasks
       SET status = 'completed', completed_at = $3, completed_by = $4, updated_at = $5
       WHERE id = $1 AND household_id = $2
       RETURNING id, household_id, senior_id, caregiver_id, title, description,
                 category, priority, status, due_date, due_time, duration, recurrence::text,
                 completed_at, completed_by, created_at, updated_at, created_by`,
      [taskId, householdId, completedAt, completedBy, now],
    );

    const row = result.rows[0];
    if (!row) {
      throw new NotFoundError('Task not found.');
    }

    return mapTask(row);
  }

  // Task Reminders

  async listTaskReminders(taskId: string, householdId: string): Promise<TaskReminder[]> {
    const result = await this.pool.query<{
      id: string;
      task_id: string;
      time: string | null;
      days_of_week: number[] | null;
      trigger_before: number | null;
      custom_message: string | null;
      enabled: boolean;
      created_at: string | Date;
      updated_at: string | Date;
    }>(
      `SELECT r.id, r.task_id, r.time, r.days_of_week, r.trigger_before, r.custom_message, r.enabled, r.created_at, r.updated_at
       FROM task_reminders r
       JOIN tasks t ON t.id = r.task_id
       WHERE r.task_id = $1 AND t.household_id = $2
       ORDER BY r.time ASC NULLS LAST, r.trigger_before DESC NULLS LAST`,
      [taskId, householdId],
    );

    return result.rows.map(mapTaskReminder);
  }

  async getTaskReminderById(reminderId: string, taskId: string, householdId: string): Promise<TaskReminder | null> {
    const result = await this.pool.query<{
      id: string;
      task_id: string;
      time: string | null;
      days_of_week: number[] | null;
      trigger_before: number | null;
      custom_message: string | null;
      enabled: boolean;
      created_at: string | Date;
      updated_at: string | Date;
    }>(
      `SELECT r.id, r.task_id, r.time, r.days_of_week, r.trigger_before, r.custom_message, r.enabled, r.created_at, r.updated_at
       FROM task_reminders r
       JOIN tasks t ON t.id = r.task_id
       WHERE r.id = $1 AND r.task_id = $2 AND t.household_id = $3
       LIMIT 1`,
      [reminderId, taskId, householdId],
    );

    const row = result.rows[0];
    return row ? mapTaskReminder(row) : null;
  }

  async createTaskReminder(input: CreateTaskReminderInput): Promise<TaskReminder> {
    const id = randomUUID();
    const now = nowIso();
    const enabled = input.enabled ?? true;

    const result = await this.pool.query<{
      id: string;
      task_id: string;
      time: string | null;
      days_of_week: number[] | null;
      trigger_before: number | null;
      custom_message: string | null;
      enabled: boolean;
      created_at: string | Date;
      updated_at: string | Date;
    }>(
      `INSERT INTO task_reminders (id, task_id, time, days_of_week, trigger_before, custom_message, enabled, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $8)
       RETURNING id, task_id, time, days_of_week, trigger_before, custom_message, enabled, created_at, updated_at`,
      [id, input.taskId, input.time ?? null, input.daysOfWeek ?? null, input.triggerBefore ?? null, input.customMessage ?? null, enabled, now],
    );

    const row = result.rows[0];
    if (!row) {
      throw new NotFoundError('Failed to create task reminder.');
    }

    return mapTaskReminder(row);
  }

  async updateTaskReminder(reminderId: string, taskId: string, householdId: string, input: UpdateTaskReminderInput): Promise<TaskReminder> {
    const updates: string[] = [];
    const values: unknown[] = [];
    let paramIndex = 1;

    if (input.time !== undefined) {
      updates.push(`time = $${paramIndex++}`);
      values.push(input.time);
    }
    if (input.daysOfWeek !== undefined) {
      updates.push(`days_of_week = $${paramIndex++}`);
      values.push(input.daysOfWeek);
    }
    if (input.triggerBefore !== undefined) {
      updates.push(`trigger_before = $${paramIndex++}`);
      values.push(input.triggerBefore);
    }
    if (input.customMessage !== undefined) {
      updates.push(`custom_message = $${paramIndex++}`);
      values.push(input.customMessage);
    }
    if (input.enabled !== undefined) {
      updates.push(`enabled = $${paramIndex++}`);
      values.push(input.enabled);
    }

    if (updates.length === 0) {
      throw new ValidationError('No fields to update.');
    }

    const now = nowIso();
    updates.push(`updated_at = $${paramIndex++}`);
    values.push(now);

    values.push(reminderId);
    values.push(taskId);

    const result = await this.pool.query<{
      id: string;
      task_id: string;
      time: string | null;
      days_of_week: number[] | null;
      trigger_before: number | null;
      custom_message: string | null;
      enabled: boolean;
      created_at: string | Date;
      updated_at: string | Date;
    }>(
      `UPDATE task_reminders r
       SET ${updates.join(', ')}
       FROM tasks t
       WHERE r.id = $${paramIndex++} AND r.task_id = $${paramIndex++} AND t.id = r.task_id AND t.household_id = $${paramIndex++}
       RETURNING r.id, r.task_id, r.time, r.days_of_week, r.trigger_before, r.custom_message, r.enabled, r.created_at, r.updated_at`,
      [...values, householdId],
    );

    const row = result.rows[0];
    if (!row) {
      throw new NotFoundError('Task reminder not found.');
    }

    return mapTaskReminder(row);
  }

  async deleteTaskReminder(reminderId: string, taskId: string, householdId: string): Promise<void> {
    const result = await this.pool.query(
      `DELETE FROM task_reminders r
       USING tasks t
       WHERE r.id = $1 AND r.task_id = $2 AND t.id = r.task_id AND t.household_id = $3`,
      [reminderId, taskId, householdId],
    );

    if (result.rowCount === 0) {
      throw new NotFoundError('Task reminder not found.');
    }
  }

  // Display Tablets

  async listHouseholdDisplayTablets(householdId: string): Promise<DisplayTablet[]> {
    const result = await this.pool.query<{
      id: string;
      household_id: string;
      name: string;
      description: string | null;
      token_hash: string;
      config: TabletDisplayConfig | null;
      created_at: string | Date;
      created_by: string;
      last_active_at: string | Date | null;
      revoked_at: string | Date | null;
      revoked_by: string | null;
      status: DisplayTabletStatus;
    }>(
      `SELECT id, household_id, name, description, token_hash, config, created_at, created_by,
              last_active_at, revoked_at, revoked_by, status
       FROM display_tablets
       WHERE household_id = $1
       ORDER BY created_at DESC`,
      [householdId],
    );

    return result.rows.map(mapDisplayTablet);
  }

  async getDisplayTabletById(tabletId: string, householdId: string): Promise<DisplayTablet | null> {
    const result = await this.pool.query<{
      id: string;
      household_id: string;
      name: string;
      description: string | null;
      token_hash: string;
      config: TabletDisplayConfig | null;
      created_at: string | Date;
      created_by: string;
      last_active_at: string | Date | null;
      revoked_at: string | Date | null;
      revoked_by: string | null;
      status: DisplayTabletStatus;
    }>(
      `SELECT id, household_id, name, description, token_hash, config, created_at, created_by,
              last_active_at, revoked_at, revoked_by, status
       FROM display_tablets
       WHERE id = $1 AND household_id = $2
       LIMIT 1`,
      [tabletId, householdId],
    );

    const row = result.rows[0];
    return row ? mapDisplayTablet(row) : null;
  }

  async createDisplayTablet(input: CreateDisplayTabletInput): Promise<DisplayTabletWithToken> {
    const id = randomUUID();
    const now = nowIso();
    const token = generateDisplayTabletToken();
    const tokenHash = hashDisplayTabletToken(token);
    const tokenExpiresAt = addHours(now, DISPLAY_TABLET_SETUP_TTL_HOURS);

    const result = await this.pool.query<{
      id: string;
      household_id: string;
      name: string;
      description: string | null;
      token_hash: string;
      config: TabletDisplayConfig | null;
      created_at: string | Date;
      created_by: string;
      last_active_at: string | Date | null;
      revoked_at: string | Date | null;
      revoked_by: string | null;
      status: DisplayTabletStatus;
    }>(
      `INSERT INTO display_tablets (
         id, household_id, name, description, token_hash, token_expires_at, created_at, created_by, status
       )
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'active')
       RETURNING id, household_id, name, description, token_hash, config, created_at, created_by,
                 last_active_at, revoked_at, revoked_by, status`,
      [id, input.householdId, input.name, input.description ?? null, tokenHash, tokenExpiresAt, now, input.createdBy],
    );

    const row = result.rows[0];
    if (!row) {
      throw new NotFoundError('Failed to create display tablet.');
    }

    const tablet = mapDisplayTablet(row);

    // Return tablet with token (omit tokenHash)

    const { tokenHash: _, ...tabletWithoutHash } = tablet;
    return {
      ...tabletWithoutHash,
      token,
    };
  }

  async updateDisplayTablet(tabletId: string, householdId: string, input: UpdateDisplayTabletInput): Promise<DisplayTablet> {
    const updates: string[] = [];
    const values: unknown[] = [];
    let paramIndex = 1;

    if (input.name !== undefined) {
      updates.push(`name = $${paramIndex++}`);
      values.push(input.name);
    }
    if (input.description !== undefined) {
      updates.push(`description = $${paramIndex++}`);
      values.push(input.description);
    }

    if (updates.length === 0) {
      throw new ValidationError('No fields to update.');
    }

    values.push(tabletId);
    values.push(householdId);

    const result = await this.pool.query<{
      id: string;
      household_id: string;
      name: string;
      description: string | null;
      token_hash: string;
      config: TabletDisplayConfig | null;
      created_at: string | Date;
      created_by: string;
      last_active_at: string | Date | null;
      revoked_at: string | Date | null;
      revoked_by: string | null;
      status: DisplayTabletStatus;
    }>(
      `UPDATE display_tablets
       SET ${updates.join(', ')}
       WHERE id = $${paramIndex++} AND household_id = $${paramIndex++}
       RETURNING id, household_id, name, description, token_hash, config, created_at, created_by,
                 last_active_at, revoked_at, revoked_by, status`,
      values,
    );

    const row = result.rows[0];
    if (!row) {
      throw new NotFoundError('Display tablet not found.');
    }

    return mapDisplayTablet(row);
  }

  async revokeDisplayTablet(tabletId: string, householdId: string, revokedBy: string): Promise<void> {
    const now = nowIso();

    const result = await this.pool.query(
      `UPDATE display_tablets
       SET status = 'revoked', revoked_at = $3, revoked_by = $4
       WHERE id = $1 AND household_id = $2 AND status = 'active'`,
      [tabletId, householdId, now, revokedBy],
    );

    if (result.rowCount === 0) {
      throw new NotFoundError('Display tablet not found or already revoked.');
    }
  }

  async deleteDisplayTablet(tabletId: string, householdId: string): Promise<void> {
    const result = await this.pool.query(
      `DELETE FROM display_tablets
       WHERE id = $1 AND household_id = $2 AND status = 'revoked'`,
      [tabletId, householdId],
    );

    if (result.rowCount === 0) {
      throw new NotFoundError('Display tablet not found or not revoked. Only revoked tablets can be deleted.');
    }
  }

  async regenerateDisplayTabletToken(tabletId: string, householdId: string): Promise<DisplayTabletWithToken> {
    const newToken = generateDisplayTabletToken();
    const newTokenHash = hashDisplayTabletToken(newToken);
    const tokenExpiresAt = addHours(nowIso(), DISPLAY_TABLET_SETUP_TTL_HOURS);

    const result = await this.pool.query<{
      id: string;
      household_id: string;
      name: string;
      description: string | null;
      token_hash: string;
      config: TabletDisplayConfig | null;
      created_at: string | Date;
      created_by: string;
      last_active_at: string | Date | null;
      revoked_at: string | Date | null;
      revoked_by: string | null;
      status: DisplayTabletStatus;
    }>(
      `UPDATE display_tablets
       SET token_hash = $3,
           token_expires_at = $4,
           token_used_at = NULL,
           refresh_token_hash = NULL,
           refresh_token_expires_at = NULL
       WHERE id = $1 AND household_id = $2 AND status = 'active'
       RETURNING id, household_id, name, description, token_hash, config, created_at, created_by,
                 last_active_at, revoked_at, revoked_by, status`,
      [tabletId, householdId, newTokenHash, tokenExpiresAt],
    );

    const row = result.rows[0];
    if (!row) {
      throw new NotFoundError('Display tablet not found or not active.');
    }

    const tablet = mapDisplayTablet(row);

    // Return tablet with token (omit tokenHash)

    const { tokenHash: _, ...tabletWithoutHash } = tablet;
    return {
      ...tabletWithoutHash,
      token: newToken,
    };
  }

  async authenticateDisplayTablet(
    tabletId: string,
    setupToken: string,
    refreshToken: string,
    refreshTokenExpiresAt: string,
  ): Promise<DisplayTabletAuthInfo | null> {
    const tokenHash = hashDisplayTabletToken(setupToken);
    const refreshTokenHash = hashDisplayTabletToken(refreshToken);
    const now = nowIso();

    const result = await this.pool.query<{
      household_id: string;
      household_name: string;
    }>(
      `UPDATE display_tablets AS dt
       SET token_used_at = $3,
           last_active_at = $3,
           refresh_token_hash = $4,
           refresh_token_expires_at = $5
       FROM households h
       WHERE dt.id = $1
         AND dt.household_id = h.id
         AND dt.token_hash = $2
         AND dt.status = 'active'
         AND dt.revoked_at IS NULL
         AND dt.token_used_at IS NULL
         AND dt.token_expires_at > $3
       RETURNING dt.household_id, h.name AS household_name`,
      [tabletId, tokenHash, now, refreshTokenHash, refreshTokenExpiresAt],
    );

    const row = result.rows[0];
    if (!row) {
      return null;
    }

    return {
      householdId: row.household_id,
      householdName: row.household_name,
      permissions: ['read'],
    };
  }

  async refreshDisplayTabletSession(
    tabletId: string,
    refreshToken: string,
    nextRefreshToken: string,
    nextRefreshTokenExpiresAt: string,
  ): Promise<DisplayTabletAuthInfo | null> {
    const refreshTokenHash = hashDisplayTabletToken(refreshToken);
    const nextRefreshTokenHash = hashDisplayTabletToken(nextRefreshToken);
    const now = nowIso();

    const result = await this.pool.query<{
      household_id: string;
      household_name: string;
    }>(
      `UPDATE display_tablets AS dt
       SET refresh_token_hash = $3,
           refresh_token_expires_at = $4,
           last_active_at = $5
       FROM households h
       WHERE dt.id = $1
         AND dt.household_id = h.id
         AND dt.refresh_token_hash = $2
         AND dt.status = 'active'
         AND dt.revoked_at IS NULL
         AND dt.refresh_token_expires_at IS NOT NULL
         AND dt.refresh_token_expires_at > $5
       RETURNING dt.household_id, h.name AS household_name`,
      [tabletId, refreshTokenHash, nextRefreshTokenHash, nextRefreshTokenExpiresAt, now],
    );

    const row = result.rows[0];
    if (!row) {
      return null;
    }

    return {
      householdId: row.household_id,
      householdName: row.household_name,
      permissions: ['read'],
    };
  }

  async countActiveDisplayTablets(householdId: string): Promise<number> {
    const result = await this.pool.query<{ count: string }>(
      `SELECT COUNT(*) AS count
       FROM display_tablets
       WHERE household_id = $1 AND status = 'active'`,
      [householdId],
    );

    return parseInt(result.rows[0]?.count || '0', 10);
  }

  async updateDisplayTabletConfig(tabletId: string, householdId: string, config: TabletDisplayConfig): Promise<DisplayTablet> {
    const result = await this.pool.query<{
      id: string;
      household_id: string;
      name: string;
      description: string | null;
      token_hash: string;
      config: TabletDisplayConfig | null;
      created_at: string | Date;
      created_by: string;
      last_active_at: string | Date | null;
      revoked_at: string | Date | null;
      revoked_by: string | null;
      status: DisplayTabletStatus;
    }>(
      `UPDATE display_tablets
       SET config = $3
       WHERE id = $1 AND household_id = $2
       RETURNING id, household_id, name, description, token_hash, config, created_at, created_by,
                 last_active_at, revoked_at, revoked_by, status`,
      [tabletId, householdId, JSON.stringify(config)],
    );

    const row = result.rows[0];
    if (!row) {
      throw new NotFoundError('Display tablet not found.');
    }

    return mapDisplayTablet(row);
  }

  // Photo Screens

  async listPhotoScreens(tabletId: string, householdId: string): Promise<PhotoScreenWithPhotos[]> {
    // Fetch all photo screens for the tablet
    const screensResult = await this.pool.query<{
      id: string;
      tablet_id: string;
      household_id: string;
      name: string;
      display_order: number;
      display_mode: 'slideshow' | 'mosaic' | 'single';
      slideshow_duration: number;
      slideshow_transition: 'fade' | 'slide' | 'none';
      slideshow_order: 'sequential' | 'random';
      show_captions: boolean;
      created_at: string | Date;
      created_by: string;
      updated_at: string | Date | null;
    }>(
      `SELECT id, tablet_id, household_id, name, display_order, display_mode, slideshow_duration,
              slideshow_transition, slideshow_order, show_captions,
              created_at, created_by, updated_at
       FROM photo_screens
       WHERE tablet_id = $1 AND household_id = $2
       ORDER BY display_order ASC, created_at ASC`,
      [tabletId, householdId],
    );

    // Fetch all photos for these screens
    const screenIds = screensResult.rows.map(row => row.id);
    let photosMap: Map<string, Photo[]> = new Map();

    if (screenIds.length > 0) {
      const photosResult = await this.pool.query<{
        id: string;
        photo_screen_id: string;
        url: string;
        caption: string | null;
        display_order: number;
        uploaded_at: string | Date;
        updated_at: string | Date | null;
      }>(
        `SELECT id, photo_screen_id, url, caption, display_order, uploaded_at, updated_at
         FROM photos
         WHERE photo_screen_id = ANY($1)
         ORDER BY display_order ASC`,
        [screenIds],
      );

      // Group photos by screen_id
      for (const row of photosResult.rows) {
        const photo: Photo = {
          id: row.id,
          photoScreenId: row.photo_screen_id,
          url: row.url,
          caption: row.caption,
          order: row.display_order,
          uploadedAt: toIso(row.uploaded_at),
          updatedAt: row.updated_at ? toIso(row.updated_at) : null,
        };
        if (!photosMap.has(row.photo_screen_id)) {
          photosMap.set(row.photo_screen_id, []);
        }
        photosMap.get(row.photo_screen_id)!.push(photo);
      }
    }

    // Combine screens with their photos
    return screensResult.rows.map(row => ({
      id: row.id,
      tabletId: row.tablet_id,
      householdId: row.household_id,
      name: row.name,
      order: row.display_order,
      displayMode: row.display_mode,
      slideshowDuration: row.slideshow_duration,
      slideshowTransition: row.slideshow_transition,
      slideshowOrder: row.slideshow_order,
      showCaptions: row.show_captions,
      createdAt: toIso(row.created_at),
      createdBy: row.created_by,
      updatedAt: row.updated_at ? toIso(row.updated_at) : null,
      photos: photosMap.get(row.id) || [],
    }));
  }

  async getPhotoScreenById(photoScreenId: string, tabletId: string, householdId: string): Promise<PhotoScreenWithPhotos | null> {
    const screenResult = await this.pool.query<{
      id: string;
      tablet_id: string;
      household_id: string;
      name: string;
      display_order: number;
      display_mode: 'slideshow' | 'mosaic' | 'single';
      slideshow_duration: number;
      slideshow_transition: 'fade' | 'slide' | 'none';
      slideshow_order: 'sequential' | 'random';
      show_captions: boolean;
      created_at: string | Date;
      created_by: string;
      updated_at: string | Date | null;
    }>(
      `SELECT id, tablet_id, household_id, name, display_order, display_mode, slideshow_duration,
              slideshow_transition, slideshow_order, show_captions,
              created_at, created_by, updated_at
       FROM photo_screens
       WHERE id = $1 AND tablet_id = $2 AND household_id = $3
       LIMIT 1`,
      [photoScreenId, tabletId, householdId],
    );

    const row = screenResult.rows[0];
    if (!row) {
      return null;
    }

    // Fetch photos for this screen
    const photosResult = await this.pool.query<{
      id: string;
      photo_screen_id: string;
      url: string;
      caption: string | null;
      display_order: number;
      uploaded_at: string | Date;
      updated_at: string | Date | null;
    }>(
      `SELECT id, photo_screen_id, url, caption, display_order, uploaded_at, updated_at
       FROM photos
       WHERE photo_screen_id = $1
       ORDER BY display_order ASC`,
      [photoScreenId],
    );

    const photos: Photo[] = photosResult.rows.map(photoRow => ({
      id: photoRow.id,
      photoScreenId: photoRow.photo_screen_id,
      url: photoRow.url,
      caption: photoRow.caption,
      order: photoRow.display_order,
      uploadedAt: toIso(photoRow.uploaded_at),
      updatedAt: photoRow.updated_at ? toIso(photoRow.updated_at) : null,
    }));

    return {
      id: row.id,
      tabletId: row.tablet_id,
      householdId: row.household_id,
      name: row.name,
      order: row.display_order,
      displayMode: row.display_mode,
      slideshowDuration: row.slideshow_duration,
      slideshowTransition: row.slideshow_transition,
      slideshowOrder: row.slideshow_order,
      showCaptions: row.show_captions,
      createdAt: toIso(row.created_at),
      createdBy: row.created_by,
      updatedAt: row.updated_at ? toIso(row.updated_at) : null,
      photos,
    };
  }

  async createPhotoScreen(input: CreatePhotoScreenInput): Promise<PhotoScreen> {
    const id = randomUUID();
    const now = nowIso();
    const displayMode = input.displayMode || 'slideshow';
    const slideshowDuration = input.slideshowDuration || 5;
    const slideshowTransition = input.slideshowTransition || 'fade';
    const slideshowOrder = input.slideshowOrder || 'sequential';
    const showCaptions = input.showCaptions ?? false;
    const displayOrder = input.order ?? await this.countPhotoScreens(input.tabletId, input.householdId);

    const result = await this.pool.query<{
      id: string;
      tablet_id: string;
      household_id: string;
      name: string;
      display_order: number;
      display_mode: 'slideshow' | 'mosaic' | 'single';
      slideshow_duration: number;
      slideshow_transition: 'fade' | 'slide' | 'none';
      slideshow_order: 'sequential' | 'random';
      show_captions: boolean;
      created_at: string | Date;
      created_by: string;
      updated_at: string | Date | null;
    }>(
      `INSERT INTO photo_screens (
         id, tablet_id, household_id, name, display_order, display_mode, slideshow_duration,
         slideshow_transition, slideshow_order, show_captions, created_at, created_by
       )
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
       RETURNING id, tablet_id, household_id, name, display_order, display_mode, slideshow_duration,
                 slideshow_transition, slideshow_order, show_captions,
                 created_at, created_by, updated_at`,
      [
        id,
        input.tabletId,
        input.householdId,
        input.name,
        displayOrder,
        displayMode,
        slideshowDuration,
        slideshowTransition,
        slideshowOrder,
        showCaptions,
        now,
        input.createdBy,
      ],
    );

    const row = result.rows[0];
    if (!row) {
      throw new NotFoundError('Failed to create photo screen.');
    }

    return {
      id: row.id,
      tabletId: row.tablet_id,
      householdId: row.household_id,
      name: row.name,
      order: row.display_order,
      displayMode: row.display_mode,
      slideshowDuration: row.slideshow_duration,
      slideshowTransition: row.slideshow_transition,
      slideshowOrder: row.slideshow_order,
      showCaptions: row.show_captions,
      createdAt: toIso(row.created_at),
      createdBy: row.created_by,
      updatedAt: row.updated_at ? toIso(row.updated_at) : null,
    };
  }

  async updatePhotoScreen(photoScreenId: string, tabletId: string, householdId: string, input: UpdatePhotoScreenInput): Promise<PhotoScreen> {
    const updates: string[] = [];
    const values: unknown[] = [];
    let paramIndex = 1;

    if (input.name !== undefined) {
      updates.push(`name = $${paramIndex++}`);
      values.push(input.name);
    }
    if (input.order !== undefined) {
      updates.push(`display_order = $${paramIndex++}`);
      values.push(input.order);
    }
    if (input.displayMode !== undefined) {
      updates.push(`display_mode = $${paramIndex++}`);
      values.push(input.displayMode);
    }
    if (input.slideshowDuration !== undefined) {
      updates.push(`slideshow_duration = $${paramIndex++}`);
      values.push(input.slideshowDuration);
    }
    if (input.slideshowTransition !== undefined) {
      updates.push(`slideshow_transition = $${paramIndex++}`);
      values.push(input.slideshowTransition);
    }
    if (input.slideshowOrder !== undefined) {
      updates.push(`slideshow_order = $${paramIndex++}`);
      values.push(input.slideshowOrder);
    }
    if (input.showCaptions !== undefined) {
      updates.push(`show_captions = $${paramIndex++}`);
      values.push(input.showCaptions);
    }

    if (updates.length === 0) {
      throw new ValidationError('No fields to update.');
    }

    const now = nowIso();
    updates.push(`updated_at = $${paramIndex++}`);
    values.push(now);

    values.push(photoScreenId);
    values.push(tabletId);
    values.push(householdId);

    const result = await this.pool.query<{
      id: string;
      tablet_id: string;
      household_id: string;
      name: string;
      display_order: number;
      display_mode: 'slideshow' | 'mosaic' | 'single';
      slideshow_duration: number;
      slideshow_transition: 'fade' | 'slide' | 'none';
      slideshow_order: 'sequential' | 'random';
      show_captions: boolean;
      created_at: string | Date;
      created_by: string;
      updated_at: string | Date | null;
    }>(
      `UPDATE photo_screens
       SET ${updates.join(', ')}
       WHERE id = $${paramIndex++} AND tablet_id = $${paramIndex++} AND household_id = $${paramIndex++}
       RETURNING id, tablet_id, household_id, name, display_order, display_mode, slideshow_duration,
                 slideshow_transition, slideshow_order, show_captions,
                 created_at, created_by, updated_at`,
      values,
    );

    const row = result.rows[0];
    if (!row) {
      throw new NotFoundError('Photo screen not found.');
    }

    return {
      id: row.id,
      tabletId: row.tablet_id,
      householdId: row.household_id,
      name: row.name,
      order: row.display_order,
      displayMode: row.display_mode,
      slideshowDuration: row.slideshow_duration,
      slideshowTransition: row.slideshow_transition,
      slideshowOrder: row.slideshow_order,
      showCaptions: row.show_captions,
      createdAt: toIso(row.created_at),
      createdBy: row.created_by,
      updatedAt: row.updated_at ? toIso(row.updated_at) : null,
    };
  }

  async deletePhotoScreen(photoScreenId: string, tabletId: string, householdId: string): Promise<void> {
    const result = await this.pool.query(
      `DELETE FROM photo_screens
       WHERE id = $1 AND tablet_id = $2 AND household_id = $3`,
      [photoScreenId, tabletId, householdId],
    );

    if (result.rowCount === 0) {
      throw new NotFoundError('Photo screen not found.');
    }
  }

  async countPhotoScreens(tabletId: string, householdId: string): Promise<number> {
    const result = await this.pool.query<{ count: string }>(
      `SELECT COUNT(*) AS count
       FROM photo_screens
       WHERE tablet_id = $1 AND household_id = $2`,
      [tabletId, householdId],
    );

    return parseInt(result.rows[0]?.count || '0', 10);
  }

  // Photos

  async listPhotos(photoScreenId: string, householdId: string): Promise<Photo[]> {
    const result = await this.pool.query<{
      id: string;
      photo_screen_id: string;
      url: string;
      caption: string | null;
      display_order: number;
      uploaded_at: string | Date;
      updated_at: string | Date | null;
    }>(
      `SELECT p.id, p.photo_screen_id, p.url, p.caption, p.display_order, p.uploaded_at, p.updated_at
       FROM photos p
       JOIN photo_screens ps ON ps.id = p.photo_screen_id
       WHERE p.photo_screen_id = $1 AND ps.household_id = $2
       ORDER BY p.display_order ASC`,
      [photoScreenId, householdId],
    );

    return result.rows.map(row => ({
      id: row.id,
      photoScreenId: row.photo_screen_id,
      url: row.url,
      caption: row.caption,
      order: row.display_order,
      uploadedAt: toIso(row.uploaded_at),
      updatedAt: row.updated_at ? toIso(row.updated_at) : null,
    }));
  }

  async getPhotoById(photoId: string, photoScreenId: string, householdId: string): Promise<Photo | null> {
    const result = await this.pool.query<{
      id: string;
      photo_screen_id: string;
      url: string;
      caption: string | null;
      display_order: number;
      uploaded_at: string | Date;
      updated_at: string | Date | null;
    }>(
      `SELECT p.id, p.photo_screen_id, p.url, p.caption, p.display_order, p.uploaded_at, p.updated_at
       FROM photos p
       JOIN photo_screens ps ON ps.id = p.photo_screen_id
       WHERE p.id = $1 AND p.photo_screen_id = $2 AND ps.household_id = $3
       LIMIT 1`,
      [photoId, photoScreenId, householdId],
    );

    const row = result.rows[0];
    if (!row) {
      return null;
    }

    return {
      id: row.id,
      photoScreenId: row.photo_screen_id,
      url: row.url,
      caption: row.caption,
      order: row.display_order,
      uploadedAt: toIso(row.uploaded_at),
      updatedAt: row.updated_at ? toIso(row.updated_at) : null,
    };
  }

  async createPhoto(input: CreatePhotoInput): Promise<Photo> {
    const id = randomUUID();
    const now = nowIso();

    const result = await this.pool.query<{
      id: string;
      photo_screen_id: string;
      url: string;
      caption: string | null;
      display_order: number;
      uploaded_at: string | Date;
      updated_at: string | Date | null;
    }>(
      `INSERT INTO photos (id, photo_screen_id, url, caption, display_order, uploaded_at)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id, photo_screen_id, url, caption, display_order, uploaded_at, updated_at`,
      [id, input.photoScreenId, input.url, input.caption ?? null, input.order, now],
    );

    const row = result.rows[0];
    if (!row) {
      throw new NotFoundError('Failed to create photo.');
    }

    return {
      id: row.id,
      photoScreenId: row.photo_screen_id,
      url: row.url,
      caption: row.caption,
      order: row.display_order,
      uploadedAt: toIso(row.uploaded_at),
      updatedAt: row.updated_at ? toIso(row.updated_at) : null,
    };
  }

  async updatePhoto(photoId: string, photoScreenId: string, householdId: string, input: UpdatePhotoInput): Promise<Photo> {
    const updates: string[] = [];
    const values: unknown[] = [];
    let paramIndex = 1;

    if (input.caption !== undefined) {
      updates.push(`caption = $${paramIndex++}`);
      values.push(input.caption);
    }
    if (input.order !== undefined) {
      updates.push(`display_order = $${paramIndex++}`);
      values.push(input.order);
    }

    if (updates.length === 0) {
      throw new ValidationError('No fields to update.');
    }

    const now = nowIso();
    updates.push(`updated_at = $${paramIndex++}`);
    values.push(now);

    values.push(photoId);
    values.push(photoScreenId);

    const result = await this.pool.query<{
      id: string;
      photo_screen_id: string;
      url: string;
      caption: string | null;
      display_order: number;
      uploaded_at: string | Date;
      updated_at: string | Date | null;
    }>(
      `UPDATE photos p
       SET ${updates.join(', ')}
       FROM photo_screens ps
       WHERE p.id = $${paramIndex++} AND p.photo_screen_id = $${paramIndex++} AND ps.id = p.photo_screen_id AND ps.household_id = $${paramIndex++}
       RETURNING p.id, p.photo_screen_id, p.url, p.caption, p.display_order, p.uploaded_at, p.updated_at`,
      [...values, householdId],
    );

    const row = result.rows[0];
    if (!row) {
      throw new NotFoundError('Photo not found.');
    }

    return {
      id: row.id,
      photoScreenId: row.photo_screen_id,
      url: row.url,
      caption: row.caption,
      order: row.display_order,
      uploadedAt: toIso(row.uploaded_at),
      updatedAt: row.updated_at ? toIso(row.updated_at) : null,
    };
  }

  async deletePhoto(photoId: string, photoScreenId: string, householdId: string): Promise<void> {
    const result = await this.pool.query(
      `DELETE FROM photos p
       USING photo_screens ps
       WHERE p.id = $1 AND p.photo_screen_id = $2 AND ps.id = p.photo_screen_id AND ps.household_id = $3`,
      [photoId, photoScreenId, householdId],
    );

    if (result.rowCount === 0) {
      throw new NotFoundError('Photo not found.');
    }
  }

  async countPhotos(photoScreenId: string): Promise<number> {
    const result = await this.pool.query<{ count: string }>(
      `SELECT COUNT(*) AS count
       FROM photos
       WHERE photo_screen_id = $1`,
      [photoScreenId],
    );

    return parseInt(result.rows[0]?.count || '0', 10);
  }

  async reorderPhotos(photoScreenId: string, householdId: string, photoOrders: Array<{ id: string; order: number }>): Promise<Photo[]> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');

      // Verify the photo screen exists and belongs to the household
      const screenCheck = await client.query(
        `SELECT id FROM photo_screens WHERE id = $1 AND household_id = $2`,
        [photoScreenId, householdId],
      );

      if (screenCheck.rowCount === 0) {
        throw new NotFoundError('Photo screen not found.');
      }

      const now = nowIso();

      // Update each photo's order
      for (const { id, order } of photoOrders) {
        await client.query(
          `UPDATE photos
           SET display_order = $2, updated_at = $3
           WHERE id = $1 AND photo_screen_id = $4`,
          [id, order, now, photoScreenId],
        );
      }

      await client.query('COMMIT');

      // Fetch and return the updated photos
      const result = await client.query<{
        id: string;
        photo_screen_id: string;
        url: string;
        caption: string | null;
        display_order: number;
        uploaded_at: string | Date;
        updated_at: string | Date | null;
      }>(
        `SELECT id, photo_screen_id, url, caption, display_order, uploaded_at, updated_at
         FROM photos
         WHERE photo_screen_id = $1
         ORDER BY display_order ASC`,
        [photoScreenId],
      );

      return result.rows.map(row => ({
        id: row.id,
        photoScreenId: row.photo_screen_id,
        url: row.url,
        caption: row.caption,
        order: row.display_order,
        uploadedAt: toIso(row.uploaded_at),
        updatedAt: row.updated_at ? toIso(row.updated_at) : null,
      }));
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  // Privacy Settings

  async getUserProfile(userId: string): Promise<UserProfile | null> {
    const memberResult = await this.pool.query<{
      user_id: string;
      email: string;
      first_name: string;
      last_name: string;
      joined_at: string | Date;
    }>(
      `SELECT user_id, email, first_name, last_name, joined_at
       FROM household_members
       WHERE user_id = $1 AND status = 'active'
       ORDER BY joined_at DESC
       LIMIT 1`,
      [userId],
    );

    const member = memberResult.rows[0];
    if (!member) {
      return null;
    }

    return {
      userId: member.user_id,
      email: member.email,
      firstName: member.first_name,
      lastName: member.last_name,
      updatedAt: toIso(member.joined_at),
    };
  }

  async updateUserProfile(userId: string, input: { email: string; firstName: string; lastName: string }): Promise<UserProfile> {
    const normalizedEmail = normalizeEmail(input.email);
    const normalizedFirstName = normalizeName(input.firstName);
    const normalizedLastName = normalizeName(input.lastName);

    const result = await this.pool.query<{
      user_id: string;
      email: string;
      first_name: string;
      last_name: string;
      joined_at: string | Date;
    }>(
      `UPDATE household_members
       SET email = $2,
           first_name = $3,
           last_name = $4
       WHERE user_id = $1 AND status = 'active'
       RETURNING user_id, email, first_name, last_name, joined_at`,
      [userId, normalizedEmail, normalizedFirstName, normalizedLastName],
    );

    const row = result.rows[0];
    if (!row) {
      throw new NotFoundError('No active household membership found for this user.');
    }

    return {
      userId: row.user_id,
      email: row.email,
      firstName: row.first_name,
      lastName: row.last_name,
      updatedAt: toIso(row.joined_at),
    };
  }

  async getUserPrivacySettings(userId: string): Promise<PrivacySettings | null> {
    const result = await this.pool.query<{
      id: string;
      user_id: string;
      share_profile: boolean;
      share_health_data: boolean;
      share_activity_history: boolean;
      allow_analytics: boolean;
      created_at: string | Date;
      updated_at: string | Date;
    }>(
      `SELECT id, user_id, share_profile, share_health_data, share_activity_history,
              allow_analytics, created_at, updated_at
       FROM user_privacy_settings
       WHERE user_id = $1
       LIMIT 1`,
      [userId],
    );

    const row = result.rows[0];
    if (!row) {
      return null;
    }

    return {
      id: row.id,
      userId: row.user_id,
      shareProfile: row.share_profile,
      shareHealthData: row.share_health_data,
      shareActivityHistory: row.share_activity_history,
      allowAnalytics: row.allow_analytics,
      createdAt: toIso(row.created_at),
      updatedAt: toIso(row.updated_at),
    };
  }

  async updateUserPrivacySettings(userId: string, input: UpdatePrivacySettingsInput): Promise<PrivacySettings> {
    const updates: string[] = [];
    const values: unknown[] = [];
    let paramIndex = 1;

    if (input.shareProfile !== undefined) {
      updates.push(`share_profile = $${paramIndex++}`);
      values.push(input.shareProfile);
    }
    if (input.shareHealthData !== undefined) {
      updates.push(`share_health_data = $${paramIndex++}`);
      values.push(input.shareHealthData);
    }
    if (input.shareActivityHistory !== undefined) {
      updates.push(`share_activity_history = $${paramIndex++}`);
      values.push(input.shareActivityHistory);
    }
    if (input.allowAnalytics !== undefined) {
      updates.push(`allow_analytics = $${paramIndex++}`);
      values.push(input.allowAnalytics);
    }

    if (updates.length === 0) {
      throw new ValidationError('No fields to update.');
    }

    const now = nowIso();
    updates.push(`updated_at = $${paramIndex++}`);
    values.push(now);

    values.push(userId);

    // Use UPSERT to create if not exists or update if exists
    const result = await this.pool.query<{
      id: string;
      user_id: string;
      share_profile: boolean;
      share_health_data: boolean;
      share_activity_history: boolean;
      allow_analytics: boolean;
      created_at: string | Date;
      updated_at: string | Date;
    }>(
      `INSERT INTO user_privacy_settings (id, user_id, share_profile, share_health_data, share_activity_history, allow_analytics, created_at, updated_at)
       VALUES (gen_random_uuid(), $${paramIndex++}, $${paramIndex++}, $${paramIndex++}, $${paramIndex++}, $${paramIndex++}, $${paramIndex++}, $${paramIndex++})
       ON CONFLICT (user_id) DO UPDATE
       SET ${updates.join(', ')}
       RETURNING id, user_id, share_profile, share_health_data, share_activity_history, allow_analytics, created_at, updated_at`,
      [
        ...values,
        userId,
        input.shareProfile ?? true,
        input.shareHealthData ?? true,
        input.shareActivityHistory ?? true,
        input.allowAnalytics ?? false,
        now,
        now,
      ],
    );

    const row = result.rows[0];
    if (!row) {
      throw new NotFoundError('Failed to update privacy settings.');
    }

    return {
      id: row.id,
      userId: row.user_id,
      shareProfile: row.share_profile,
      shareHealthData: row.share_health_data,
      shareActivityHistory: row.share_activity_history,
      allowAnalytics: row.allow_analytics,
      createdAt: toIso(row.created_at),
      updatedAt: toIso(row.updated_at),
    };
  }

  async getBulkPrivacySettings(userIds: string[]): Promise<Map<string, PrivacySettings>> {
    if (userIds.length === 0) {
      return new Map();
    }

    const result = await this.pool.query<{
      id: string;
      user_id: string;
      share_profile: boolean;
      share_health_data: boolean;
      share_activity_history: boolean;
      allow_analytics: boolean;
      created_at: string | Date;
      updated_at: string | Date;
    }>(
      `SELECT id, user_id, share_profile, share_health_data, share_activity_history,
              allow_analytics, created_at, updated_at
       FROM user_privacy_settings
       WHERE user_id = ANY($1)`,
      [userIds],
    );

    const settingsMap = new Map<string, PrivacySettings>();

    for (const row of result.rows) {
      settingsMap.set(row.user_id, {
        id: row.id,
        userId: row.user_id,
        shareProfile: row.share_profile,
        shareHealthData: row.share_health_data,
        shareActivityHistory: row.share_activity_history,
        allowAnalytics: row.allow_analytics,
        createdAt: toIso(row.created_at),
        updatedAt: toIso(row.updated_at),
      });
    }

    return settingsMap;
  }
}
