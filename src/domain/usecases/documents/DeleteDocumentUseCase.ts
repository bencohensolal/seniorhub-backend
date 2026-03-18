import type { AuthenticatedRequester } from '../../entities/Household.js';
import type { HouseholdRepository } from '../../repositories/HouseholdRepository.js';
import { HouseholdAccessValidator } from '../shared/index.js';
import { ForbiddenError } from '../../errors/index.js';

/**
 * Soft‑deletes a document.
 */
export class DeleteDocumentUseCase {
  private readonly accessValidator: HouseholdAccessValidator;

  constructor(private readonly repository: HouseholdRepository) {
    this.accessValidator = new HouseholdAccessValidator(repository);
  }

  /**
   * @param input - Document identifier with requester info
   * @throws {ForbiddenError} If requester is not a member of the household or lacks manageDocuments permission
   */
  async execute(input: {
    documentId: string;
    householdId: string;
    requester: AuthenticatedRequester;
  }): Promise<void> {
    // Validate member access and manageDocuments permission
    await this.accessValidator.ensureMember(input.requester.userId, input.householdId);
    await this.accessValidator.ensurePermission(
      input.requester.userId,
      input.householdId,
      'manageDocuments',
    );

    // Validate document exists and belongs to household
    const existingDocument = await this.repository.getDocumentById(input.documentId, input.householdId);
    if (!existingDocument) {
      throw new ForbiddenError('Document not found or does not belong to this household.');
    }

    // Delete document (soft delete)
    await this.repository.softDeleteDocument(input.documentId, input.householdId);
  }
}
