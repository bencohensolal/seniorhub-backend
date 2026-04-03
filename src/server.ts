import { env } from './config/env.js';
import { buildApp } from './app.js';
import { WeeklySummaryScheduler } from './services/WeeklySummaryScheduler.js';
import { getPostgresPool } from './data/db/postgres.js';
import { createHouseholdRepository } from './data/repositories/createHouseholdRepository.js';
import { PostgresJournalEntryRepository } from './data/repositories/postgres/PostgresJournalEntryRepository.js';
import { expoPushService } from './services/ExpoPushService.js';
import { getEmailProvider } from './data/services/email/emailProvider.js';

const app = buildApp();

const start = async () => {
  try {
    await app.listen({
      host: env.HOST,
      port: env.PORT,
    });
    app.log.info(`API listening on ${env.HOST}:${env.PORT}`);

    // Start weekly summary scheduler (Sérénité feature)
    if (env.PERSISTENCE_DRIVER === 'postgres') {
      try {
        const pool = getPostgresPool();
        const scheduler = new WeeklySummaryScheduler({
          pool,
          householdRepository: createHouseholdRepository(),
          journalRepository: new PostgresJournalEntryRepository(pool),
          pushService: expoPushService,
          emailProvider: getEmailProvider(),
        });
        scheduler.start();
        app.log.info('Weekly summary scheduler started');
      } catch (err) {
        app.log.warn({ err }, 'Failed to start weekly summary scheduler — continuing without it');
      }
    }
  } catch (error) {
    app.log.error(error);
    process.exit(1);
  }
};

start();
