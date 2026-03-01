/**
 * Base class for all domain errors.
 * Extends Error to maintain stack traces and error handling compatibility.
 */
export class DomainError extends Error {
  constructor(message: string) {
    super(message);
    this.name = this.constructor.name;
    // Maintain proper stack trace for debugging
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor);
    }
  }
}

/**
 * Thrown when a requested resource is not found.
 * HTTP Status: 404
 * 
 * @example
 * throw new NotFoundError('Household not found.');
 * throw new NotFoundError('Invitation not found.');
 */
export class NotFoundError extends DomainError {}

/**
 * Thrown when a user lacks permission to perform an action.
 * HTTP Status: 403
 * 
 * @example
 * throw new ForbiddenError('Only caregivers can delete medications.');
 * throw new ForbiddenError('Access denied to this household.');
 */
export class ForbiddenError extends DomainError {}

/**
 * Thrown when authentication is required but missing or invalid.
 * HTTP Status: 401
 * 
 * @example
 * throw new UnauthorizedError('Invalid authentication token.');
 * throw new UnauthorizedError('Authentication required.');
 */
export class UnauthorizedError extends DomainError {}

/**
 * Thrown when input data fails validation rules.
 * HTTP Status: 400
 * 
 * @example
 * throw new ValidationError('Email format is invalid.');
 * throw new ValidationError('Search term must be at least 2 characters long.');
 */
export class ValidationError extends DomainError {}

/**
 * Thrown when an operation conflicts with current state.
 * HTTP Status: 409
 * 
 * @example
 * throw new ConflictError('Invitation is not pending.');
 * throw new ConflictError('Cannot remove yourself using this endpoint.');
 */
export class ConflictError extends DomainError {}

/**
 * Thrown when a business rule is violated.
 * HTTP Status: 422
 * 
 * @example
 * throw new BusinessRuleError('Cannot leave household. You are the last caregiver.');
 * throw new BusinessRuleError('The household must have at least one caregiver.');
 */
export class BusinessRuleError extends DomainError {}
