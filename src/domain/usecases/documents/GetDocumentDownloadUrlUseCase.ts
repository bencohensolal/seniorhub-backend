import type { HouseholdRepository } from '../../repositories/HouseholdRepository.js';
import type { StorageService } from '../../../data/services/storage/types.js';
import { HouseholdAccessValidator } from '../shared/index.js';
import { ForbiddenError } from '../../errors/index.js';

/**
 * Generates a short-lived signed URL for downloading a document from storage.
 */
export class GetDocumentDownloadUrlUseCase {
  private readonly accessValidator: HouseholdAccessValidator;

  constructor(
    private readonly repository: HouseholdRepository,
    private readonly storageService: StorageService,
  ) {
    this.accessValidator = new HouseholdAccessValidator(repository);
  }

  async execute(input: {
    documentId: string;
    householdId: string;
    requester: { userId: string };
  }): Promise<{ url: string; filename: string; mimeType: string }> {
    await this.accessValidator.ensureMember(input.requester.userId, input.householdId);

    const document = await this.repository.getDocumentById(input.documentId, input.householdId);
    if (!document) {
      throw new ForbiddenError('Document not found or does not belong to this household.');
    }

    const url = await this.storageService.getSignedUrl(document.storageKey, 900); // 15 min

    return {
      url,
      filename: document.originalFilename,
      mimeType: document.mimeType,
    };
  }
}
