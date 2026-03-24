import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import type { HouseholdRepository } from '../../domain/repositories/HouseholdRepository.js';
import { RegisterWithEmailUseCase } from '../../domain/usecases/emailAuth/RegisterWithEmailUseCase.js';
import { LoginWithEmailUseCase } from '../../domain/usecases/emailAuth/LoginWithEmailUseCase.js';
import { RefreshEmailSessionUseCase } from '../../domain/usecases/emailAuth/RefreshEmailSessionUseCase.js';
import { handleDomainError } from '../errorHandler.js';

const registerBodySchema = z.object({
  email: z.string().email(),
  password: z.string().min(8).max(128),
  firstName: z.string().min(1).max(255),
  lastName: z.string().min(1).max(255),
});

const loginBodySchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

const refreshBodySchema = z.object({
  refreshToken: z.string().length(64),
});

const authResultSchema = {
  type: 'object',
  properties: {
    status: { type: 'string', enum: ['success'] },
    data: {
      type: 'object',
      properties: {
        userId: { type: 'string' },
        email: { type: 'string' },
        firstName: { type: 'string' },
        lastName: { type: 'string' },
        refreshToken: { type: 'string' },
      },
    },
  },
};

export function registerEmailAuthRoutes(
  fastify: FastifyInstance,
  repository: HouseholdRepository,
): void {
  // POST /v1/auth/email/register
  fastify.post(
    '/v1/auth/email/register',
    {
      schema: {
        tags: ['Email Auth'],
        body: {
          type: 'object',
          properties: {
            email: { type: 'string', format: 'email' },
            password: { type: 'string', minLength: 8, maxLength: 128 },
            firstName: { type: 'string', minLength: 1, maxLength: 255 },
            lastName: { type: 'string', minLength: 1, maxLength: 255 },
          },
          required: ['email', 'password', 'firstName', 'lastName'],
        },
        response: { 201: authResultSchema },
      },
    },
    async (request, reply) => {
      try {
        const body = registerBodySchema.parse(request.body);
        const useCase = new RegisterWithEmailUseCase(repository);
        const result = await useCase.execute(body);
        return reply.status(201).send({ status: 'success', data: result });
      } catch (error) {
        return handleDomainError(error, reply);
      }
    },
  );

  // POST /v1/auth/email/login
  fastify.post(
    '/v1/auth/email/login',
    {
      schema: {
        tags: ['Email Auth'],
        body: {
          type: 'object',
          properties: {
            email: { type: 'string', format: 'email' },
            password: { type: 'string', minLength: 1 },
          },
          required: ['email', 'password'],
        },
        response: { 200: authResultSchema },
      },
    },
    async (request, reply) => {
      try {
        const body = loginBodySchema.parse(request.body);
        const useCase = new LoginWithEmailUseCase(repository);
        const result = await useCase.execute(body);
        return reply.status(200).send({ status: 'success', data: result });
      } catch (error) {
        return handleDomainError(error, reply);
      }
    },
  );

  // POST /v1/auth/email/session/refresh
  fastify.post(
    '/v1/auth/email/session/refresh',
    {
      schema: {
        tags: ['Email Auth'],
        body: {
          type: 'object',
          properties: {
            refreshToken: { type: 'string', minLength: 64, maxLength: 64 },
          },
          required: ['refreshToken'],
        },
        response: { 200: authResultSchema },
      },
    },
    async (request, reply) => {
      try {
        const body = refreshBodySchema.parse(request.body);
        const useCase = new RefreshEmailSessionUseCase(repository);
        const result = await useCase.execute(body);
        return reply.status(200).send({ status: 'success', data: result });
      } catch (error) {
        return handleDomainError(error, reply);
      }
    },
  );
}
