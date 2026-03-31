import type { AuthenticatedRequester } from '../../entities/Household.js';
import type { JournalEntry, JournalCategory, CreateJournalEntryInput } from '../../entities/JournalEntry.js';
import type { HouseholdRepository } from '../../repositories/HouseholdRepository.js';
import type { JournalEntryRepository } from '../../repositories/JournalEntryRepository.js';
import { HouseholdAccessValidator } from '../shared/index.js';

/**
 * Creates a new journal entry for a household.
 * All household members can create entries.
 */
export class CreateJournalEntryUseCase {
  private readonly accessValidator: HouseholdAccessValidator;

  constructor(
    private readonly householdRepository: HouseholdRepository,
    private readonly journalRepository: JournalEntryRepository,
  ) {
    this.accessValidator = new HouseholdAccessValidator(householdRepository);
  }

  async execute(input: {
    householdId: string;
    seniorId: string;
    content: string;
    category?: JournalCategory;
    requester: AuthenticatedRequester;
  }): Promise<JournalEntry> {
    // Validate member access
    const member = await this.accessValidator.ensureMember(input.requester.userId, input.householdId);

    const createInput: CreateJournalEntryInput = {
      householdId: input.householdId,
      seniorId: input.seniorId,
      authorId: member.id,
      content: input.content,
      ...(input.category && { category: input.category }),
    };

    return this.journalRepository.create(createInput);
  }
}
