import type { FastifyInstance } from 'fastify';
import type { z } from 'zod';
import { createHouseholdRepository } from '../../../data/repositories/createHouseholdRepository.js';
import { getRequesterContext } from '../utils.js';
import { requireUserAuth } from '../../../plugins/authContext.js';
import { CreateTextScreenUseCase } from '../../../domain/usecases/textScreens/CreateTextScreenUseCase.js';
import { ListTextScreensUseCase } from '../../../domain/usecases/textScreens/ListTextScreensUseCase.js';
import { GetTextScreenUseCase } from '../../../domain/usecases/textScreens/GetTextScreenUseCase.js';
import { UpdateTextScreenUseCase } from '../../../domain/usecases/textScreens/UpdateTextScreenUseCase.js';
import { DeleteTextScreenUseCase } from '../../../domain/usecases/textScreens/DeleteTextScreenUseCase.js';
import {
  createTextScreenSchema,
  updateTextScreenSchema,
} from './textScreenSchemas.js';
import { logAudit } from '../../households/auditHelper.js';

export async function textScreenRoutes(server: FastifyInstance) {
  const repository = createHouseholdRepository();

  /**
   * Create a new text screen
   * POST /v1/households/:householdId/display-tablets/:tabletId/text-screens
   */
  server.post<{
    Params: { householdId: string; tabletId: string };
    Body: z.infer<typeof createTextScreenSchema>;
  }>(
    '/households/:householdId/display-tablets/:tabletId/text-screens',
    {
      preHandler: requireUserAuth,
    },
    async (request, reply) => {
    const requester = getRequesterContext(request);
    const { householdId, tabletId } = request.params;

    const body = createTextScreenSchema.parse(request.body);

    const useCase = new CreateTextScreenUseCase(repository);
    const textScreen = await useCase.execute({
      householdId,
      tabletId,
      title: body.title,
      ...(body.body !== undefined && { body: body.body }),
      ...(body.order !== undefined && { order: body.order }),
      ...(body.fontFamily !== undefined && { fontFamily: body.fontFamily }),
      ...(body.fontSize !== undefined && { fontSize: body.fontSize }),
      ...(body.textColor !== undefined && { textColor: body.textColor }),
      ...(body.textAlign !== undefined && { textAlign: body.textAlign }),
      ...(body.backgroundType !== undefined && { backgroundType: body.backgroundType }),
      ...(body.backgroundColor !== undefined && { backgroundColor: body.backgroundColor }),
      ...(body.backgroundColorEnd !== undefined && { backgroundColorEnd: body.backgroundColorEnd }),
      ...(body.gradientDirection !== undefined && { gradientDirection: body.gradientDirection }),
      ...(body.icon !== undefined && { icon: body.icon }),
      ...(body.animation !== undefined && { animation: body.animation }),
      requester,
    });

    logAudit(repository, request, householdId, 'create_text_screen', textScreen.id, { title: body.title });

    return reply.code(201).send({
      success: true,
      data: textScreen,
    });
  });

  /**
   * List all text screens for a tablet
   * GET /v1/households/:householdId/display-tablets/:tabletId/text-screens
   */
  server.get<{
    Params: { householdId: string; tabletId: string };
  }>(
    '/households/:householdId/display-tablets/:tabletId/text-screens',
    {
      preHandler: requireUserAuth,
    },
    async (request, reply) => {
    const requester = getRequesterContext(request);
    const { householdId, tabletId } = request.params;

    const useCase = new ListTextScreensUseCase(repository);
    const textScreens = await useCase.execute({
      householdId,
      tabletId,
      requester,
    });

    return reply.send({
      success: true,
      data: textScreens,
    });
  });

  /**
   * Get a specific text screen
   * GET /v1/households/:householdId/display-tablets/:tabletId/text-screens/:screenId
   */
  server.get<{
    Params: { householdId: string; tabletId: string; screenId: string };
  }>(
    '/households/:householdId/display-tablets/:tabletId/text-screens/:screenId',
    {
      preHandler: requireUserAuth,
    },
    async (request, reply) => {
    const requester = getRequesterContext(request);
    const { householdId, tabletId, screenId } = request.params;

    const useCase = new GetTextScreenUseCase(repository);
    const textScreen = await useCase.execute({
      householdId,
      tabletId,
      textScreenId: screenId,
      requester,
    });

    return reply.send({
      success: true,
      data: textScreen,
    });
  });

  /**
   * Update a text screen
   * PUT /v1/households/:householdId/display-tablets/:tabletId/text-screens/:screenId
   */
  server.put<{
    Params: { householdId: string; tabletId: string; screenId: string };
    Body: z.infer<typeof updateTextScreenSchema>;
  }>(
    '/households/:householdId/display-tablets/:tabletId/text-screens/:screenId',
    {
      preHandler: requireUserAuth,
    },
    async (request, reply) => {
    const requester = getRequesterContext(request);
    const { householdId, tabletId, screenId } = request.params;

    const body = updateTextScreenSchema.parse(request.body);

    const useCase = new UpdateTextScreenUseCase(repository);
    const textScreen = await useCase.execute({
      householdId,
      tabletId,
      textScreenId: screenId,
      ...(body.title !== undefined && { title: body.title }),
      ...(body.body !== undefined && { body: body.body }),
      ...(body.order !== undefined && { order: body.order }),
      ...(body.fontFamily !== undefined && { fontFamily: body.fontFamily }),
      ...(body.fontSize !== undefined && { fontSize: body.fontSize }),
      ...(body.textColor !== undefined && { textColor: body.textColor }),
      ...(body.textAlign !== undefined && { textAlign: body.textAlign }),
      ...(body.backgroundType !== undefined && { backgroundType: body.backgroundType }),
      ...(body.backgroundColor !== undefined && { backgroundColor: body.backgroundColor }),
      ...(body.backgroundColorEnd !== undefined && { backgroundColorEnd: body.backgroundColorEnd }),
      ...(body.gradientDirection !== undefined && { gradientDirection: body.gradientDirection }),
      ...(body.icon !== undefined && { icon: body.icon }),
      ...(body.animation !== undefined && { animation: body.animation }),
      requester,
    });

    logAudit(repository, request, householdId, 'update_text_screen', screenId);

    return reply.send({
      success: true,
      data: textScreen,
    });
  });

  /**
   * Delete a text screen
   * DELETE /v1/households/:householdId/display-tablets/:tabletId/text-screens/:screenId
   */
  server.delete<{
    Params: { householdId: string; tabletId: string; screenId: string };
  }>(
    '/households/:householdId/display-tablets/:tabletId/text-screens/:screenId',
    {
      preHandler: requireUserAuth,
    },
    async (request, reply) => {
    const requester = getRequesterContext(request);
    const { householdId, tabletId, screenId } = request.params;

    const useCase = new DeleteTextScreenUseCase(repository);
    await useCase.execute({
      householdId,
      tabletId,
      textScreenId: screenId,
      requester,
    });

    logAudit(repository, request, householdId, 'delete_text_screen', screenId);

    return reply.send({
      success: true,
      message: 'Text screen deleted successfully',
    });
  });
}
