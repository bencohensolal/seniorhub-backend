import type { HouseholdRepository } from '../../repositories/HouseholdRepository.js';
import type { AuthenticatedRequester } from '../../entities/Household.js';
import type { CreatePhotoScreenInput, PhotoScreen } from '../../entities/PhotoScreen.js';
import { NotFoundError, ForbiddenError } from '../../errors/index.js';
import { PlanLimitGuard } from '../shared/PlanLimitGuard.js';
import { tabletConfigNotifier } from '../../services/tabletConfigNotifier.js';

export class CreatePhotoScreenUseCase {
  private readonly planLimitGuard: PlanLimitGuard;

  constructor(private readonly repository: HouseholdRepository) {
    this.planLimitGuard = new PlanLimitGuard(repository);
  }

  async execute(input: {
    householdId: string;
    tabletId: string;
    name: string;
    order?: number;
    displayMode?: 'slideshow' | 'mosaic' | 'single';
    slideshowDuration?: number;
    slideshowTransition?: 'fade' | 'slide' | 'none';
    slideshowOrder?: 'sequential' | 'random';
    showCaptions?: boolean;
    requester: AuthenticatedRequester;
  }): Promise<PhotoScreen> {
    // Verify requester is a caregiver in the household
    const member = await this.repository.findActiveMemberByUserInHousehold(
      input.requester.userId,
      input.householdId,
    );

    if (!member) {
      throw new NotFoundError('Household not found or you are not a member.');
    }

    if (member.role !== 'caregiver') {
      throw new ForbiddenError('Only caregivers can create photo screens.');
    }

    // Verify tablet exists and belongs to the household
    const tablet = await this.repository.getDisplayTabletById(input.tabletId, input.householdId);

    if (!tablet) {
      throw new NotFoundError('Display tablet not found.');
    }

    // Check plan limit for photo screens per tablet
    const existingCount = await this.repository.countPhotoScreens(input.tabletId, input.householdId);
    await this.planLimitGuard.ensureWithinLimit({
      householdId: input.householdId,
      resource: 'photo_screens',
      currentCount: existingCount,
      limitKey: 'maxPhotoScreensPerTablet',
    });

    // Create the photo screen with defaults
    const createInput: CreatePhotoScreenInput = {
      tabletId: input.tabletId,
      householdId: input.householdId,
      name: input.name,
      ...(input.order !== undefined && { order: input.order }),
      createdBy: input.requester.userId,
      ...(input.displayMode !== undefined && { displayMode: input.displayMode }),
      ...(input.slideshowDuration !== undefined && { slideshowDuration: input.slideshowDuration }),
      ...(input.slideshowTransition !== undefined && { slideshowTransition: input.slideshowTransition }),
      ...(input.slideshowOrder !== undefined && { slideshowOrder: input.slideshowOrder }),
      ...(input.showCaptions !== undefined && { showCaptions: input.showCaptions }),
    };

    const photoScreen = await this.repository.createPhotoScreen(createInput);

    // Notify the tablet that its config has been updated
    tabletConfigNotifier.notifyConfigUpdate(input.tabletId, { lastUpdated: new Date().toISOString() });

    return photoScreen;
  }
}
