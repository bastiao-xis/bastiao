'use client';

const KEY = 'bastiao.admin.session';
const STORE_KEY = 'bastiao.admin.store';

export interface Session {
  accessToken: string;
  refreshToken: string;
}

export function getSession(): Session | null {
  if (typeof window === 'undefined') return null;
  const raw = window.localStorage.getItem(KEY);
  return raw ? (JSON.parse(raw) as Session) : null;
}

export function setSession(s: Session | null): void {
  if (s) window.localStorage.setItem(KEY, JSON.stringify(s));
  else window.localStorage.removeItem(KEY);
}

export function getLastStore(): string | null {
  return typeof window === 'undefined' ? null : window.localStorage.getItem(STORE_KEY);
}

export function setLastStore(id: string): void {
  window.localStorage.setItem(STORE_KEY, id);
}
