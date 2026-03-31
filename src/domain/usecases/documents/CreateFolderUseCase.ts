import type { AuthenticatedRequester } from '../../entities/Household.js';
import type { HouseholdRepository } from '../../repositories/HouseholdRepository.js';
import type { DocumentFolder, CreateDocumentFolderInput } from '../../entities/DocumentFolder.js';
import { HouseholdAccessValidator } from '../shared/index.js';
import { ForbiddenError } from '../../errors/index.js';

/**
 * Creates a new document folder within a household.
 */
export class CreateFolderUseCase {
  private readonly accessValidator: HouseholdAccessValidator;

  constructor(private readonly repository: HouseholdRepository) {
    this.accessValidator = new HouseholdAccessValidator(repository);
  }

  /**
   * @param input - Folder creation data with requester info
   * @returns The created document folder
   * @throws {ForbiddenError} If requester is not a member of the household or lacks manageDocuments permission
   */
  async execute(input: Omit<CreateDocumentFolderInput, 'createdByUserId'> & {
    requester: AuthenticatedRequester;
  }): Promise<DocumentFolder> {
    // Validate member access and manageDocuments permission
    await this.accessValidator.ensureMember(input.requester.userId, input.householdId);
    await this.accessValidator.ensurePermission(
      input.requester.userId,
      input.householdId,
      'manageDocuments',
    );

    // Disallow creation at root level
    if (!input.parentFolderId) {
      throw new ForbiddenError('Cannot create a folder at the root level.');
    }

    // Validate parent folder exists and belongs to same household
    const parentFolder = await this.repository.getDocumentFolderById(input.parentFolderId, input.householdId);
    if (!parentFolder) {
      throw new ForbiddenError('Parent folder not found or does not belong to this household.');
    }

    // Disallow creation inside the trash folder
    if (parentFolder.type === 'system_root' && parentFolder.systemRootType === 'trash') {
      throw new ForbiddenError('Cannot create a folder inside the trash.');
    }

    // Disallow creation directly inside Personal Documents — only senior folders are allowed there (auto-managed)
    if (parentFolder.type === 'system_root' && parentFolder.systemRootType === 'personal') {
      throw new ForbiddenError('Cannot create a folder directly inside Personal Documents. Navigate into a senior folder first.');
    }

    // Create folder
    const folder = await this.repository.createDocumentFolder({
      ...input,
      createdByUserId: input.requester.userId,
    });

    return folder;
  }
}
