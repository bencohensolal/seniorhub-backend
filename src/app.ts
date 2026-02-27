import Fastify from 'fastify';
import swagger from '@fastify/swagger';
import swaggerUi from '@fastify/swagger-ui';
import { householdsRoutes } from './routes/households/index.js';
import { registerPublicMedicationRoutes } from './routes/medicationRoutes.js';
import { registerAuthContext } from './plugins/authContext.js';

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
      tags: [{ name: 'Households' }, { name: 'Invitations' }, { name: 'Medications' }, { name: 'Observability' }],
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

  return app;
};
