import { randomUUID } from 'node:crypto';
import type { Pool, PoolClient } from 'pg';
import { env } from '../../config/env.js';
import type { AuthenticatedRequester, Household, HouseholdOverview } from '../../domain/entities/Household.js';
import type { AuditEventInput, HouseholdInvitation } from '../../domain/entities/Invitation.js';
import type { HouseholdRole, Member } from '../../domain/entities/Member.js';
import type { CreateMedicationInput, Medication, MedicationForm, UpdateMedicationInput } from '../../domain/entities/Medication.js';
import { isInvitationTokenValid, signInvitationToken } from '../../domain/security/invitationToken.js';
import { buildInvitationLinks } from '../../domain/services/buildInvitationLinks.js';
import type {
  BulkInvitationResult,
  HouseholdRepository,
  InvitationCandidate,
} from '../../domain/repositories/HouseholdRepository.js';
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
} from './postgres/helpers.js';

const INVITATION_TTL_HOURS = 72;

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
        ...(env.INVITATION_WEB_FALLBACK_URL
          ? { fallbackBaseUrl: env.INVITATION_WEB_FALLBACK_URL }
          : {}),
      });

      result.deliveries.push({
        invitationId,
        inviteeEmail: email,
        status: 'sent',
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
      created_at: string | Date;
      accepted_at: string | Date | null;
    }>(
      `SELECT i.id, i.household_id, h.name AS household_name, i.inviter_user_id, i.invitee_email, 
              i.invitee_first_name, i.invitee_last_name, i.assigned_role, i.token_hash, 
              i.token_expires_at, i.status, i.created_at, i.accepted_at
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
      created_at: string | Date;
      accepted_at: string | Date | null;
    }>(
      `SELECT i.id, i.household_id, h.name AS household_name, i.inviter_user_id, i.invitee_email, 
              i.invitee_first_name, i.invitee_last_name, i.assigned_role, i.token_hash, 
              i.token_expires_at, i.status, i.created_at, i.accepted_at
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
      created_at: string | Date;
      accepted_at: string | Date | null;
    }>(
      `SELECT i.id, i.household_id, h.name AS household_name, i.inviter_user_id, i.invitee_email, 
              i.invitee_first_name, i.invitee_last_name, i.assigned_role, i.token_hash, 
              i.token_expires_at, i.status, i.created_at, i.accepted_at
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
        throw new Error('Invitation not found.');
      }

      const normalizedEmail = normalizeEmail(input.requester.email);
      await client.query('BEGIN');

      const invitation = await this.findInvitationForAccept(client, input, normalizedEmail);

      if (!invitation) {
        throw new Error('Invitation not found.');
      }

      if (invitation.invitee_email !== normalizedEmail) {
        throw new Error('Access denied to this invitation.');
      }

      if (invitation.status !== 'pending') {
        throw new Error('Invitation is not pending.');
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
        throw new Error('Invitation expired. Please request a new invitation.');
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
        throw new Error('Only caregivers can cancel invitations.');
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
        throw new Error('Invitation not found.');
      }

      if (invitationRow.status !== 'pending') {
        throw new Error('Invitation is not pending.');
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
  }): Promise<{ newToken: string; newExpiresAt: string; deepLinkUrl: string; fallbackUrl: string | null }> {
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
        throw new Error('Only caregivers can resend invitations.');
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
        throw new Error('Invitation not found.');
      }

      if (invitationRow.status !== 'pending') {
        throw new Error('Can only resend pending invitations.');
      }

      const now = new Date();
      const expiresAt = new Date(invitationRow.token_expires_at);
      if (expiresAt <= now) {
        throw new Error('Cannot resend expired invitation. Please cancel and create a new one.');
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
        ...(env.INVITATION_WEB_FALLBACK_URL ? { fallbackBaseUrl: env.INVITATION_WEB_FALLBACK_URL } : {}),
      });

      return {
        newToken,
        newExpiresAt,
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
      throw new Error('Member not found or already removed.');
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
      name: string;
      dosage: string;
      form: MedicationForm;
      frequency: string;
      schedule: string | string[];
      prescribed_by: string | null;
      prescription_date: string | Date | null;
      start_date: string | Date;
      end_date: string | Date | null;
      instructions: string | null;
      created_by_user_id: string;
      created_at: string | Date;
      updated_at: string | Date;
    }>(
      `SELECT id, household_id, name, dosage, form, frequency, schedule,
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
      name: string;
      dosage: string;
      form: MedicationForm;
      frequency: string;
      schedule: string | string[];
      prescribed_by: string | null;
      prescription_date: string | Date | null;
      start_date: string | Date;
      end_date: string | Date | null;
      instructions: string | null;
      created_by_user_id: string;
      created_at: string | Date;
      updated_at: string | Date;
    }>(
      `SELECT id, household_id, name, dosage, form, frequency, schedule,
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
      name: string;
      dosage: string;
      form: MedicationForm;
      frequency: string;
      schedule: string | string[];
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
         id, household_id, name, dosage, form, frequency, schedule,
         prescribed_by, prescription_date, start_date, end_date, instructions,
         created_by_user_id, created_at, updated_at
       )
       VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, $8, $9, $10, $11, $12, $13, $14, $14)
       RETURNING id, household_id, name, dosage, form, frequency, schedule,
                 prescribed_by, prescription_date, start_date, end_date, instructions,
                 created_by_user_id, created_at, updated_at`,
      [
        id,
        input.householdId,
        input.name,
        input.dosage,
        input.form,
        input.frequency,
        JSON.stringify(input.schedule),
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
      throw new Error('Failed to create medication.');
    }

    return mapMedication(row);
  }

  async updateMedication(medicationId: string, householdId: string, input: UpdateMedicationInput): Promise<Medication> {
    const updates: string[] = [];
    const values: any[] = [];
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
    if (input.schedule !== undefined) {
      updates.push(`schedule = $${paramIndex++}::jsonb`);
      values.push(JSON.stringify(input.schedule));
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
      throw new Error('No fields to update.');
    }

    const now = nowIso();
    updates.push(`updated_at = $${paramIndex++}`);
    values.push(now);

    values.push(medicationId);
    values.push(householdId);

    const result = await this.pool.query<{
      id: string;
      household_id: string;
      name: string;
      dosage: string;
      form: MedicationForm;
      frequency: string;
      schedule: string | string[];
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
       RETURNING id, household_id, name, dosage, form, frequency, schedule,
                 prescribed_by, prescription_date, start_date, end_date, instructions,
                 created_by_user_id, created_at, updated_at`,
      values,
    );

    const row = result.rows[0];
    if (!row) {
      throw new Error('Medication not found.');
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
      throw new Error('Medication not found.');
    }
  }
}
