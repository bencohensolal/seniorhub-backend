import type { AuthenticatedRequester } from '../../entities/Household.js';
import type { HouseholdRepository } from '../../repositories/HouseholdRepository.js';
import type { JournalEntryRepository } from '../../repositories/JournalEntryRepository.js';
import { HouseholdAccessValidator } from '../shared/index.js';
import { NotFoundError } from '../../errors/index.js';

/**
 * Deletes a journal entry.
 * Only the author or a caregiver can delete entries.
 */
export class DeleteJournalEntryUseCase {
  private readonly accessValidator: HouseholdAccessValidator;

  constructor(
    private readonly householdRepository: HouseholdRepository,
    private readonly journalRepository: JournalEntryRepository,
  ) {
    this.accessValidator = new HouseholdAccessValidator(householdRepository);
  }

  async execute(input: {
    entryId: string;
    householdId: string;
    requester: AuthenticatedRequester;
  }): Promise<void> {
    // Validate member access
    await this.accessValidator.ensureMember(input.requester.userId, input.householdId);

    // Verify entry exists and belongs to household
    const entry = await this.journalRepository.getById(input.entryId);
    if (!entry || entry.householdId !== input.householdId) {
      throw new NotFoundError('Journal entry not found.');
    }

    await this.journalRepository.delete(input.entryId);
  }
}
