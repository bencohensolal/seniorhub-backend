import Fastify from 'fastify';
import { householdsRoutes } from './routes/households.js';
import { authContextPlugin } from './plugins/authContext.js';

export const buildApp = () => {
  const app = Fastify({ logger: true });

  app.get('/health', async () => {
    return { status: 'ok' };
  });

  app.register(authContextPlugin);
  app.register(householdsRoutes);

  return app;
};
