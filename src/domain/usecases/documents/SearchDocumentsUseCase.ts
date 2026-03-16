import type { AuthenticatedRequester } from '../../entities/Household.js';
import type { HouseholdRepository } from '../../repositories/HouseholdRepository.js';
import type { DocumentFolder } from '../../entities/DocumentFolder.js';
import type { Document } from '../../entities/Document.js';
import { HouseholdAccessValidator } from '../shared/index.js';

/**
 * Searches for documents and folders within a household by name/description.
 */
export class SearchDocumentsUseCase {
  private readonly accessValidator: HouseholdAccessValidator;

  constructor(private readonly repository: HouseholdRepository) {
    this.accessValidator = new HouseholdAccessValidator(repository);
  }

  /**
   * @param input - Search query with requester info
   * @returns Object containing matching documents and folders
   * @throws {ForbiddenError} If requester is not a member of the household or lacks viewDocuments permission
   */
  async execute(input: {
    householdId: string;
    query: string;
    requester: AuthenticatedRequester;
  }): Promise<{
    documents: Document[];
    folders: DocumentFolder[];
  }> {
    // Validate member access and viewDocuments permission
    await this.accessValidator.ensureMember(input.requester.userId, input.householdId);
    await this.accessValidator.ensurePermission(
      input.requester.userId,
      input.householdId,
      'viewDocuments',
    );

    // Search documents and folders
    const result = await this.repository.searchDocumentsAndFolders(input.householdId, input.query);

    return result;
  }
}
