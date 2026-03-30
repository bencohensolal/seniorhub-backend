import { randomUUID } from 'node:crypto';
import type { Pool } from 'pg';
import type {
  CaregiverTodo,
  CaregiverTodoComment,
  CaregiverTodoWithComments,
  CaregiverTodoPriority,
  CaregiverTodoStatus,
  CreateCaregiverTodoInput,
  UpdateCaregiverTodoInput,
} from '../../../domain/entities/CaregiverTodo.js';
import {
  NotFoundError,
  ValidationError,
} from '../../../domain/errors/index.js';
import {
  nowIso,
  mapCaregiverTodo,
  mapCaregiverTodoComment,
} from './helpers.js';

export class PostgresCaregiverTodoRepository {
  constructor(protected readonly pool: Pool) {}

  async listCaregiverTodos(householdId: string, filters?: {
    status?: string;
    assignedTo?: string;
  }): Promise<CaregiverTodoWithComments[]> {
    let query = `
      SELECT id, household_id, title, description, priority, status, assigned_to,
             due_date, completed_at, completed_by, last_nudged_at, nudge_count,
             created_at, updated_at, created_by
      FROM caregiver_todos
      WHERE household_id = $1
    `;

    const params: unknown[] = [householdId];
    let paramIndex = 2;

    if (filters?.status) {
      query += ` AND status = $${paramIndex++}`;
      params.push(filters.status);
    }

    if (filters?.assignedTo) {
      query += ` AND assigned_to = $${paramIndex++}`;
      params.push(filters.assignedTo);
    }

    query += ` ORDER BY due_date ASC NULLS LAST, priority DESC, created_at DESC`;

    const todosResult = await this.pool.query<{
      id: string;
      household_id: string;
      title: string;
      description: string | null;
      priority: CaregiverTodoPriority;
      status: CaregiverTodoStatus;
      assigned_to: string | null;
      due_date: string | Date | null;
      completed_at: string | Date | null;
      completed_by: string | null;
      last_nudged_at: string | Date | null;
      nudge_count: number;
      created_at: string | Date;
      updated_at: string | Date;
      created_by: string;
    }>(query, params);

    // Fetch all comments for these todos
    const todoIds = todosResult.rows.map(row => row.id);
    let commentsMap: Map<string, CaregiverTodoComment[]> = new Map();

    if (todoIds.length > 0) {
      const commentsResult = await this.pool.query<{
        id: string;
        todo_id: string;
        author_id: string;
        content: string;
        created_at: string | Date;
      }>(
        `SELECT id, todo_id, author_id, content, created_at
         FROM caregiver_todo_comments
         WHERE todo_id = ANY($1)
         ORDER BY created_at ASC`,
        [todoIds],
      );

      // Group comments by todo_id
      for (const row of commentsResult.rows) {
        const comment = mapCaregiverTodoComment(row);
        if (!commentsMap.has(row.todo_id)) {
          commentsMap.set(row.todo_id, []);
        }
        commentsMap.get(row.todo_id)!.push(comment);
      }
    }

    // Combine todos with their comments
    return todosResult.rows.map(row => ({
      ...mapCaregiverTodo(row),
      comments: commentsMap.get(row.id) || [],
    }));
  }

  async getCaregiverTodoById(todoId: string, householdId: string): Promise<CaregiverTodoWithComments | null> {
    const todoResult = await this.pool.query<{
      id: string;
      household_id: string;
      title: string;
      description: string | null;
      priority: CaregiverTodoPriority;
      status: CaregiverTodoStatus;
      assigned_to: string | null;
      due_date: string | Date | null;
      completed_at: string | Date | null;
      completed_by: string | null;
      last_nudged_at: string | Date | null;
      nudge_count: number;
      created_at: string | Date;
      updated_at: string | Date;
      created_by: string;
    }>(
      `SELECT id, household_id, title, description, priority, status, assigned_to,
              due_date, completed_at, completed_by, last_nudged_at, nudge_count,
              created_at, updated_at, created_by
       FROM caregiver_todos
       WHERE id = $1 AND household_id = $2
       LIMIT 1`,
      [todoId, householdId],
    );

    const row = todoResult.rows[0];
    if (!row) {
      return null;
    }

    // Fetch comments for this todo
    const commentsResult = await this.pool.query<{
      id: string;
      todo_id: string;
      author_id: string;
      content: string;
      created_at: string | Date;
    }>(
      `SELECT id, todo_id, author_id, content, created_at
       FROM caregiver_todo_comments
       WHERE todo_id = $1
       ORDER BY created_at ASC`,
      [todoId],
    );

    return {
      ...mapCaregiverTodo(row),
      comments: commentsResult.rows.map(mapCaregiverTodoComment),
    };
  }

  async createCaregiverTodo(input: CreateCaregiverTodoInput): Promise<CaregiverTodo> {
    const id = randomUUID();
    const now = nowIso();
    const priority = input.priority || 'normal';

    const result = await this.pool.query<{
      id: string;
      household_id: string;
      title: string;
      description: string | null;
      priority: CaregiverTodoPriority;
      status: CaregiverTodoStatus;
      assigned_to: string | null;
      due_date: string | Date | null;
      completed_at: string | Date | null;
      completed_by: string | null;
      last_nudged_at: string | Date | null;
      nudge_count: number;
      created_at: string | Date;
      updated_at: string | Date;
      created_by: string;
    }>(
      `INSERT INTO caregiver_todos (
         id, household_id, title, description, priority, status, assigned_to,
         due_date, nudge_count, created_at, updated_at, created_by
       )
       VALUES ($1, $2, $3, $4, $5, 'pending', $6, $7, 0, $8, $8, $9)
       RETURNING id, household_id, title, description, priority, status, assigned_to,
                 due_date, completed_at, completed_by, last_nudged_at, nudge_count,
                 created_at, updated_at, created_by`,
      [
        id,
        input.householdId,
        input.title,
        input.description ?? null,
        priority,
        input.assignedTo ?? null,
        input.dueDate ?? null,
        now,
        input.createdBy,
      ],
    );

    const row = result.rows[0];
    if (!row) {
      throw new NotFoundError('Failed to create caregiver todo.');
    }

    return mapCaregiverTodo(row);
  }

  async updateCaregiverTodo(todoId: string, householdId: string, input: UpdateCaregiverTodoInput): Promise<CaregiverTodo> {
    const updates: string[] = [];
    const values: unknown[] = [];
    let paramIndex = 1;

    if (input.title !== undefined) {
      updates.push(`title = $${paramIndex++}`);
      values.push(input.title);
    }
    if (input.description !== undefined) {
      updates.push(`description = $${paramIndex++}`);
      values.push(input.description);
    }
    if (input.priority !== undefined) {
      updates.push(`priority = $${paramIndex++}`);
      values.push(input.priority);
    }
    if (input.status !== undefined) {
      updates.push(`status = $${paramIndex++}`);
      values.push(input.status);

      // Auto-set completedAt if status becomes 'completed'
      if (input.status === 'completed') {
        updates.push(`completed_at = $${paramIndex++}`);
        values.push(nowIso());
      }
    }
    if (input.assignedTo !== undefined) {
      updates.push(`assigned_to = $${paramIndex++}`);
      values.push(input.assignedTo);
    }
    if (input.dueDate !== undefined) {
      updates.push(`due_date = $${paramIndex++}`);
      values.push(input.dueDate);
    }

    if (updates.length === 0) {
      throw new ValidationError('No fields to update.');
    }

    const now = nowIso();
    updates.push(`updated_at = $${paramIndex++}`);
    values.push(now);

    values.push(todoId);
    values.push(householdId);

    const result = await this.pool.query<{
      id: string;
      household_id: string;
      title: string;
      description: string | null;
      priority: CaregiverTodoPriority;
      status: CaregiverTodoStatus;
      assigned_to: string | null;
      due_date: string | Date | null;
      completed_at: string | Date | null;
      completed_by: string | null;
      last_nudged_at: string | Date | null;
      nudge_count: number;
      created_at: string | Date;
      updated_at: string | Date;
      created_by: string;
    }>(
      `UPDATE caregiver_todos
       SET ${updates.join(', ')}
       WHERE id = $${paramIndex++} AND household_id = $${paramIndex++}
       RETURNING id, household_id, title, description, priority, status, assigned_to,
                 due_date, completed_at, completed_by, last_nudged_at, nudge_count,
                 created_at, updated_at, created_by`,
      values,
    );

    const row = result.rows[0];
    if (!row) {
      throw new NotFoundError('Caregiver todo not found.');
    }

    return mapCaregiverTodo(row);
  }

  async deleteCaregiverTodo(todoId: string, householdId: string): Promise<void> {
    const result = await this.pool.query(
      `DELETE FROM caregiver_todos
       WHERE id = $1 AND household_id = $2`,
      [todoId, householdId],
    );

    if (result.rowCount === 0) {
      throw new NotFoundError('Caregiver todo not found.');
    }
  }

  async completeCaregiverTodo(todoId: string, householdId: string, completedBy: string): Promise<CaregiverTodo> {
    const now = nowIso();

    const result = await this.pool.query<{
      id: string;
      household_id: string;
      title: string;
      description: string | null;
      priority: CaregiverTodoPriority;
      status: CaregiverTodoStatus;
      assigned_to: string | null;
      due_date: string | Date | null;
      completed_at: string | Date | null;
      completed_by: string | null;
      last_nudged_at: string | Date | null;
      nudge_count: number;
      created_at: string | Date;
      updated_at: string | Date;
      created_by: string;
    }>(
      `UPDATE caregiver_todos
       SET status = 'completed', completed_at = $3, completed_by = $4, updated_at = $5
       WHERE id = $1 AND household_id = $2
       RETURNING id, household_id, title, description, priority, status, assigned_to,
                 due_date, completed_at, completed_by, last_nudged_at, nudge_count,
                 created_at, updated_at, created_by`,
      [todoId, householdId, now, completedBy, now],
    );

    const row = result.rows[0];
    if (!row) {
      throw new NotFoundError('Caregiver todo not found.');
    }

    return mapCaregiverTodo(row);
  }

  async nudgeCaregiverTodo(todoId: string, householdId: string): Promise<CaregiverTodo> {
    const now = nowIso();

    const result = await this.pool.query<{
      id: string;
      household_id: string;
      title: string;
      description: string | null;
      priority: CaregiverTodoPriority;
      status: CaregiverTodoStatus;
      assigned_to: string | null;
      due_date: string | Date | null;
      completed_at: string | Date | null;
      completed_by: string | null;
      last_nudged_at: string | Date | null;
      nudge_count: number;
      created_at: string | Date;
      updated_at: string | Date;
      created_by: string;
    }>(
      `UPDATE caregiver_todos
       SET last_nudged_at = $3, nudge_count = nudge_count + 1, updated_at = $3
       WHERE id = $1 AND household_id = $2
       RETURNING id, household_id, title, description, priority, status, assigned_to,
                 due_date, completed_at, completed_by, last_nudged_at, nudge_count,
                 created_at, updated_at, created_by`,
      [todoId, householdId, now],
    );

    const row = result.rows[0];
    if (!row) {
      throw new NotFoundError('Caregiver todo not found.');
    }

    return mapCaregiverTodo(row);
  }

  async addCaregiverTodoComment(input: { todoId: string; authorId: string; content: string }): Promise<CaregiverTodoComment> {
    const id = randomUUID();
    const now = nowIso();

    const result = await this.pool.query<{
      id: string;
      todo_id: string;
      author_id: string;
      content: string;
      created_at: string | Date;
    }>(
      `INSERT INTO caregiver_todo_comments (id, todo_id, author_id, content, created_at)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, todo_id, author_id, content, created_at`,
      [id, input.todoId, input.authorId, input.content, now],
    );

    const row = result.rows[0];
    if (!row) {
      throw new NotFoundError('Failed to create caregiver todo comment.');
    }

    return mapCaregiverTodoComment(row);
  }
}
