import { randomUUID } from 'node:crypto';
import type { Pool } from 'pg';
import type { CreateTextScreenInput, TextScreen, UpdateTextScreenInput } from '../../../domain/entities/TextScreen.js';
import {
  NotFoundError,
  ValidationError,
} from '../../../domain/errors/index.js';
import {
  nowIso,
  toIso,
} from './helpers.js';

export class PostgresTextScreenRepository {
  constructor(protected readonly pool: Pool) {}

  async listTextScreens(tabletId: string, householdId: string): Promise<TextScreen[]> {
    const result = await this.pool.query<{
      id: string;
      tablet_id: string;
      household_id: string;
      title: string;
      body: string | null;
      display_order: number;
      font_family: 'sans-serif' | 'serif' | 'monospace';
      font_size: 'small' | 'medium' | 'large' | 'xlarge';
      text_color: string;
      text_align: 'left' | 'center' | 'right';
      background_type: 'solid' | 'gradient';
      background_color: string;
      background_color_end: string | null;
      gradient_direction: 'to-bottom' | 'to-right' | 'to-bottom-right';
      icon: string | null;
      animation: 'none' | 'fade-in' | 'slide-up' | 'zoom-in';
      created_at: string | Date;
      created_by: string;
      updated_at: string | Date | null;
    }>(
      `SELECT id, tablet_id, household_id, title, body, display_order, font_family, font_size,
              text_color, text_align, background_type, background_color, background_color_end,
              gradient_direction, icon, animation, created_at, created_by, updated_at
       FROM text_screens
       WHERE tablet_id = $1 AND household_id = $2
       ORDER BY display_order ASC, created_at ASC`,
      [tabletId, householdId],
    );

    return result.rows.map(row => ({
      id: row.id,
      tabletId: row.tablet_id,
      householdId: row.household_id,
      title: row.title,
      body: row.body,
      order: row.display_order,
      fontFamily: row.font_family,
      fontSize: row.font_size,
      textColor: row.text_color,
      textAlign: row.text_align,
      backgroundType: row.background_type,
      backgroundColor: row.background_color,
      backgroundColorEnd: row.background_color_end,
      gradientDirection: row.gradient_direction,
      icon: row.icon,
      animation: row.animation,
      createdAt: toIso(row.created_at),
      createdBy: row.created_by,
      updatedAt: row.updated_at ? toIso(row.updated_at) : null,
    }));
  }

  async getTextScreenById(textScreenId: string, tabletId: string, householdId: string): Promise<TextScreen | null> {
    const result = await this.pool.query<{
      id: string;
      tablet_id: string;
      household_id: string;
      title: string;
      body: string | null;
      display_order: number;
      font_family: 'sans-serif' | 'serif' | 'monospace';
      font_size: 'small' | 'medium' | 'large' | 'xlarge';
      text_color: string;
      text_align: 'left' | 'center' | 'right';
      background_type: 'solid' | 'gradient';
      background_color: string;
      background_color_end: string | null;
      gradient_direction: 'to-bottom' | 'to-right' | 'to-bottom-right';
      icon: string | null;
      animation: 'none' | 'fade-in' | 'slide-up' | 'zoom-in';
      created_at: string | Date;
      created_by: string;
      updated_at: string | Date | null;
    }>(
      `SELECT id, tablet_id, household_id, title, body, display_order, font_family, font_size,
              text_color, text_align, background_type, background_color, background_color_end,
              gradient_direction, icon, animation, created_at, created_by, updated_at
       FROM text_screens
       WHERE id = $1 AND tablet_id = $2 AND household_id = $3
       LIMIT 1`,
      [textScreenId, tabletId, householdId],
    );

    const row = result.rows[0];
    if (!row) {
      return null;
    }

    return {
      id: row.id,
      tabletId: row.tablet_id,
      householdId: row.household_id,
      title: row.title,
      body: row.body,
      order: row.display_order,
      fontFamily: row.font_family,
      fontSize: row.font_size,
      textColor: row.text_color,
      textAlign: row.text_align,
      backgroundType: row.background_type,
      backgroundColor: row.background_color,
      backgroundColorEnd: row.background_color_end,
      gradientDirection: row.gradient_direction,
      icon: row.icon,
      animation: row.animation,
      createdAt: toIso(row.created_at),
      createdBy: row.created_by,
      updatedAt: row.updated_at ? toIso(row.updated_at) : null,
    };
  }

  async createTextScreen(input: CreateTextScreenInput): Promise<TextScreen> {
    const id = randomUUID();
    const now = nowIso();
    const fontFamily = input.fontFamily || 'sans-serif';
    const fontSize = input.fontSize || 'medium';
    const textColor = input.textColor || '#1E293B';
    const textAlign = input.textAlign || 'center';
    const backgroundType = input.backgroundType || 'solid';
    const backgroundColor = input.backgroundColor || '#FFFFFF';
    const backgroundColorEnd = input.backgroundColorEnd ?? null;
    const gradientDirection = input.gradientDirection || 'to-bottom';
    const icon = input.icon ?? null;
    const animation = input.animation || 'none';
    const displayOrder = input.order ?? await this.countTextScreens(input.tabletId, input.householdId);

    const result = await this.pool.query<{
      id: string;
      tablet_id: string;
      household_id: string;
      title: string;
      body: string | null;
      display_order: number;
      font_family: 'sans-serif' | 'serif' | 'monospace';
      font_size: 'small' | 'medium' | 'large' | 'xlarge';
      text_color: string;
      text_align: 'left' | 'center' | 'right';
      background_type: 'solid' | 'gradient';
      background_color: string;
      background_color_end: string | null;
      gradient_direction: 'to-bottom' | 'to-right' | 'to-bottom-right';
      icon: string | null;
      animation: 'none' | 'fade-in' | 'slide-up' | 'zoom-in';
      created_at: string | Date;
      created_by: string;
      updated_at: string | Date | null;
    }>(
      `INSERT INTO text_screens (
         id, tablet_id, household_id, title, body, display_order, font_family, font_size,
         text_color, text_align, background_type, background_color, background_color_end,
         gradient_direction, icon, animation, created_at, created_by
       )
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18)
       RETURNING id, tablet_id, household_id, title, body, display_order, font_family, font_size,
                 text_color, text_align, background_type, background_color, background_color_end,
                 gradient_direction, icon, animation, created_at, created_by, updated_at`,
      [
        id,
        input.tabletId,
        input.householdId,
        input.title,
        input.body ?? null,
        displayOrder,
        fontFamily,
        fontSize,
        textColor,
        textAlign,
        backgroundType,
        backgroundColor,
        backgroundColorEnd,
        gradientDirection,
        icon,
        animation,
        now,
        input.createdBy,
      ],
    );

    const row = result.rows[0];
    if (!row) {
      throw new NotFoundError('Failed to create text screen.');
    }

    return {
      id: row.id,
      tabletId: row.tablet_id,
      householdId: row.household_id,
      title: row.title,
      body: row.body,
      order: row.display_order,
      fontFamily: row.font_family,
      fontSize: row.font_size,
      textColor: row.text_color,
      textAlign: row.text_align,
      backgroundType: row.background_type,
      backgroundColor: row.background_color,
      backgroundColorEnd: row.background_color_end,
      gradientDirection: row.gradient_direction,
      icon: row.icon,
      animation: row.animation,
      createdAt: toIso(row.created_at),
      createdBy: row.created_by,
      updatedAt: row.updated_at ? toIso(row.updated_at) : null,
    };
  }

  async updateTextScreen(textScreenId: string, tabletId: string, householdId: string, input: UpdateTextScreenInput): Promise<TextScreen> {
    const updates: string[] = [];
    const values: unknown[] = [];
    let paramIndex = 1;

    if (input.title !== undefined) {
      updates.push(`title = $${paramIndex++}`);
      values.push(input.title);
    }
    if (input.body !== undefined) {
      updates.push(`body = $${paramIndex++}`);
      values.push(input.body);
    }
    if (input.order !== undefined) {
      updates.push(`display_order = $${paramIndex++}`);
      values.push(input.order);
    }
    if (input.fontFamily !== undefined) {
      updates.push(`font_family = $${paramIndex++}`);
      values.push(input.fontFamily);
    }
    if (input.fontSize !== undefined) {
      updates.push(`font_size = $${paramIndex++}`);
      values.push(input.fontSize);
    }
    if (input.textColor !== undefined) {
      updates.push(`text_color = $${paramIndex++}`);
      values.push(input.textColor);
    }
    if (input.textAlign !== undefined) {
      updates.push(`text_align = $${paramIndex++}`);
      values.push(input.textAlign);
    }
    if (input.backgroundType !== undefined) {
      updates.push(`background_type = $${paramIndex++}`);
      values.push(input.backgroundType);
    }
    if (input.backgroundColor !== undefined) {
      updates.push(`background_color = $${paramIndex++}`);
      values.push(input.backgroundColor);
    }
    if (input.backgroundColorEnd !== undefined) {
      updates.push(`background_color_end = $${paramIndex++}`);
      values.push(input.backgroundColorEnd);
    }
    if (input.gradientDirection !== undefined) {
      updates.push(`gradient_direction = $${paramIndex++}`);
      values.push(input.gradientDirection);
    }
    if (input.icon !== undefined) {
      updates.push(`icon = $${paramIndex++}`);
      values.push(input.icon);
    }
    if (input.animation !== undefined) {
      updates.push(`animation = $${paramIndex++}`);
      values.push(input.animation);
    }

    if (updates.length === 0) {
      throw new ValidationError('No fields to update.');
    }

    const now = nowIso();
    updates.push(`updated_at = $${paramIndex++}`);
    values.push(now);

    values.push(textScreenId);
    values.push(tabletId);
    values.push(householdId);

    const result = await this.pool.query<{
      id: string;
      tablet_id: string;
      household_id: string;
      title: string;
      body: string | null;
      display_order: number;
      font_family: 'sans-serif' | 'serif' | 'monospace';
      font_size: 'small' | 'medium' | 'large' | 'xlarge';
      text_color: string;
      text_align: 'left' | 'center' | 'right';
      background_type: 'solid' | 'gradient';
      background_color: string;
      background_color_end: string | null;
      gradient_direction: 'to-bottom' | 'to-right' | 'to-bottom-right';
      icon: string | null;
      animation: 'none' | 'fade-in' | 'slide-up' | 'zoom-in';
      created_at: string | Date;
      created_by: string;
      updated_at: string | Date | null;
    }>(
      `UPDATE text_screens
       SET ${updates.join(', ')}
       WHERE id = $${paramIndex++} AND tablet_id = $${paramIndex++} AND household_id = $${paramIndex++}
       RETURNING id, tablet_id, household_id, title, body, display_order, font_family, font_size,
                 text_color, text_align, background_type, background_color, background_color_end,
                 gradient_direction, icon, animation, created_at, created_by, updated_at`,
      values,
    );

    const row = result.rows[0];
    if (!row) {
      throw new NotFoundError('Text screen not found.');
    }

    return {
      id: row.id,
      tabletId: row.tablet_id,
      householdId: row.household_id,
      title: row.title,
      body: row.body,
      order: row.display_order,
      fontFamily: row.font_family,
      fontSize: row.font_size,
      textColor: row.text_color,
      textAlign: row.text_align,
      backgroundType: row.background_type,
      backgroundColor: row.background_color,
      backgroundColorEnd: row.background_color_end,
      gradientDirection: row.gradient_direction,
      icon: row.icon,
      animation: row.animation,
      createdAt: toIso(row.created_at),
      createdBy: row.created_by,
      updatedAt: row.updated_at ? toIso(row.updated_at) : null,
    };
  }

  async deleteTextScreen(textScreenId: string, tabletId: string, householdId: string): Promise<void> {
    const result = await this.pool.query(
      `DELETE FROM text_screens
       WHERE id = $1 AND tablet_id = $2 AND household_id = $3`,
      [textScreenId, tabletId, householdId],
    );

    if (result.rowCount === 0) {
      throw new NotFoundError('Text screen not found.');
    }
  }

  async countTextScreens(tabletId: string, householdId: string): Promise<number> {
    const result = await this.pool.query<{ count: string }>(
      `SELECT COUNT(*) AS count
       FROM text_screens
       WHERE tablet_id = $1 AND household_id = $2`,
      [tabletId, householdId],
    );

    return parseInt(result.rows[0]?.count || '0', 10);
  }
}
