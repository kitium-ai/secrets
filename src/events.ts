export interface SecretEvent {
  type: 'created' | 'updated' | 'deleted' | 'accessed' | 'expired';
  secretId: string;
  tenant: string;
  timestamp: Date;
  actor: string;
  metadata?: Record<string, any>;
}

export interface EventNotifier {
  notify(event: SecretEvent): Promise<void>;
}

export class WebhookNotifier implements EventNotifier {
  constructor(
    private readonly webhookUrl: string,
    private readonly headers?: Record<string, string>
  ) {}

  async notify(event: SecretEvent): Promise<void> {
    try {
      const response = await fetch(this.webhookUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...this.headers,
        },
        body: JSON.stringify(event),
      });

      if (!response.ok) {
        console.warn(`Webhook notification failed: ${response.status} ${response.statusText}`);
      }
    } catch (error) {
      console.warn('Webhook notification error:', error);
    }
  }
}

export class CompositeNotifier implements EventNotifier {
  constructor(private readonly notifiers: EventNotifier[]) {}

  async notify(event: SecretEvent): Promise<void> {
    await Promise.allSettled(this.notifiers.map(notifier => notifier.notify(event)));
  }
}