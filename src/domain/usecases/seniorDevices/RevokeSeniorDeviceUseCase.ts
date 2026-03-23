import type { HouseholdRepository } from '../../repositories/HouseholdRepository.js';
import { HouseholdAccessValidator } from '../shared/HouseholdAccessValidator.js';
import { ForbiddenError } from '../../errors/index.js';

export class RevokeSeniorDeviceUseCase {
  private readonly accessValidator: HouseholdAccessValidator;

  constructor(private readonly repository: HouseholdRepository) {
    this.accessValidator = new HouseholdAccessValidator(repository);
  }

  async execute(input: {
    householdId: string;
    deviceId: string;
    requesterUserId: string;
  }): Promise<void> {
    const member = await this.accessValidator.ensureMember(input.requesterUserId, input.householdId);

    if (!member) {
      throw new ForbiddenError('Tablets cannot revoke senior devices.');
    }

    if (member.role === 'senior') {
      throw new ForbiddenError('Seniors cannot revoke senior devices.');
    }

    await this.repository.revokeSeniorDevice(input.deviceId, input.householdId, input.requesterUserId);
  }
}
