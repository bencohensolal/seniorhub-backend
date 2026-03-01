import type { FastifyReply } from 'fastify';
import {
  NotFoundError,
  ForbiddenError,
  UnauthorizedError,
  ValidationError,
  ConflictError,
  BusinessRuleError,
  DomainError,
} from '../domain/errors/index.js';

/**
 * Maps DomainErrors to appropriate HTTP status codes and sends error responses.
 * 
 * This centralizes error handling logic and eliminates the need for
 * manual error message parsing in route handlers.
 * 
 * @example
 * ```typescript
 * try {
 *   const result = await useCase.execute(input);
 *   return reply.status(200).send({ status: 'success', data: result });
 * } catch (error) {
 *   return handleDomainError(error, reply);
 * }
 * ```
 */
export function handleDomainError(error: unknown, reply: FastifyReply): FastifyReply {
  // Handle known DomainErrors with proper HTTP status codes
  if (error instanceof NotFoundError) {
    return reply.status(404).send({
      status: 'error',
      message: error.message,
    });
  }

  if (error instanceof ForbiddenError) {
    return reply.status(403).send({
      status: 'error',
      message: error.message,
    });
  }

  if (error instanceof UnauthorizedError) {
    return reply.status(401).send({
      status: 'error',
      message: error.message,
    });
  }

  if (error instanceof ValidationError) {
    return reply.status(400).send({
      status: 'error',
      message: error.message,
    });
  }

  if (error instanceof ConflictError) {
    return reply.status(409).send({
      status: 'error',
      message: error.message,
    });
  }

  if (error instanceof BusinessRuleError) {
    return reply.status(422).send({
      status: 'error',
      message: error.message,
    });
  }

  if (error instanceof DomainError) {
    // Fallback for generic DomainError
    return reply.status(500).send({
      status: 'error',
      message: error.message,
    });
  }

  // Handle unexpected errors
  const message = error instanceof Error ? error.message : 'An unexpected error occurred.';
  
  return reply.status(500).send({
    status: 'error',
    message,
  });
}
