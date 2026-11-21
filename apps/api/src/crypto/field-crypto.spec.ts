import { randomBytes } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { FieldCrypto } from './field-crypto';

const key = () => randomBytes(32).toString('base64');

describe('FieldCrypto', () => {
  const crypto = new FieldCrypto(key(), key());

  it('encrypts and decrypts', () => {
    const enc = crypto.encrypt('12345678909');
    expect(enc).not.toContain('12345678909');
    expect(crypto.decrypt(enc)).toBe('12345678909');
  });

  it('produces a different ciphertext each time', () => {
    expect(crypto.encrypt('48999990000')).not.toBe(crypto.encrypt('48999990000'));
  });

  it('rejects tampered ciphertext', () => {
    const enc = crypto.encrypt('48999990000');
    const parts = enc.split('.');
    const data = Buffer.from(parts[3]!, 'base64url');
    data[0] = data[0]! ^ 0xff;
    parts[3] = data.toString('base64url');
    expect(() => crypto.decrypt(parts.join('.'))).toThrow();
  });

  it('rejects ciphertext from another key', () => {
    const other = new FieldCrypto(key(), key());
    expect(() => other.decrypt(crypto.encrypt('x'))).toThrow();
  });

  it('blind index is deterministic and purpose-scoped', () => {
    expect(crypto.blindIndex('48999990000', 'phone')).toBe(
      crypto.blindIndex('48999990000', 'phone'),
    );
    expect(crypto.blindIndex('48999990000', 'phone')).not.toBe(
      crypto.blindIndex('48999990000', 'cpf'),
    );
  });

  it('refuses short or identical keys', () => {
    expect(() => new FieldCrypto('abc', key())).toThrow();
    const k = key();
    expect(() => new FieldCrypto(k, k)).toThrow();
  });
});
