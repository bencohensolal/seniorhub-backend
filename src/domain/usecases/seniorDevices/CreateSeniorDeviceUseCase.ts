import type { HouseholdRepository } from '../../repositories/HouseholdRepository.js';
import type { SeniorDeviceWithToken } from '../../entities/SeniorDevice.js';
import { HouseholdAccessValidator } from '../shared/HouseholdAccessValidator.js';
import { ForbiddenError, ConflictError } from '../../errors/index.js';

const MAX_ACTIVE_DEVICES_PER_HOUSEHOLD = 10;

export class CreateSeniorDeviceUseCase {
  private readonly accessValidator: HouseholdAccessValidator;

  constructor(private readonly repository: HouseholdRepository) {
    this.accessValidator = new HouseholdAccessValidator(repository);
  }

  async execute(input: {
    householdId: string;
    memberId: string;
    name: string;
    requesterUserId: string;
  }): Promise<SeniorDeviceWithToken> {
    const member = await this.accessValidator.ensureMember(input.requesterUserId, input.householdId);

    if (!member) {
      throw new ForbiddenError('Tablets cannot create senior devices.');
    }

    if (member.role === 'senior') {
      throw new ForbiddenError('Seniors cannot create senior devices.');
    }

    // Verify the target member exists in this household
    await this.accessValidator.ensureMemberExists(input.memberId, input.householdId);

    const activeCount = await this.repository.countActiveSeniorDevices(input.householdId);
    if (activeCount >= MAX_ACTIVE_DEVICES_PER_HOUSEHOLD) {
      throw new ConflictError(
        `Maximum number of active senior devices (${MAX_ACTIVE_DEVICES_PER_HOUSEHOLD}) reached for this household.`,
      );
    }

    return this.repository.createSeniorDevice({
      householdId: input.householdId,
      memberId: input.memberId,
      name: input.name,
      createdBy: input.requesterUserId,
    });
  }
}
