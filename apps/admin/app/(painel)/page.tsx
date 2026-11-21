'use client';

import Link from 'next/link';
import { usePanel } from '../../components/Shell';

export default function Home() {
  const { stores } = usePanel();
  return (
    <>
      <h1>Unidades</h1>
      {stores.length === 0 && <p className="muted">Tu ainda não tens acesso a nenhuma unidade.</p>}
      {stores.map((s) => (
        <div key={s.id} className="card row">
          <strong style={{ flex: 1 }}>{s.name}</strong>
          <Link href={`/loja/${s.id}/estoque`}>Estoque</Link>
          <Link href={`/loja/${s.id}/compras`}>Compras</Link>
        </div>
      ))}
    </>
  );
}
