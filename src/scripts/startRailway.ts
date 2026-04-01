import { spawn } from 'node:child_process';

const MIGRATION_RETRY_ATTEMPTS = 12;
const MIGRATION_RETRY_DELAY_MS = 5000;

const wait = async (milliseconds: number): Promise<void> =>
  new Promise((resolve) => {
    setTimeout(resolve, milliseconds);
  });

const runCommand = (command: string, args: string[]): Promise<void> =>
  new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      stdio: 'inherit',
      env: process.env,
    });

    child.on('error', reject);

    child.on('exit', (code) => {
      if (code === 0) {
        resolve();
        return;
      }

      reject(new Error(`${command} ${args.join(' ')} exited with code ${code ?? 'unknown'}.`));
    });
  });

const bootstrap = async (): Promise<void> => {
  const persistenceDriver = process.env.PERSISTENCE_DRIVER ?? 'in-memory';

  if (persistenceDriver === 'postgres') {
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= MIGRATION_RETRY_ATTEMPTS; attempt += 1) {
      try {
        await runCommand('node', ['dist/scripts/migrate.js']);
        lastError = null;
        break;
      } catch (error) {
        lastError = error instanceof Error ? error : new Error('Unknown migration failure.');
        console.error(
          `Migration attempt ${attempt}/${MIGRATION_RETRY_ATTEMPTS} failed: ${lastError.message}`,
        );

        if (attempt < MIGRATION_RETRY_ATTEMPTS) {
          await wait(MIGRATION_RETRY_DELAY_MS);
        }
      }
    }

    if (lastError) {
      throw lastError;
    }
  }

  await runCommand('node', ['dist/server.js']);
};

bootstrap().catch((error) => {
  console.error('Railway bootstrap failed:', error);
  process.exit(1);
});
