import { describe, expect, it } from 'vitest';
import { InMemoryHouseholdRepository } from '../../data/repositories/InMemoryHouseholdRepository.js';
import { GetHouseholdOverviewUseCase } from './GetHouseholdOverviewUseCase.js';

describe('GetHouseholdOverviewUseCase', () => {
  it('returns overview when requester belongs to household', async () => {
    const repository = new InMemoryHouseholdRepository();
    const useCase = new GetHouseholdOverviewUseCase(repository);

    const result = await useCase.execute({
      householdId: 'household-1',
      requesterUserId: 'user-2',
    });

    expect(result.household.id).toBe('household-1');
    expect(result.membersCount).toBeGreaterThan(0);
  });

  it('throws when requester is not part of household', async () => {
    const repository = new InMemoryHouseholdRepository();
    const useCase = new GetHouseholdOverviewUseCase(repository);

    await expect(
      useCase.execute({ householdId: 'household-1', requesterUserId: 'user-999' }),
    ).rejects.toThrow('Access denied to this household.');
  });
});
