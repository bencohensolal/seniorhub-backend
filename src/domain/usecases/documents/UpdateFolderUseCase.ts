import type { AuthenticatedRequester } from '../../entities/Household.js';
import type { HouseholdRepository } from '../../repositories/HouseholdRepository.js';
import type { DocumentFolder, UpdateDocumentFolderInput } from '../../entities/DocumentFolder.js';
import { HouseholdAccessValidator } from '../shared/index.js';
import { ForbiddenError } from '../../errors/index.js';

/**
 * Updates an existing document folder.
 */
export class UpdateFolderUseCase {
  private readonly accessValidator: HouseholdAccessValidator;

  constructor(private readonly repository: HouseholdRepository) {
    this.accessValidator = new HouseholdAccessValidator(repository);
  }

  /**
   * @param input - Folder update data with requester info
   * @returns The updated document folder
   * @throws {ForbiddenError} If requester is not a member of the household or lacks manageDocuments permission
   */
  async execute(input: {
    folderId: string;
    householdId: string;
    updates: UpdateDocumentFolderInput;
    requester: AuthenticatedRequester;
  }): Promise<DocumentFolder> {
    // Validate member access and manageDocuments permission
    await this.accessValidator.ensureMember(input.requester.userId, input.householdId);
    await this.accessValidator.ensurePermission(
      input.requester.userId,
      input.householdId,
      'manageDocuments',
    );

    // Validate folder exists and belongs to household
    const existingFolder = await this.repository.getDocumentFolderById(input.folderId, input.householdId);
    if (!existingFolder) {
      throw new ForbiddenError('Folder not found or does not belong to this household.');
    }

    // Prevent renaming or moving system root folders and senior folders
    if (existingFolder.type === 'system_root' || existingFolder.type === 'senior_folder') {
      throw new ForbiddenError('Cannot rename or move system folders.');
    }

    // Validate new parent folder exists and belongs to same household (if changing parent)
    if (input.updates.parentFolderId !== undefined && input.updates.parentFolderId !== existingFolder.parentFolderId) {
      if (input.updates.parentFolderId) {
        const parentFolder = await this.repository.getDocumentFolderById(input.updates.parentFolderId, input.householdId);
        if (!parentFolder) {
          throw new ForbiddenError('Parent folder not found or does not belong to this household.');
        }
      }
    }

    // Update folder
    const updatedFolder = await this.repository.updateDocumentFolder(
      input.folderId,
      input.householdId,
      input.updates,
    );

    return updatedFolder;
  }
}
