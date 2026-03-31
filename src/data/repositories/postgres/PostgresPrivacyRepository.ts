import type { Pool } from 'pg';
import type { PrivacySettings, UpdatePrivacySettingsInput } from '../../../domain/entities/PrivacySettings.js';
import type { UserProfile } from '../../../domain/entities/UserProfile.js';
import {
  NotFoundError,
  ValidationError,
} from '../../../domain/errors/index.js';
import {
  nowIso,
  toIso,
  normalizeEmail,
  normalizeName,
} from './helpers.js';

export class PostgresPrivacyRepository {
  constructor(protected readonly pool: Pool) {}

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
      share_activity_history: boolean;
      allow_analytics: boolean;
      created_at: string | Date;
      updated_at: string | Date;
    }>(
      `SELECT id, user_id, share_profile, share_activity_history,
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
      share_activity_history: boolean;
      allow_analytics: boolean;
      created_at: string | Date;
      updated_at: string | Date;
    }>(
      `INSERT INTO user_privacy_settings (id, user_id, share_profile, share_activity_history, allow_analytics, created_at, updated_at)
       VALUES (gen_random_uuid(), $${paramIndex++}, $${paramIndex++}, $${paramIndex++}, $${paramIndex++}, $${paramIndex++}, $${paramIndex++})
       ON CONFLICT (user_id) DO UPDATE
       SET ${updates.join(', ')}
       RETURNING id, user_id, share_profile, share_activity_history, allow_analytics, created_at, updated_at`,
      [
        ...values,
        userId,
        input.shareProfile ?? true,
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
      share_activity_history: boolean;
      allow_analytics: boolean;
      created_at: string | Date;
      updated_at: string | Date;
    }>(
      `SELECT id, user_id, share_profile, share_activity_history,
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
          shareActivityHistory: row.share_activity_history,
        allowAnalytics: row.allow_analytics,
        createdAt: toIso(row.created_at),
        updatedAt: toIso(row.updated_at),
      });
    }

    return settingsMap;
  }
}
