'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { api } from '../../../../../lib/api';
import { brl, dateBR } from '../../../../../lib/format';
import { useLoad } from '../../../../../lib/useLoad';

export default function PurchasesPage() {
  const { storeId } = useParams<{ storeId: string }>();
  const { data, error } = useLoad(() => api.purchases.list(storeId), [storeId]);

  return (
    <>
      <div className="row" style={{ justifyContent: 'space-between', marginBottom: 16 }}>
        <h1 style={{ margin: 0 }}>Compras</h1>
        <Link href={`/loja/${storeId}/compras/nova`}>
          <button>Nova compra</button>
        </Link>
      </div>
      {error && <p className="error">{error}</p>}
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Data</th>
              <th>Fornecedor</th>
              <th>Nota</th>
              <th className="num">Total</th>
              <th>Situação</th>
            </tr>
          </thead>
          <tbody>
            {data?.map((p) => (
              <tr key={p.id}>
                <td>
                  <Link href={`/loja/${storeId}/compras/${p.id}`}>{dateBR(p.purchasedAt)}</Link>
                </td>
                <td>{p.supplier.name}</td>
                <td>{p.invoiceNumber ?? '—'}</td>
                <td className="num">{brl(p.totalCents)}</td>
                <td>
                  {p.status === 'POSTED' ? (
                    <span className="badge ok">Lançada</span>
                  ) : (
                    <span className="badge warn">Rascunho</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {data?.length === 0 && <p className="muted">Nenhuma compra registrada.</p>}
    </>
  );
}
