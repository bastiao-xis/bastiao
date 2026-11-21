'use client';

import type { StockMovementType } from '@bastiao/api-client';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { api } from '../../../../../../lib/api';
import { brl, costPerUnit, dateTimeBR, qty } from '../../../../../../lib/format';
import { useLoad } from '../../../../../../lib/useLoad';

const TYPE_LABEL: Record<StockMovementType, string> = {
  PURCHASE: 'Compra',
  ADJUSTMENT: 'Ajuste',
  WASTE: 'Perda',
  COUNT: 'Contagem',
};

export default function MovementsPage() {
  const { storeId, ingredientId } = useParams<{ storeId: string; ingredientId: string }>();
  const { data, error } = useLoad(
    () => Promise.all([api.stock.list(storeId), api.stock.movements(storeId, ingredientId)]),
    [storeId, ingredientId],
  );
  const line = data?.[0].find((l) => l.ingredientId === ingredientId);
  const movements = data?.[1] ?? [];

  return (
    <>
      <p>
        <Link href={`/loja/${storeId}/estoque`}>← Estoque</Link>
      </p>
      <h1>{line?.name ?? 'Insumo'}</h1>
      {error && <p className="error">{error}</p>}
      {line && (
        <p className="muted">
          Saldo {qty(line.quantity, line.unitKind)} · custo médio{' '}
          {Number(line.avgCost) > 0 ? costPerUnit(line.avgCost, line.unitKind) : '—'} · valor{' '}
          {brl(line.valueCents)}
        </p>
      )}
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Quando</th>
              <th>Tipo</th>
              <th className="num">Quantidade</th>
              <th className="num">Saldo depois</th>
              <th className="num">Valor</th>
              <th className="num">Custo médio depois</th>
              <th>Motivo</th>
            </tr>
          </thead>
          <tbody>
            {line &&
              movements.map((m) => (
                <tr key={m.id}>
                  <td>{dateTimeBR(m.createdAt)}</td>
                  <td>
                    {m.purchaseId ? (
                      <Link href={`/loja/${storeId}/compras/${m.purchaseId}`}>
                        {TYPE_LABEL[m.type]}
                      </Link>
                    ) : (
                      TYPE_LABEL[m.type]
                    )}
                  </td>
                  <td className="num">
                    {Number(m.quantityDelta) > 0 ? '+' : ''}
                    {qty(m.quantityDelta, line.unitKind)}
                  </td>
                  <td className="num">{qty(m.quantityAfter, line.unitKind)}</td>
                  <td className="num">{brl(m.valueCents)}</td>
                  <td className="num">{costPerUnit(m.avgCostAfter, line.unitKind)}</td>
                  <td>{m.reason ?? ''}</td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>
      {movements.length === 0 && <p className="muted">Sem movimentos ainda.</p>}
    </>
  );
}
