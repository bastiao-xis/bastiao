/**
 * Cliente mínimo da API. Na Fase 1 cobre saúde e login da equipe;
 * cresce junto com os módulos da API.
 */

export type StaffRole = 'CASHIER' | 'KITCHEN' | 'MANAGER' | 'OWNER';

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

export interface Store {
  id: string;
  code: string;
  name: string;
  timezone: string;
  active: boolean;
}

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly body: unknown,
  ) {
    super(
      typeof body === 'object' && body && 'message' in body
        ? String((body as { message: unknown }).message)
        : `HTTP ${status}`,
    );
  }
}

export interface ApiClientOptions {
  baseUrl: string;
  getAccessToken?: () => string | null | undefined;
  fetch?: typeof fetch;
}

export function createApiClient(opts: ApiClientOptions) {
  const doFetch = opts.fetch ?? fetch;

  async function call<T>(method: string, path: string, body?: unknown): Promise<T> {
    const headers: Record<string, string> = { accept: 'application/json' };
    if (body !== undefined) headers['content-type'] = 'application/json';
    const token = opts.getAccessToken?.();
    if (token) headers.authorization = `Bearer ${token}`;
    const res = await doFetch(`${opts.baseUrl}${path}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const text = await res.text();
    const data = text ? (JSON.parse(text) as unknown) : undefined;
    if (!res.ok) throw new ApiError(res.status, data);
    return data as T;
  }

  return {
    health: () => call<{ status: 'ok' }>('GET', '/health'),
    auth: {
      login: (email: string, password: string) =>
        call<LoginResult>('POST', '/auth/login', { email, password }),
      verifyMfa: (mfaToken: string, code: string) =>
        call<LoginResult>('POST', '/auth/mfa/verify', { mfaToken, code }),
      beginMfaEnrollment: (mfaToken: string) =>
        call<{ secret: string; otpauthUrl: string }>('POST', '/auth/mfa/enroll', { mfaToken }),
      confirmMfaEnrollment: (mfaToken: string, code: string) =>
        call<LoginResult>('POST', '/auth/mfa/enroll/confirm', { mfaToken, code }),
      refresh: (refreshToken: string) =>
        call<LoginResult>('POST', '/auth/refresh', { refreshToken }),
      logout: () => call<void>('POST', '/auth/logout'),
      me: () => call<StaffProfile>('GET', '/auth/me'),
    },
    stores: { list: () => call<Store[]>('GET', '/stores') },
  };
}

export type ApiClient = ReturnType<typeof createApiClient>;
