import type { Pool } from 'pg';

export interface MissedMedication {
  medicationId: string;
  medicationName: string;
  householdId: string;
  scheduledTime: string; // HH:MM
  seniorFirstName: string;
}

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

  /**
   * Returns medications whose reminder time + grace period has passed today
   * but have no medication_log and no caregiver_alert already sent.
   * Uses Europe/Paris timezone for "today" and current time.
   */
  async getMissedMedications(graceMinutes: number = 30): Promise<MissedMedication[]> {
    const result = await this.pool.query<{
      medication_id: string;
      medication_name: string;
      household_id: string;
      scheduled_time: string;
      senior_first_name: string;
    }>(
      `WITH local_now AS (
        SELECT
          (NOW() AT TIME ZONE 'Europe/Paris')::date AS today,
          (NOW() AT TIME ZONE 'Europe/Paris')::time AS current_time
      )
      SELECT
        m.id          AS medication_id,
        m.name        AS medication_name,
        m.household_id,
        LEFT(mr.time, 5) AS scheduled_time,
        hm_senior.first_name AS senior_first_name
      FROM medication_reminders mr
      JOIN medications m ON m.id = mr.medication_id
      JOIN household_members hm_senior
        ON hm_senior.household_id = m.household_id
        AND hm_senior.user_id = m.senior_id
        AND hm_senior.status = 'active'
      CROSS JOIN local_now
      WHERE mr.enabled = true
        -- Reminder applies today (empty array = every day)
        AND (
          mr.days_of_week = '{}'
          OR EXTRACT(DOW FROM local_now.today)::int = ANY(mr.days_of_week)
        )
        -- Grace period has elapsed
        AND (mr.time::time + ($1 || ' minutes')::interval) < local_now.current_time
        -- Senior has not confirmed the intake
        AND NOT EXISTS (
          SELECT 1 FROM medication_logs ml
          WHERE ml.medication_id = m.id
            AND ml.scheduled_date = local_now.today
            AND ml.scheduled_time = LEFT(mr.time, 5)
        )
        -- Alert not already sent today for this reminder slot
        AND NOT EXISTS (
          SELECT 1 FROM caregiver_medication_alerts ca
          WHERE ca.medication_id = m.id
            AND ca.scheduled_date = local_now.today
            AND ca.scheduled_time = LEFT(mr.time, 5)
        )`,
      [graceMinutes],
    );

    return result.rows.map(r => ({
      medicationId: r.medication_id,
      medicationName: r.medication_name,
      householdId: r.household_id,
      scheduledTime: r.scheduled_time,
      seniorFirstName: r.senior_first_name,
    }));
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

  /** Mark an alert as sent to avoid duplicate notifications. */
  async markAlertSent(medicationId: string, scheduledDate: string, scheduledTime: string): Promise<void> {
    await this.pool.query(
      `INSERT INTO caregiver_medication_alerts (medication_id, scheduled_date, scheduled_time)
       VALUES ($1, $2::date, $3)
       ON CONFLICT (medication_id, scheduled_date, scheduled_time) DO NOTHING`,
      [medicationId, scheduledDate, scheduledTime],
    );
  }

  /** Get today's date in Europe/Paris timezone (YYYY-MM-DD). */
  async getTodayParis(): Promise<string> {
    const result = await this.pool.query<{ today: string }>(
      `SELECT (NOW() AT TIME ZONE 'Europe/Paris')::date::text AS today`,
    );
    return result.rows[0].today;
  }
}
