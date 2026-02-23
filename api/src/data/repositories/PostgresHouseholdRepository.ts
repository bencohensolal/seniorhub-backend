import { createHash, randomUUID } from 'node:crypto';
import type { Pool, PoolClient } from 'pg';
import { env } from '../../config/env.js';
import type { AuthenticatedRequester, Household, HouseholdOverview } from '../../domain/entities/Household.js';
import type { AuditEventInput, HouseholdInvitation } from '../../domain/entities/Invitation.js';
import type { HouseholdRole, Member } from '../../domain/entities/Member.js';
import { isInvitationTokenValid, signInvitationToken } from '../../domain/security/invitationToken.js';
import { buildInvitationLinks } from '../../domain/services/buildInvitationLinks.js';
import type {
  BulkInvitationResult,
  HouseholdRepository,
  InvitationCandidate,
} from '../../domain/repositories/HouseholdRepository.js';

const INVITATION_TTL_HOURS = 72;

const nowIso = (): string => new Date().toISOString();

const addHours = (isoDate: string, hours: number): string => {
  const date = new Date(isoDate);
  date.setHours(date.getHours() + hours);
  return date.toISOString();
};

const hashToken = (token: string): string => createHash('sha256').update(token).digest('hex');

const normalizeEmail = (email: string): string => email.trim().toLowerCase();

const normalizeName = (value: string): string => value.trim();

const toIso = (value: string | Date): string => new Date(value).toISOString();

const mapMember = (row: {
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

const mapInvitation = (row: {
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
      `SELECT id, household_id, inviter_user_id, invitee_email, invitee_first_name, invitee_last_name,
              assigned_role, token_hash, token_expires_at, status, created_at, accepted_at
       FROM household_invitations
       WHERE invitee_email = $1
         AND status = 'pending'
       ORDER BY created_at DESC`,
      [normalizedEmail],
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
      `SELECT id, household_id, inviter_user_id, invitee_email, invitee_first_name, invitee_last_name,
              assigned_role, token_hash, token_expires_at, status, created_at, accepted_at
       FROM household_invitations
       WHERE token_hash = $1
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

  async logAuditEvent(input: AuditEventInput): Promise<void> {
    await this.pool.query(
      `INSERT INTO audit_events (id, household_id, actor_user_id, action, target_id, metadata, created_at)
       VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7)`,
      [randomUUID(), input.householdId, input.actorUserId, input.action, input.targetId, JSON.stringify(input.metadata), nowIso()],
    );
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
}
