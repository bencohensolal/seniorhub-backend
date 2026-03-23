import type { HouseholdRepository } from '../../repositories/HouseholdRepository.js';
import type { ExpoPushService } from '../../../services/ExpoPushService.js';
import { HouseholdAccessValidator } from '../shared/HouseholdAccessValidator.js';

export class TriggerEmergencyAlertUseCase {
  private readonly accessValidator: HouseholdAccessValidator;
  constructor(
    private readonly repository: HouseholdRepository,
    private readonly pushService: ExpoPushService,
  ) {
    this.accessValidator = new HouseholdAccessValidator(repository);
  }

  async execute(householdId: string, requesterUserId: string): Promise<{ tokensSent: number }> {
    await this.accessValidator.ensureMember(requesterUserId, householdId);

    // Get the requester's name for the notification
    const member = await this.repository.findActiveMemberByUserInHousehold(requesterUserId, householdId);
    const senderName = member ? `${member.firstName} ${member.lastName}`.trim() : 'Un membre de la famille';

    const tokens = await this.repository.getCaregiverPushTokens(householdId);

    if (tokens.length > 0) {
      await this.pushService.send(tokens.map(token => ({
        to: token,
        title: '🚨 Alerte urgence',
        body: `${senderName} a déclenché une alerte d'urgence.`,
        sound: 'default' as const,
        priority: 'high' as const,
        data: { type: 'emergency_alert', householdId },
      })));
    }

    return { tokensSent: tokens.length };
  }
}
