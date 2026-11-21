import { describe, expect, it } from 'vitest';
import { hashPassword, verifyPassword } from './password';

describe('password', () => {
  it('hashes with argon2id and verifies', async () => {
    const h = await hashPassword('senha-bem-comprida');
    expect(h).toMatch(/^\$argon2id\$/);
    expect(await verifyPassword(h, 'senha-bem-comprida')).toBe(true);
    expect(await verifyPassword(h, 'senha-errada-xxxx')).toBe(false);
  });

  it('refuses short passwords', async () => {
    await expect(hashPassword('curta')).rejects.toThrow();
  });

  it('returns false for a malformed hash', async () => {
    expect(await verifyPassword('not-a-hash', 'qualquer-coisa')).toBe(false);
  });
});
