import type { SecretManager } from './manager';

export type PerformanceMetrics = {
  operationLatency: {
    create: number[];
    read: number[];
    update: number[];
    delete: number[];
    rotate: number[];
  };
  throughput: {
    operationsPerSecond: number;
    bytesProcessedPerSecond: number;
  };
  resourceUsage: {
    memoryUsage: number;
    cpuUsage: number;
  };
  cacheMetrics: {
    hitRate: number;
    missRate: number;
    size: number;
  };
  errorRates: {
    total: number;
    byOperation: Record<string, number>;
  };
};

export type PerformanceConfig = {
  metricsRetentionMs: number;
  samplingRate: number; // 0.0 to 1.0
  alertThresholds: {
    maxLatencyMs: number;
    maxErrorRate: number;
    minThroughput: number;
  };
};

export class PerformanceMonitor {
  private readonly metrics: PerformanceMetrics = {
    operationLatency: {
      create: [],
      read: [],
      update: [],
      delete: [],
      rotate: [],
    },
    throughput: {
      operationsPerSecond: 0,
      bytesProcessedPerSecond: 0,
    },
    resourceUsage: {
      memoryUsage: 0,
      cpuUsage: 0,
    },
    cacheMetrics: {
      hitRate: 0,
      missRate: 0,
      size: 0,
    },
    errorRates: {
      total: 0,
      byOperation: {},
    },
  };

  private readonly operationCounts = new Map<string, number>();
  private readonly errorCounts = new Map<string, number>();
  private readonly startTime = Date.now();

  constructor(
    _manager: SecretManager,
    private readonly config: PerformanceConfig
  ) {
    this.startMonitoring();
  }

  private startMonitoring(): void {
    // Monitor resource usage every 30 seconds
    setInterval(() => {
      this.updateResourceMetrics();
    }, 30000);

    // Calculate throughput every minute
    setInterval(() => {
      this.updateThroughputMetrics();
    }, 60000);

    // Cleanup old metrics
    setInterval(() => {
      this.cleanupOldMetrics();
    }, this.config.metricsRetentionMs / 4);
  }

  recordOperation(operation: string, duration: number, success = true): void {
    if (Math.random() > this.config.samplingRate) {
      return;
    }

    // Record latency
    if (this.metrics.operationLatency[operation as keyof typeof this.metrics.operationLatency]) {
      this.metrics.operationLatency[operation as keyof typeof this.metrics.operationLatency].push(
        duration
      );
    }

    // Record operation count
    this.operationCounts.set(operation, (this.operationCounts.get(operation) ?? 0) + 1);

    // Record errors
    if (!success) {
      this.errorCounts.set(operation, (this.errorCounts.get(operation) ?? 0) + 1);
    }
  }

  recordCacheHit(): void {
    // This would be called by the caching layer
    this.metrics.cacheMetrics.hitRate += 1;
  }

  recordCacheMiss(): void {
    // This would be called by the caching layer
    this.metrics.cacheMetrics.missRate += 1;
  }

  getMetrics(): PerformanceMetrics {
    this.updateErrorRates();
    return { ...this.metrics };
  }

  getHealthScore(): number {
    // Calculate a health score from 0-100 based on performance
    const latencyScore = this.calculateLatencyScore();
    const errorScore = this.calculateErrorScore();
    const throughputScore = this.calculateThroughputScore();

    return Math.round((latencyScore + errorScore + throughputScore) / 3);
  }

  private calculateLatencyScore(): number {
    const allLatencies = [
      ...this.metrics.operationLatency.create,
      ...this.metrics.operationLatency.read,
      ...this.metrics.operationLatency.update,
      ...this.metrics.operationLatency.delete,
      ...this.metrics.operationLatency.rotate,
    ];

    if (allLatencies.length === 0) {
      return 100;
    }

    const avgLatency = allLatencies.reduce((a, b) => a + b, 0) / allLatencies.length;
    const score = Math.max(0, 100 - (avgLatency / this.config.alertThresholds.maxLatencyMs) * 100);
    return Math.min(100, score);
  }

  private calculateErrorScore(): number {
    const totalOperations = Array.from(this.operationCounts.values()).reduce((a, b) => a + b, 0);
    const totalErrors = Array.from(this.errorCounts.values()).reduce((a, b) => a + b, 0);

    if (totalOperations === 0) {
      return 100;
    }

    const errorRate = totalErrors / totalOperations;
    const score = Math.max(0, 100 - (errorRate / this.config.alertThresholds.maxErrorRate) * 100);
    return Math.min(100, score);
  }

  private calculateThroughputScore(): number {
    const score = Math.min(
      100,
      (this.metrics.throughput.operationsPerSecond / this.config.alertThresholds.minThroughput) *
        100
    );
    return Math.max(0, score);
  }

  private updateResourceMetrics(): void {
    // Get memory usage
    const memUsage = process.memoryUsage();
    this.metrics.resourceUsage.memoryUsage = memUsage.heapUsed / memUsage.heapTotal;

    // CPU usage would require additional monitoring (like node-os-utils)
    this.metrics.resourceUsage.cpuUsage = 0; // Placeholder
  }

  private updateThroughputMetrics(): void {
    const elapsedSeconds = (Date.now() - this.startTime) / 1000;
    const totalOperations = Array.from(this.operationCounts.values()).reduce((a, b) => a + b, 0);

    this.metrics.throughput.operationsPerSecond = totalOperations / elapsedSeconds;
    // bytesProcessedPerSecond would need to be tracked separately
  }

  private updateErrorRates(): void {
    const totalOperations = Array.from(this.operationCounts.values()).reduce((a, b) => a + b, 0);
    const totalErrors = Array.from(this.errorCounts.values()).reduce((a, b) => a + b, 0);

    this.metrics.errorRates.total = totalOperations > 0 ? totalErrors / totalOperations : 0;

    for (const [operation, count] of this.operationCounts) {
      const errors = this.errorCounts.get(operation) ?? 0;
      this.metrics.errorRates.byOperation[operation] = count > 0 ? errors / count : 0;
    }
  }

  private cleanupOldMetrics(): void {
    // const cutoffTime = Date.now() - this.config.metricsRetentionMs;

    // Keep only recent latency measurements
    const maxSamples = 1000; // Keep last 1000 samples per operation type
    for (const operation of Object.keys(this.metrics.operationLatency) as Array<
      keyof typeof this.metrics.operationLatency
    >) {
      if (this.metrics.operationLatency[operation].length > maxSamples) {
        this.metrics.operationLatency[operation] =
          this.metrics.operationLatency[operation].slice(-maxSamples);
      }
    }
  }

  getAlerts(): string[] {
    const alerts: string[] = [];
    const metrics = this.getMetrics();

    // Check latency threshold
    const avgLatency = this.getAverageLatency();
    if (avgLatency > this.config.alertThresholds.maxLatencyMs) {
      alerts.push(
        `High latency detected: ${avgLatency.toFixed(2)}ms (threshold: ${this.config.alertThresholds.maxLatencyMs}ms)`
      );
    }

    // Check error rate threshold
    if (metrics.errorRates.total > this.config.alertThresholds.maxErrorRate) {
      alerts.push(
        `High error rate detected: ${(metrics.errorRates.total * 100).toFixed(2)}% (threshold: ${(this.config.alertThresholds.maxErrorRate * 100).toFixed(2)}%)`
      );
    }

    // Check throughput threshold
    if (metrics.throughput.operationsPerSecond < this.config.alertThresholds.minThroughput) {
      alerts.push(
        `Low throughput detected: ${metrics.throughput.operationsPerSecond.toFixed(2)} ops/sec (threshold: ${this.config.alertThresholds.minThroughput} ops/sec)`
      );
    }

    return alerts;
  }

  private getAverageLatency(): number {
    const allLatencies = [
      ...this.metrics.operationLatency.create,
      ...this.metrics.operationLatency.read,
      ...this.metrics.operationLatency.update,
      ...this.metrics.operationLatency.delete,
      ...this.metrics.operationLatency.rotate,
    ];

    return allLatencies.length > 0
      ? allLatencies.reduce((a, b) => a + b, 0) / allLatencies.length
      : 0;
  }
}

export class ConnectionPool<TConnection> {
  private pool: TConnection[] = [];
  private activeConnections = 0;
  private readonly waitingQueue: Array<(connection: TConnection) => void> = [];

  constructor(
    private readonly maxConnections: number,
    private readonly createConnection: () => Promise<TConnection>,
    private readonly destroyConnection: (connection: TConnection) => Promise<void>
  ) {}

  async getConnection(): Promise<TConnection> {
    if (this.pool.length > 0) {
      const connection = this.pool.pop();
      if (!connection) {
        this.activeConnections++;
        return await this.createConnection();
      }
      this.activeConnections++;
      return connection;
    }

    if (this.activeConnections < this.maxConnections) {
      this.activeConnections++;
      return await this.createConnection();
    }

    // Wait for a connection to become available
    return new Promise((resolve) => {
      this.waitingQueue.push(resolve);
    });
  }

  releaseConnection(connection: TConnection): Promise<void> {
    this.activeConnections--;

    if (this.waitingQueue.length > 0) {
      const waitingResolver = this.waitingQueue.shift();
      if (waitingResolver) {
        waitingResolver(connection);
        return Promise.resolve();
      }
    }
    this.pool.push(connection);
    return Promise.resolve();
  }

  async close(): Promise<void> {
    await Promise.all(this.pool.map((connection) => this.destroyConnection(connection)));
    this.pool = [];
    this.activeConnections = 0;
  }

  getStats(): { active: number; idle: number; waiting: number } {
    return {
      active: this.activeConnections,
      idle: this.pool.length,
      waiting: this.waitingQueue.length,
    };
  }
}
