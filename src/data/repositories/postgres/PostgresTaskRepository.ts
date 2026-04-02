import { randomUUID } from 'node:crypto';
import type { Pool } from 'pg';
import type { Task, TaskWithReminders, CreateTaskInput, UpdateTaskInput, CompleteTaskInput, TaskCategory, TaskPriority, TaskStatus } from '../../../domain/entities/Task.js';
import type { TaskReminder, CreateTaskReminderInput, UpdateTaskReminderInput } from '../../../domain/entities/TaskReminder.js';
import {
  NotFoundError,
  ValidationError,
} from '../../../domain/errors/index.js';
import {
  nowIso,
  mapTask,
  mapTaskReminder,
} from './helpers.js';

// Shared row type for task queries
type TaskRow = {
  id: string;
  household_id: string;
  senior_ids: string[] | string;
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
  requires_confirmation: boolean;
  confirmation_delay_minutes: number | null;
  confirmed_at: string | Date | null;
  confirmed_by: string | null;
  completed_at: string | Date | null;
  completed_by: string | null;
  created_at: string | Date;
  updated_at: string | Date;
  created_by: string;
};

const TASK_COLUMNS = `id, household_id, senior_ids, caregiver_id, title, description,
  category, priority, status, due_date, due_time, duration, recurrence::text,
  requires_confirmation, confirmation_delay_minutes, confirmed_at, confirmed_by,
  completed_at, completed_by, created_at, updated_at, created_by`;

export class PostgresTaskRepository {
  constructor(protected readonly pool: Pool) {}

  async listHouseholdTasks(householdId: string, filters?: {
    status?: string;
    seniorId?: string;
    category?: string;
    fromDate?: string;
    toDate?: string;
  }): Promise<TaskWithReminders[]> {
    let query = `
      SELECT t.id, t.household_id, t.senior_ids, t.caregiver_id, t.title, t.description,
             t.category, t.priority, t.status, t.due_date, t.due_time, t.duration, t.recurrence::text,
             t.requires_confirmation, t.confirmation_delay_minutes, t.confirmed_at, t.confirmed_by,
             t.completed_at, t.completed_by, t.created_at, t.updated_at, t.created_by
      FROM tasks t
      WHERE t.household_id = $1
    `;

    const params: unknown[] = [householdId];
    let paramIndex = 2;

    if (filters?.status) {
      query += ` AND t.status = $${paramIndex++}`;
      params.push(filters.status);
    }

    if (filters?.seniorId) {
      query += ` AND t.senior_ids @> $${paramIndex++}::jsonb`;
      params.push(JSON.stringify([filters.seniorId]));
    }

    if (filters?.category) {
      query += ` AND t.category = $${paramIndex++}`;
      params.push(filters.category);
    }

    if (filters?.fromDate) {
      query += ` AND t.due_date >= $${paramIndex++}`;
      params.push(filters.fromDate);
    }

    if (filters?.toDate) {
      query += ` AND t.due_date <= $${paramIndex++}`;
      params.push(filters.toDate);
    }

    query += ` ORDER BY t.due_date ASC NULLS LAST, t.priority DESC, t.created_at DESC`;

    const tasksResult = await this.pool.query<TaskRow>(query, params);

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
    const taskResult = await this.pool.query<TaskRow>(
      `SELECT ${TASK_COLUMNS}
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

    const result = await this.pool.query<TaskRow>(
      `INSERT INTO tasks (
         id, household_id, senior_ids, caregiver_id, title, description,
         category, priority, status, due_date, due_time, duration, recurrence,
         requires_confirmation, confirmation_delay_minutes,
         created_at, updated_at, created_by
       )
       VALUES ($1, $2, $3::jsonb, $4, $5, $6, $7, $8, 'pending', $9, $10, $11, $12, $13, $14, $15, $15, $16)
       RETURNING ${TASK_COLUMNS}`,
      [
        id,
        input.householdId,
        JSON.stringify(input.seniorIds),
        input.caregiverId ?? null,
        input.title,
        input.description ?? null,
        input.category,
        priority,
        input.dueDate ?? null,
        input.dueTime ?? null,
        input.duration ?? null,
        input.recurrence ? JSON.stringify(input.recurrence) : null,
        input.requiresConfirmation ?? false,
        input.confirmationDelayMinutes ?? null,
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

    if (input.seniorIds !== undefined) {
      updates.push(`senior_ids = $${paramIndex++}::jsonb`);
      values.push(JSON.stringify(input.seniorIds));
    }
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
    if (input.requiresConfirmation !== undefined) {
      updates.push(`requires_confirmation = $${paramIndex++}`);
      values.push(input.requiresConfirmation);
    }
    if (input.confirmationDelayMinutes !== undefined) {
      updates.push(`confirmation_delay_minutes = $${paramIndex++}`);
      values.push(input.confirmationDelayMinutes);
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

    const result = await this.pool.query<TaskRow>(
      `UPDATE tasks
       SET ${updates.join(', ')}
       WHERE id = $${paramIndex++} AND household_id = $${paramIndex++}
       RETURNING ${TASK_COLUMNS}`,
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

    const result = await this.pool.query<TaskRow>(
      `UPDATE tasks
       SET status = 'completed', completed_at = $3, completed_by = $4, updated_at = $5
       WHERE id = $1 AND household_id = $2
       RETURNING ${TASK_COLUMNS}`,
      [taskId, householdId, completedAt, completedBy, now],
    );

    const row = result.rows[0];
    if (!row) {
      throw new NotFoundError('Task not found.');
    }

    return mapTask(row);
  }

  async confirmTask(taskId: string, householdId: string, confirmedBy: string): Promise<Task> {
    const now = nowIso();

    const result = await this.pool.query<TaskRow>(
      `UPDATE tasks
       SET confirmed_at = $3, confirmed_by = $4, updated_at = $3
       WHERE id = $1 AND household_id = $2 AND requires_confirmation = true AND confirmed_at IS NULL
       RETURNING ${TASK_COLUMNS}`,
      [taskId, householdId, now, confirmedBy],
    );

    const row = result.rows[0];
    if (!row) {
      throw new NotFoundError('Task not found or already confirmed.');
    }

    return mapTask(row);
  }

  async listUnconfirmedTasks(): Promise<(Task & { householdId: string })[]> {
    const result = await this.pool.query<TaskRow>(
      `SELECT ${TASK_COLUMNS}
       FROM tasks
       WHERE requires_confirmation = true
         AND confirmed_at IS NULL
         AND confirmation_notified_at IS NULL
         AND status = 'pending'
         AND due_date IS NOT NULL
         AND due_time IS NOT NULL
         AND confirmation_delay_minutes IS NOT NULL
         AND (due_date + due_time::time + (confirmation_delay_minutes || ' minutes')::interval) < NOW()`,
    );

    return result.rows.map(row => mapTask(row));
  }

  async markConfirmationNotified(taskIds: string[]): Promise<void> {
    if (taskIds.length === 0) return;
    const now = nowIso();
    await this.pool.query(
      `UPDATE tasks SET confirmation_notified_at = $1 WHERE id = ANY($2)`,
      [now, taskIds],
    );
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
}
