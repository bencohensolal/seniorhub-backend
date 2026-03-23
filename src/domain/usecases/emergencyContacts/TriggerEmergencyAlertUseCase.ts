import type { HouseholdRepository } from '../../repositories/HouseholdRepository.js';
import type { ExpoPushService } from '../../../services/ExpoPushService.js';
import type { SmsService } from '../../../services/SmsService.js';
import { HouseholdAccessValidator } from '../shared/HouseholdAccessValidator.js';

export class TriggerEmergencyAlertUseCase {
  private readonly accessValidator: HouseholdAccessValidator;
  constructor(
    private readonly repository: HouseholdRepository,
    private readonly pushService: ExpoPushService,
    private readonly smsService: SmsService,
  ) {
    this.accessValidator = new HouseholdAccessValidator(repository);
  }

  async execute(householdId: string, requesterUserId: string): Promise<{ tokensSent: number; smsSent: number }> {
    await this.accessValidator.ensureMember(requesterUserId, householdId);

    const member = await this.repository.findActiveMemberByUserInHousehold(requesterUserId, householdId);
    const senderName = member ? `${member.firstName} ${member.lastName}`.trim() : 'Un membre de la famille';

    // Push notifications to caregivers
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

    // SMS to all emergency contacts (best-effort, errors are logged but not thrown)
    const contacts = await this.repository.listEmergencyContacts(householdId);
    const smsBody = `🚨 ${senderName} a besoin d'aide. Veuillez le/la rappeler ou vous rendre sur place.`;
    await Promise.all(
      contacts.map(contact => this.smsService.send(contact.phone, smsBody)),
    );

    return { tokensSent: tokens.length, smsSent: contacts.length };
  }
}
