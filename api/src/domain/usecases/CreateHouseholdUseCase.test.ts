import { describe, expect, it } from 'vitest';
import { InMemoryHouseholdRepository } from '../../data/repositories/InMemoryHouseholdRepository.js';
import { CreateHouseholdUseCase } from './CreateHouseholdUseCase.js';

describe('CreateHouseholdUseCase', () => {
  it('creates household and allows requester access as caregiver', async () => {
    const repository = new InMemoryHouseholdRepository();
    const useCase = new CreateHouseholdUseCase(repository);

    const requester = {
      userId: 'user-900',
      email: 'new-caregiver@example.com',
      firstName: 'Nora',
      lastName: 'Stone',
    };

    const household = await useCase.execute({
      name: 'Stone Family Home',
      requester,
    });

    const membership = await repository.findActiveMemberByUserInHousehold(
      requester.userId,
      household.id,
    );

    expect(membership).not.toBeNull();
    expect(membership?.role).toBe('caregiver');
  });
});
