import { StaffRole } from '@prisma/client';

/**
 * RQ-27: quem pode estornar, mudar preço, ver dados de clientes ou mexer no financeiro
 * entra com dois fatores. Hoje esses poderes são de gerente e dono.
 */
export const MFA_REQUIRED_ROLES: ReadonlySet<StaffRole> = new Set([
  StaffRole.MANAGER,
  StaffRole.OWNER,
]);

export const MAX_FAILED_LOGINS = 5;
export const LOCKOUT_MINUTES = 15;
export const MFA_TOKEN_TTL_SECONDS = 300;

export function requiresMfa(role: StaffRole): boolean {
  return MFA_REQUIRED_ROLES.has(role);
}
