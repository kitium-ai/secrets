import type { Identity } from './domain';
import type { SecretManager } from './manager';

export type RotationSchedule = {
  secretId: string;
  nextRotation: Date;
  rotationWindow?: {
    start: string; // HH:MM format
    end: string; // HH:MM format
    timezone: string;
  };
  maxRetries: number;
  retryCount: number;
  lastRotationAttempt?: Date;
  lastRotationError?: string;
};

export type RotationConfig = {
  checkIntervalMs: number;
  maxConcurrentRotations: number;
  defaultMaxRetries: number;
  notificationWebhook?: string;
};

export class RotationScheduler {
  private readonly schedules = new Map<string, RotationSchedule>();
  private intervalId: NodeJS.Timeout | undefined;
  private isRunning = false;

  constructor(
    private readonly manager: SecretManager,
    private readonly config: RotationConfig,
    private readonly actor: Identity
  ) {}

  start(): void {
    if (this.isRunning) {
      return;
    }

    this.isRunning = true;
    this.intervalId = setInterval(() => {
      void this.checkAndRotateSecrets();
    }, this.config.checkIntervalMs);

    console.info(`Rotation scheduler started with ${this.config.checkIntervalMs}ms interval`);
  }

  stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = undefined;
    }
    this.isRunning = false;
    console.info('Rotation scheduler stopped');
  }

  addSchedule(secretId: string, rotationWindow?: RotationSchedule['rotationWindow']): void {
    const schedule: RotationSchedule = {
      secretId,
      nextRotation: this.calculateNextRotation(),
      ...(rotationWindow && { rotationWindow }),
      maxRetries: this.config.defaultMaxRetries,
      retryCount: 0,
    };
    this.schedules.set(secretId, schedule);
  }

  removeSchedule(secretId: string): void {
    this.schedules.delete(secretId);
  }

  getSchedule(secretId: string): RotationSchedule | undefined {
    return this.schedules.get(secretId);
  }

  private async checkAndRotateSecrets(): Promise<void> {
    const now = new Date();
    const secretsToRotate: RotationSchedule[] = [];

    for (const schedule of this.schedules.values()) {
      if (this.shouldRotate(schedule, now)) {
        secretsToRotate.push(schedule);
      }
    }

    // Limit concurrent rotations
    const batch = secretsToRotate.slice(0, this.config.maxConcurrentRotations);

    for (const schedule of batch) {
      try {
        await this.rotateSecret(schedule);
      } catch (error) {
        console.error(`Failed to rotate secret ${schedule.secretId}:`, error);
        await this.handleRotationFailure(schedule, error);
      }
    }
  }

  private shouldRotate(schedule: RotationSchedule, now: Date): boolean {
    if (now < schedule.nextRotation) {
      return false;
    }

    // Check rotation window if specified
    if (schedule.rotationWindow) {
      const currentTime = now.toLocaleTimeString('en-US', {
        hour12: false,
        timeZone: schedule.rotationWindow.timezone,
      });

      const start = schedule.rotationWindow.start;
      const end = schedule.rotationWindow.end;

      if (start < end) {
        // Same day window
        return currentTime >= start && currentTime <= end;
      } else {
        // Overnight window
        return currentTime >= start || currentTime <= end;
      }
    }

    return true;
  }

  private async rotateSecret(schedule: RotationSchedule): Promise<void> {
    console.info(`Rotating secret ${schedule.secretId}`);

    await this.manager.rotate(schedule.secretId, this.actor);

    // Update schedule
    schedule.nextRotation = this.calculateNextRotation();
    schedule.retryCount = 0;
    schedule.lastRotationAttempt = new Date();
    delete schedule.lastRotationError;

    console.info(`Successfully rotated secret ${schedule.secretId}`);

    // Notify success
    if (this.config.notificationWebhook) {
      await this.notifyRotationSuccess(schedule);
    }
  }

  private async handleRotationFailure(schedule: RotationSchedule, error: unknown): Promise<void> {
    schedule.retryCount++;
    schedule.lastRotationAttempt = new Date();
    schedule.lastRotationError = error instanceof Error ? error.message : String(error);

    if (schedule.retryCount < schedule.maxRetries) {
      // Exponential backoff
      const delayMs = 2 ** schedule.retryCount * 60000; // 1min, 2min, 4min, etc.
      schedule.nextRotation = new Date(Date.now() + delayMs);
      console.info(`Will retry rotation for secret ${schedule.secretId} in ${delayMs}ms`);
    } else {
      console.error(`Max retries exceeded for secret ${schedule.secretId}`);
      // Notify failure
      if (this.config.notificationWebhook) {
        await this.notifyRotationFailure(schedule);
      }
    }
  }

  private calculateNextRotation(): Date {
    // Default to 90 days from now (can be customized per secret)
    return new Date(Date.now() + 90 * 24 * 60 * 60 * 1000);
  }

  private async notifyRotationSuccess(schedule: RotationSchedule): Promise<void> {
    if (!this.config.notificationWebhook) {
      return;
    }

    try {
      await fetch(this.config.notificationWebhook, {
        method: 'POST',
        headers: {
          // eslint-disable-next-line @typescript-eslint/naming-convention -- HTTP header name is standardized
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          event: 'rotation_success',
          secretId: schedule.secretId,
          timestamp: new Date().toISOString(),
          nextRotation: schedule.nextRotation.toISOString(),
        }),
      });
    } catch (error) {
      console.error('Failed to send rotation success notification:', error);
    }
  }

  private async notifyRotationFailure(schedule: RotationSchedule): Promise<void> {
    if (!this.config.notificationWebhook) {
      return;
    }

    try {
      await fetch(this.config.notificationWebhook, {
        method: 'POST',
        headers: {
          // eslint-disable-next-line @typescript-eslint/naming-convention -- HTTP header name is standardized
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          event: 'rotation_failure',
          secretId: schedule.secretId,
          timestamp: new Date().toISOString(),
          error: schedule.lastRotationError,
          retryCount: schedule.retryCount,
          maxRetries: schedule.maxRetries,
        }),
      });
    } catch (error) {
      console.error('Failed to send rotation failure notification:', error);
    }
  }
}
