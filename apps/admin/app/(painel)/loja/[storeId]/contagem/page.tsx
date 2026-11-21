'use client';

import type { Unit } from '@bastiao/api-client';
import { useParams } from 'next/navigation';
import { useState } from 'react';
import { api } from '../../../../../lib/api';
import {
  brl,
  commercialUnit,
  errorMessage,
  qty,
  readQuantity,
  unitsFor,
} from '../../../../../lib/format';
import { useLoad } from '../../../../../lib/useLoad';

/**
 * Contagem de inventário. Só os insumos preenchidos entram; o saldo passa a ser o contado,
 * e a diferença fica registrada ao custo médio (base do CMV real).
 */
export default function CountPage() {
  const { storeId } = useParams<{ storeId: string }>();
  const { data, error, reload } = useLoad(() => api.stock.list(storeId), [storeId]);
  const [counts, setCounts] = useState<Record<string, { value: string; unit?: Unit }>>({});
  const [note, setNote] = useState('');
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit() {
    setMsg(null);
    const items = [];
    for (const line of data ?? []) {
      const c = counts[line.ingredientId];
      if (!c || c.value.trim() === '') continue;
      const q = readQuantity(c.value, true);
      if (q === null) return setMsg({ ok: false, text: `Quantidade inválida em ${line.name}.` });
      items.push({
        ingredientId: line.ingredientId,
        countedQuantity: q,
        unit: c.unit ?? commercialUnit(line.unitKind),
      });
    }
    if (items.length === 0) return setMsg({ ok: false, text: 'Preencha pelo menos um insumo.' });
    if (
      !window.confirm(
        `Registrar a contagem de ${items.length} insumo(s)? O saldo passa a ser o contado.`,
      )
    )
      return;
    setBusy(true);
    try {
      const movements = await api.stock.count(storeId, { note: note.trim() || undefined, items });
      const diff = movements.reduce((sum, m) => sum + m.valueCents, 0);
      setMsg({ ok: true, text: `Contagem registrada. Diferença total: ${brl(diff)}.` });
      setCounts({});
      await reload();
    } catch (e) {
      setMsg({ ok: false, text: errorMessage(e) });
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <h1>Contagem de inventário</h1>
      <p className="muted">Preencha só o que foi contado. Deixe em branco o que não contou.</p>
      {error && <p className="error">{error}</p>}
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Insumo</th>
              <th className="num">Saldo no sistema</th>
              <th>Contado</th>
              <th>Unidade</th>
            </tr>
          </thead>
          <tbody>
            {data?.map((l) => {
              const c = counts[l.ingredientId];
              return (
                <tr key={l.ingredientId}>
                  <td>{l.name}</td>
                  <td className="num">{qty(l.quantity, l.unitKind)}</td>
                  <td>
                    <input
                      inputMode="decimal"
                      size={8}
                      value={c?.value ?? ''}
                      onChange={(e) =>
                        setCounts({ ...counts, [l.ingredientId]: { ...c, value: e.target.value } })
                      }
                    />
                  </td>
                  <td>
                    <select
                      value={c?.unit ?? commercialUnit(l.unitKind)}
                      onChange={(e) =>
                        setCounts({
                          ...counts,
                          [l.ingredientId]: { value: c?.value ?? '', unit: e.target.value as Unit },
                        })
                      }
                    >
                      {unitsFor(l.unitKind).map((u) => (
                        <option key={u}>{u}</option>
                      ))}
                    </select>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div className="row" style={{ marginTop: 12 }}>
        <label style={{ flex: 1, minWidth: 200 }}>
          Observação (opcional)
          <input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Ex.: contagem de fechamento do mês"
          />
        </label>
        <button disabled={busy} onClick={submit}>
          Registrar contagem
        </button>
      </div>
      {msg && <p className={msg.ok ? 'ok' : 'error'}>{msg.text}</p>}
    </>
  );
}
