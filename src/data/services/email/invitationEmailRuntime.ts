import { env } from '../../../config/env.js';
import { InvitationEmailMetrics } from './InvitationEmailMetrics.js';
import { InvitationEmailQueue } from './InvitationEmailQueue.js';
import { getEmailProvider } from './emailProvider.js';

const metrics = new InvitationEmailMetrics();
const provider = getEmailProvider();
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
