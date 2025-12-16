import { type AuditLogEntry, Identity, type Secret } from './domain';
import type { SecretManager } from './manager';

export type ComplianceReport = {
  period: {
    start: Date;
    end: Date;
  };
  summary: {
    totalSecrets: number;
    totalAccesses: number;
    totalModifications: number;
    complianceViolations: number;
  };
  violations: ComplianceViolation[];
  recommendations: string[];
};

export type ComplianceViolation = {
  id: string;
  type: 'rotation_overdue' | 'access_anomaly' | 'policy_violation' | 'unauthorized_access';
  severity: 'low' | 'medium' | 'high' | 'critical';
  secretId?: string;
  description: string;
  timestamp: Date;
  actor?: string;
  details: Record<string, unknown>;
};

type AccessPattern = {
  totalAccesses: number;
  uniqueActors: Set<string>;
  accessTimes: Date[];
  isAnomalous: boolean;
  anomalyReason?: string;
  offHoursAccess?: number;
};

type SerializableAccessPattern = Omit<AccessPattern, 'uniqueActors' | 'accessTimes'> & {
  uniqueActors: string[];
  accessTimes: string[];
};

export type AuditQuery = {
  startDate?: Date;
  endDate?: Date;
  secretId?: string;
  actor?: string;
  action?: string;
  tenant?: string;
  limit?: number;
  offset?: number;
};

export class ComplianceAuditor {
  constructor(private readonly manager: SecretManager) {}

  async generateComplianceReport(
    startDate: Date,
    endDate: Date,
    tenant?: string
  ): Promise<ComplianceReport> {
    const auditEntries = await this.queryAuditLogs({
      startDate,
      endDate,
      ...(tenant && { tenant }),
    });

    const secrets = await this.manager.listSecrets(
      new Identity('auditor', ['reader'], tenant ?? 'default')
    );

    const violations = await this.detectViolations(secrets, auditEntries, startDate, endDate);

    return {
      period: { start: startDate, end: endDate },
      summary: {
        totalSecrets: secrets.length,
        totalAccesses: auditEntries.filter((entry) => entry.action === 'get').length,
        totalModifications: auditEntries.filter((entry) =>
          ['create', 'put', 'delete'].includes(entry.action)
        ).length,
        complianceViolations: violations.length,
      },
      violations,
      recommendations: this.generateRecommendations(violations, secrets),
    };
  }

  async detectViolations(
    secrets: Secret[],
    auditEntries: AuditLogEntry[],
    _startDate: Date,
    _endDate: Date
  ): Promise<ComplianceViolation[]> {
    const violations: ComplianceViolation[] = [];

    // Check for overdue rotations
    for (const secret of secrets) {
      const lastRotation = this.getLastRotationDate(secret, auditEntries);
      const daysSinceRotation = lastRotation
        ? (Date.now() - lastRotation.getTime()) / (1000 * 60 * 60 * 24)
        : Infinity;

      if (daysSinceRotation > secret.policy.rotationDays) {
        violations.push({
          id: `rotation-${secret.id}`,
          type: 'rotation_overdue',
          severity: daysSinceRotation > secret.policy.rotationDays * 2 ? 'high' : 'medium',
          secretId: secret.id,
          description: `Secret has not been rotated for ${Math.round(daysSinceRotation)} days (policy requires ${secret.policy.rotationDays} days)`,
          timestamp: new Date(),
          details: {
            lastRotation,
            daysOverdue: daysSinceRotation - secret.policy.rotationDays,
            policyRotationDays: secret.policy.rotationDays,
          },
        });
      }
    }

    // Check for access anomalies
    const accessPatterns = this.analyzeAccessPatterns(auditEntries);
    for (const [secretId, pattern] of Object.entries(accessPatterns)) {
      if (pattern.isAnomalous) {
        violations.push({
          id: `access-anomaly-${secretId}`,
          type: 'access_anomaly',
          severity: 'medium',
          secretId,
          description: `Unusual access pattern detected for secret`,
          timestamp: new Date(),
          details: this.serializeAccessPattern(pattern),
        });
      }
    }

    // Check for policy violations
    for (const entry of auditEntries) {
      if (entry.action === 'create' || entry.action === 'put') {
        const violationsForEntry = await this.checkPolicyCompliance(entry);
        violations.push(...violationsForEntry);
      }
    }

    return violations;
  }

  private getLastRotationDate(secret: Secret, auditEntries: AuditLogEntry[]): Date | null {
    const rotationEntries = auditEntries
      .filter((entry) => entry.secretId === secret.id && entry.action === 'rotate')
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

    return rotationEntries[0]?.timestamp ?? null;
  }

  private analyzeAccessPatterns(auditEntries: AuditLogEntry[]): Record<string, AccessPattern> {
    const patterns: Record<string, AccessPattern> = {};

    for (const entry of auditEntries) {
      if (!entry.secretId || entry.action !== 'get') {
        continue;
      }

      const pattern =
        patterns[entry.secretId] ??
        (patterns[entry.secretId] = {
          totalAccesses: 0,
          uniqueActors: new Set(),
          accessTimes: [],
          isAnomalous: false,
        });
      pattern.totalAccesses++;
      pattern.uniqueActors.add(entry.subject);
      pattern.accessTimes.push(entry.timestamp);

      // Simple anomaly detection: high frequency access or access outside business hours
      if (pattern.totalAccesses > 100) {
        pattern.isAnomalous = true;
        pattern.anomalyReason = 'High access frequency';
      }

      // Check for off-hours access (simplified)
      const hour = entry.timestamp.getHours();
      if (hour < 6 || hour > 22) {
        pattern.offHoursAccess = (pattern.offHoursAccess ?? 0) + 1;
        if (pattern.offHoursAccess > 10) {
          pattern.isAnomalous = true;
          pattern.anomalyReason = 'Frequent off-hours access';
        }
      }
    }

    return patterns;
  }

  private serializeAccessPattern(pattern: AccessPattern): SerializableAccessPattern {
    return {
      totalAccesses: pattern.totalAccesses,
      uniqueActors: Array.from(pattern.uniqueActors),
      accessTimes: pattern.accessTimes.map((time) => time.toISOString()),
      isAnomalous: pattern.isAnomalous,
      ...(pattern.anomalyReason ? { anomalyReason: pattern.anomalyReason } : {}),
      ...(pattern.offHoursAccess ? { offHoursAccess: pattern.offHoursAccess } : {}),
    };
  }

  private checkPolicyCompliance(_entry: AuditLogEntry): Promise<ComplianceViolation[]> {
    // This would check if the secret creation/update complied with policies.
    return Promise.resolve([]);
  }

  private generateRecommendations(violations: ComplianceViolation[], secrets: Secret[]): string[] {
    const recommendations: string[] = [];

    const overdueRotations = violations.filter((v) => v.type === 'rotation_overdue').length;
    if (overdueRotations > 0) {
      recommendations.push(
        `Rotate ${overdueRotations} secrets that are past their rotation deadline`
      );
    }

    const anomalousAccess = violations.filter((v) => v.type === 'access_anomaly').length;
    if (anomalousAccess > 0) {
      recommendations.push('Review access patterns for secrets with anomalous activity');
    }

    const unrotatedSecrets = secrets.filter((s) => !s.rotationHandler).length;
    if (unrotatedSecrets > secrets.length * 0.5) {
      recommendations.push(
        'Implement rotation handlers for secrets that support automated rotation'
      );
    }

    if (secrets.some((s) => !s.description)) {
      recommendations.push('Add descriptions to all secrets for better governance');
    }

    return recommendations;
  }

  queryAuditLogs(query: AuditQuery): Promise<AuditLogEntry[]> {
    // In a real implementation, this would query the audit log storage
    // For now, return empty array as audit logs are written to files/console
    console.info('Audit query:', query);
    return Promise.resolve([]);
  }

  exportAuditReport(format: 'json' | 'csv' | 'pdf', report: ComplianceReport): Promise<Buffer> {
    switch (format) {
      case 'json':
        return Promise.resolve(Buffer.from(JSON.stringify(report, null, 2)));
      case 'csv':
        return Promise.resolve(this.generateCSVReport(report));
      case 'pdf':
        return Promise.resolve(this.generatePDFReport(report));
      default:
        return Promise.reject(new Error(`Unsupported format: ${format}`));
    }
  }

  private generateCSVReport(report: ComplianceReport): Buffer {
    const lines = [
      'Violation ID,Type,Severity,Secret ID,Description,Timestamp',
      ...report.violations.map(
        (v) =>
          `${v.id},${v.type},${v.severity},${v.secretId ?? ''},"${v.description}",${v.timestamp.toISOString()}`
      ),
    ];
    return Buffer.from(lines.join('\n'));
  }

  private generatePDFReport(report: ComplianceReport): Buffer {
    // In a real implementation, this would generate a PDF
    // For now, return JSON as PDF
    return Buffer.from(JSON.stringify(report, null, 2));
  }
}
