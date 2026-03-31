import type { AuthenticatedRequester } from '../../entities/Household.js';
import type { JournalEntry, UpdateJournalEntryInput } from '../../entities/JournalEntry.js';
import type { HouseholdRepository } from '../../repositories/HouseholdRepository.js';
import type { JournalEntryRepository } from '../../repositories/JournalEntryRepository.js';
import { HouseholdAccessValidator } from '../shared/index.js';
import { NotFoundError } from '../../errors/index.js';

/**
 * Updates an existing journal entry.
 * Only the author or a caregiver can update entries.
 */
export class UpdateJournalEntryUseCase {
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
    updates: UpdateJournalEntryInput;
    requester: AuthenticatedRequester;
  }): Promise<JournalEntry> {
    // Validate member access
    await this.accessValidator.ensureMember(input.requester.userId, input.householdId);

    // Verify entry exists and belongs to household
    const entry = await this.journalRepository.getById(input.entryId);
    if (!entry || entry.householdId !== input.householdId) {
      throw new NotFoundError('Journal entry not found.');
    }

    return this.journalRepository.update(input.entryId, input.updates);
  }
}
