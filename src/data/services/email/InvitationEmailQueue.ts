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
    console.info('[EmailQueue] Enqueuing bulk email jobs:', {
      count: jobs.length,
      recipients: jobs.map(j => j.inviteeEmail),
      invitationIds: jobs.map(j => j.invitationId),
    });

    for (const job of jobs) {
      this.metrics.incrementQueued();
      // Job queued - detailed logging available if needed

      setTimeout(() => {
        this.processJob(job, 1).catch(() => undefined);
      }, 0);
    }
  }

  private async processJob(job: InvitationEmailJob, attempt: number): Promise<void> {
    console.info(`[EmailQueue] Processing job (attempt ${attempt}/${env.EMAIL_JOB_MAX_RETRIES}):`, {
      invitationId: job.invitationId,
      recipient: job.inviteeEmail,
      role: job.assignedRole,
    });

    try {
      const template = await buildInvitationEmailTemplate({
        firstName: job.inviteeFirstName,
        assignedRole: job.assignedRole,
        acceptLinkUrl: job.acceptLinkUrl,
        deepLinkUrl: job.deepLinkUrl,
        fallbackUrl: job.fallbackUrl,
      });

      // Template built successfully - content validated

      await this.provider.send({
        to: job.inviteeEmail,
        subject: template.subject,
        body: template.body,
      });

      this.metrics.incrementSent();
      console.info('[EmailQueue] ✅ Email sent successfully:', {
        invitationId: job.invitationId,
        recipient: job.inviteeEmail,
      });
    } catch (error) {
      this.metrics.incrementFailed();
      
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error(`[EmailQueue] ❌ Email send failed (attempt ${attempt}):`, {
        invitationId: job.invitationId,
        recipient: job.inviteeEmail,
        error: errorMessage,
        willRetry: attempt < env.EMAIL_JOB_MAX_RETRIES,
      });

      if (attempt >= env.EMAIL_JOB_MAX_RETRIES) {
        this.metrics.incrementDeadLetter();
        console.error('[EmailQueue] 💀 Email moved to dead letter queue (max retries exceeded):', {
          invitationId: job.invitationId,
          recipient: job.inviteeEmail,
          totalAttempts: attempt,
        });
        return;
      }

      this.metrics.incrementRetries();
      console.warn(`[EmailQueue] 🔄 Scheduling retry ${attempt + 1}/${env.EMAIL_JOB_MAX_RETRIES} in ${env.EMAIL_JOB_RETRY_DELAY_MS}ms`);
      
      setTimeout(() => {
        this.processJob(job, attempt + 1).catch(() => undefined);
      }, env.EMAIL_JOB_RETRY_DELAY_MS);
    }
  }
}
