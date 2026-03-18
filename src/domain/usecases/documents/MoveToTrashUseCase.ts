import type { AuthenticatedRequester } from '../../entities/Household.js';
import type { HouseholdRepository } from '../../repositories/HouseholdRepository.js';
import { HouseholdAccessValidator } from '../shared/index.js';
import { ForbiddenError, NotFoundError } from '../../errors/index.js';

/**
 * Moves a document or folder to the household trash.
 * Items remain recoverable for 30 days before being permanently purged.
 */
export class MoveToTrashUseCase {
  private readonly accessValidator: HouseholdAccessValidator;

  constructor(private readonly repository: HouseholdRepository) {
    this.accessValidator = new HouseholdAccessValidator(repository);
  }

  async execute(input: {
    householdId: string;
    itemId: string;
    itemType: 'folder' | 'document';
    requester: AuthenticatedRequester;
  }): Promise<void> {
    await this.accessValidator.ensureMember(input.requester.userId, input.householdId);
    await this.accessValidator.ensurePermission(
      input.requester.userId,
      input.householdId,
      'manageDocuments',
    );

    const trashRoot = await this.repository.getSystemRootFolder(input.householdId, 'trash');
    if (!trashRoot) {
      throw new NotFoundError('Trash folder not found for this household.');
    }

    if (input.itemType === 'folder') {
      const folder = await this.repository.getDocumentFolderById(input.itemId, input.householdId);
      if (!folder) {
        throw new NotFoundError('Folder not found or does not belong to this household.');
      }
      if (folder.type === 'system_root' || folder.type === 'senior_folder') {
        throw new ForbiddenError('Cannot move a system folder to trash.');
      }
      if (folder.trashedAt !== null) {
        throw new ForbiddenError('Folder is already in trash.');
      }
      await this.repository.moveDocumentFolderToTrash(input.itemId, input.householdId, trashRoot.id);
    } else {
      const document = await this.repository.getDocumentById(input.itemId, input.householdId);
      if (!document) {
        throw new NotFoundError('Document not found or does not belong to this household.');
      }
      if (document.trashedAt !== null) {
        throw new ForbiddenError('Document is already in trash.');
      }
      await this.repository.moveDocumentToTrash(input.itemId, input.householdId, trashRoot.id);
    }
  }
}
