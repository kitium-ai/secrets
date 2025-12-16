import type { Identity } from './domain';

export type AccessConditionValue =
  | string
  | number
  | boolean
  | null
  | Date
  | unknown[]
  | Record<string, unknown>;

export type AccessRule = {
  id: string;
  resource: string;
  action: string;
  conditions: AccessCondition[];
  effect: 'allow' | 'deny';
};

export type AccessCondition = {
  type: 'time' | 'ip' | 'role' | 'custom';
  operator: 'equals' | 'in' | 'between' | 'matches';
  value: AccessConditionValue;
};

export type AccessRequest = {
  subject: string;
  resource: string;
  action: string;
  context: {
    ip?: string;
    time?: Date;
    roles?: string[];
    custom?: Record<string, unknown>;
  };
};

export class AccessControlManager {
  private rules: AccessRule[] = [];

  addRule(rule: AccessRule): void {
    this.rules.push(rule);
  }

  removeRule(ruleId: string): void {
    this.rules = this.rules.filter((r) => r.id !== ruleId);
  }

  evaluateAccess(request: AccessRequest): Promise<boolean> {
    // Default deny
    let finalDecision = false;

    for (const rule of this.rules) {
      if (this.ruleMatches(request, rule)) {
        if (rule.effect === 'allow') {
          finalDecision = true;
        } else if (rule.effect === 'deny') {
          return Promise.resolve(false); // Explicit deny overrides allow
        }
      }
    }

    return Promise.resolve(finalDecision);
  }

  private ruleMatches(request: AccessRequest, rule: AccessRule): boolean {
    // Check resource and action match
    if (rule.resource !== '*' && rule.resource !== request.resource) {
      return false;
    }

    if (rule.action !== '*' && rule.action !== request.action) {
      return false;
    }

    // Check all conditions
    for (const condition of rule.conditions) {
      if (!this.conditionMatches(request, condition)) {
        return false;
      }
    }

    return true;
  }

  private conditionMatches(request: AccessRequest, condition: AccessCondition): boolean {
    const contextValue = this.getContextValue(request, condition.type);

    switch (condition.operator) {
      case 'equals':
        return contextValue === condition.value;
      case 'in':
        return this.matchesInCondition(condition, contextValue);
      case 'between':
        return this.matchesBetweenCondition(condition, contextValue);
      case 'matches':
        return this.matchesRegexCondition(condition, contextValue);
      default:
        return false;
    }
  }

  private matchesInCondition(condition: AccessCondition, contextValue: unknown): boolean {
    const allowedValues = condition.value;
    if (!Array.isArray(allowedValues)) {
      return false;
    }

    if (condition.type === 'role') {
      const roles = Array.isArray(contextValue) ? contextValue : [];
      return roles.some((role) => allowedValues.includes(role));
    }

    return allowedValues.includes(contextValue);
  }

  private matchesBetweenCondition(condition: AccessCondition, contextValue: unknown): boolean {
    const betweenValues = condition.value;
    if (!Array.isArray(betweenValues) || betweenValues.length !== 2) {
      return false;
    }
    if (
      typeof betweenValues[0] !== 'number' ||
      typeof betweenValues[1] !== 'number' ||
      typeof contextValue !== 'number'
    ) {
      return false;
    }
    return contextValue >= betweenValues[0] && contextValue <= betweenValues[1];
  }

  private matchesRegexCondition(condition: AccessCondition, contextValue: unknown): boolean {
    if (typeof condition.value !== 'string' || typeof contextValue !== 'string') {
      return false;
    }
    // eslint-disable-next-line security/detect-non-literal-regexp -- rule patterns can be configured dynamically
    const regex = new RegExp(condition.value);
    return regex.test(contextValue);
  }

  private getContextValue(request: AccessRequest, type: AccessCondition['type']): unknown {
    switch (type) {
      case 'time':
        return (request.context.time ?? new Date()).getHours();
      case 'ip':
        return request.context.ip;
      case 'role':
        return request.context.roles ?? [];
      case 'custom':
        return request.context.custom;
      default:
        return null;
    }
  }

  createTimeBasedRule(
    id: string,
    resource: string,
    action: string,
    startHour: number,
    endHour: number
  ): AccessRule {
    return {
      id,
      resource,
      action,
      effect: 'allow',
      conditions: [
        {
          type: 'time',
          operator: 'between',
          value: [startHour, endHour],
        },
      ],
    };
  }

  createIPRestrictionRule(
    id: string,
    resource: string,
    action: string,
    allowedIPs: string[]
  ): AccessRule {
    return {
      id,
      resource,
      action,
      effect: 'allow',
      conditions: [
        {
          type: 'ip',
          operator: 'in',
          value: allowedIPs,
        },
      ],
    };
  }

  createRoleBasedRule(
    id: string,
    resource: string,
    action: string,
    requiredRoles: string[]
  ): AccessRule {
    return {
      id,
      resource,
      action,
      effect: 'allow',
      conditions: [
        {
          type: 'role',
          operator: 'in',
          value: requiredRoles,
        },
      ],
    };
  }

  listRules(): AccessRule[] {
    return [...this.rules];
  }
}

export class SessionManager {
  private readonly sessions: Map<string, Session> = new Map();

  constructor(private readonly sessionTimeoutMs = 3600000) {} // 1 hour default

  createSession(identity: Identity, metadata: Record<string, unknown> = {}): string {
    const sessionId = this.generateSessionId();
    const session: Session = {
      id: sessionId,
      identity,
      createdAt: new Date(),
      lastActivity: new Date(),
      expiresAt: new Date(Date.now() + this.sessionTimeoutMs),
      metadata,
      isActive: true,
    };

    this.sessions.set(sessionId, session);
    return sessionId;
  }

  getSession(sessionId: string): Session | undefined {
    const session = this.sessions.get(sessionId);
    if (!session) {
      return undefined;
    }

    // Check if session is expired
    if (session.expiresAt.getTime() < Date.now()) {
      this.invalidateSession(sessionId);
      return undefined;
    }

    // Update last activity
    session.lastActivity = new Date();
    return session;
  }

  extendSession(sessionId: string): boolean {
    const session = this.sessions.get(sessionId);
    if (!session?.isActive) {
      return false;
    }

    session.expiresAt = new Date(Date.now() + this.sessionTimeoutMs);
    session.lastActivity = new Date();
    return true;
  }

  invalidateSession(sessionId: string): void {
    const session = this.sessions.get(sessionId);
    if (session) {
      session.isActive = false;
      // Keep session for audit purposes but mark as inactive
    }
  }

  cleanupExpiredSessions(): void {
    const now = Date.now();
    for (const [sessionId, session] of this.sessions) {
      if (session.expiresAt.getTime() < now || !session.isActive) {
        this.sessions.delete(sessionId);
      }
    }
  }

  listActiveSessions(): Session[] {
    return Array.from(this.sessions.values()).filter((s) => s.isActive);
  }

  private generateSessionId(): string {
    return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}

export type Session = {
  id: string;
  identity: Identity;
  createdAt: Date;
  lastActivity: Date;
  expiresAt: Date;
  metadata: Record<string, unknown>;
  isActive: boolean;
};
