import { env } from '../../../config/env.js';
import { buildInvitationEmailTemplate } from '../../../domain/services/invitationEmailTemplate.js';
import type { EmailProvider, InvitationEmailJob } from './types.js';
import type { InvitationEmailMetrics } from './InvitationEmailMetrics.js';

export class InvitationEmailQueue {
  constructor(
    private readonly provider: EmailProvider,
    private readonly metrics: InvitationEmailMetrics,
  ) {}

  enqueueBulk(jobs: InvitationEmailJob[]): void {
    for (const job of jobs) {
      this.metrics.incrementQueued();
      setTimeout(() => {
        this.processJob(job, 1).catch(() => undefined);
      }, 0);
    }
  }

  private async processJob(job: InvitationEmailJob, attempt: number): Promise<void> {
    try {
      const template = buildInvitationEmailTemplate({
        firstName: job.inviteeFirstName,
        assignedRole: job.assignedRole,
        deepLinkUrl: job.deepLinkUrl,
        fallbackUrl: job.fallbackUrl,
      });

      await this.provider.send({
        to: job.inviteeEmail,
        subject: template.subject,
        body: template.body,
      });

      this.metrics.incrementSent();
    } catch (_error) {
      this.metrics.incrementFailed();

      if (attempt >= env.EMAIL_JOB_MAX_RETRIES) {
        this.metrics.incrementDeadLetter();
        return;
      }

      this.metrics.incrementRetries();
      setTimeout(() => {
        this.processJob(job, attempt + 1).catch(() => undefined);
      }, env.EMAIL_JOB_RETRY_DELAY_MS);
    }
  }
}
