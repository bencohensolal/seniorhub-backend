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

/**
 * Thrown when maximum photo screens limit is reached for a tablet.
 * HTTP Status: 400
 * 
 * @example
 * throw new MaxPhotoScreensReachedError('Maximum number of photo screens (5) reached for this tablet');
 */
export class MaxPhotoScreensReachedError extends DomainError {}

/**
 * Thrown when maximum photos limit is reached for a photo screen.
 * HTTP Status: 400
 * 
 * @example
 * throw new MaxPhotosReachedError('Maximum number of photos (6) reached for this screen');
 */
export class MaxPhotosReachedError extends DomainError {}

/**
 * Thrown when an unsupported file format is uploaded.
 * HTTP Status: 400
 * 
 * @example
 * throw new UnsupportedFileFormatError('Unsupported file format. Use JPEG, PNG or WebP');
 */
export class UnsupportedFileFormatError extends DomainError {}

/**
 * Thrown when uploaded file size exceeds the limit.
 * HTTP Status: 400
 * 
 * @example
 * throw new FileTooLargeError('File size exceeds the maximum limit of 5MB');
 */
export class FileTooLargeError extends DomainError {}

/**
 * Thrown when a requested photo screen is not found.
 * HTTP Status: 404
 * 
 * @example
 * throw new PhotoScreenNotFoundError('Photo screen not found');
 */
export class PhotoScreenNotFoundError extends DomainError {}

/**
 * Thrown when a requested photo is not found.
 * HTTP Status: 404
 * 
 * @example
 * throw new PhotoNotFoundError('Photo not found');
 */
export class PhotoNotFoundError extends DomainError {}
