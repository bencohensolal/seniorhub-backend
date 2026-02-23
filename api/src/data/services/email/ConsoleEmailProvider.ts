import type { EmailMessage, EmailProvider } from './types.js';

export class ConsoleEmailProvider implements EmailProvider {
  async send(message: EmailMessage): Promise<void> {
    if (message.to.endsWith('@fail.test')) {
      throw new Error('Simulated email provider failure.');
    }

    console.info(`Invitation email queued for delivery to ${message.to}`);
  }
}
