import type { AuthenticatedRequester } from '../../entities/Household.js';
import type { HouseholdRepository } from '../../repositories/HouseholdRepository.js';
import type { StorageService } from '../../../data/services/storage/types.js';
import { HouseholdAccessValidator } from '../shared/index.js';
import { ForbiddenError, NotFoundError } from '../../errors/index.js';

/**
 * Permanently deletes a trashed document or folder (hard delete + GCS cleanup).
 * The item must already be in the trash.
 */
export class PermanentlyDeleteFromTrashUseCase {
  private readonly accessValidator: HouseholdAccessValidator;

  constructor(
    private readonly repository: HouseholdRepository,
    private readonly storageService: StorageService,
  ) {
    this.accessValidator = new HouseholdAccessValidator(repository);
  }

  async execute(input: {
    householdId: string;
    itemId: string;
    itemType: 'folder' | 'document';
    requester: AuthenticatedRequester;
  }): Promise<void> {
    await this.accessValidator.ensureMember(input.requester.userId, input.householdId);
    await this.accessValidator.ensurePermission(input.requester.userId, input.householdId, 'manageDocuments');

    if (input.itemType === 'document') {
      const doc = await this.repository.getDocumentById(input.itemId, input.householdId);
      if (!doc) throw new NotFoundError('Document not found.');
      if (!doc.trashedAt) throw new ForbiddenError('Document is not in trash.');

      const { storageKey } = await this.repository.hardDeleteDocument(input.itemId, input.householdId);
      // Best-effort GCS deletion — don't fail if storage delete fails
      await this.storageService.deleteDocument(storageKey).catch(() => {});
    } else {
      const folder = await this.repository.getDocumentFolderById(input.itemId, input.householdId);
      if (!folder) throw new NotFoundError('Folder not found.');
      if (!folder.trashedAt) throw new ForbiddenError('Folder is not in trash.');

      const { storageKeys } = await this.repository.hardDeleteDocumentFolder(input.itemId, input.householdId);
      await Promise.allSettled(storageKeys.map((key) => this.storageService.deleteDocument(key)));
    }
  }
}
