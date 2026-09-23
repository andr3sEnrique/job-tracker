import { Injectable } from '@nestjs/common';
import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';
import { AppConfig } from '../config/app-config.service.js';

const ALGORITHM = 'aes-256-gcm';
const IV_BYTES = 12;
export const CURRENT_KEY_VERSION = 1;

/**
 * Authenticated encryption for secrets at rest (Gmail refresh tokens).
 * - AES-256-GCM with a random IV per value: identical tokens never produce identical ciphertexts.
 * - The auth tag makes any tampering fail loudly instead of decrypting to garbage.
 * - `context` is bound as additional authenticated data, so a ciphertext copied into
 *   another user's row cannot be decrypted there.
 * The key version travels with the row, which allows rotating keys later.
 */
@Injectable()
export class EncryptionService {
  private readonly keys: Map<number, Buffer>;

  constructor(config: AppConfig) {
    this.keys = new Map([
      [CURRENT_KEY_VERSION, Buffer.from(config.get('TOKEN_ENCRYPTION_KEY'), 'base64')],
    ]);
  }

  encrypt(plaintext: string, context: string): { ciphertext: string; keyVersion: number } {
    const iv = randomBytes(IV_BYTES);
    const cipher = createCipheriv(ALGORITHM, this.key(CURRENT_KEY_VERSION), iv);
    cipher.setAAD(Buffer.from(context));
    const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
    const tag = cipher.getAuthTag();
    return {
      ciphertext: ['v1', iv, tag, encrypted]
        .map((p) => (typeof p === 'string' ? p : p.toString('base64url')))
        .join('.'),
      keyVersion: CURRENT_KEY_VERSION,
    };
  }

  decrypt(payload: string, keyVersion: number, context: string): string {
    const [format, iv, tag, data] = payload.split('.');
    if (format !== 'v1' || !iv || !tag || !data) throw new Error('Unsupported ciphertext format');
    const decipher = createDecipheriv(
      ALGORITHM,
      this.key(keyVersion),
      Buffer.from(iv, 'base64url'),
    );
    decipher.setAAD(Buffer.from(context));
    decipher.setAuthTag(Buffer.from(tag, 'base64url'));
    return Buffer.concat([
      decipher.update(Buffer.from(data, 'base64url')),
      decipher.final(),
    ]).toString('utf8');
  }

  private key(version: number): Buffer {
    const key = this.keys.get(version);
    if (!key) throw new Error(`Unknown encryption key version ${version}`);
    return key;
  }
}
