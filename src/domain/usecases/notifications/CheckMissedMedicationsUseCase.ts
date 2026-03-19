import type { PostgresNotificationRepository } from '../../../data/repositories/postgres/PostgresNotificationRepository.js';
import type { ExpoPushService } from '../../../services/ExpoPushService.js';

const GRACE_MINUTES = 30;

export class CheckMissedMedicationsUseCase {
  constructor(
    private readonly notifRepo: PostgresNotificationRepository,
    private readonly pushService: ExpoPushService,
  ) {}

  async execute(graceMinutes: number = GRACE_MINUTES): Promise<void> {
    const missed = await this.notifRepo.getMissedMedications(graceMinutes);
    if (missed.length === 0) return;

    console.log(`[CheckMissedMedications] Found ${missed.length} missed medication(s)`);

    // Group by household to batch caregiver token lookups
    const byHousehold = new Map<string, typeof missed>();
    for (const m of missed) {
      const list = byHousehold.get(m.householdId) ?? [];
      list.push(m);
      byHousehold.set(m.householdId, list);
    }

    const today = await this.notifRepo.getTodayParis();

    for (const [householdId, medications] of byHousehold) {
      const caregiverIds = await this.notifRepo.getCaregiverUserIds(householdId);
      if (caregiverIds.length === 0) continue;

      const tokens = await this.notifRepo.getPushTokensForUsers(caregiverIds);
      if (tokens.length === 0) continue;

      for (const med of medications) {
        const messages = tokens.map(token => ({
          to: token,
          title: '⚠️ Médicaments non pris',
          body: `${med.seniorFirstName} n'a pas confirmé la prise des médicaments de ${med.scheduledTime}.`,
          sound: 'default' as const,
          priority: 'high' as const,
          data: {
            type: 'missed_medication',
            householdId,
            medicationId: med.medicationId,
            scheduledTime: med.scheduledTime,
          },
        }));

        await this.pushService.send(messages);
        await this.notifRepo.markAlertSent(med.medicationId, today, med.scheduledTime);

        console.log(
          `[CheckMissedMedications] Alert sent for "${med.medicationName}" ` +
          `(${med.scheduledTime}) → ${tokens.length} caregiver(s)`,
        );
      }
    }
  }
}
