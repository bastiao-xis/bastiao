'use client';

import type { StockLine, Unit } from '@bastiao/api-client';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useState, type FormEvent } from 'react';
import { api } from '../../../../../lib/api';
import {
  brl,
  commercialUnit,
  costPerUnit,
  errorMessage,
  qty,
  readQuantity,
  unitsFor,
} from '../../../../../lib/format';
import { useLoad } from '../../../../../lib/useLoad';

type Action = { kind: 'adjust' | 'min'; line: StockLine };

export default function StockPage() {
  const { storeId } = useParams<{ storeId: string }>();
  const { data, error, reload } = useLoad(() => api.stock.list(storeId), [storeId]);
  const [action, setAction] = useState<Action | null>(null);
  const total = data?.reduce((sum, l) => sum + l.valueCents, 0) ?? 0;

  return (
    <>
      <h1>Estoque</h1>
      <p className="muted">
        Valor total em estoque (custo médio): <strong>{brl(total)}</strong>
      </p>
      {error && <p className="error">{error}</p>}
      {action && (
        <ActionForm
          storeId={storeId}
          action={action}
          onDone={async () => {
            setAction(null);
            await reload();
          }}
        />
      )}
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Insumo</th>
              <th className="num">Saldo</th>
              <th className="num">Custo médio</th>
              <th className="num">Valor</th>
              <th className="num">Mínimo</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {data?.map((l) => (
              <tr key={l.ingredientId}>
                <td>
                  <Link href={`/loja/${storeId}/estoque/${l.ingredientId}`}>{l.name}</Link>{' '}
                  {l.belowMinimum && <span className="badge warn">Abaixo do mínimo</span>}
                </td>
                <td className="num">{qty(l.quantity, l.unitKind)}</td>
                <td className="num">
                  {Number(l.avgCost) > 0 ? costPerUnit(l.avgCost, l.unitKind) : '—'}
                </td>
                <td className="num">{brl(l.valueCents)}</td>
                <td className="num">{l.minQuantity ? qty(l.minQuantity, l.unitKind) : '—'}</td>
                <td className="num">
                  <button
                    className="secondary"
                    onClick={() => setAction({ kind: 'adjust', line: l })}
                  >
                    Ajustar
                  </button>{' '}
                  <button className="secondary" onClick={() => setAction({ kind: 'min', line: l })}>
                    Mínimo
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {data?.length === 0 && <p className="muted">Nenhum insumo ativo. Cadastre em Insumos.</p>}
    </>
  );
}

function ActionForm({
  storeId,
  action,
  onDone,
}: {
  storeId: string;
  action: Action;
  onDone: () => void;
}) {
  const { line } = action;
  const [type, setType] = useState<'WASTE' | 'ADJUSTMENT_IN' | 'ADJUSTMENT_OUT'>('WASTE');
  const [quantity, setQuantity] = useState('');
  const [unit, setUnit] = useState<Unit>(commercialUnit(line.unitKind));
  const [reason, setReason] = useState('');
  const [msg, setMsg] = useState<string | null>(null);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setMsg(null);
    const q = readQuantity(quantity, action.kind === 'min');
    if (action.kind === 'min' && quantity.trim() === '') {
      try {
        await api.stock.setMin(storeId, line.ingredientId, null, unit);
        return onDone();
      } catch (err) {
        return setMsg(errorMessage(err));
      }
    }
    if (!q) return setMsg('Quantidade inválida.');
    try {
      if (action.kind === 'min') await api.stock.setMin(storeId, line.ingredientId, q, unit);
      else
        await api.stock.adjust(storeId, {
          ingredientId: line.ingredientId,
          type,
          quantity: q,
          unit,
          reason,
        });
      onDone();
    } catch (err) {
      setMsg(errorMessage(err));
    }
  }

  return (
    <form className="card" onSubmit={submit}>
      <h2 style={{ marginTop: 0 }}>
        {action.kind === 'min' ? 'Estoque mínimo' : 'Ajuste de estoque'}: {line.name}
      </h2>
      <div className="row">
        {action.kind === 'adjust' && (
          <label>
            Tipo
            <select value={type} onChange={(e) => setType(e.target.value as typeof type)}>
              <option value="WASTE">Perda / desperdício</option>
              <option value="ADJUSTMENT_OUT">Saída (correção)</option>
              <option value="ADJUSTMENT_IN">Entrada sem compra (correção)</option>
            </select>
          </label>
        )}
        <label>
          Quantidade
          <input
            inputMode="decimal"
            value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
            placeholder={action.kind === 'min' ? 'vazio = sem mínimo' : ''}
          />
        </label>
        <label>
          Unidade
          <select value={unit} onChange={(e) => setUnit(e.target.value as Unit)}>
            {unitsFor(line.unitKind).map((u) => (
              <option key={u}>{u}</option>
            ))}
          </select>
        </label>
        {action.kind === 'adjust' && (
          <label style={{ flex: 1, minWidth: 200 }}>
            Motivo
            <input
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              required
              minLength={3}
            />
          </label>
        )}
        <button type="submit">Salvar</button>
        <button type="button" className="secondary" onClick={onDone}>
          Cancelar
        </button>
      </div>
      {action.kind === 'adjust' && (
        <p className="muted">
          O ajuste não muda o custo médio. Ele é valorizado pelo custo médio atual.
        </p>
      )}
      {msg && <p className="error">{msg}</p>}
    </form>
  );
}
