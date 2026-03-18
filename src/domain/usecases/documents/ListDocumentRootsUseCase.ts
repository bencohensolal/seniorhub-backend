import type { AuthenticatedRequester } from '../../entities/Household.js';
import type { HouseholdRepository } from '../../repositories/HouseholdRepository.js';
import type { DocumentFolderWithCounts } from '../../entities/DocumentFolder.js';
import { HouseholdAccessValidator } from '../shared/index.js';
import { ForbiddenError, NotFoundError } from '../../errors/index.js';

/**
 * Lists the two system root folders (Medical File and Administrative) for a household.
 * Also includes senior folders under Medical File root.
 */
export class ListDocumentRootsUseCase {
  private readonly accessValidator: HouseholdAccessValidator;

  constructor(private readonly repository: HouseholdRepository) {
    this.accessValidator = new HouseholdAccessValidator(repository);
  }

  /**
   * @param input - Household identifier with requester info
   * @returns Object containing medical and administrative roots with senior folders
   * @throws {ForbiddenError} If requester is not a member of the household or lacks viewDocuments permission
   */
  async execute(input: {
    householdId: string;
    requester: AuthenticatedRequester;
  }): Promise<{
    medicalRoot: DocumentFolderWithCounts;
    administrativeRoot: DocumentFolderWithCounts;
    seniorFolders: DocumentFolderWithCounts[];
  }> {
    // Validate member access and viewDocuments permission
    await this.accessValidator.ensureMember(input.requester.userId, input.householdId);
    await this.accessValidator.ensurePermission(
      input.requester.userId,
      input.householdId,
      'viewDocuments',
    );

    // Ensure system roots exist
    await this.repository.ensureSystemRootsForHousehold(input.householdId, input.requester.userId);

    // Fetch system roots
    const medicalRoot = await this.repository.getSystemRootFolder(input.householdId, 'medical');
    const administrativeRoot = await this.repository.getSystemRootFolder(input.householdId, 'administrative');

    if (!medicalRoot || !administrativeRoot) {
      throw new NotFoundError('System roots not found after creation');
    }

    // Fetch senior folders under Medical File root
    const seniorFolders = await this.repository.listSeniorFolders(input.householdId);

    return {
      medicalRoot,
      administrativeRoot,
      seniorFolders,
    };
  }
}
