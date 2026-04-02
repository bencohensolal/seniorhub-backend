import type { HouseholdRepository } from '../../repositories/HouseholdRepository.js';
import type { ExpoPushService } from '../../../services/ExpoPushService.js';

/**
 * Checks for tasks that require confirmation but haven't been confirmed
 * within the configured delay. Sends high-priority push notifications
 * to all caregivers in the household and marks tasks as notified.
 *
 * Designed to be called periodically (e.g., every 5 minutes via cron).
 */
export class CheckUnconfirmedTasksUseCase {
  constructor(
    private readonly repository: HouseholdRepository,
    private readonly pushService: ExpoPushService,
  ) {}

  async execute(): Promise<{ notifiedCount: number }> {
    // Find all tasks past their confirmation deadline that haven't been notified
    const overdueTasks = await this.repository.listUnconfirmedTasks();

    if (overdueTasks.length === 0) {
      return { notifiedCount: 0 };
    }

    // Group tasks by householdId to batch notifications
    const tasksByHousehold = new Map<string, typeof overdueTasks>();
    for (const task of overdueTasks) {
      const existing = tasksByHousehold.get(task.householdId) || [];
      existing.push(task);
      tasksByHousehold.set(task.householdId, existing);
    }

    const notifiedTaskIds: string[] = [];

    for (const [householdId, tasks] of tasksByHousehold) {
      try {
        const tokens = await this.repository.getCaregiverPushTokens(householdId);
        if (tokens.length === 0) continue;

        // Send one notification per overdue task
        const messages = tasks.map(task => ({
          to: tokens,
          title: '⚠️ Tâche non confirmée',
          body: `« ${task.title} » n'a pas été confirmée.`,
          sound: 'default' as const,
          priority: 'high' as const,
          data: { type: 'task_unconfirmed', householdId, taskId: task.id },
        }));

        await this.pushService.send(messages);
        notifiedTaskIds.push(...tasks.map(t => t.id));
      } catch (err) {
        console.error(`[CheckUnconfirmedTasks] Failed for household ${householdId}:`, err);
      }
    }

    // Mark all notified tasks to prevent re-sending
    if (notifiedTaskIds.length > 0) {
      await this.repository.markConfirmationNotified(notifiedTaskIds);
    }

    return { notifiedCount: notifiedTaskIds.length };
  }
}
