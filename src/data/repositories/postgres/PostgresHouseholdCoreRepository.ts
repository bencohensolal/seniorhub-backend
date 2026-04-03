import { randomUUID } from 'node:crypto';
import type { Pool, PoolClient } from 'pg';
import { env } from '../../../config/env.js';
import type { AuthenticatedRequester, Household, HouseholdOverview } from '../../../domain/entities/Household.js';
import type { HouseholdInvitation } from '../../../domain/entities/Invitation.js';
import { getCategoryForAction } from '../../../domain/entities/AuditEvent.js';
import type { AuditEventInput, AuditEvent, ListAuditEventsParams, ListAuditEventsResult } from '../../../domain/entities/AuditEvent.js';
import type { HouseholdRole, Member } from '../../../domain/entities/Member.js';
import { isInvitationTokenValid, signInvitationToken } from '../../../domain/security/invitationToken.js';
import { buildInvitationLinks } from '../../../domain/services/buildInvitationLinks.js';
import type {
  BulkInvitationResult,
  InvitationCandidate,
} from '../../../domain/repositories/HouseholdRepository.js';
import {
  NotFoundError,
  ForbiddenError,
  ConflictError,
} from '../../../domain/errors/index.js';
import {
  nowIso,
  addHours,
  toIso,
  hashToken,
  normalizeEmail,
  normalizeName,
  mapMember,
  mapInvitation,
} from './helpers.js';
import type {
  HouseholdSettings,
  HouseholdMemberPermissions,
  HouseholdNotificationSettings,
  UpdateHouseholdSettingsInput,
} from '../../../domain/entities/HouseholdSettings.js';
import {
  DEFAULT_HOUSEHOLD_NOTIFICATION_SETTINGS,
  getDefaultHouseholdMemberPermissions,
} from '../../../domain/entities/HouseholdSettings.js';

const INVITATION_TTL_HOURS = 72;

export class PostgresHouseholdCoreRepository {
  private static ensureHouseholdSettingsTablePromise: Promise<void> | null = null;

  constructor(protected readonly pool: Pool) {}

  private async ensureHouseholdSettingsTable(): Promise<void> {
    if (!PostgresHouseholdCoreRepository.ensureHouseholdSettingsTablePromise) {
      PostgresHouseholdCoreRepository.ensureHouseholdSettingsTablePromise = this.pool
        .query(`
          CREATE TABLE IF NOT EXISTS household_settings (
            household_id UUID PRIMARY KEY REFERENCES households(id) ON DELETE CASCADE,
            notifications JSONB NOT NULL DEFAULT '{"enabled": true, "memberUpdates": true, "invitations": true}'::jsonb,
            senior_menu_pin TEXT,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
          )
        `)
        .then(() => undefined);
    }

    await PostgresHouseholdCoreRepository.ensureHouseholdSettingsTablePromise;
  }

  private normalizeHouseholdSettings(
    householdId: string,
    stored: {
      notifications?: Partial<HouseholdNotificationSettings>;
      seniorMenuPin?: string | null;
      createdAt?: string;
      updatedAt?: string;
    },
    memberPermissions: Record<string, HouseholdMemberPermissions>,
  ): HouseholdSettings {
    return {
      householdId,
      memberPermissions,
      notifications: {
        ...DEFAULT_HOUSEHOLD_NOTIFICATION_SETTINGS,
        ...(stored.notifications ?? {}),
      },
      seniorMenuPin: stored.seniorMenuPin ?? null,
      createdAt: stored.createdAt ?? nowIso(),
      updatedAt: stored.updatedAt ?? nowIso(),
    };
  }

  private permissionsForRole(role: HouseholdRole): HouseholdMemberPermissions {
    return getDefaultHouseholdMemberPermissions(role);
  }

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

  async getHouseholdSettings(householdId: string): Promise<HouseholdSettings> {
    await this.ensureHouseholdSettingsTable();

    const settingsResult = await this.pool.query<{
      notifications: Partial<HouseholdNotificationSettings> | null;
      senior_menu_pin: string | null;
      created_at: string | Date;
      updated_at: string | Date;
    }>(
      `SELECT notifications, senior_menu_pin, created_at, updated_at
       FROM household_settings
       WHERE household_id = $1
       LIMIT 1`,
      [householdId],
    );

    let settingsRow = settingsResult.rows[0];
    if (!settingsRow) {
      const inserted = await this.pool.query<{
        notifications: HouseholdNotificationSettings;
        senior_menu_pin: string | null;
        created_at: string | Date;
        updated_at: string | Date;
      }>(
        `INSERT INTO household_settings (household_id, notifications, senior_menu_pin, created_at, updated_at)
         VALUES ($1, $2::jsonb, NULL, NOW(), NOW())
         ON CONFLICT (household_id) DO UPDATE
         SET updated_at = household_settings.updated_at
         RETURNING notifications, senior_menu_pin, created_at, updated_at`,
        [householdId, JSON.stringify(DEFAULT_HOUSEHOLD_NOTIFICATION_SETTINGS)],
      );
      settingsRow = inserted.rows[0]!;
    }

    const membersResult = await this.pool.query<{
      id: string;
      role: string;
      perm_manage_journal: boolean;
      perm_manage_appointments: boolean;
      perm_manage_tasks: boolean;
      perm_manage_caregiver_todos: boolean;
      perm_manage_members: boolean;
      perm_view_sensitive_info: boolean;
      perm_view_documents: boolean;
      perm_manage_documents: boolean;
    }>(
      `SELECT id, role, perm_manage_journal, perm_manage_appointments,
              perm_manage_tasks, perm_manage_caregiver_todos, perm_manage_members,
              perm_view_sensitive_info, perm_view_documents, perm_manage_documents
       FROM household_members
       WHERE household_id = $1 AND status = 'active'`,
      [householdId],
    );

    const memberPermissions: Record<string, HouseholdMemberPermissions> = {};
    for (const row of membersResult.rows) {
      const defaults = getDefaultHouseholdMemberPermissions(row.role as HouseholdRole);
      memberPermissions[row.id] = {
        viewJournal: defaults.viewJournal,
        manageJournal: row.perm_manage_journal,
        deleteJournal: defaults.deleteJournal,
        viewAppointments: defaults.viewAppointments,
        manageAppointments: row.perm_manage_appointments,
        deleteAppointments: defaults.deleteAppointments,
        viewTasks: defaults.viewTasks,
        manageTasks: row.perm_manage_tasks,
        deleteTasks: defaults.deleteTasks,
        viewCaregiverTodos: defaults.viewCaregiverTodos,
        manageCaregiverTodos: row.perm_manage_caregiver_todos,
        deleteCaregiverTodos: defaults.deleteCaregiverTodos,
        viewDocuments: row.perm_view_documents,
        manageDocuments: row.perm_manage_documents,
        deleteDocuments: defaults.deleteDocuments,
        manageMembers: row.perm_manage_members,
        inviteMembers: defaults.inviteMembers,
        editMemberRoles: defaults.editMemberRoles,
        archiveMembers: defaults.archiveMembers,
        manageMemberPermissions: defaults.manageMemberPermissions,
        viewDisplayTablets: defaults.viewDisplayTablets,
        manageDisplayTablets: defaults.manageDisplayTablets,
        deleteDisplayTablets: defaults.deleteDisplayTablets,
        viewSensitiveInfo: row.perm_view_sensitive_info,
      };
    }

    return this.normalizeHouseholdSettings(
      householdId,
      {
        notifications: settingsRow.notifications ?? {},
        seniorMenuPin: settingsRow.senior_menu_pin ?? null,
        createdAt: toIso(settingsRow.created_at),
        updatedAt: toIso(settingsRow.updated_at),
      },
      memberPermissions,
    );
  }

  async updateHouseholdSettings(householdId: string, input: UpdateHouseholdSettingsInput): Promise<HouseholdSettings> {
    await this.ensureHouseholdSettingsTable();

    const current = await this.getHouseholdSettings(householdId);

    if (input.memberPermissions) {
      for (const [memberId, perms] of Object.entries(input.memberPermissions)) {
        await this.pool.query(
          `UPDATE household_members SET
            perm_manage_journal     = COALESCE($2, perm_manage_journal),
            perm_manage_appointments    = COALESCE($3, perm_manage_appointments),
            perm_manage_tasks           = COALESCE($4, perm_manage_tasks),
            perm_manage_caregiver_todos = COALESCE($5, perm_manage_caregiver_todos),
            perm_manage_members         = COALESCE($6, perm_manage_members),
            perm_view_sensitive_info    = COALESCE($7, perm_view_sensitive_info),
            perm_view_documents         = COALESCE($8, perm_view_documents),
            perm_manage_documents       = COALESCE($9, perm_manage_documents)
           WHERE id = $1 AND household_id = $10`,
          [
            memberId,
            perms.manageJournal ?? null,
            perms.manageAppointments ?? null,
            perms.manageTasks ?? null,
            perms.manageCaregiverTodos ?? null,
            perms.manageMembers ?? null,
            perms.viewSensitiveInfo ?? null,
            perms.viewDocuments ?? null,
            perms.manageDocuments ?? null,
            householdId,
          ],
        );
      }
    }

    const nextNotifications = {
      ...current.notifications,
      ...(input.notifications ?? {}),
    };
    const nextSeniorMenuPin = input.seniorMenuPin !== undefined ? input.seniorMenuPin : current.seniorMenuPin ?? null;

    await this.pool.query(
      `INSERT INTO household_settings (household_id, notifications, senior_menu_pin, created_at, updated_at)
       VALUES ($1, $2::jsonb, $3, NOW(), NOW())
       ON CONFLICT (household_id) DO UPDATE
       SET notifications = EXCLUDED.notifications,
           senior_menu_pin = EXCLUDED.senior_menu_pin,
           updated_at = NOW()`,
      [householdId, JSON.stringify(nextNotifications), nextSeniorMenuPin],
    );

    return this.getHouseholdSettings(householdId);
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

      const caregiverPerms = this.permissionsForRole('caregiver');
      await client.query(
        `INSERT INTO household_members
         (id, household_id, user_id, email, first_name, last_name, role, status, joined_at, created_at,
          perm_manage_journal, perm_manage_appointments, perm_manage_tasks, perm_manage_caregiver_todos,
          perm_manage_members, perm_view_sensitive_info, perm_view_documents, perm_manage_documents)
         VALUES ($1, $2, $3, $4, $5, $6, 'caregiver', 'active', $7, $7, $8, $9, $10, $11, $12, $13, $14, $15)`,
        [
          memberId,
          householdId,
          requester.userId,
          normalizeEmail(requester.email),
          normalizeName(requester.firstName),
          normalizeName(requester.lastName),
          createdAt,
          caregiverPerms.manageJournal,
          caregiverPerms.manageAppointments,
          caregiverPerms.manageTasks,
          caregiverPerms.manageCaregiverTodos,
          caregiverPerms.manageMembers,
          caregiverPerms.viewSensitiveInfo,
          caregiverPerms.viewDocuments,
          caregiverPerms.manageDocuments,
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

  async updateHouseholdName(householdId: string, name: string): Promise<Household> {
    const updatedAt = nowIso();
    const result = await this.pool.query<{
      id: string;
      name: string;
      created_by_user_id: string;
      created_at: string | Date;
      updated_at: string | Date;
    }>(
      `UPDATE households
       SET name = $2,
           updated_at = $3
       WHERE id = $1
       RETURNING id, name, created_by_user_id, created_at, updated_at`,
      [householdId, name.trim(), updatedAt],
    );

    const row = result.rows[0];
    if (!row) {
      throw new NotFoundError('Household not found.');
    }

    return {
      id: row.id,
      name: row.name,
      createdByUserId: row.created_by_user_id,
      createdAt: toIso(row.created_at),
      updatedAt: toIso(row.updated_at),
    };
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

      const invitePerms = this.permissionsForRole(invitation.assigned_role);
      await client.query(
        `INSERT INTO household_members
         (id, household_id, user_id, email, first_name, last_name, role, status, joined_at, created_at,
          perm_manage_journal, perm_manage_appointments, perm_manage_tasks, perm_manage_caregiver_todos,
          perm_manage_members, perm_view_sensitive_info, perm_view_documents, perm_manage_documents)
         VALUES ($1, $2, $3, $4, $5, $6, $7, 'active', $8, $8, $9, $10, $11, $12, $13, $14, $15, $16)
         ON CONFLICT (household_id, user_id)
         DO UPDATE SET
           email = EXCLUDED.email,
           first_name = EXCLUDED.first_name,
           last_name = EXCLUDED.last_name,
           role = EXCLUDED.role,
           status = 'active',
           joined_at = EXCLUDED.joined_at,
           perm_manage_journal     = EXCLUDED.perm_manage_journal,
           perm_manage_appointments    = EXCLUDED.perm_manage_appointments,
           perm_manage_tasks           = EXCLUDED.perm_manage_tasks,
           perm_manage_caregiver_todos = EXCLUDED.perm_manage_caregiver_todos,
           perm_manage_members         = EXCLUDED.perm_manage_members,
           perm_view_sensitive_info    = EXCLUDED.perm_view_sensitive_info,
           perm_view_documents         = EXCLUDED.perm_view_documents,
           perm_manage_documents       = EXCLUDED.perm_manage_documents`,
        [
          randomUUID(),
          invitation.household_id,
          input.requester.userId,
          normalizedEmail,
          normalizeName(input.requester.firstName),
          normalizeName(input.requester.lastName),
          invitation.assigned_role,
          acceptedAt,
          invitePerms.manageJournal,
          invitePerms.manageAppointments,
          invitePerms.manageTasks,
          invitePerms.manageCaregiverTodos,
          invitePerms.manageMembers,
          invitePerms.viewSensitiveInfo,
          invitePerms.viewDocuments,
          invitePerms.manageDocuments,
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
    const category = input.category ?? getCategoryForAction(input.action);
    await this.pool.query(
      `INSERT INTO audit_events (id, household_id, actor_user_id, action, category, target_id, metadata, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, $8)`,
      [
        randomUUID(),
        input.householdId,
        input.actorUserId ?? null,
        input.action,
        category,
        input.targetId ?? null,
        JSON.stringify(input.metadata ?? {}),
        nowIso(),
      ],
    );
  }

  async listAuditEvents(params: ListAuditEventsParams): Promise<ListAuditEventsResult> {
    const conditions: string[] = ['ae.household_id = $1'];
    const values: unknown[] = [params.householdId];
    let idx = 2;

    if (params.category) {
      conditions.push(`ae.category = $${idx}`);
      values.push(params.category);
      idx++;
    }
    if (params.sinceDate) {
      conditions.push(`ae.created_at >= $${idx}`);
      values.push(params.sinceDate);
      idx++;
    }
    if (params.cursor) {
      conditions.push(`ae.created_at < $${idx}`);
      values.push(params.cursor);
      idx++;
    }

    const limit = Math.min(params.limit || 50, 100);
    values.push(limit + 1); // fetch one extra for pagination

    const sql = `
      SELECT
        ae.id, ae.household_id, ae.actor_user_id, ae.action, ae.category,
        ae.target_id, ae.metadata, ae.created_at,
        hm.first_name AS actor_first_name, hm.last_name AS actor_last_name
      FROM audit_events ae
      LEFT JOIN household_members hm ON hm.user_id = ae.actor_user_id AND hm.household_id = ae.household_id
      WHERE ${conditions.join(' AND ')}
      ORDER BY ae.created_at DESC
      LIMIT $${idx}
    `;

    const result = await this.pool.query(sql, values);
    const hasMore = result.rows.length > limit;
    const rows = hasMore ? result.rows.slice(0, limit) : result.rows;

    const events: AuditEvent[] = rows.map((row: any) => ({
      id: row.id,
      householdId: row.household_id,
      actorUserId: row.actor_user_id,
      actorFirstName: row.actor_first_name ?? null,
      actorLastName: row.actor_last_name ?? null,
      action: row.action,
      category: row.category,
      targetId: row.target_id,
      metadata: row.metadata ?? {},
      createdAt: row.created_at instanceof Date ? row.created_at.toISOString() : row.created_at,
    }));

    return {
      events,
      nextCursor: hasMore ? events[events.length - 1].createdAt : null,
    };
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

  async archiveMember(memberId: string, householdId: string): Promise<void> {
    const result = await this.pool.query(
      `UPDATE household_members
       SET status = 'archived'
       WHERE id = $1 AND household_id = $2 AND status = 'active'`,
      [memberId, householdId],
    );

    if (result.rowCount === 0) {
      throw new NotFoundError('Member not found or already archived.');
    }
  }

  async restoreMember(memberId: string, householdId: string): Promise<void> {
    const result = await this.pool.query(
      `UPDATE household_members
       SET status = 'active'
       WHERE id = $1 AND household_id = $2 AND status = 'archived'`,
      [memberId, householdId],
    );

    if (result.rowCount === 0) {
      throw new NotFoundError('Archived member not found.');
    }
  }

  async listArchivedHouseholdMembers(householdId: string): Promise<Member[]> {
    const result = await this.pool.query<any>(
      `SELECT id, household_id, user_id, email, first_name, last_name, role, status, joined_at, created_at, auth_provider, phone_number
       FROM household_members
       WHERE household_id = $1 AND status = 'archived'
       ORDER BY joined_at ASC`,
      [householdId],
    );

    return result.rows.map((row: any) => ({
      id: row.id,
      householdId: row.household_id,
      userId: row.user_id,
      email: row.email,
      firstName: row.first_name,
      lastName: row.last_name,
      role: row.role,
      status: row.status,
      joinedAt: row.joined_at?.toISOString?.() ?? row.joined_at,
      createdAt: row.created_at?.toISOString?.() ?? row.created_at,
      authProvider: row.auth_provider,
      phoneNumber: row.phone_number,
    }));
  }

  async updateMemberRole(memberId: string, newRole: HouseholdRole): Promise<Member> {
    const rolePerms = this.permissionsForRole(newRole);
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
       SET role = $2,
           perm_manage_journal     = $3,
           perm_manage_appointments    = $4,
           perm_manage_tasks           = $5,
           perm_manage_caregiver_todos = $6,
           perm_manage_members         = $7,
           perm_view_sensitive_info    = $8,
           perm_view_documents         = $9,
           perm_manage_documents       = $10
       WHERE id = $1 AND status = 'active'
       RETURNING id, household_id, user_id, email, first_name, last_name, role, status, joined_at, created_at`,
      [
        memberId,
        newRole,
        rolePerms.manageJournal,
        rolePerms.manageAppointments,
        rolePerms.manageTasks,
        rolePerms.manageCaregiverTodos,
        rolePerms.manageMembers,
        rolePerms.viewSensitiveInfo,
        rolePerms.viewDocuments,
        rolePerms.manageDocuments,
      ],
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
}
