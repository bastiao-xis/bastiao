import type { StaffRole } from '@prisma/client';

export interface AccessTokenPayload {
  sub: string;
  sid: string;
  role: StaffRole;
  typ: 'access';
}

export interface MfaTokenPayload {
  sub: string;
  typ: 'mfa';
  stage: 'verify' | 'enroll';
}

export interface AuthenticatedStaff {
  id: string;
  sessionId: string;
  role: StaffRole;
}

export interface StaffProfile {
  id: string;
  email: string;
  name: string;
  role: StaffRole;
  mfaEnabled: boolean;
}

export type LoginResult =
  | {
      status: 'AUTHENTICATED';
      accessToken: string;
      refreshToken: string;
      expiresIn: number;
      user: StaffProfile;
    }
  | { status: 'MFA_REQUIRED'; mfaToken: string }
  | { status: 'MFA_ENROLLMENT_REQUIRED'; mfaToken: string };

export interface RequestMeta {
  ip?: string | null;
  userAgent?: string | null;
}
