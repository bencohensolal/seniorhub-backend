import type { AuthenticatedRequester } from '../../entities/Household.js';
import type { JournalEntry, JournalCategory, CreateJournalEntryInput } from '../../entities/JournalEntry.js';
import type { HouseholdRepository } from '../../repositories/HouseholdRepository.js';
import type { JournalEntryRepository } from '../../repositories/JournalEntryRepository.js';
import { ForbiddenError } from '../../errors/index.js';
import { HouseholdAccessValidator, PlanLimitGuard } from '../shared/index.js';

/**
 * Creates a new journal entry for a household.
 * All household members can create entries.
 */
export class CreateJournalEntryUseCase {
  private readonly accessValidator: HouseholdAccessValidator;
  private readonly planLimitGuard: PlanLimitGuard;

  constructor(
    private readonly householdRepository: HouseholdRepository,
    private readonly journalRepository: JournalEntryRepository,
  ) {
    this.accessValidator = new HouseholdAccessValidator(householdRepository);
    this.planLimitGuard = new PlanLimitGuard(householdRepository);
  }

  async execute(input: {
    householdId: string;
    seniorIds: string[];
    content: string;
    description?: string;
    category?: JournalCategory;
    requester: AuthenticatedRequester;
  }): Promise<JournalEntry> {
    // Validate member access (tablets cannot create journal entries)
    const member = await this.accessValidator.ensureMember(input.requester.userId, input.householdId);
    if (!member) {
      throw new ForbiddenError('Only household members can create journal entries.');
    }

    // Check plan limit for journal entries (only count non-archived)
    const currentEntries = await this.journalRepository.listByHousehold(input.householdId, { archived: false });
    await this.planLimitGuard.ensureWithinLimit({
      householdId: input.householdId,
      resource: 'journal_entries',
      currentCount: currentEntries.length,
      limitKey: 'maxJournalEntries',
    });

    const createInput: CreateJournalEntryInput = {
      householdId: input.householdId,
      seniorIds: input.seniorIds,
      authorId: member.id,
      content: input.content,
      ...(input.description !== undefined && { description: input.description }),
      ...(input.category && { category: input.category }),
    };

    return this.journalRepository.create(createInput);
  }
}
