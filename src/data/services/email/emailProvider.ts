import { env } from '../../../config/env.js';
import { ConsoleEmailProvider } from './ConsoleEmailProvider.js';
import { ResendEmailProvider } from './ResendEmailProvider.js';
import { GmailSmtpProvider } from './GmailSmtpProvider.js';
import type { EmailProvider } from './types.js';

/**
 * Lazy singleton for the email provider.
 * Reused across invitation emails, payment failure emails, etc.
 */
let instance: EmailProvider | null = null;

export function getEmailProvider(): EmailProvider {
  if (instance) return instance;

  switch (env.EMAIL_PROVIDER) {
    case 'resend':
      instance = new ResendEmailProvider({
        apiKey: env.RESEND_API_KEY!,
        from: env.EMAIL_FROM!,
      });
      break;
    case 'gmail':
      instance = new GmailSmtpProvider({
        user: env.GMAIL_USER!,
        pass: env.GMAIL_APP_PASSWORD!,
        from: env.EMAIL_FROM!,
      });
      break;
    case 'console':
    default:
      instance = new ConsoleEmailProvider();
      break;
  }

  return instance;
}
