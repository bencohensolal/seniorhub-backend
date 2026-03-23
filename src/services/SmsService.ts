import { createHash } from 'crypto';

export interface SmsService {
  send(to: string, body: string): Promise<void>;
}

// ─── Console (dev/test) ──────────────────────────────────────────────────────

export class ConsoleSmsService implements SmsService {
  async send(to: string, body: string): Promise<void> {
    console.log(`[ConsoleSmsService] SMS to ${to}: ${body}`);
  }
}

// ─── OVH SMS ─────────────────────────────────────────────────────────────────
// Docs: https://eu.api.ovh.com/console/#/sms
//
// Auth: chaque requête est signée avec
//   "$1$" + SHA1("${appSecret}+${consumerKey}+${method}+${url}+${body}+${timestamp}")

export class OvhSmsService implements SmsService {
  private readonly endpoint: string;

  constructor(
    private readonly appKey: string,
    private readonly appSecret: string,
    private readonly consumerKey: string,
    private readonly serviceName: string,
    private readonly sender: string | undefined,
  ) {
    this.endpoint = `https://eu.api.ovh.com/v1/sms/${serviceName}/jobs/`;
  }

  async send(to: string, body: string): Promise<void> {
    const method = 'POST';
    const url = this.endpoint;
    const payload: Record<string, unknown> = {
      receivers: [to],
      message: body,
      priority: 'high',
      ...(this.sender ? { sender: this.sender } : { senderForResponse: true }),
    };
    const bodyStr = JSON.stringify(payload);
    const timestamp = Math.floor(Date.now() / 1000).toString();

    const sigData = `${this.appSecret}+${this.consumerKey}+${method}+${url}+${bodyStr}+${timestamp}`;
    const signature = '$1$' + createHash('sha1').update(sigData).digest('hex');

    const response = await fetch(url, {
      method,
      headers: {
        'Content-Type': 'application/json',
        'X-Ovh-Application': this.appKey,
        'X-Ovh-Consumer': this.consumerKey,
        'X-Ovh-Timestamp': timestamp,
        'X-Ovh-Signature': signature,
      },
      body: bodyStr,
    });

    if (!response.ok) {
      const text = await response.text();
      console.error(`[OvhSmsService] Failed to send SMS to ${to}: ${response.status} ${text}`);
      // Don't throw — a failed SMS should not abort the whole emergency flow
    } else {
      console.log(`[OvhSmsService] SMS sent to ${to}`);
    }
  }
}

// ─── Factory ─────────────────────────────────────────────────────────────────

import { env } from '../config/env.js';

export function createSmsService(): SmsService {
  if (env.SMS_PROVIDER === 'ovh') {
    return new OvhSmsService(
      env.OVH_APP_KEY!,
      env.OVH_APP_SECRET!,
      env.OVH_CONSUMER_KEY!,
      env.OVH_SMS_SERVICE!,
      env.OVH_SMS_SENDER,
    );
  }
  return new ConsoleSmsService();
}
