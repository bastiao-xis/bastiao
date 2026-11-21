import { generateSecret, generateSync, generateURI, verifySync } from 'otplib';

// TOTP padrão (30 s, 6 dígitos), compatível com Google Authenticator, Authy etc.
// Aceita 30 s de tolerância para relógios levemente fora de hora.
const EPOCH_TOLERANCE_SECONDS = 30;

export const TOTP_ISSUER = 'Bastião ERP';

export function generateTotpSecret(): string {
  return generateSecret();
}

export function totpUri(accountEmail: string, secret: string): string {
  return generateURI({ issuer: TOTP_ISSUER, label: accountEmail, secret });
}

export function verifyTotp(secret: string, code: string): boolean {
  if (!/^\d{6}$/.test(code)) return false;
  try {
    return verifySync({ secret, token: code, epochTolerance: EPOCH_TOLERANCE_SECONDS }).valid;
  } catch {
    return false;
  }
}

export function currentTotp(secret: string): string {
  return generateSync({ secret });
}
