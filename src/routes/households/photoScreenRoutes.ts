import type { FastifyInstance } from 'fastify';
import type { z } from 'zod';
import multipart from '@fastify/multipart';
import { createHouseholdRepository } from '../../data/repositories/createHouseholdRepository.js';
import { createStorageService } from '../../data/services/storage/createStorageService.js';
import { getRequesterContext } from './utils.js';
import { CreatePhotoScreenUseCase } from '../../domain/usecases/photoScreens/CreatePhotoScreenUseCase.js';
import { UpdatePhotoScreenUseCase } from '../../domain/usecases/photoScreens/UpdatePhotoScreenUseCase.js';
import { DeletePhotoScreenUseCase } from '../../domain/usecases/photoScreens/DeletePhotoScreenUseCase.js';
import { ListPhotoScreensUseCase } from '../../domain/usecases/photoScreens/ListPhotoScreensUseCase.js';
import { GetPhotoScreenUseCase } from '../../domain/usecases/photoScreens/GetPhotoScreenUseCase.js';
import { UploadPhotoUseCase } from '../../domain/usecases/photos/UploadPhotoUseCase.js';
import { UpdatePhotoUseCase } from '../../domain/usecases/photos/UpdatePhotoUseCase.js';
import { DeletePhotoUseCase } from '../../domain/usecases/photos/DeletePhotoUseCase.js';
import { ReorderPhotosUseCase } from '../../domain/usecases/photos/ReorderPhotosUseCase.js';
import {
  createPhotoScreenSchema,
  updatePhotoScreenSchema,
  updatePhotoSchema,
  reorderPhotosSchema,
  photoScreenParamsSchema,
  photoParamsSchema,
} from './photoScreenSchemas.js';
import { MAX_PHOTO_SIZE_MB, MAX_PHOTO_CAPTION_LENGTH } from '../../domain/entities/PhotoScreen.js';

const MAX_FILE_SIZE = MAX_PHOTO_SIZE_MB * 1024 * 1024; // Convert to bytes

export async function photoScreenRoutes(server: FastifyInstance) {
  const repository = createHouseholdRepository();
  const storageService = createStorageService();

  // Register multipart plugin for file uploads
  await server.register(multipart, {
    limits: {
      fileSize: MAX_FILE_SIZE,
      files: 1,
    },
  });

  // Photo Screens endpoints

  /**
   * Create a new photo screen
   * POST /v1/households/:householdId/display-tablets/:tabletId/photo-screens
   */
  server.post<{
    Params: { householdId: string; tabletId: string };
    Body: z.infer<typeof createPhotoScreenSchema>;
  }>('/:householdId/display-tablets/:tabletId/photo-screens', async (request, reply) => {
    const requester = getRequesterContext(request);
    const { householdId, tabletId } = request.params;

    const body = createPhotoScreenSchema.parse(request.body);

    const useCase = new CreatePhotoScreenUseCase(repository);
    const photoScreen = await useCase.execute({
      householdId,
      tabletId,
      name: body.name,
      ...(body.displayMode !== undefined && { displayMode: body.displayMode }),
      ...(body.slideshowDuration !== undefined && { slideshowDuration: body.slideshowDuration }),
      ...(body.slideshowTransition !== undefined && { slideshowTransition: body.slideshowTransition }),
      ...(body.slideshowOrder !== undefined && { slideshowOrder: body.slideshowOrder }),
      ...(body.showCaptions !== undefined && { showCaptions: body.showCaptions }),
      requester,
    });

    return reply.code(201).send({
      success: true,
      data: photoScreen,
    });
  });

  /**
   * List all photo screens for a tablet
   * GET /v1/households/:householdId/display-tablets/:tabletId/photo-screens
   */
  server.get<{
    Params: { householdId: string; tabletId: string };
  }>('/:householdId/display-tablets/:tabletId/photo-screens', async (request, reply) => {
    const requester = getRequesterContext(request);
    const { householdId, tabletId } = request.params;

    const useCase = new ListPhotoScreensUseCase(repository);
    const photoScreens = await useCase.execute({
      householdId,
      tabletId,
      requester,
    });

    return reply.send({
      success: true,
      data: photoScreens,
    });
  });

  /**
   * Get a specific photo screen
   * GET /v1/households/:householdId/display-tablets/:tabletId/photo-screens/:screenId
   */
  server.get<{
    Params: { householdId: string; tabletId: string; screenId: string };
  }>('/:householdId/display-tablets/:tabletId/photo-screens/:screenId', async (request, reply) => {
    const requester = getRequesterContext(request);
    const { householdId, tabletId, screenId } = request.params;

    const useCase = new GetPhotoScreenUseCase(repository);
    const photoScreen = await useCase.execute({
      householdId,
      tabletId,
      photoScreenId: screenId,
      requester,
    });

    return reply.send({
      success: true,
      data: photoScreen,
    });
  });

  /**
   * Update a photo screen
   * PUT /v1/households/:householdId/display-tablets/:tabletId/photo-screens/:screenId
   */
  server.put<{
    Params: { householdId: string; tabletId: string; screenId: string };
    Body: z.infer<typeof updatePhotoScreenSchema>;
  }>('/:householdId/display-tablets/:tabletId/photo-screens/:screenId', async (request, reply) => {
    const requester = getRequesterContext(request);
    const { householdId, tabletId, screenId } = request.params;

    const body = updatePhotoScreenSchema.parse(request.body);

    const useCase = new UpdatePhotoScreenUseCase(repository);
    const photoScreen = await useCase.execute({
      householdId,
      tabletId,
      photoScreenId: screenId,
      ...(body.name !== undefined && { name: body.name }),
      ...(body.displayMode !== undefined && { displayMode: body.displayMode }),
      ...(body.slideshowDuration !== undefined && { slideshowDuration: body.slideshowDuration }),
      ...(body.slideshowTransition !== undefined && { slideshowTransition: body.slideshowTransition }),
      ...(body.slideshowOrder !== undefined && { slideshowOrder: body.slideshowOrder }),
      ...(body.showCaptions !== undefined && { showCaptions: body.showCaptions }),
      requester,
    });

    return reply.send({
      success: true,
      data: photoScreen,
    });
  });

  /**
   * Delete a photo screen
   * DELETE /v1/households/:householdId/display-tablets/:tabletId/photo-screens/:screenId
   */
  server.delete<{
    Params: { householdId: string; tabletId: string; screenId: string };
  }>('/:householdId/display-tablets/:tabletId/photo-screens/:screenId', async (request, reply) => {
    const requester = getRequesterContext(request);
    const { householdId, tabletId, screenId } = request.params;

    const useCase = new DeletePhotoScreenUseCase(repository, storageService);
    await useCase.execute({
      householdId,
      tabletId,
      photoScreenId: screenId,
      requester,
    });

    return reply.send({
      success: true,
      message: 'Photo screen deleted successfully',
    });
  });

  // Photos endpoints

  /**
   * Upload a photo to a photo screen
   * POST /v1/households/:householdId/display-tablets/:tabletId/photo-screens/:screenId/photos
   */
  server.post<{
    Params: { householdId: string; tabletId: string; screenId: string };
  }>('/:householdId/display-tablets/:tabletId/photo-screens/:screenId/photos', async (request, reply) => {
    const requester = getRequesterContext(request);
    const { householdId, tabletId, screenId } = request.params;

    // Handle multipart/form-data
    const data = await request.file();

    if (!data) {
      return reply.code(400).send({
        success: false,
        error: {
          code: 'MISSING_FILE',
          message: 'No file provided',
        },
      });
    }

    // Get file buffer
    const fileBuffer = await data.toBuffer();
    const mimeType = data.mimetype;

    // Parse form fields
    const fields = data.fields as any;
    const caption = fields.caption?.value as string | undefined;
    const order = fields.order ? parseInt(fields.order.value as string, 10) : 0;

    // Validate caption length
    if (caption && caption.length > MAX_PHOTO_CAPTION_LENGTH) {
      return reply.code(400).send({
        success: false,
        error: {
          code: 'CAPTION_TOO_LONG',
          message: `Caption must be ${MAX_PHOTO_CAPTION_LENGTH} characters or less`,
        },
      });
    }

    // Validate order
    if (isNaN(order) || order < 0 || order > 5) {
      return reply.code(400).send({
        success: false,
        error: {
          code: 'INVALID_ORDER',
          message: 'Order must be a number between 0 and 5',
        },
      });
    }

    const useCase = new UploadPhotoUseCase(repository, storageService);
    const photo = await useCase.execute({
      householdId,
      tabletId,
      photoScreenId: screenId,
      fileBuffer,
      mimeType,
      ...(caption !== undefined && { caption }),
      order,
      requester,
    });

    return reply.code(201).send({
      success: true,
      data: photo,
    });
  });

  /**
   * Update a photo's metadata
   * PUT /v1/households/:householdId/display-tablets/:tabletId/photo-screens/:screenId/photos/:photoId
   */
  server.put<{
    Params: { householdId: string; tabletId: string; screenId: string; photoId: string };
    Body: z.infer<typeof updatePhotoSchema>;
  }>('/:householdId/display-tablets/:tabletId/photo-screens/:screenId/photos/:photoId', async (request, reply) => {
    const requester = getRequesterContext(request);
    const { householdId, tabletId, screenId, photoId } = request.params;

    const body = updatePhotoSchema.parse(request.body);

    const useCase = new UpdatePhotoUseCase(repository);
    const photo = await useCase.execute({
      householdId,
      tabletId,
      photoScreenId: screenId,
      photoId,
      ...(body.caption !== undefined && { caption: body.caption }),
      ...(body.order !== undefined && { order: body.order }),
      requester,
    });

    return reply.send({
      success: true,
      data: photo,
    });
  });

  /**
   * Delete a photo
   * DELETE /v1/households/:householdId/display-tablets/:tabletId/photo-screens/:screenId/photos/:photoId
   */
  server.delete<{
    Params: { householdId: string; tabletId: string; screenId: string; photoId: string };
  }>('/:householdId/display-tablets/:tabletId/photo-screens/:screenId/photos/:photoId', async (request, reply) => {
    const requester = getRequesterContext(request);
    const { householdId, tabletId, screenId, photoId } = request.params;

    const useCase = new DeletePhotoUseCase(repository, storageService);
    await useCase.execute({
      householdId,
      tabletId,
      photoScreenId: screenId,
      photoId,
      requester,
    });

    return reply.send({
      success: true,
      message: 'Photo deleted successfully',
    });
  });

  /**
   * Reorder photos in a photo screen
   * PUT /v1/households/:householdId/display-tablets/:tabletId/photo-screens/:screenId/photos/reorder
   */
  server.put<{
    Params: { householdId: string; tabletId: string; screenId: string };
    Body: z.infer<typeof reorderPhotosSchema>;
  }>('/:householdId/display-tablets/:tabletId/photo-screens/:screenId/photos/reorder', async (request, reply) => {
    const requester = getRequesterContext(request);
    const { householdId, tabletId, screenId } = request.params;

    const body = reorderPhotosSchema.parse(request.body);

    const useCase = new ReorderPhotosUseCase(repository);
    const photos = await useCase.execute({
      householdId,
      tabletId,
      photoScreenId: screenId,
      photoOrders: body.photoOrders,
      requester,
    });

    return reply.send({
      success: true,
      data: {
        photos,
      },
    });
  });
}
