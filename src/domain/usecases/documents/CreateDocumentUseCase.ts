import type { AuthenticatedRequester } from '../../entities/Household.js';
import type { HouseholdRepository } from '../../repositories/HouseholdRepository.js';
import type { Document, CreateDocumentInput } from '../../entities/Document.js';
import { HouseholdAccessValidator } from '../shared/index.js';
import { ForbiddenError } from '../../errors/index.js';

/**
 * Creates a new document (metadata) within a folder.
 */
export class CreateDocumentUseCase {
  private readonly accessValidator: HouseholdAccessValidator;

  constructor(private readonly repository: HouseholdRepository) {
    this.accessValidator = new HouseholdAccessValidator(repository);
  }

  /**
   * @param input - Document creation data with requester info
   * @returns The created document
   * @throws {ForbiddenError} If requester is not a member of the household or lacks manageDocuments permission
   */
  async execute(input: Omit<CreateDocumentInput, 'uploadedByUserId'> & {
    requester: AuthenticatedRequester;
  }): Promise<Document> {
    // Validate member access and manageDocuments permission
    await this.accessValidator.ensureMember(input.requester.userId, input.householdId);
    await this.accessValidator.ensurePermission(
      input.requester.userId,
      input.householdId,
      'manageDocuments',
    );

    // Validate folder exists and belongs to same household
    const folder = await this.repository.getDocumentFolderById(input.folderId, input.householdId);
    if (!folder) {
      throw new ForbiddenError('Folder not found or does not belong to this household.');
    }

    // Create document
    const document = await this.repository.createDocument({
      ...input,
      uploadedByUserId: input.requester.userId,
    });

    return document;
  }
}
