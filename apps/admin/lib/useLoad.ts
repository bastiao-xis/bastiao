'use client';

import { useCallback, useEffect, useState } from 'react';
import { errorMessage } from './format';

/** Carrega dados e expõe reload. Mantém o erro legível para a tela. */
export function useLoad<T>(loader: () => Promise<T>, deps: unknown[]) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const load = useCallback(loader, deps);
  const reload = useCallback(() => {
    setError(null);
    return load()
      .then(setData)
      .catch((e: unknown) => setError(errorMessage(e)));
  }, [load]);
  useEffect(() => {
    void reload();
  }, [reload]);
  return { data, error, reload };
}
