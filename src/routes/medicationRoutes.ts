/**
 * Public Medication Routes
 * 
 * These routes are truly public (no authentication required).
 * Used as CORS proxy for medication autocomplete from mobile app.
 * Exempted from authentication in src/plugins/authContext.ts
 */

import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { MedicationAutocompleteUseCase } from '../domain/usecases/MedicationAutocompleteUseCase.js';

// Validation schemas
const autocompleteQuerySchema = z.object({
  term: z.string().min(2, 'Term must be at least 2 characters').max(100, 'Term must not exceed 100 characters'),
  locale: z.enum(['en', 'fr']).default('en'),
});

const errorResponseSchema = {
  type: 'object',
  properties: {
    status: { type: 'string', enum: ['error'] },
    message: { type: 'string' },
  },
  required: ['status', 'message'],
};

export function registerPublicMedicationRoutes(fastify: FastifyInstance): void {
  const medicationAutocompleteUseCase = new MedicationAutocompleteUseCase();

  // GET /v1/medications/autocomplete - Public medication autocomplete (no auth required)
  fastify.get(
    '/v1/medications/autocomplete',
    {
      schema: {
        tags: ['Medications'],
        description: 'Autocomplete medication names from French or RxNorm APIs',
        querystring: {
          type: 'object',
          properties: {
            term: { 
              type: 'string', 
              minLength: 2, 
              maxLength: 100,
              description: 'Search term (minimum 2 characters)',
            },
            locale: { 
              type: 'string', 
              enum: ['en', 'fr'],
              default: 'en',
              description: 'Locale for medication database (fr=French, en=English/RxNorm)',
            },
          },
          required: ['term'],
        },
        response: {
          200: {
            type: 'object',
            properties: {
              status: { type: 'string', enum: ['success'] },
              data: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    label: { type: 'string' },
                    value: { type: 'string' },
                    id: { type: 'string' },
                  },
                  required: ['label', 'value', 'id'],
                },
              },
            },
            required: ['status', 'data'],
          },
          400: errorResponseSchema,
          500: errorResponseSchema,
        },
      },
    },
    async (request, reply) => {
      const queryResult = autocompleteQuerySchema.safeParse(request.query);

      if (!queryResult.success) {
        const firstError = queryResult.error.issues[0];
        return reply.status(400).send({
          status: 'error',
          message: firstError?.message || 'Invalid query parameters',
        });
      }

      // Log public request (no auth required for this endpoint)
      console.log(`[MedicationAutocomplete] Public search for "${queryResult.data.term}" (locale: ${queryResult.data.locale})`);

      try {
        const suggestions = await medicationAutocompleteUseCase.execute({
          term: queryResult.data.term,
          locale: queryResult.data.locale,
        });

        return reply.status(200).send({
          status: 'success',
          data: suggestions,
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unexpected error';
        
        // Validation errors (term length) → 400
        if (message.includes('characters')) {
          return reply.status(400).send({
            status: 'error',
            message,
          });
        }

        // Other errors → 500
        console.error(`[MedicationRoutes] Autocomplete failed:`, error);
        return reply.status(500).send({
          status: 'error',
          message: 'Failed to fetch medication suggestions',
        });
      }
    },
  );
}
