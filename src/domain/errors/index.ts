/**
 * Domain errors module
 * Provides typed error classes for domain layer error handling
 */
export {
  DomainError,
  NotFoundError,
  ForbiddenError,
  UnauthorizedError,
  ValidationError,
  ConflictError,
  BusinessRuleError,
  MaxPhotoScreensReachedError,
  MaxPhotosReachedError,
  UnsupportedFileFormatError,
  FileTooLargeError,
  PhotoScreenNotFoundError,
  PhotoNotFoundError,
} from './DomainErrors.js';
