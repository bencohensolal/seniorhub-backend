import type { CheckMissedMedicationsUseCase } from '../domain/usecases/notifications/CheckMissedMedicationsUseCase.js';

const INTERVAL_MS = 15 * 60 * 1000; // 15 minutes

export function startMedicationAlertScheduler(
  useCase: CheckMissedMedicationsUseCase,
): void {
  const run = async () => {
    try {
      await useCase.execute();
    } catch (err) {
      console.error('[MedicationAlertScheduler] Error during check:', err);
    }
  };

  // Run immediately on startup, then every 15 minutes
  void run();
  setInterval(() => void run(), INTERVAL_MS);

  console.log('[MedicationAlertScheduler] Started — checking every 15 minutes');
}
