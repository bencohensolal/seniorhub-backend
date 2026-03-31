import type { Pool } from 'pg';
import type { Subscription, SubscriptionPlan, SubscriptionStatus, UpdateSubscriptionInput } from '../../../domain/entities/Subscription.js';
import { NotFoundError } from '../../../domain/errors/index.js';
import { toIso, nowIso } from './helpers.js';

interface SubscriptionRow {
  id: string;
  household_id: string;
  plan: SubscriptionPlan;
  status: SubscriptionStatus;
  rc_app_user_id: string | null;
  rc_original_transaction_id: string | null;
  rc_product_id: string | null;
  current_period_start: string | Date | null;
  current_period_end: string | Date | null;
  cancel_at_period_end: boolean;
  created_at: string | Date;
  updated_at: string | Date;
}

const mapSubscription = (row: SubscriptionRow): Subscription => ({
  id: row.id,
  householdId: row.household_id,
  plan: row.plan,
  status: row.status,
  rcAppUserId: row.rc_app_user_id,
  rcOriginalTransactionId: row.rc_original_transaction_id,
  rcProductId: row.rc_product_id,
  currentPeriodStart: row.current_period_start ? toIso(row.current_period_start) : null,
  currentPeriodEnd: row.current_period_end ? toIso(row.current_period_end) : null,
  cancelAtPeriodEnd: row.cancel_at_period_end,
  createdAt: toIso(row.created_at),
  updatedAt: toIso(row.updated_at),
});

export class PostgresSubscriptionRepository {
  constructor(protected readonly pool: Pool) {}

  async getActiveSubscription(householdId: string): Promise<Subscription | null> {
    const result = await this.pool.query<SubscriptionRow>(
      `SELECT * FROM subscriptions
       WHERE household_id = $1 AND status IN ('active', 'past_due', 'trialing')
       LIMIT 1`,
      [householdId],
    );
    const row = result.rows[0];
    return row ? mapSubscription(row) : null;
  }

  async getByRcAppUserId(rcAppUserId: string): Promise<Subscription | null> {
    const result = await this.pool.query<SubscriptionRow>(
      `SELECT * FROM subscriptions
       WHERE rc_app_user_id = $1
       ORDER BY updated_at DESC
       LIMIT 1`,
      [rcAppUserId],
    );
    const row = result.rows[0];
    return row ? mapSubscription(row) : null;
  }

  async createSubscription(householdId: string, plan: SubscriptionPlan): Promise<Subscription> {
    const result = await this.pool.query<SubscriptionRow>(
      `INSERT INTO subscriptions (household_id, plan, status)
       VALUES ($1, $2, 'active')
       RETURNING *`,
      [householdId, plan],
    );
    const row = result.rows[0];
    if (!row) throw new NotFoundError('Failed to create subscription.');
    return mapSubscription(row);
  }

  async updateSubscription(subscriptionId: string, input: UpdateSubscriptionInput): Promise<Subscription> {
    const updates: string[] = [];
    const values: unknown[] = [];
    let idx = 1;

    if (input.plan !== undefined) {
      updates.push(`plan = $${idx++}`);
      values.push(input.plan);
    }
    if (input.status !== undefined) {
      updates.push(`status = $${idx++}`);
      values.push(input.status);
    }
    if (input.rcAppUserId !== undefined) {
      updates.push(`rc_app_user_id = $${idx++}`);
      values.push(input.rcAppUserId);
    }
    if (input.rcOriginalTransactionId !== undefined) {
      updates.push(`rc_original_transaction_id = $${idx++}`);
      values.push(input.rcOriginalTransactionId);
    }
    if (input.rcProductId !== undefined) {
      updates.push(`rc_product_id = $${idx++}`);
      values.push(input.rcProductId);
    }
    if (input.currentPeriodStart !== undefined) {
      updates.push(`current_period_start = $${idx++}`);
      values.push(input.currentPeriodStart);
    }
    if (input.currentPeriodEnd !== undefined) {
      updates.push(`current_period_end = $${idx++}`);
      values.push(input.currentPeriodEnd);
    }
    if (input.cancelAtPeriodEnd !== undefined) {
      updates.push(`cancel_at_period_end = $${idx++}`);
      values.push(input.cancelAtPeriodEnd);
    }

    updates.push(`updated_at = $${idx++}`);
    values.push(nowIso());

    values.push(subscriptionId);

    const result = await this.pool.query<SubscriptionRow>(
      `UPDATE subscriptions
       SET ${updates.join(', ')}
       WHERE id = $${idx}
       RETURNING *`,
      values,
    );

    const row = result.rows[0];
    if (!row) throw new NotFoundError('Subscription not found.');
    return mapSubscription(row);
  }

  async ensureDefaultSubscription(householdId: string): Promise<Subscription> {
    const existing = await this.getActiveSubscription(householdId);
    if (existing) return existing;
    return this.createSubscription(householdId, 'gratuit');
  }
}
