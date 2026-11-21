'use client';

import type { StaffProfile, Store } from '@bastiao/api-client';
import Link from 'next/link';
import { useParams, usePathname, useRouter } from 'next/navigation';
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { api } from '../lib/api';
import { getLastStore, getSession, setLastStore, setSession } from '../lib/session';

interface PanelContext {
  me: StaffProfile;
  stores: Store[];
}

const Ctx = createContext<PanelContext | null>(null);
export const usePanel = () => useContext(Ctx)!;

const ROLE_LABEL = {
  CASHIER: 'Caixa',
  KITCHEN: 'Cozinha',
  MANAGER: 'Gerente',
  OWNER: 'Dono',
} as const;

export function Shell({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useParams<{ storeId?: string }>();
  const [ctx, setCtx] = useState<PanelContext | null>(null);

  useEffect(() => {
    if (!getSession()) {
      router.replace('/login');
      return;
    }
    Promise.all([api.auth.me(), api.stores.list()])
      .then(([me, stores]) => setCtx({ me, stores }))
      .catch(() => router.replace('/login'));
  }, [router]);

  useEffect(() => {
    if (params.storeId) setLastStore(params.storeId);
  }, [params.storeId]);

  if (!ctx) return <main className="muted">Carregando…</main>;

  const storeId = params.storeId ?? getLastStore() ?? ctx.stores[0]?.id;
  const links = storeId
    ? [
        { href: `/loja/${storeId}/estoque`, label: 'Estoque' },
        { href: `/loja/${storeId}/compras`, label: 'Compras' },
        { href: `/loja/${storeId}/contagem`, label: 'Contagem' },
      ]
    : [];
  links.push(
    { href: '/insumos', label: 'Insumos' },
    { href: '/fornecedores', label: 'Fornecedores' },
  );

  async function logout() {
    await api.auth.logout().catch(() => undefined);
    setSession(null);
    router.replace('/login');
  }

  return (
    <Ctx.Provider value={ctx}>
      <header className="top">
        <strong>Bastião · ERP</strong>
        {ctx.stores.length > 0 && (
          <select
            aria-label="Unidade"
            value={storeId ?? ''}
            onChange={(e) => router.push(`/loja/${e.target.value}/estoque`)}
          >
            {ctx.stores.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        )}
        <nav>
          {links.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className={pathname.startsWith(l.href) ? 'active' : ''}
            >
              {l.label}
            </Link>
          ))}
        </nav>
        <span className="spacer" />
        <span className="muted">
          {ctx.me.name} · {ROLE_LABEL[ctx.me.role]}
        </span>
        <button className="secondary" onClick={logout}>
          Sair
        </button>
      </header>
      <main>{children}</main>
    </Ctx.Provider>
  );
}
