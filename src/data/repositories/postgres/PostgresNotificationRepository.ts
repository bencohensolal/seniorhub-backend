import type { Pool } from 'pg';

export class PostgresNotificationRepository {
  constructor(private readonly pool: Pool) {}

  /** Upsert a push token for a user. */
  async upsertPushToken(userId: string, token: string, platform?: string): Promise<void> {
    await this.pool.query(
      `INSERT INTO user_push_tokens (user_id, token, platform, updated_at)
       VALUES ($1, $2, $3, now())
       ON CONFLICT (user_id, token)
       DO UPDATE SET platform = EXCLUDED.platform, updated_at = now()`,
      [userId, token, platform ?? null],
    );
  }

  /** Get all Expo push tokens for a list of user IDs. */
  async getPushTokensForUsers(userIds: string[]): Promise<string[]> {
    if (userIds.length === 0) return [];
    const result = await this.pool.query<{ token: string }>(
      `SELECT DISTINCT token FROM user_push_tokens WHERE user_id = ANY($1)`,
      [userIds],
    );
    return result.rows.map(r => r.token);
  }

  /** Get user IDs of all active caregivers in a household. */
  async getCaregiverUserIds(householdId: string): Promise<string[]> {
    const result = await this.pool.query<{ user_id: string }>(
      `SELECT user_id FROM household_members
       WHERE household_id = $1 AND role = 'caregiver' AND status = 'active'`,
      [householdId],
    );
    return result.rows.map(r => r.user_id);
  }

  /** Get today's date in Europe/Paris timezone (YYYY-MM-DD). */
  async getTodayParis(): Promise<string> {
    const result = await this.pool.query<{ today: string }>(
      `SELECT (NOW() AT TIME ZONE 'Europe/Paris')::date::text AS today`,
    );
    return result.rows[0]!.today;
  }
}
