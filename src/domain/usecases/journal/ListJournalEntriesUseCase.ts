import type { AuthenticatedRequester } from '../../entities/Household.js';
import type { JournalEntry, JournalCategory } from '../../entities/JournalEntry.js';
import type { HouseholdRepository } from '../../repositories/HouseholdRepository.js';
import type { JournalEntryRepository } from '../../repositories/JournalEntryRepository.js';
import { HouseholdAccessValidator } from '../shared/index.js';

/**
 * Lists journal entries for a household with optional filters.
 * All household members can list entries.
 */
export class ListJournalEntriesUseCase {
  private readonly accessValidator: HouseholdAccessValidator;

  constructor(
    private readonly householdRepository: HouseholdRepository,
    private readonly journalRepository: JournalEntryRepository,
  ) {
    this.accessValidator = new HouseholdAccessValidator(householdRepository);
  }

  async execute(input: {
    householdId: string;
    requester: AuthenticatedRequester;
    filters?: {
      seniorId?: string;
      category?: JournalCategory;
      limit?: number;
      offset?: number;
    };
  }): Promise<JournalEntry[]> {
    await this.accessValidator.ensureMember(input.requester.userId, input.householdId);
    return this.journalRepository.listByHousehold(input.householdId, input.filters);
  }
}
