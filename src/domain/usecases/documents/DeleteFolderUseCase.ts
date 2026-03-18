import type { AuthenticatedRequester } from '../../entities/Household.js';
import type { HouseholdRepository } from '../../repositories/HouseholdRepository.js';
import { HouseholdAccessValidator } from '../shared/index.js';
import { ForbiddenError } from '../../errors/index.js';

/**
 * Soft‑deletes a document folder (and its contents via cascade).
 */
export class DeleteFolderUseCase {
  private readonly accessValidator: HouseholdAccessValidator;

  constructor(private readonly repository: HouseholdRepository) {
    this.accessValidator = new HouseholdAccessValidator(repository);
  }

  /**
   * @param input - Folder identifier with requester info
   * @throws {ForbiddenError} If requester is not a member of the household or lacks manageDocuments permission
   */
  async execute(input: {
    folderId: string;
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

    // Validate folder exists and belongs to household
    const existingFolder = await this.repository.getDocumentFolderById(input.folderId, input.householdId);
    if (!existingFolder) {
      throw new ForbiddenError('Folder not found or does not belong to this household.');
    }

    // Prevent deleting system root folders and senior folders
    if (existingFolder.type === 'system_root' || existingFolder.type === 'senior_folder') {
      throw new ForbiddenError('Cannot delete system folders.');
    }

    // Delete folder (soft delete)
    await this.repository.softDeleteDocumentFolder(input.folderId, input.householdId);
  }
}
