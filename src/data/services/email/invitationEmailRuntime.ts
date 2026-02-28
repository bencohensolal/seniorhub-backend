import { env } from '../../../config/env.js';
import { ConsoleEmailProvider } from './ConsoleEmailProvider.js';
import { ResendEmailProvider } from './ResendEmailProvider.js';
import { GmailSmtpProvider } from './GmailSmtpProvider.js';
import { InvitationEmailMetrics } from './InvitationEmailMetrics.js';
import { InvitationEmailQueue } from './InvitationEmailQueue.js';
import type { EmailProvider } from './types.js';

function createEmailProvider(): EmailProvider {
  console.info('[Email] Initializing email provider...', {
    provider: env.EMAIL_PROVIDER,
    hasResendKey: !!env.RESEND_API_KEY,
    hasGmailUser: !!env.GMAIL_USER,
    hasGmailPass: !!env.GMAIL_APP_PASSWORD,
    hasEmailFrom: !!env.EMAIL_FROM,
  });

  switch (env.EMAIL_PROVIDER) {
    case 'resend':
      console.info('[Email] ✅ Using Resend email provider');
      return new ResendEmailProvider({
        apiKey: env.RESEND_API_KEY!,
        from: env.EMAIL_FROM!,
      });
    case 'gmail':
      console.info('[Email] ✅ Using Gmail SMTP provider');
      return new GmailSmtpProvider({
        user: env.GMAIL_USER!,
        pass: env.GMAIL_APP_PASSWORD!,
        from: env.EMAIL_FROM!,
      });
    case 'console':
    default:
      console.info('[Email] ✅ Using Console email provider (development mode - emails will be logged, not sent)');
      return new ConsoleEmailProvider();
  }
}

const metrics = new InvitationEmailMetrics();
const provider = createEmailProvider();
const queue = new InvitationEmailQueue(provider, metrics);

console.info('[Email] Email runtime initialized successfully', {
  provider: env.EMAIL_PROVIDER,
  maxRetries: env.EMAIL_JOB_MAX_RETRIES,
  retryDelayMs: env.EMAIL_JOB_RETRY_DELAY_MS,
});

export const invitationEmailRuntime = {
  queue,
  metrics,
};
