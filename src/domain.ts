export class Policy {
  constructor(
    public name: string,
    public description: string,
    public rotationDays: number = 90,
    public minLength: number = 16,
    public forbidPatterns?: string[],
    public allowedCidrs?: string[],
  ) {}
}

export class Identity {
  constructor(public subject: string, public roles: string[], public tenant: string = "default") {}

  hasRole(role: string): boolean {
    return this.roles.includes(role);
  }
}

export interface AuditLogEntry {
  timestamp: Date;
  subject: string;
  action: string;
  secretId?: string | null;
  tenant: string;
  metadata: Record<string, string>;
}

export class SecretVersion {
  constructor(
    public version: number,
    public createdAt: Date,
    public value: string,
    public checksum: string,
    public createdBy: string,
  ) {}
}

export class Secret {
  constructor(
    public id: string,
    public name: string,
    public tenant: string,
    public policy: Policy,
    public createdAt: Date,
    public createdBy: string,
    public versions: SecretVersion[],
    public description?: string,
    public rotationHandler?: () => string | Promise<string>,
  ) {}

  latestVersion(): SecretVersion {
    return [...this.versions].sort((a, b) => a.version - b.version).at(-1) as SecretVersion;
  }

  nextVersionNumber(): number {
    const maxVersion = this.versions.reduce((max, version) => Math.max(max, version.version), 0);
    return maxVersion + 1;
  }
}
