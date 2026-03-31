import type { HouseholdRepository } from '../../repositories/HouseholdRepository.js';
import type { DisplayTabletWithToken } from '../../entities/DisplayTablet.js';
import { HouseholdAccessValidator } from '../shared/HouseholdAccessValidator.js';
import { PlanLimitGuard } from '../shared/PlanLimitGuard.js';
import { ForbiddenError } from '../../errors/index.js';

export class CreateDisplayTabletUseCase {
  private readonly accessValidator: HouseholdAccessValidator;
  private readonly planLimitGuard: PlanLimitGuard;

  constructor(private readonly repository: HouseholdRepository) {
    this.accessValidator = new HouseholdAccessValidator(repository);
    this.planLimitGuard = new PlanLimitGuard(repository);
  }

  async execute(input: {
    householdId: string;
    name: string;
    description?: string;
    requesterUserId: string;
  }): Promise<DisplayTabletWithToken> {
    // Validate household access and role
    const member = await this.accessValidator.ensureMember(input.requesterUserId, input.householdId);

    // Tablets cannot create other tablets
    if (!member) {
      throw new ForbiddenError('Tablets cannot create display tablets.');
    }

    // Only caregivers and family can create tablets (not seniors)
    if (member.role === 'senior') {
      throw new ForbiddenError('Seniors cannot create display tablets.');
    }

    // Check plan limit for tablets
    const activeCount = await this.repository.countActiveDisplayTablets(input.householdId);
    await this.planLimitGuard.ensureWithinLimit({
      householdId: input.householdId,
      resource: 'display_tablets',
      currentCount: activeCount,
      limitKey: 'maxTablets',
    });

    // Create the tablet
    return this.repository.createDisplayTablet({
      householdId: input.householdId,
      name: input.name,
      description: input.description,
      createdBy: input.requesterUserId,
    });
  }
}
