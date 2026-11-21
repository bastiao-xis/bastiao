import { describe, expect, it } from 'vitest';
import { currentTotp, generateTotpSecret, totpUri, verifyTotp } from './totp';

describe('totp', () => {
  it('accepts the current code and rejects others', () => {
    const secret = generateTotpSecret();
    const code = currentTotp(secret);
    expect(verifyTotp(secret, code)).toBe(true);
    const wrong = String((Number(code) + 1) % 1_000_000).padStart(6, '0');
    expect(verifyTotp(secret, wrong)).toBe(false);
  });

  it('rejects malformed codes', () => {
    const secret = generateTotpSecret();
    expect(verifyTotp(secret, '')).toBe(false);
    expect(verifyTotp(secret, '12345')).toBe(false);
    expect(verifyTotp(secret, 'abcdef')).toBe(false);
  });

  it('builds an otpauth uri', () => {
    expect(totpUri('gerente@bastiao.local', 'JBSWY3DPEHPK3PXP')).toMatch(/^otpauth:\/\/totp\//);
  });
});
