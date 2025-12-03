import { describe, it, expect } from 'vitest';
import { encrypt, decrypt, checksum } from '../crypto';

describe('crypto', () => {
  const key = 'master-key-123';
  it('encrypts and decrypts symmetrically', () => {
    const msg = 'super-secret';
    const token = encrypt(msg, key);
    expect(token).toBeTypeOf('string');
    const plain = decrypt(token, key);
    expect(plain).toBe(msg);
  });

  it('checksum is stable', () => {
    expect(checksum('a')).toEqual(checksum('a'));
    expect(checksum('a')).not.toEqual(checksum('b'));
  });
});
