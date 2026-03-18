import { randomUUID } from 'node:crypto';
import type { Pool } from 'pg';
import type { CreatePhotoInput, CreatePhotoScreenInput, Photo, PhotoScreen, PhotoScreenWithPhotos, UpdatePhotoInput, UpdatePhotoScreenInput } from '../../../domain/entities/PhotoScreen.js';
import {
  NotFoundError,
  ValidationError,
} from '../../../domain/errors/index.js';
import {
  nowIso,
  toIso,
} from './helpers.js';

export class PostgresPhotoScreenRepository {
  constructor(protected readonly pool: Pool) {}

  async listPhotoScreens(tabletId: string, householdId: string): Promise<PhotoScreenWithPhotos[]> {
    // Fetch all photo screens for the tablet
    const screensResult = await this.pool.query<{
      id: string;
      tablet_id: string;
      household_id: string;
      name: string;
      display_order: number;
      display_mode: 'slideshow' | 'mosaic' | 'single';
      slideshow_duration: number;
      slideshow_transition: 'fade' | 'slide' | 'none';
      slideshow_order: 'sequential' | 'random';
      show_captions: boolean;
      created_at: string | Date;
      created_by: string;
      updated_at: string | Date | null;
    }>(
      `SELECT id, tablet_id, household_id, name, display_order, display_mode, slideshow_duration,
              slideshow_transition, slideshow_order, show_captions,
              created_at, created_by, updated_at
       FROM photo_screens
       WHERE tablet_id = $1 AND household_id = $2
       ORDER BY display_order ASC, created_at ASC`,
      [tabletId, householdId],
    );

    // Fetch all photos for these screens
    const screenIds = screensResult.rows.map(row => row.id);
    let photosMap: Map<string, Photo[]> = new Map();

    if (screenIds.length > 0) {
      const photosResult = await this.pool.query<{
        id: string;
        photo_screen_id: string;
        url: string;
        caption: string | null;
        display_order: number;
        uploaded_at: string | Date;
        updated_at: string | Date | null;
      }>(
        `SELECT id, photo_screen_id, url, caption, display_order, uploaded_at, updated_at
         FROM photos
         WHERE photo_screen_id = ANY($1)
         ORDER BY display_order ASC`,
        [screenIds],
      );

      // Group photos by screen_id
      for (const row of photosResult.rows) {
        const photo: Photo = {
          id: row.id,
          photoScreenId: row.photo_screen_id,
          url: row.url,
          caption: row.caption,
          order: row.display_order,
          uploadedAt: toIso(row.uploaded_at),
          updatedAt: row.updated_at ? toIso(row.updated_at) : null,
        };
        if (!photosMap.has(row.photo_screen_id)) {
          photosMap.set(row.photo_screen_id, []);
        }
        photosMap.get(row.photo_screen_id)!.push(photo);
      }
    }

    // Combine screens with their photos
    return screensResult.rows.map(row => ({
      id: row.id,
      tabletId: row.tablet_id,
      householdId: row.household_id,
      name: row.name,
      order: row.display_order,
      displayMode: row.display_mode,
      slideshowDuration: row.slideshow_duration,
      slideshowTransition: row.slideshow_transition,
      slideshowOrder: row.slideshow_order,
      showCaptions: row.show_captions,
      createdAt: toIso(row.created_at),
      createdBy: row.created_by,
      updatedAt: row.updated_at ? toIso(row.updated_at) : null,
      photos: photosMap.get(row.id) || [],
    }));
  }

  async getPhotoScreenById(photoScreenId: string, tabletId: string, householdId: string): Promise<PhotoScreenWithPhotos | null> {
    const screenResult = await this.pool.query<{
      id: string;
      tablet_id: string;
      household_id: string;
      name: string;
      display_order: number;
      display_mode: 'slideshow' | 'mosaic' | 'single';
      slideshow_duration: number;
      slideshow_transition: 'fade' | 'slide' | 'none';
      slideshow_order: 'sequential' | 'random';
      show_captions: boolean;
      created_at: string | Date;
      created_by: string;
      updated_at: string | Date | null;
    }>(
      `SELECT id, tablet_id, household_id, name, display_order, display_mode, slideshow_duration,
              slideshow_transition, slideshow_order, show_captions,
              created_at, created_by, updated_at
       FROM photo_screens
       WHERE id = $1 AND tablet_id = $2 AND household_id = $3
       LIMIT 1`,
      [photoScreenId, tabletId, householdId],
    );

    const row = screenResult.rows[0];
    if (!row) {
      return null;
    }

    // Fetch photos for this screen
    const photosResult = await this.pool.query<{
      id: string;
      photo_screen_id: string;
      url: string;
      caption: string | null;
      display_order: number;
      uploaded_at: string | Date;
      updated_at: string | Date | null;
    }>(
      `SELECT id, photo_screen_id, url, caption, display_order, uploaded_at, updated_at
       FROM photos
       WHERE photo_screen_id = $1
       ORDER BY display_order ASC`,
      [photoScreenId],
    );

    const photos: Photo[] = photosResult.rows.map(photoRow => ({
      id: photoRow.id,
      photoScreenId: photoRow.photo_screen_id,
      url: photoRow.url,
      caption: photoRow.caption,
      order: photoRow.display_order,
      uploadedAt: toIso(photoRow.uploaded_at),
      updatedAt: photoRow.updated_at ? toIso(photoRow.updated_at) : null,
    }));

    return {
      id: row.id,
      tabletId: row.tablet_id,
      householdId: row.household_id,
      name: row.name,
      order: row.display_order,
      displayMode: row.display_mode,
      slideshowDuration: row.slideshow_duration,
      slideshowTransition: row.slideshow_transition,
      slideshowOrder: row.slideshow_order,
      showCaptions: row.show_captions,
      createdAt: toIso(row.created_at),
      createdBy: row.created_by,
      updatedAt: row.updated_at ? toIso(row.updated_at) : null,
      photos,
    };
  }

  async createPhotoScreen(input: CreatePhotoScreenInput): Promise<PhotoScreen> {
    const id = randomUUID();
    const now = nowIso();
    const displayMode = input.displayMode || 'slideshow';
    const slideshowDuration = input.slideshowDuration || 5;
    const slideshowTransition = input.slideshowTransition || 'fade';
    const slideshowOrder = input.slideshowOrder || 'sequential';
    const showCaptions = input.showCaptions ?? false;
    const displayOrder = input.order ?? await this.countPhotoScreens(input.tabletId, input.householdId);

    const result = await this.pool.query<{
      id: string;
      tablet_id: string;
      household_id: string;
      name: string;
      display_order: number;
      display_mode: 'slideshow' | 'mosaic' | 'single';
      slideshow_duration: number;
      slideshow_transition: 'fade' | 'slide' | 'none';
      slideshow_order: 'sequential' | 'random';
      show_captions: boolean;
      created_at: string | Date;
      created_by: string;
      updated_at: string | Date | null;
    }>(
      `INSERT INTO photo_screens (
         id, tablet_id, household_id, name, display_order, display_mode, slideshow_duration,
         slideshow_transition, slideshow_order, show_captions, created_at, created_by
       )
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
       RETURNING id, tablet_id, household_id, name, display_order, display_mode, slideshow_duration,
                 slideshow_transition, slideshow_order, show_captions,
                 created_at, created_by, updated_at`,
      [
        id,
        input.tabletId,
        input.householdId,
        input.name,
        displayOrder,
        displayMode,
        slideshowDuration,
        slideshowTransition,
        slideshowOrder,
        showCaptions,
        now,
        input.createdBy,
      ],
    );

    const row = result.rows[0];
    if (!row) {
      throw new NotFoundError('Failed to create photo screen.');
    }

    return {
      id: row.id,
      tabletId: row.tablet_id,
      householdId: row.household_id,
      name: row.name,
      order: row.display_order,
      displayMode: row.display_mode,
      slideshowDuration: row.slideshow_duration,
      slideshowTransition: row.slideshow_transition,
      slideshowOrder: row.slideshow_order,
      showCaptions: row.show_captions,
      createdAt: toIso(row.created_at),
      createdBy: row.created_by,
      updatedAt: row.updated_at ? toIso(row.updated_at) : null,
    };
  }

  async updatePhotoScreen(photoScreenId: string, tabletId: string, householdId: string, input: UpdatePhotoScreenInput): Promise<PhotoScreen> {
    const updates: string[] = [];
    const values: unknown[] = [];
    let paramIndex = 1;

    if (input.name !== undefined) {
      updates.push(`name = $${paramIndex++}`);
      values.push(input.name);
    }
    if (input.order !== undefined) {
      updates.push(`display_order = $${paramIndex++}`);
      values.push(input.order);
    }
    if (input.displayMode !== undefined) {
      updates.push(`display_mode = $${paramIndex++}`);
      values.push(input.displayMode);
    }
    if (input.slideshowDuration !== undefined) {
      updates.push(`slideshow_duration = $${paramIndex++}`);
      values.push(input.slideshowDuration);
    }
    if (input.slideshowTransition !== undefined) {
      updates.push(`slideshow_transition = $${paramIndex++}`);
      values.push(input.slideshowTransition);
    }
    if (input.slideshowOrder !== undefined) {
      updates.push(`slideshow_order = $${paramIndex++}`);
      values.push(input.slideshowOrder);
    }
    if (input.showCaptions !== undefined) {
      updates.push(`show_captions = $${paramIndex++}`);
      values.push(input.showCaptions);
    }

    if (updates.length === 0) {
      throw new ValidationError('No fields to update.');
    }

    const now = nowIso();
    updates.push(`updated_at = $${paramIndex++}`);
    values.push(now);

    values.push(photoScreenId);
    values.push(tabletId);
    values.push(householdId);

    const result = await this.pool.query<{
      id: string;
      tablet_id: string;
      household_id: string;
      name: string;
      display_order: number;
      display_mode: 'slideshow' | 'mosaic' | 'single';
      slideshow_duration: number;
      slideshow_transition: 'fade' | 'slide' | 'none';
      slideshow_order: 'sequential' | 'random';
      show_captions: boolean;
      created_at: string | Date;
      created_by: string;
      updated_at: string | Date | null;
    }>(
      `UPDATE photo_screens
       SET ${updates.join(', ')}
       WHERE id = $${paramIndex++} AND tablet_id = $${paramIndex++} AND household_id = $${paramIndex++}
       RETURNING id, tablet_id, household_id, name, display_order, display_mode, slideshow_duration,
                 slideshow_transition, slideshow_order, show_captions,
                 created_at, created_by, updated_at`,
      values,
    );

    const row = result.rows[0];
    if (!row) {
      throw new NotFoundError('Photo screen not found.');
    }

    return {
      id: row.id,
      tabletId: row.tablet_id,
      householdId: row.household_id,
      name: row.name,
      order: row.display_order,
      displayMode: row.display_mode,
      slideshowDuration: row.slideshow_duration,
      slideshowTransition: row.slideshow_transition,
      slideshowOrder: row.slideshow_order,
      showCaptions: row.show_captions,
      createdAt: toIso(row.created_at),
      createdBy: row.created_by,
      updatedAt: row.updated_at ? toIso(row.updated_at) : null,
    };
  }

  async deletePhotoScreen(photoScreenId: string, tabletId: string, householdId: string): Promise<void> {
    const result = await this.pool.query(
      `DELETE FROM photo_screens
       WHERE id = $1 AND tablet_id = $2 AND household_id = $3`,
      [photoScreenId, tabletId, householdId],
    );

    if (result.rowCount === 0) {
      throw new NotFoundError('Photo screen not found.');
    }
  }

  async countPhotoScreens(tabletId: string, householdId: string): Promise<number> {
    const result = await this.pool.query<{ count: string }>(
      `SELECT COUNT(*) AS count
       FROM photo_screens
       WHERE tablet_id = $1 AND household_id = $2`,
      [tabletId, householdId],
    );

    return parseInt(result.rows[0]?.count || '0', 10);
  }

  // Photos

  async listPhotos(photoScreenId: string, householdId: string): Promise<Photo[]> {
    const result = await this.pool.query<{
      id: string;
      photo_screen_id: string;
      url: string;
      caption: string | null;
      display_order: number;
      uploaded_at: string | Date;
      updated_at: string | Date | null;
    }>(
      `SELECT p.id, p.photo_screen_id, p.url, p.caption, p.display_order, p.uploaded_at, p.updated_at
       FROM photos p
       JOIN photo_screens ps ON ps.id = p.photo_screen_id
       WHERE p.photo_screen_id = $1 AND ps.household_id = $2
       ORDER BY p.display_order ASC`,
      [photoScreenId, householdId],
    );

    return result.rows.map(row => ({
      id: row.id,
      photoScreenId: row.photo_screen_id,
      url: row.url,
      caption: row.caption,
      order: row.display_order,
      uploadedAt: toIso(row.uploaded_at),
      updatedAt: row.updated_at ? toIso(row.updated_at) : null,
    }));
  }

  async getPhotoById(photoId: string, photoScreenId: string, householdId: string): Promise<Photo | null> {
    const result = await this.pool.query<{
      id: string;
      photo_screen_id: string;
      url: string;
      caption: string | null;
      display_order: number;
      uploaded_at: string | Date;
      updated_at: string | Date | null;
    }>(
      `SELECT p.id, p.photo_screen_id, p.url, p.caption, p.display_order, p.uploaded_at, p.updated_at
       FROM photos p
       JOIN photo_screens ps ON ps.id = p.photo_screen_id
       WHERE p.id = $1 AND p.photo_screen_id = $2 AND ps.household_id = $3
       LIMIT 1`,
      [photoId, photoScreenId, householdId],
    );

    const row = result.rows[0];
    if (!row) {
      return null;
    }

    return {
      id: row.id,
      photoScreenId: row.photo_screen_id,
      url: row.url,
      caption: row.caption,
      order: row.display_order,
      uploadedAt: toIso(row.uploaded_at),
      updatedAt: row.updated_at ? toIso(row.updated_at) : null,
    };
  }

  async createPhoto(input: CreatePhotoInput): Promise<Photo> {
    const id = randomUUID();
    const now = nowIso();

    const result = await this.pool.query<{
      id: string;
      photo_screen_id: string;
      url: string;
      caption: string | null;
      display_order: number;
      uploaded_at: string | Date;
      updated_at: string | Date | null;
    }>(
      `INSERT INTO photos (id, photo_screen_id, url, caption, display_order, uploaded_at)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id, photo_screen_id, url, caption, display_order, uploaded_at, updated_at`,
      [id, input.photoScreenId, input.url, input.caption ?? null, input.order, now],
    );

    const row = result.rows[0];
    if (!row) {
      throw new NotFoundError('Failed to create photo.');
    }

    return {
      id: row.id,
      photoScreenId: row.photo_screen_id,
      url: row.url,
      caption: row.caption,
      order: row.display_order,
      uploadedAt: toIso(row.uploaded_at),
      updatedAt: row.updated_at ? toIso(row.updated_at) : null,
    };
  }

  async updatePhoto(photoId: string, photoScreenId: string, householdId: string, input: UpdatePhotoInput): Promise<Photo> {
    const updates: string[] = [];
    const values: unknown[] = [];
    let paramIndex = 1;

    if (input.caption !== undefined) {
      updates.push(`caption = $${paramIndex++}`);
      values.push(input.caption);
    }
    if (input.order !== undefined) {
      updates.push(`display_order = $${paramIndex++}`);
      values.push(input.order);
    }

    if (updates.length === 0) {
      throw new ValidationError('No fields to update.');
    }

    const now = nowIso();
    updates.push(`updated_at = $${paramIndex++}`);
    values.push(now);

    values.push(photoId);
    values.push(photoScreenId);

    const result = await this.pool.query<{
      id: string;
      photo_screen_id: string;
      url: string;
      caption: string | null;
      display_order: number;
      uploaded_at: string | Date;
      updated_at: string | Date | null;
    }>(
      `UPDATE photos p
       SET ${updates.join(', ')}
       FROM photo_screens ps
       WHERE p.id = $${paramIndex++} AND p.photo_screen_id = $${paramIndex++} AND ps.id = p.photo_screen_id AND ps.household_id = $${paramIndex++}
       RETURNING p.id, p.photo_screen_id, p.url, p.caption, p.display_order, p.uploaded_at, p.updated_at`,
      [...values, householdId],
    );

    const row = result.rows[0];
    if (!row) {
      throw new NotFoundError('Photo not found.');
    }

    return {
      id: row.id,
      photoScreenId: row.photo_screen_id,
      url: row.url,
      caption: row.caption,
      order: row.display_order,
      uploadedAt: toIso(row.uploaded_at),
      updatedAt: row.updated_at ? toIso(row.updated_at) : null,
    };
  }

  async deletePhoto(photoId: string, photoScreenId: string, householdId: string): Promise<void> {
    const result = await this.pool.query(
      `DELETE FROM photos p
       USING photo_screens ps
       WHERE p.id = $1 AND p.photo_screen_id = $2 AND ps.id = p.photo_screen_id AND ps.household_id = $3`,
      [photoId, photoScreenId, householdId],
    );

    if (result.rowCount === 0) {
      throw new NotFoundError('Photo not found.');
    }
  }

  async countPhotos(photoScreenId: string): Promise<number> {
    const result = await this.pool.query<{ count: string }>(
      `SELECT COUNT(*) AS count
       FROM photos
       WHERE photo_screen_id = $1`,
      [photoScreenId],
    );

    return parseInt(result.rows[0]?.count || '0', 10);
  }

  async reorderPhotos(photoScreenId: string, householdId: string, photoOrders: Array<{ id: string; order: number }>): Promise<Photo[]> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');

      // Verify the photo screen exists and belongs to the household
      const screenCheck = await client.query(
        `SELECT id FROM photo_screens WHERE id = $1 AND household_id = $2`,
        [photoScreenId, householdId],
      );

      if (screenCheck.rowCount === 0) {
        throw new NotFoundError('Photo screen not found.');
      }

      const now = nowIso();

      // Update each photo's order
      for (const { id, order } of photoOrders) {
        await client.query(
          `UPDATE photos
           SET display_order = $2, updated_at = $3
           WHERE id = $1 AND photo_screen_id = $4`,
          [id, order, now, photoScreenId],
        );
      }

      await client.query('COMMIT');

      // Fetch and return the updated photos
      const result = await client.query<{
        id: string;
        photo_screen_id: string;
        url: string;
        caption: string | null;
        display_order: number;
        uploaded_at: string | Date;
        updated_at: string | Date | null;
      }>(
        `SELECT id, photo_screen_id, url, caption, display_order, uploaded_at, updated_at
         FROM photos
         WHERE photo_screen_id = $1
         ORDER BY display_order ASC`,
        [photoScreenId],
      );

      return result.rows.map(row => ({
        id: row.id,
        photoScreenId: row.photo_screen_id,
        url: row.url,
        caption: row.caption,
        order: row.display_order,
        uploadedAt: toIso(row.uploaded_at),
        updatedAt: row.updated_at ? toIso(row.updated_at) : null,
      }));
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }
}
