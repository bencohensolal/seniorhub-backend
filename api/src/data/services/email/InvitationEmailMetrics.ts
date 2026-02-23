export interface InvitationEmailMetricsSnapshot {
  queued: number;
  sent: number;
  failed: number;
  retries: number;
  deadLetter: number;
}

export class InvitationEmailMetrics {
  private queued = 0;
  private sent = 0;
  private failed = 0;
  private retries = 0;
  private deadLetter = 0;

  incrementQueued(): void {
    this.queued += 1;
  }

  incrementSent(): void {
    this.sent += 1;
  }

  incrementFailed(): void {
    this.failed += 1;
  }

  incrementRetries(): void {
    this.retries += 1;
  }

  incrementDeadLetter(): void {
    this.deadLetter += 1;
  }

  snapshot(): InvitationEmailMetricsSnapshot {
    return {
      queued: this.queued,
      sent: this.sent,
      failed: this.failed,
      retries: this.retries,
      deadLetter: this.deadLetter,
    };
  }
}
