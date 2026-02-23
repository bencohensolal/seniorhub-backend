import { describe, expect, it } from 'vitest';
import { InMemoryHouseholdRepository } from '../../data/repositories/InMemoryHouseholdRepository.js';
import { CreateBulkInvitationsUseCase } from './CreateBulkInvitationsUseCase.js';

describe('CreateBulkInvitationsUseCase', () => {
  it('rejects invitation creation for non-caregiver requester', async () => {
    const repository = new InMemoryHouseholdRepository();
    const useCase = new CreateBulkInvitationsUseCase(repository);

    await expect(
      useCase.execute({
        householdId: 'household-1',
        requester: {
          userId: 'user-1',
          email: 'alice@example.com',
          firstName: 'Alice',
          lastName: 'Martin',
        },
        users: [
          {
            firstName: 'Dina',
            lastName: 'Wells',
            email: 'dina@example.com',
            role: 'senior',
          },
        ],
      }),
    ).rejects.toThrow('Only caregivers can send invitations.');
  });

  it('creates invitations for caregiver requester', async () => {
    const repository = new InMemoryHouseholdRepository();
    const useCase = new CreateBulkInvitationsUseCase(repository);

    const result = await useCase.execute({
      householdId: 'household-1',
      requester: {
        userId: 'user-2',
        email: 'ben@example.com',
        firstName: 'Ben',
        lastName: 'Martin',
      },
      users: [
        {
          firstName: 'Dina',
          lastName: 'Wells',
          email: 'dina@example.com',
          role: 'senior',
        },
      ],
    });

    expect(result.acceptedCount).toBe(1);
    expect(result.deliveries[0]?.status).toBe('sent');
  });
});
