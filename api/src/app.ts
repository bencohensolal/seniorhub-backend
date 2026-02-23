import Fastify from 'fastify';
import { householdsRoutes } from './routes/households.js';

export const buildApp = () => {
  const app = Fastify({ logger: true });

  app.get('/health', async () => {
    return { status: 'ok' };
  });

  app.register(householdsRoutes);

  return app;
};
