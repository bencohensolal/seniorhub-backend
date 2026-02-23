import { env } from './config/env.js';
import { buildApp } from './app.js';

const app = buildApp();

const start = async () => {
  try {
    await app.listen({
      host: env.HOST,
      port: env.PORT,
    });
    app.log.info(`API listening on ${env.HOST}:${env.PORT}`);
  } catch (error) {
    app.log.error(error);
    process.exit(1);
  }
};

start();
