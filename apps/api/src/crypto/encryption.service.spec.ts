import { describe, expect, it } from 'vitest';
import type { AppConfig } from '../config/app-config.service.js';
import { EncryptionService } from './encryption.service.js';

const service = (key = Buffer.alloc(32, 1)) =>
  new EncryptionService({ get: () => key.toString('base64') } as unknown as AppConfig);

describe('EncryptionService', () => {
  it('round-trips a secret', () => {
    const s = service();
    const { ciphertext, keyVersion } = s.encrypt('1//refresh-token', 'user-1');
    expect(s.decrypt(ciphertext, keyVersion, 'user-1')).toBe('1//refresh-token');
  });

  it('never stores the plaintext and randomises every encryption', () => {
    const s = service();
    const a = s.encrypt('1//refresh-token', 'user-1').ciphertext;
    const b = s.encrypt('1//refresh-token', 'user-1').ciphertext;
    expect(a).not.toContain('refresh-token');
    expect(a).not.toBe(b);
  });

  it('detects tampering', () => {
    const s = service();
    const { ciphertext } = s.encrypt('secret', 'user-1');
    const parts = ciphertext.split('.');
    parts[3] = Buffer.from('forged').toString('base64url');
    expect(() => s.decrypt(parts.join('.'), 1, 'user-1')).toThrow();
  });

  it('refuses to decrypt in another context (row swapping)', () => {
    const s = service();
    const { ciphertext } = s.encrypt('secret', 'user-1');
    expect(() => s.decrypt(ciphertext, 1, 'user-2')).toThrow();
  });

  it('refuses to decrypt with another key', () => {
    const { ciphertext } = service(Buffer.alloc(32, 1)).encrypt('secret', 'user-1');
    expect(() => service(Buffer.alloc(32, 2)).decrypt(ciphertext, 1, 'user-1')).toThrow();
  });

  it('rejects unknown key versions and formats', () => {
    const s = service();
    const { ciphertext } = s.encrypt('secret', 'user-1');
    expect(() => s.decrypt(ciphertext, 99, 'user-1')).toThrow(/key version/);
    expect(() => s.decrypt('plain-text', 1, 'user-1')).toThrow(/format/);
  });
});
