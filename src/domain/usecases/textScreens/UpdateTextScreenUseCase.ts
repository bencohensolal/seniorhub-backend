import type { HouseholdRepository } from '../../repositories/HouseholdRepository.js';
import type { AuthenticatedRequester } from '../../entities/Household.js';
import type {
  UpdateTextScreenInput,
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

export class UpdateTextScreenUseCase {
  constructor(private readonly repository: HouseholdRepository) {}

  async execute(input: {
    householdId: string;
    tabletId: string;
    textScreenId: string;
    title?: string;
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
      throw new ForbiddenError('Only caregivers can update text screens.');
    }

    // Verify text screen exists
    const existingScreen = await this.repository.getTextScreenById(
      input.textScreenId,
      input.tabletId,
      input.householdId,
    );

    if (!existingScreen) {
      throw new NotFoundError('Text screen not found.');
    }

    // Update the text screen - only include defined properties
    const updateInput: UpdateTextScreenInput = {};
    if (input.title !== undefined) updateInput.title = input.title;
    if (input.body !== undefined) updateInput.body = input.body;
    if (input.order !== undefined) updateInput.order = input.order;
    if (input.fontFamily !== undefined) updateInput.fontFamily = input.fontFamily;
    if (input.fontSize !== undefined) updateInput.fontSize = input.fontSize;
    if (input.textColor !== undefined) updateInput.textColor = input.textColor;
    if (input.textAlign !== undefined) updateInput.textAlign = input.textAlign;
    if (input.backgroundType !== undefined) updateInput.backgroundType = input.backgroundType;
    if (input.backgroundColor !== undefined) updateInput.backgroundColor = input.backgroundColor;
    if (input.backgroundColorEnd !== undefined) updateInput.backgroundColorEnd = input.backgroundColorEnd;
    if (input.gradientDirection !== undefined) updateInput.gradientDirection = input.gradientDirection;
    if (input.icon !== undefined) updateInput.icon = input.icon;
    if (input.animation !== undefined) updateInput.animation = input.animation;

    const updatedScreen = await this.repository.updateTextScreen(
      input.textScreenId,
      input.tabletId,
      input.householdId,
      updateInput,
    );

    // Notify the tablet that its config has been updated
    tabletConfigNotifier.notifyConfigUpdate(input.tabletId, { lastUpdated: new Date().toISOString() });

    return updatedScreen;
  }
}
