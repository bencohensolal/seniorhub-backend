import { randomUUID } from 'node:crypto';
import type { Pool } from 'pg';
import type {
  SeniorDevice,
  SeniorDeviceWithToken,
  CreateSeniorDeviceInput,
  SeniorDeviceAuthInfo,
  SeniorDeviceStatus,
} from '../../../domain/entities/SeniorDevice.js';
import type { HouseholdRole } from '../../../domain/entities/Member.js';
import { NotFoundError } from '../../../domain/errors/index.js';
import { nowIso, addHours, mapSeniorDevice } from './helpers.js';
import { generateDisplayTabletToken, hashDisplayTabletToken } from '../../../domain/security/displayTabletToken.js';

const SETUP_TOKEN_TTL_HOURS = 72;

export class PostgresSeniorDeviceRepository {
  constructor(protected readonly pool: Pool) {}

  async listHouseholdSeniorDevices(householdId: string): Promise<SeniorDevice[]> {
    const result = await this.pool.query<{
      id: string;
      household_id: string;
      member_id: string;
      name: string;
      token_hash: string;
      status: SeniorDeviceStatus;
      created_by: string;
      created_at: string | Date;
      last_active_at: string | Date | null;
      revoked_at: string | Date | null;
      revoked_by: string | null;
    }>(
      `SELECT id, household_id, member_id, name, token_hash, status, created_by,
              created_at, last_active_at, revoked_at, revoked_by
       FROM senior_devices
       WHERE household_id = $1
       ORDER BY created_at DESC`,
      [householdId],
    );

    return result.rows.map(mapSeniorDevice);
  }

  async getSeniorDeviceById(deviceId: string, householdId: string): Promise<SeniorDevice | null> {
    const result = await this.pool.query<{
      id: string;
      household_id: string;
      member_id: string;
      name: string;
      token_hash: string;
      status: SeniorDeviceStatus;
      created_by: string;
      created_at: string | Date;
      last_active_at: string | Date | null;
      revoked_at: string | Date | null;
      revoked_by: string | null;
    }>(
      `SELECT id, household_id, member_id, name, token_hash, status, created_by,
              created_at, last_active_at, revoked_at, revoked_by
       FROM senior_devices
       WHERE id = $1 AND household_id = $2
       LIMIT 1`,
      [deviceId, householdId],
    );

    const row = result.rows[0];
    return row ? mapSeniorDevice(row) : null;
  }

  async createSeniorDevice(input: CreateSeniorDeviceInput): Promise<SeniorDeviceWithToken> {
    const id = randomUUID();
    const now = nowIso();
    const token = generateDisplayTabletToken();
    const tokenHash = hashDisplayTabletToken(token);
    const tokenExpiresAt = addHours(now, SETUP_TOKEN_TTL_HOURS);

    const result = await this.pool.query<{
      id: string;
      household_id: string;
      member_id: string;
      name: string;
      token_hash: string;
      status: SeniorDeviceStatus;
      created_by: string;
      created_at: string | Date;
      last_active_at: string | Date | null;
      revoked_at: string | Date | null;
      revoked_by: string | null;
    }>(
      `INSERT INTO senior_devices (
         id, household_id, member_id, name, token_hash, token_expires_at, created_by, created_at, status
       )
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'active')
       RETURNING id, household_id, member_id, name, token_hash, status, created_by,
                 created_at, last_active_at, revoked_at, revoked_by`,
      [id, input.householdId, input.memberId, input.name, tokenHash, tokenExpiresAt, input.createdBy, now],
    );

    const row = result.rows[0];
    if (!row) {
      throw new NotFoundError('Failed to create senior device.');
    }

    const device = mapSeniorDevice(row);
    const { tokenHash: _, ...deviceWithoutHash } = device;
    return { ...deviceWithoutHash, token };
  }

  async authenticateSeniorDevice(
    deviceId: string,
    setupToken: string,
    refreshToken: string,
    refreshTokenExpiresAt: string,
  ): Promise<SeniorDeviceAuthInfo | null> {
    const tokenHash = hashDisplayTabletToken(setupToken);
    const refreshTokenHash = hashDisplayTabletToken(refreshToken);
    const now = nowIso();

    const result = await this.pool.query<{
      household_id: string;
      household_name: string;
      member_id: string;
      user_id: string;
      first_name: string;
      last_name: string;
      role: HouseholdRole;
    }>(
      `UPDATE senior_devices AS sd
       SET token_used_at = $3,
           last_active_at = $3,
           refresh_token_hash = $4,
           refresh_token_expires_at = $5
       FROM households h, household_members hm
       WHERE sd.id = $1
         AND sd.household_id = h.id
         AND sd.member_id = hm.id
         AND sd.token_hash = $2
         AND sd.status = 'active'
         AND sd.revoked_at IS NULL
         AND sd.token_used_at IS NULL
         AND sd.token_expires_at > $3
       RETURNING sd.household_id, h.name AS household_name,
                 hm.id AS member_id, hm.user_id, hm.first_name, hm.last_name, hm.role`,
      [deviceId, tokenHash, now, refreshTokenHash, refreshTokenExpiresAt],
    );

    const row = result.rows[0];
    if (!row) {
      return null;
    }

    return {
      householdId: row.household_id,
      householdName: row.household_name,
      memberId: row.member_id,
      userId: row.user_id,
      firstName: row.first_name,
      lastName: row.last_name,
      role: row.role,
      permissions: ['read', 'write'],
    };
  }

  async refreshSeniorDeviceSession(
    deviceId: string,
    refreshToken: string,
    nextRefreshToken: string,
    nextRefreshTokenExpiresAt: string,
  ): Promise<SeniorDeviceAuthInfo | null> {
    const refreshTokenHash = hashDisplayTabletToken(refreshToken);
    const nextRefreshTokenHash = hashDisplayTabletToken(nextRefreshToken);
    const now = nowIso();

    const result = await this.pool.query<{
      household_id: string;
      household_name: string;
      member_id: string;
      user_id: string;
      first_name: string;
      last_name: string;
      role: HouseholdRole;
    }>(
      `UPDATE senior_devices AS sd
       SET refresh_token_hash = $3,
           refresh_token_expires_at = $4,
           last_active_at = $5
       FROM households h, household_members hm
       WHERE sd.id = $1
         AND sd.household_id = h.id
         AND sd.member_id = hm.id
         AND sd.refresh_token_hash = $2
         AND sd.status = 'active'
         AND sd.revoked_at IS NULL
         AND sd.refresh_token_expires_at IS NOT NULL
         AND sd.refresh_token_expires_at > $5
       RETURNING sd.household_id, h.name AS household_name,
                 hm.id AS member_id, hm.user_id, hm.first_name, hm.last_name, hm.role`,
      [deviceId, refreshTokenHash, nextRefreshTokenHash, nextRefreshTokenExpiresAt, now],
    );

    const row = result.rows[0];
    if (!row) {
      return null;
    }

    return {
      householdId: row.household_id,
      householdName: row.household_name,
      memberId: row.member_id,
      userId: row.user_id,
      firstName: row.first_name,
      lastName: row.last_name,
      role: row.role,
      permissions: ['read', 'write'],
    };
  }

  async revokeSeniorDevice(deviceId: string, householdId: string, revokedBy: string): Promise<void> {
    const now = nowIso();

    const result = await this.pool.query(
      `UPDATE senior_devices
       SET status = 'revoked', revoked_at = $3, revoked_by = $4
       WHERE id = $1 AND household_id = $2 AND status = 'active'`,
      [deviceId, householdId, now, revokedBy],
    );

    if (result.rowCount === 0) {
      throw new NotFoundError('Senior device not found or already revoked.');
    }
  }

  async revokeAllSeniorDevicesForMember(memberId: string, householdId: string, revokedBy: string): Promise<void> {
    const now = nowIso();
    await this.pool.query(
      `UPDATE senior_devices
       SET status = 'revoked', revoked_at = $3, revoked_by = $4
       WHERE member_id = $1 AND household_id = $2 AND status = 'active'`,
      [memberId, householdId, now, revokedBy],
    );
  }

  async countActiveSeniorDevices(householdId: string): Promise<number> {
    const result = await this.pool.query<{ count: string }>(
      `SELECT COUNT(*) AS count
       FROM senior_devices
       WHERE household_id = $1 AND status = 'active'`,
      [householdId],
    );

    return parseInt(result.rows[0]?.count || '0', 10);
  }

  async createProxyMember(input: {
    householdId: string;
    userId: string;
    firstName: string;
    lastName: string;
    role: HouseholdRole;
    phoneNumber?: string;
    permissions: {
      manageMedications: boolean;
      manageAppointments: boolean;
      manageTasks: boolean;
      manageMembers: boolean;
      viewSensitiveInfo: boolean;
      viewDocuments: boolean;
      manageDocuments: boolean;
    };
  }): Promise<{ id: string }> {
    const id = randomUUID();
    const now = nowIso();

    await this.pool.query(
      `INSERT INTO household_members
       (id, household_id, user_id, email, first_name, last_name, role, status, joined_at, created_at,
        auth_provider, phone_number,
        perm_manage_medications, perm_manage_appointments, perm_manage_tasks, perm_manage_caregiver_todos,
        perm_manage_members, perm_view_sensitive_info, perm_view_documents, perm_manage_documents)
       VALUES ($1, $2, $3, NULL, $4, $5, $6, 'active', $7, $7,
        'device', $8,
        $9, $10, $11, $12, $13, $14, $15, $16)`,
      [
        id,
        input.householdId,
        input.userId,
        input.firstName.trim(),
        input.lastName.trim(),
        input.role,
        now,
        input.phoneNumber?.trim() || null,
        input.permissions.manageMedications,
        input.permissions.manageAppointments,
        input.permissions.manageTasks,
        input.permissions.manageCaregiverTodos,
        input.permissions.manageMembers,
        input.permissions.viewSensitiveInfo,
        input.permissions.viewDocuments,
        input.permissions.manageDocuments,
      ],
    );

    return { id };
  }
}
