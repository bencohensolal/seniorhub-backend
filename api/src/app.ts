import Fastify from 'fastify';
import { householdsRoutes } from './routes/households.js';
import { authContextPlugin } from './plugins/authContext.js';

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

  app.register(authContextPlugin);
  app.register(householdsRoutes);

  return app;
};
