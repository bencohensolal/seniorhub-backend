import Fastify from 'fastify';
import swagger from '@fastify/swagger';
import swaggerUi from '@fastify/swagger-ui';
import { householdsRoutes } from './routes/households/index.js';
import { registerPublicMedicationRoutes } from './routes/medicationRoutes.js';
import { registerPrivacySettingsRoutes } from './routes/privacySettingsRoutes.js';
import { registerUserProfileRoutes } from './routes/userProfileRoutes.js';
import { registerPushTokenRoutes } from './routes/me/pushTokenRoutes.js';
import { registerAuthContext } from './plugins/authContext.js';
import { createHouseholdRepository } from './data/repositories/createHouseholdRepository.js';
import { getPostgresPool } from './data/db/postgres.js';
import { PostgresNotificationRepository } from './data/repositories/postgres/PostgresNotificationRepository.js';
import { ExpoPushService } from './services/ExpoPushService.js';
import { CheckMissedMedicationsUseCase } from './domain/usecases/notifications/CheckMissedMedicationsUseCase.js';
import { startMedicationAlertScheduler } from './scheduler/medicationAlertScheduler.js';
import { registerInternalRoutes } from './routes/internal/triggerRoutes.js';
import { registerEmailAuthRoutes } from './routes/auth/emailAuthRoutes.js';
import { GetUserPrivacySettingsUseCase } from './domain/usecases/privacySettings/GetUserPrivacySettingsUseCase.js';
import { UpdateUserPrivacySettingsUseCase } from './domain/usecases/privacySettings/UpdateUserPrivacySettingsUseCase.js';

export const buildApp = () => {
  const app = Fastify({
    logger: {
      redact: {
        paths: [
          'req.headers.x-user-email',
          'req.headers.authorization',
          'req.body.users[*].email',
          'req.body.token',
          'req.query.token',
        ],
        remove: true,
      },
    },
    // Allow empty bodies for DELETE requests with Content-Type: application/json
    ignoreTrailingSlash: true,
  });

  // Override default JSON parser to allow empty bodies on DELETE requests
  app.removeContentTypeParser('application/json');
  app.addContentTypeParser('application/json', { parseAs: 'string' }, (req, body, done) => {
    // Allow empty body for DELETE requests
    if (req.method === 'DELETE' && body === '') {
      done(null, undefined);
      return;
    }

    try {
      const json = JSON.parse(body as string);
      done(null, json);
    } catch (err: unknown) {
      const parseError = err instanceof Error ? err : new Error('Invalid JSON payload');
      Object.assign(parseError, { statusCode: 400 });
      done(parseError, undefined);
    }
  });

  app.get('/health', async () => {
    return { status: 'ok' };
  });

  app.register(swagger, {
    openapi: {
      info: {
        title: 'Senior Hub API',
        version: '0.1.0',
        description: 'Household onboarding and invitation management API contracts.',
      },
      tags: [{ name: 'Households' }, { name: 'Invitations' }, { name: 'Medications' }, { name: 'Observability' }, { name: 'Privacy' }, { name: 'Users' }],
    },
  });

  app.register(swaggerUi, {
    routePrefix: '/docs',
    staticCSP: true,
    transformSpecificationClone: true,
  });

  registerAuthContext(app);
  app.register(householdsRoutes);
  registerPublicMedicationRoutes(app);

  // Privacy settings + user profile routes
  const repository = createHouseholdRepository();
  registerPrivacySettingsRoutes(app, {
    getUserPrivacySettingsUseCase: new GetUserPrivacySettingsUseCase(repository),
    updateUserPrivacySettingsUseCase: new UpdateUserPrivacySettingsUseCase(repository),
  });
  registerUserProfileRoutes(app, repository);

  // Email + password authentication (for users without Google accounts)
  registerEmailAuthRoutes(app, repository);

  // Push token registration
  const pool = getPostgresPool();
  const notifRepo = new PostgresNotificationRepository(pool);
  registerPushTokenRoutes(app, notifRepo);

  // Caregiver missed-medication alert scheduler
  const pushService = new ExpoPushService();
  const checkMissedUseCase = new CheckMissedMedicationsUseCase(notifRepo, pushService);
  startMedicationAlertScheduler(checkMissedUseCase);

  // Internal routes (manual trigger for testing)
  registerInternalRoutes(app, checkMissedUseCase, notifRepo);

  return app;
};
