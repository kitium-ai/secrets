import { createCipheriv, createDecipheriv, randomBytes, scrypt } from 'node:crypto';
import { promisify } from 'node:util';

const scryptAsync = promisify(scrypt);

export type EncryptionKey = {
  id: string;
  key: Buffer;
  createdAt: Date;
  expiresAt?: Date;
  isActive: boolean;
};

export type EnvelopeEncryptionConfig = {
  masterKey: string;
  keyRotationDays: number;
  keySize: number;
  algorithm: string;
};

export class AdvancedEncryptionManager {
  private readonly keys: Map<string, EncryptionKey> = new Map();
  private currentKeyId: string;

  constructor(private readonly config: EnvelopeEncryptionConfig) {
    this.currentKeyId = this.generateKeyId();
    void this.initializeKeys();
  }

  private async initializeKeys(): Promise<void> {
    // Create initial data encryption key
    const key = await this.deriveKey(this.config.masterKey, this.currentKeyId);
    this.keys.set(this.currentKeyId, {
      id: this.currentKeyId,
      key,
      createdAt: new Date(),
      isActive: true,
    });
  }

  private generateKeyId(): string {
    return `key_${Date.now()}_${randomBytes(4).toString('hex')}`;
  }

  private async deriveKey(masterKey: string, salt: string): Promise<Buffer> {
    const key = await scryptAsync(masterKey, salt, this.config.keySize);
    return key as Buffer;
  }

  encrypt(plaintext: string): Promise<{
    ciphertext: string;
    keyId: string;
    iv: string;
  }> {
    const currentKey = this.keys.get(this.currentKeyId);
    if (!currentKey) {
      throw new Error('No active encryption key available');
    }

    const iv = randomBytes(16);
    const cipher = createCipheriv(this.config.algorithm, currentKey.key, iv);

    let encrypted = cipher.update(plaintext, 'utf8', 'hex');
    encrypted += cipher.final('hex');

    return Promise.resolve({
      ciphertext: encrypted,
      keyId: this.currentKeyId,
      iv: iv.toString('hex'),
    });
  }

  decrypt(ciphertext: string, keyId: string, iv: string): Promise<string> {
    const key = this.keys.get(keyId);
    if (!key) {
      return Promise.reject(new Error(`Encryption key ${keyId} not found`));
    }

    const decipher = createDecipheriv(this.config.algorithm, key.key, Buffer.from(iv, 'hex'));

    let decrypted = decipher.update(ciphertext, 'hex', 'utf8');
    decrypted += decipher.final('utf8');

    return Promise.resolve(decrypted);
  }

  async rotateKey(): Promise<string> {
    // Create new key
    const newKeyId = this.generateKeyId();
    const newKey = await this.deriveKey(this.config.masterKey, newKeyId);

    this.keys.set(newKeyId, {
      id: newKeyId,
      key: newKey,
      createdAt: new Date(),
      isActive: true,
    });

    // Mark old key as inactive but keep for decryption
    const oldKey = this.keys.get(this.currentKeyId);
    if (oldKey) {
      oldKey.isActive = false;
    }

    this.currentKeyId = newKeyId;
    return newKeyId;
  }

  shouldRotateKey(): Promise<boolean> {
    const currentKey = this.keys.get(this.currentKeyId);
    if (!currentKey) {
      return Promise.resolve(true);
    }

    const ageInDays = (Date.now() - currentKey.createdAt.getTime()) / (1000 * 60 * 60 * 24);
    return Promise.resolve(ageInDays >= this.config.keyRotationDays);
  }

  getActiveKeyId(): string {
    return this.currentKeyId;
  }

  getKeyInfo(keyId: string): EncryptionKey | undefined {
    return this.keys.get(keyId);
  }

  listKeys(): EncryptionKey[] {
    return Array.from(this.keys.values());
  }

  cleanupExpiredKeys(): Promise<void> {
    const now = Date.now();
    for (const [keyId, key] of this.keys) {
      if (key.expiresAt && key.expiresAt.getTime() < now && !key.isActive) {
        this.keys.delete(keyId);
      }
    }
    return Promise.resolve();
  }
}

export class BackupManager {
  constructor(
    _storagePath: string,
    private readonly retentionDays = 30
  ) {}

  createBackup(data: unknown): Promise<string> {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupId = `backup_${timestamp}`;

    // In a real implementation, this would:
    // 1. Serialize the data
    // 2. Encrypt it
    // 3. Store it in the configured storage backend
    // 4. Create metadata about the backup

    console.info(`Creating backup ${backupId} with ${JSON.stringify(data).length} bytes of data`);
    return Promise.resolve(backupId);
  }

  restoreFromBackup(backupId: string): Promise<unknown> {
    // In a real implementation, this would:
    // 1. Locate the backup
    // 2. Decrypt it
    // 3. Deserialize and return the data

    console.info(`Restoring from backup ${backupId}`);
    return Promise.reject(new Error('Backup restoration not yet implemented'));
  }

  listBackups(): Promise<string[]> {
    // Return list of available backup IDs
    return Promise.resolve([]);
  }

  cleanupOldBackups(): Promise<void> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - this.retentionDays);

    console.info(`Cleaning up backups older than ${cutoffDate.toISOString()}`);
    // In a real implementation, this would delete old backups
    return Promise.resolve();
  }
}
