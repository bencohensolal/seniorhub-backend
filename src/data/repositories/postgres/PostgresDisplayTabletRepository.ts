import { randomUUID } from 'node:crypto';
import type { Pool } from 'pg';
import type { DisplayTablet, DisplayTabletWithToken, CreateDisplayTabletInput, UpdateDisplayTabletInput, DisplayTabletAuthInfo, DisplayTabletStatus } from '../../../domain/entities/DisplayTablet.js';
import type { TabletDisplayConfig } from '../../../domain/entities/TabletDisplayConfig.js';
import {
  NotFoundError,
  ValidationError,
} from '../../../domain/errors/index.js';
import {
  nowIso,
  addHours,
  mapDisplayTablet,
} from './helpers.js';
import { generateDisplayTabletToken, hashDisplayTabletToken } from '../../../domain/security/displayTabletToken.js';

const DISPLAY_TABLET_SETUP_TTL_HOURS = 72;

export class PostgresDisplayTabletRepository {
  constructor(protected readonly pool: Pool) {}

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
}
