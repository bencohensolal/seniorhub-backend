import type { HouseholdRepository } from '../../repositories/HouseholdRepository.js';
import type { AuthenticatedRequester } from '../../entities/Household.js';
import type {
  CreateTextScreenInput,
  TextScreen,
  FontFamily,
  FontSize,
  TextAlign,
  BackgroundType,
  GradientDirection,
  TextAnimation,
} from '../../entities/TextScreen.js';
import { NotFoundError, ForbiddenError } from '../../errors/index.js';
import { tabletConfigNotifier } from '../../services/tabletConfigNotifier.js';

export class CreateTextScreenUseCase {
  constructor(private readonly repository: HouseholdRepository) {}

  async execute(input: {
    householdId: string;
    tabletId: string;
    title: string;
    body?: string | null;
    order?: number;
    fontFamily?: FontFamily;
    fontSize?: FontSize;
    textColor?: string;
    textAlign?: TextAlign;
    backgroundType?: BackgroundType;
    backgroundColor?: string;
    backgroundColorEnd?: string | null;
    gradientDirection?: GradientDirection;
    icon?: string | null;
    animation?: TextAnimation;
    requester: AuthenticatedRequester;
  }): Promise<TextScreen> {
    // Verify requester is a caregiver in the household
    const member = await this.repository.findActiveMemberByUserInHousehold(
      input.requester.userId,
      input.householdId,
    );

    if (!member) {
      throw new NotFoundError('Household not found or you are not a member.');
    }

    if (member.role !== 'caregiver') {
      throw new ForbiddenError('Only caregivers can create text screens.');
    }

    // Verify tablet exists and belongs to the household
    const tablet = await this.repository.getDisplayTabletById(input.tabletId, input.householdId);

    if (!tablet) {
      throw new NotFoundError('Display tablet not found.');
    }

    // Create the text screen with defaults
    const createInput: CreateTextScreenInput = {
      tabletId: input.tabletId,
      householdId: input.householdId,
      title: input.title,
      ...(input.body !== undefined && { body: input.body }),
      ...(input.order !== undefined && { order: input.order }),
      createdBy: input.requester.userId,
      ...(input.fontFamily !== undefined && { fontFamily: input.fontFamily }),
      ...(input.fontSize !== undefined && { fontSize: input.fontSize }),
      ...(input.textColor !== undefined && { textColor: input.textColor }),
      ...(input.textAlign !== undefined && { textAlign: input.textAlign }),
      ...(input.backgroundType !== undefined && { backgroundType: input.backgroundType }),
      ...(input.backgroundColor !== undefined && { backgroundColor: input.backgroundColor }),
      ...(input.backgroundColorEnd !== undefined && { backgroundColorEnd: input.backgroundColorEnd }),
      ...(input.gradientDirection !== undefined && { gradientDirection: input.gradientDirection }),
      ...(input.icon !== undefined && { icon: input.icon }),
      ...(input.animation !== undefined && { animation: input.animation }),
    };

    const textScreen = await this.repository.createTextScreen(createInput);

    // Notify the tablet that its config has been updated
    tabletConfigNotifier.notifyConfigUpdate(input.tabletId, { lastUpdated: new Date().toISOString() });

    return textScreen;
  }
}
