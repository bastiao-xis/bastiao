'use client';

import { createApiClient, type LoginResult } from '@bastiao/api-client';
import { getSession, setSession } from './session';

const BASE = '/api';

let refreshing: Promise<boolean> | null = null;

async function tryRefresh(): Promise<boolean> {
  const s = getSession();
  if (!s) return false;
  const res = await fetch(`${BASE}/auth/refresh`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ refreshToken: s.refreshToken }),
  });
  if (!res.ok) {
    setSession(null);
    return false;
  }
  const body = (await res.json()) as LoginResult;
  if (body.status !== 'AUTHENTICATED') return false;
  setSession({ accessToken: body.accessToken, refreshToken: body.refreshToken });
  return true;
}

/** fetch que renova o token uma vez quando ele vence, e manda para o login se a sessão acabou. */
const fetchWithRefresh: typeof fetch = async (input, init) => {
  let res = await fetch(input, init);
  if (res.status !== 401 || String(input).includes('/auth/')) return res;
  refreshing ??= tryRefresh().finally(() => (refreshing = null));
  if (await refreshing) {
    const headers = new Headers(init?.headers);
    headers.set('authorization', `Bearer ${getSession()!.accessToken}`);
    res = await fetch(input, { ...init, headers });
  } else if (typeof window !== 'undefined') {
    window.location.href = '/login';
  }
  return res;
};

export const api = createApiClient({
  baseUrl: BASE,
  getAccessToken: () => getSession()?.accessToken,
  fetch: fetchWithRefresh,
});
