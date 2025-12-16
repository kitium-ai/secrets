export type KtSecretEvent = {
  type: 'created' | 'updated' | 'deleted' | 'accessed' | 'expired';
  secretId: string;
  tenant: string;
  timestamp: Date;
  actor: string;
  metadata?: Record<string, unknown>;
};

export type SecretNotifier = {
  notify(event: KtSecretEvent): Promise<void>;
};

export class WebhookNotifier implements SecretNotifier {
  constructor(
    private readonly webhookUrl: string,
    private readonly headers?: Record<string, string>
  ) {}

  async notify(event: KtSecretEvent): Promise<void> {
    try {
      const response = await fetch(this.webhookUrl, {
        method: 'POST',
        headers: {
          // eslint-disable-next-line @typescript-eslint/naming-convention -- HTTP header name is standardized
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

export class CompositeNotifier implements SecretNotifier {
  constructor(private readonly notifiers: SecretNotifier[]) {}

  async notify(event: KtSecretEvent): Promise<void> {
    await Promise.allSettled(this.notifiers.map((notifier) => notifier.notify(event)));
  }
}
