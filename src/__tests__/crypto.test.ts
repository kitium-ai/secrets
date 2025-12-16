import { describe, expect, it } from 'vitest';

import { checksum, decrypt, encrypt } from '../crypto';

describe('crypto', () => {
  const key = 'master-key-123';
  it('encrypts and decrypts symmetrically', () => {
    const message = 'super-secret';
    const token = encrypt(message, key);
    expect(token).toBeTypeOf('string');
    const plain = decrypt(token, key);
    expect(plain).toBe(message);
  });

  it('checksum is stable', () => {
    expect(checksum('a')).toEqual(checksum('a'));
    expect(checksum('a')).not.toEqual(checksum('b'));
  });
});
