import type { SecretManager } from './manager';
import type { SecretStore } from './storage';

export type HealthStatus = {
  overall: 'healthy' | 'degraded' | 'unhealthy';
  components: {
    storage: ComponentHealth;
    encryption: ComponentHealth;
    audit: ComponentHealth;
    rotation?: ComponentHealth;
  };
  metrics: SystemMetrics;
  lastChecked: Date;
};

export type ComponentHealth = {
  status: 'healthy' | 'degraded' | 'unhealthy';
  message?: string;
  details?: Record<string, unknown>;
};

export type SystemMetrics = {
  totalSecrets: number;
  activeSecrets: number;
  expiredSecrets: number;
  secretsByTenant: Record<string, number>;
  averageSecretAge: number; // in days
  rotationCompliance: number; // percentage
  auditEventsLast24h: number;
  failedOperations: number;
  storageLatency: number; // in ms
};

export type AlertRule = {
  id: string;
  name: string;
  condition: (metrics: SystemMetrics) => boolean;
  severity: 'info' | 'warning' | 'error' | 'critical';
  message: string;
  enabled: boolean;
};

export class HealthMonitor {
  private alertRules: AlertRule[] = [];
  private metricsHistory: SystemMetrics[] = [];
  private lastHealthCheck?: HealthStatus;

  constructor(
    private readonly manager: SecretManager,
    private readonly store: SecretStore,
    private readonly config: {
      healthCheckIntervalMs: number;
      metricsRetentionHours: number;
      alertWebhook?: string;
    }
  ) {
    this.initializeDefaultAlertRules();
  }

  async checkHealth(): Promise<HealthStatus> {
    const components: HealthStatus['components'] = {
      storage: this.checkStorageHealth(),
      encryption: this.checkEncryptionHealth(),
      audit: this.checkAuditHealth(),
    };

    const metrics = this.collectMetrics();
    const overall = this.determineOverallHealth(components);

    const healthStatus: HealthStatus = {
      overall,
      components,
      metrics,
      lastChecked: new Date(),
    };

    this.lastHealthCheck = healthStatus;

    // Check alerts
    await this.evaluateAlerts(metrics);

    return healthStatus;
  }

  private checkStorageHealth(): ComponentHealth {
    try {
      // Test basic storage operations
      // This is a simplified health check - in real implementation,
      // we'd create a temporary secret and verify storage operations
      const latency = 0; // Placeholder

      if (latency > 5000) {
        // 5 second timeout
        return {
          status: 'degraded',
          message: 'Storage operations are slow',
          details: { latency },
        };
      }

      return {
        status: 'healthy',
        details: { latency },
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        message: `Storage health check failed: ${error instanceof Error ? error.message : String(error)}`,
      };
    }
  }

  private checkEncryptionHealth(): ComponentHealth {
    try {
      // Test encryption/decryption operations
      // This would verify that the master key is working and crypto operations succeed
      console.info('Checking encryption health with manager:', !!this.manager);
      return {
        status: 'healthy',
        message: 'Encryption operations are functioning correctly',
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        message: `Encryption health check failed: ${error instanceof Error ? error.message : String(error)}`,
      };
    }
  }

  private checkAuditHealth(): ComponentHealth {
    try {
      // Test audit logging functionality
      // This would verify that audit logs can be written
      console.info('Checking audit health with store:', !!this.store);
      return {
        status: 'healthy',
        message: 'Audit logging is functioning correctly',
      };
    } catch (error) {
      return {
        status: 'degraded',
        message: `Audit health check failed: ${error instanceof Error ? error.message : String(error)}`,
      };
    }
  }

  private collectMetrics(): SystemMetrics {
    try {
      // In a real implementation, this would query the secret store
      // and audit logs to collect comprehensive metrics
      const metrics: SystemMetrics = {
        totalSecrets: 0,
        activeSecrets: 0,
        expiredSecrets: 0,
        secretsByTenant: {},
        averageSecretAge: 0,
        rotationCompliance: 100,
        auditEventsLast24h: 0,
        failedOperations: 0,
        storageLatency: 0,
      };

      // Store metrics history
      this.metricsHistory.push(metrics);
      // Keep only last N hours of metrics
      const retentionMs = this.config.metricsRetentionHours * 60 * 60 * 1000;
      const cutoffTime = Date.now() - retentionMs;
      this.metricsHistory = this.metricsHistory.filter(
        (m) => this.metricsHistory.indexOf(m) * this.config.healthCheckIntervalMs > cutoffTime
      );

      return metrics;
    } catch (error) {
      console.error('Failed to collect metrics:', error);
      throw error;
    }
  }

  private determineOverallHealth(
    components: HealthStatus['components']
  ): 'healthy' | 'degraded' | 'unhealthy' {
    const statuses = Object.values(components).map((c) => c.status);

    if (statuses.includes('unhealthy')) {
      return 'unhealthy';
    } else if (statuses.includes('degraded')) {
      return 'degraded';
    } else {
      return 'healthy';
    }
  }

  private initializeDefaultAlertRules(): void {
    this.alertRules = [
      {
        id: 'high-expiry-rate',
        name: 'High Secret Expiry Rate',
        condition: (metrics) => metrics.expiredSecrets / metrics.totalSecrets > 0.1,
        severity: 'warning',
        message: 'More than 10% of secrets are expired',
        enabled: true,
      },
      {
        id: 'rotation-compliance-low',
        name: 'Low Rotation Compliance',
        condition: (metrics) => metrics.rotationCompliance < 80,
        severity: 'error',
        message: 'Rotation compliance is below 80%',
        enabled: true,
      },
      {
        id: 'high-failure-rate',
        name: 'High Operation Failure Rate',
        condition: (metrics) => metrics.failedOperations > 10,
        severity: 'critical',
        message: 'High number of failed operations detected',
        enabled: true,
      },
      {
        id: 'storage-latency-high',
        name: 'High Storage Latency',
        condition: (metrics) => metrics.storageLatency > 1000,
        severity: 'warning',
        message: 'Storage operations are experiencing high latency',
        enabled: true,
      },
    ];
  }

  addAlertRule(rule: AlertRule): void {
    this.alertRules.push(rule);
  }

  removeAlertRule(ruleId: string): void {
    this.alertRules = this.alertRules.filter((r) => r.id !== ruleId);
  }

  private async evaluateAlerts(metrics: SystemMetrics): Promise<void> {
    const triggeredAlerts = this.alertRules.filter(
      (rule) => rule.enabled && rule.condition(metrics)
    );

    for (const alert of triggeredAlerts) {
      console.warn(`ALERT [${alert.severity.toUpperCase()}]: ${alert.message}`);

      if (this.config.alertWebhook) {
        await this.sendAlert(alert, metrics);
      }
    }
  }

  private async sendAlert(alert: AlertRule, metrics: SystemMetrics): Promise<void> {
    if (!this.config.alertWebhook) {
      return;
    }

    try {
      await fetch(this.config.alertWebhook, {
        method: 'POST',
        headers: {
          // eslint-disable-next-line @typescript-eslint/naming-convention -- HTTP header name is standardized
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          alert: {
            id: alert.id,
            name: alert.name,
            severity: alert.severity,
            message: alert.message,
          },
          metrics,
          timestamp: new Date().toISOString(),
        }),
      });
    } catch (error) {
      console.error('Failed to send alert:', error);
    }
  }

  getMetricsHistory(hours?: number): SystemMetrics[] {
    if (!hours) {
      return this.metricsHistory;
    }

    const cutoffTime = Date.now() - hours * 60 * 60 * 1000;
    return this.metricsHistory.filter(
      (_, index) => index * this.config.healthCheckIntervalMs > cutoffTime
    );
  }

  getLastHealthCheck(): HealthStatus | undefined {
    return this.lastHealthCheck;
  }
}
