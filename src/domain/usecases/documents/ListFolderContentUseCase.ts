import type { AuthenticatedRequester } from '../../entities/Household.js';
import type { HouseholdRepository } from '../../repositories/HouseholdRepository.js';
import type { DocumentFolderWithCounts } from '../../entities/DocumentFolder.js';
import type { Document } from '../../entities/Document.js';
import { HouseholdAccessValidator } from '../shared/index.js';

/**
 * Lists all documents and subfolders within a specific folder.
 */
export class ListFolderContentUseCase {
  private readonly accessValidator: HouseholdAccessValidator;

  constructor(private readonly repository: HouseholdRepository) {
    this.accessValidator = new HouseholdAccessValidator(repository);
  }

  /**
   * @param input - Folder identifier with requester info
   * @returns Object containing folders and documents within the specified folder
   * @throws {ForbiddenError} If requester is not a member of the household or lacks viewDocuments permission
   */
  async execute(input: {
    householdId: string;
    folderId: string | null; // null for root (system roots)
    requester: AuthenticatedRequester;
  }): Promise<{
    folders: DocumentFolderWithCounts[];
    documents: Document[];
  }> {
    // Validate member access and viewDocuments permission
    await this.accessValidator.ensureMember(input.requester.userId, input.householdId);
    await this.accessValidator.ensurePermission(
      input.requester.userId,
      input.householdId,
      'viewDocuments',
    );

    // Fetch folders and documents
    const folders = await this.repository.listDocumentFoldersByParent(input.householdId, input.folderId);
    const documents = input.folderId
      ? await this.repository.listDocumentsByFolder(input.householdId, input.folderId)
      : [];

    return { folders, documents };
  }
}
