import cron, { type ScheduledTask } from 'node-cron';
import type { Pool } from 'pg';
import type { HouseholdRepository } from '../domain/repositories/HouseholdRepository.js';
import type { JournalEntryRepository } from '../domain/repositories/JournalEntryRepository.js';
import { GenerateWeeklySummaryUseCase } from '../domain/usecases/reports/GenerateWeeklySummaryUseCase.js';
import type { ExpoPushService } from './ExpoPushService.js';
import type { EmailProvider } from '../data/services/email/types.js';
import { buildWeeklySummaryEmail } from './templates/weeklySummaryEmail.js';

interface WeeklySummarySchedulerDeps {
  pool: Pool;
  householdRepository: HouseholdRepository;
  journalRepository: JournalEntryRepository;
  pushService: ExpoPushService;
  emailProvider: EmailProvider;
}

export class WeeklySummaryScheduler {
  private task: ScheduledTask | null = null;
  private readonly pool: Pool;
  private readonly householdRepository: HouseholdRepository;
  private readonly journalRepository: JournalEntryRepository;
  private readonly pushService: ExpoPushService;
  private readonly emailProvider: EmailProvider;

  constructor(deps: WeeklySummarySchedulerDeps) {
    this.pool = deps.pool;
    this.householdRepository = deps.householdRepository;
    this.journalRepository = deps.journalRepository;
    this.pushService = deps.pushService;
    this.emailProvider = deps.emailProvider;
  }

  start(): void {
    // Every Monday at 9am
    this.task = cron.schedule('0 9 * * 1', () => {
      this.run().catch((err) =>
        console.error('[WeeklySummaryScheduler] Unhandled error:', err),
      );
    });
    console.log('[WeeklySummaryScheduler] Scheduled (every Monday at 9am)');
  }

  stop(): void {
    if (this.task) {
      this.task.stop();
      this.task = null;
      console.log('[WeeklySummaryScheduler] Stopped');
    }
  }

  async run(): Promise<void> {
    console.log('[WeeklySummaryScheduler] Running weekly summary generation...');

    // List all households with active serenite plan
    const { rows: sereniteHouseholds } = await this.pool.query<{ household_id: string }>(
      `SELECT household_id FROM subscriptions
       WHERE plan = 'serenite' AND status = 'active'`,
    );

    if (sereniteHouseholds.length === 0) {
      console.log('[WeeklySummaryScheduler] No serenite households found, skipping.');
      return;
    }

    const useCase = new GenerateWeeklySummaryUseCase(
      this.householdRepository,
      this.journalRepository,
    );

    let successCount = 0;
    let errorCount = 0;

    for (const row of sereniteHouseholds) {
      const householdId = row.household_id;
      try {
        // Generate the summary
        const summary = await useCase.execute({ householdId });

        // Send push notifications to caregivers
        const tokens = await this.householdRepository.getCaregiverPushTokens(householdId);
        if (tokens.length > 0) {
          await this.pushService.send([
            {
              to: tokens,
              title: summary.title,
              body: summary.body,
              sound: 'default',
              data: { type: 'weekly_summary', householdId },
            },
          ]);
        }

        // Send emails to caregivers
        const members = await this.householdRepository.listHouseholdMembers(householdId);
        const caregiverEmails = members
          .filter((m) => m.role !== 'senior' && m.email)
          .map((m) => m.email!);

        if (caregiverEmails.length > 0) {
          const { subject, html } = buildWeeklySummaryEmail(summary);
          for (const email of caregiverEmails) {
            try {
              await this.emailProvider.send({ to: email, subject, body: html });
            } catch (emailErr) {
              console.error(
                `[WeeklySummaryScheduler] Failed to send email to ${email}:`,
                emailErr,
              );
            }
          }
        }

        successCount++;
      } catch (err) {
        errorCount++;
        console.error(
          `[WeeklySummaryScheduler] Failed for household ${householdId}:`,
          err,
        );
      }
    }

    console.log(
      `[WeeklySummaryScheduler] Done. Success: ${successCount}, Errors: ${errorCount}`,
    );
  }
}
