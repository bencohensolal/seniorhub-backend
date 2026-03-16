import type { AuthenticatedRequester } from '../../entities/Household.js';
import type { HouseholdRepository } from '../../repositories/HouseholdRepository.js';
import type { Document, UpdateDocumentInput } from '../../entities/Document.js';
import { HouseholdAccessValidator } from '../shared/index.js';
import { ForbiddenError } from '../../errors/index.js';

/**
 * Updates an existing document (metadata).
 */
export class UpdateDocumentUseCase {
  private readonly accessValidator: HouseholdAccessValidator;

  constructor(private readonly repository: HouseholdRepository) {
    this.accessValidator = new HouseholdAccessValidator(repository);
  }

  /**
   * @param input - Document update data with requester info
   * @returns The updated document
   * @throws {ForbiddenError} If requester is not a member of the household or lacks manageDocuments permission
   */
  async execute(input: {
    documentId: string;
    householdId: string;
    updates: UpdateDocumentInput;
    requester: AuthenticatedRequester;
  }): Promise<Document> {
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

    // Validate new folder exists and belongs to same household (if changing folder)
    if (input.updates.folderId !== undefined && input.updates.folderId !== existingDocument.folderId) {
      const folder = await this.repository.getDocumentFolderById(input.updates.folderId, input.householdId);
      if (!folder) {
        throw new ForbiddenError('Folder not found or does not belong to this household.');
      }
    }

    // Update document
    const updatedDocument = await this.repository.updateDocument(
      input.documentId,
      input.householdId,
      input.updates,
    );

    return updatedDocument;
  }
}
