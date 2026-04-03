import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import type { HouseholdRepository } from '../../../domain/repositories/HouseholdRepository.js';
import type { JournalEntryRepository } from '../../../domain/repositories/JournalEntryRepository.js';
import type { GenerateHouseholdReportUseCase } from '../../../domain/usecases/reports/GenerateHouseholdReportUseCase.js';
import type { GenerateWeeklySummaryUseCase } from '../../../domain/usecases/reports/GenerateWeeklySummaryUseCase.js';
import { paramsSchema } from '../householdSchemas.js';
import { getRequesterContext } from '../utils.js';
import { handleDomainError } from '../../errorHandler.js';
import { logAudit } from '../auditHelper.js';

const pdfQuerySchema = z.object({
  fromDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  toDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

export function registerReportRoutes(
  fastify: FastifyInstance,
  repository: HouseholdRepository,
  deps: {
    generateHouseholdReportUseCase: GenerateHouseholdReportUseCase;
    generateWeeklySummaryUseCase: GenerateWeeklySummaryUseCase;
  },
): void {
  // GET /v1/households/:householdId/reports/pdf?fromDate=YYYY-MM-DD&toDate=YYYY-MM-DD
  fastify.get(
    '/v1/households/:householdId/reports/pdf',
    async (request, reply) => {
      const paramsResult = paramsSchema.safeParse(request.params);
      const queryResult = pdfQuerySchema.safeParse(request.query);

      if (!paramsResult.success || !queryResult.success) {
        return reply.status(400).send({ status: 'error', message: 'Invalid request. Provide fromDate and toDate as YYYY-MM-DD.' });
      }

      const { householdId } = paramsResult.data;
      const { fromDate, toDate } = queryResult.data;
      const requester = getRequesterContext(request);

      try {
        const pdfBuffer = await deps.generateHouseholdReportUseCase.execute({
          householdId,
          requesterUserId: requester.userId,
          fromDate,
          toDate,
        });

        logAudit(repository, request, householdId, 'create_household', null, { feature: 'pdf_export' });

        return reply
          .header('Content-Type', 'application/pdf')
          .header('Content-Disposition', `attachment; filename="rapport-foyer-${fromDate}-${toDate}.pdf"`)
          .send(pdfBuffer);
      } catch (error) {
        return handleDomainError(error, reply);
      }
    },
  );

  // GET /v1/households/:householdId/reports/weekly-summary
  fastify.get(
    '/v1/households/:householdId/reports/weekly-summary',
    async (request, reply) => {
      const paramsResult = paramsSchema.safeParse(request.params);
      if (!paramsResult.success) {
        return reply.status(400).send({ status: 'error', message: 'Invalid request.' });
      }

      const { householdId } = paramsResult.data;
      const requester = getRequesterContext(request);

      try {
        const summary = await deps.generateWeeklySummaryUseCase.execute({
          householdId,
        });

        return reply.send({
          status: 'success',
          data: summary,
        });
      } catch (error) {
        return handleDomainError(error, reply);
      }
    },
  );
}
