export interface ExpoPushMessage {
  to: string | string[];
  title: string;
  body: string;
  sound?: 'default' | null;
  priority?: 'default' | 'normal' | 'high';
  data?: Record<string, unknown>;
  badge?: number;
}

export class ExpoPushService {
  private readonly endpoint = 'https://exp.host/--/api/v2/push/send';

  async send(messages: ExpoPushMessage[]): Promise<void> {
    if (messages.length === 0) return;

    // Expo accepts up to 100 messages per request
    const chunks = this.chunk(messages, 100);

    for (const chunk of chunks) {
      try {
        const response = await fetch(this.endpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
            'Accept-Encoding': 'gzip, deflate',
          },
          body: JSON.stringify(chunk),
        });

        if (!response.ok) {
          const text = await response.text();
          console.error('[ExpoPushService] Push failed:', response.status, text);
        }
      } catch (err) {
        console.error('[ExpoPushService] Network error:', err);
      }
    }
  }

  private chunk<T>(arr: T[], size: number): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < arr.length; i += size) {
      chunks.push(arr.slice(i, i + size));
    }
    return chunks;
  }
}

export const expoPushService = new ExpoPushService();
