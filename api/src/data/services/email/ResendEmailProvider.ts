import { Resend } from 'resend';
import type { EmailMessage, EmailProvider } from './types.js';

/**
 * Resend Email Provider for production
 * 
 * Sends real emails using Resend API (https://resend.com)
 * 
 * Setup:
 * 1. Sign up at https://resend.com
 * 2. Get your API key from the dashboard
 * 3. Verify your sending domain (or use onboarding@resend.dev for testing)
 * 4. Set RESEND_API_KEY environment variable
 * 5. Set EMAIL_FROM environment variable (e.g., "Senior Hub <noreply@seniorhub.app>")
 * 
 * Free tier: 100 emails/day, 3,000/month
 */
export class ResendEmailProvider implements EmailProvider {
  private readonly resend: Resend;
  private readonly from: string;

  constructor(config: { apiKey: string; from: string }) {
    if (!config.apiKey) {
      throw new Error('RESEND_API_KEY is required');
    }
    if (!config.from) {
      throw new Error('EMAIL_FROM is required');
    }

    this.resend = new Resend(config.apiKey);
    this.from = config.from;
  }

  async send(message: EmailMessage): Promise<void> {
    try {
      const { data, error } = await this.resend.emails.send({
        from: this.from,
        to: message.to,
        subject: message.subject,
        html: message.body,
      });

      if (error) {
        console.error('[ResendEmailProvider] Error sending email:', error);
        throw new Error(`Failed to send email via Resend: ${error.message}`);
      }

      console.info(`[ResendEmailProvider] Email sent successfully to ${message.to} (ID: ${data?.id})`);
    } catch (error) {
      console.error('[ResendEmailProvider] Unexpected error:', error);
      throw error;
    }
  }
}
