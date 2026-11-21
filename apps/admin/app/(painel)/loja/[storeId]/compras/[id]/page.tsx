'use client';

import type { Ingredient, Purchase, PurchaseInput, Supplier, Unit } from '@bastiao/api-client';
import { custoPorUnidadeComercial, Decimal, lerReais, paraUnidadeBase } from '@bastiao/regras';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { api } from '../../../../../../lib/api';
import {
  brl,
  commercialUnit,
  dateBR,
  errorMessage,
  qty,
  readQuantity,
  unitsFor,
} from '../../../../../../lib/format';

interface Line {
  ingredientId: string;
  quantity: string;
  unit: Unit;
  total: string;
}

const emptyLine = (): Line => ({ ingredientId: '', quantity: '', unit: 'kg', total: '' });
const today = () => new Date().toISOString().slice(0, 10);
const centsToText = (c: number) => (c / 100).toFixed(2).replace('.', ',');

export default function PurchasePage() {
  const { storeId, id } = useParams<{ storeId: string; id: string }>();
  const router = useRouter();
  const isNew = id === 'nova';
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [ingredients, setIngredients] = useState<Ingredient[]>([]);
  const [purchase, setPurchase] = useState<Purchase | null>(null);
  const [supplierId, setSupplierId] = useState('');
  const [purchasedAt, setPurchasedAt] = useState(today());
  const [invoiceNumber, setInvoiceNumber] = useState('');
  const [notes, setNotes] = useState('');
  const [lines, setLines] = useState<Line[]>([emptyLine()]);
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    Promise.all([
      api.suppliers.list(),
      api.ingredients.list(),
      isNew ? null : api.purchases.get(storeId, id),
    ])
      .then(([s, i, p]) => {
        setSuppliers(s);
        setIngredients(i);
        if (p) {
          setPurchase(p);
          setSupplierId(p.supplier.id);
          setPurchasedAt(p.purchasedAt.slice(0, 10));
          setInvoiceNumber(p.invoiceNumber ?? '');
          setNotes(p.notes ?? '');
          setLines(
            (p.items ?? []).map((it) => ({
              ingredientId: it.ingredient.id,
              quantity: String(Number(it.quantity)).replace('.', ','),
              unit: it.unit,
              total: centsToText(it.totalCents),
            })),
          );
        }
      })
      .catch((e: unknown) => setMsg(errorMessage(e)));
  }, [storeId, id, isNew]);

  const byId = new Map(ingredients.map((i) => [i.id, i]));
  const posted = purchase?.status === 'POSTED';

  function update(index: number, patch: Partial<Line>) {
    setLines((ls) =>
      ls.map((l, i) => {
        if (i !== index) return l;
        const next = { ...l, ...patch };
        if (patch.ingredientId) {
          const kind = byId.get(patch.ingredientId)?.unitKind;
          if (kind && !unitsFor(kind).includes(next.unit)) next.unit = commercialUnit(kind);
        }
        return next;
      }),
    );
  }

  /** Monta o pedido validando cada linha; devolve null e mostra o erro se algo estiver errado. */
  function build(): PurchaseInput | null {
    if (!supplierId) return (setMsg('Escolha o fornecedor.'), null);
    const items = [];
    for (const [i, l] of lines.entries()) {
      const n = i + 1;
      if (!l.ingredientId) return (setMsg(`Linha ${n}: escolha o insumo.`), null);
      const quantity = readQuantity(l.quantity);
      if (!quantity) return (setMsg(`Linha ${n}: quantidade inválida.`), null);
      const totalCents = lerReais(l.total);
      if (totalCents === null) return (setMsg(`Linha ${n}: valor inválido (use 123,45).`), null);
      items.push({ ingredientId: l.ingredientId, quantity, unit: l.unit, totalCents });
    }
    return {
      supplierId,
      purchasedAt,
      invoiceNumber: invoiceNumber.trim() || undefined,
      notes: notes.trim() || undefined,
      items,
    };
  }

  async function save(andPost: boolean) {
    setMsg(null);
    const body = build();
    if (!body) return;
    if (
      andPost &&
      !window.confirm(
        'Depois de lançada, a compra entra no estoque e não pode mais ser alterada. Lançar?',
      )
    ) {
      return;
    }
    setBusy(true);
    try {
      const saved = isNew
        ? await api.purchases.create(storeId, body)
        : await api.purchases.update(storeId, id, body);
      if (andPost) await api.purchases.post(storeId, saved.id);
      router.push(andPost ? `/loja/${storeId}/estoque` : `/loja/${storeId}/compras/${saved.id}`);
      if (!isNew && !andPost) setMsg('Rascunho salvo.');
    } catch (e) {
      setMsg(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    if (!window.confirm('Excluir este rascunho?')) return;
    try {
      await api.purchases.remove(storeId, id);
      router.push(`/loja/${storeId}/compras`);
    } catch (e) {
      setMsg(errorMessage(e));
    }
  }

  const total = lines.reduce((sum, l) => sum + (lerReais(l.total) ?? 0), 0);

  if (posted && purchase) {
    return (
      <>
        <p>
          <Link href={`/loja/${storeId}/compras`}>← Compras</Link>
        </p>
        <h1>Compra lançada · {purchase.supplier.name}</h1>
        <p className="muted">
          {dateBR(purchase.purchasedAt)} · nota {purchase.invoiceNumber ?? '—'} · total{' '}
          {brl(purchase.totalCents)}
          {purchase.notes ? ` · ${purchase.notes}` : ''}
        </p>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Insumo</th>
                <th className="num">Quantidade</th>
                <th className="num">Valor</th>
              </tr>
            </thead>
            <tbody>
              {purchase.items?.map((it) => (
                <tr key={it.id}>
                  <td>{it.ingredient.name}</td>
                  <td className="num">{qty(it.baseQuantity, it.ingredient.unitKind)}</td>
                  <td className="num">{brl(it.totalCents)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="muted">
          Compra lançada não se altera. Para corrigir, use um ajuste de estoque.
        </p>
      </>
    );
  }

  return (
    <>
      <p>
        <Link href={`/loja/${storeId}/compras`}>← Compras</Link>
      </p>
      <h1>{isNew ? 'Nova compra' : 'Compra (rascunho)'}</h1>
      <div className="card row">
        <label style={{ flex: 1, minWidth: 200 }}>
          Fornecedor
          <select value={supplierId} onChange={(e) => setSupplierId(e.target.value)}>
            <option value="">Escolha…</option>
            {suppliers
              .filter((s) => s.active || s.id === supplierId)
              .map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
          </select>
        </label>
        <label>
          Data da compra
          <input type="date" value={purchasedAt} onChange={(e) => setPurchasedAt(e.target.value)} />
        </label>
        <label>
          Nº da nota (opcional)
          <input value={invoiceNumber} onChange={(e) => setInvoiceNumber(e.target.value)} />
        </label>
        <label style={{ flex: 1, minWidth: 200 }}>
          Observação (opcional)
          <input value={notes} onChange={(e) => setNotes(e.target.value)} />
        </label>
      </div>

      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Insumo</th>
              <th>Quantidade</th>
              <th>Unidade</th>
              <th>Valor pago (R$)</th>
              <th className="num">Custo desta compra</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {lines.map((l, i) => {
              const ing = byId.get(l.ingredientId);
              return (
                <tr key={i}>
                  <td>
                    <select
                      value={l.ingredientId}
                      onChange={(e) => update(i, { ingredientId: e.target.value })}
                    >
                      <option value="">Escolha…</option>
                      {ingredients
                        .filter((x) => x.active || x.id === l.ingredientId)
                        .map((x) => (
                          <option key={x.id} value={x.id}>
                            {x.name}
                          </option>
                        ))}
                    </select>
                  </td>
                  <td>
                    <input
                      inputMode="decimal"
                      size={8}
                      value={l.quantity}
                      onChange={(e) => update(i, { quantity: e.target.value })}
                    />
                  </td>
                  <td>
                    <select
                      value={l.unit}
                      onChange={(e) => update(i, { unit: e.target.value as Unit })}
                    >
                      {(ing ? unitsFor(ing.unitKind) : ['g', 'kg', 'ml', 'L', 'un']).map((u) => (
                        <option key={u}>{u}</option>
                      ))}
                    </select>
                  </td>
                  <td>
                    <input
                      inputMode="decimal"
                      size={10}
                      placeholder="0,00"
                      value={l.total}
                      onChange={(e) => update(i, { total: e.target.value })}
                    />
                  </td>
                  <td className="num muted">{ing ? linePreview(l, ing) : ''}</td>
                  <td className="num">
                    {lines.length > 1 && (
                      <button
                        className="secondary"
                        onClick={() => setLines((ls) => ls.filter((_, j) => j !== i))}
                        aria-label="Remover linha"
                      >
                        ✕
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div className="row" style={{ margin: '12px 0' }}>
        <button className="secondary" onClick={() => setLines((ls) => [...ls, emptyLine()])}>
          + Item
        </button>
        <span className="spacer" style={{ flex: 1 }} />
        <strong>Total: {brl(total)}</strong>
      </div>
      {msg && <p className={msg === 'Rascunho salvo.' ? 'ok' : 'error'}>{msg}</p>}
      <div className="row">
        <button className="secondary" disabled={busy} onClick={() => save(false)}>
          Salvar rascunho
        </button>
        <button disabled={busy} onClick={() => save(true)}>
          Lançar no estoque
        </button>
        {!isNew && (
          <button className="danger" disabled={busy} onClick={remove}>
            Excluir rascunho
          </button>
        )}
      </div>
    </>
  );
}

/** Mostra quanto custou o kg/L/un nesta compra, para conferir a digitação antes de lançar. */
function linePreview(l: Line, ing: Ingredient): string {
  const quantity = readQuantity(l.quantity);
  const cents = lerReais(l.total);
  if (!quantity || cents === null) return '';
  try {
    const base = paraUnidadeBase(quantity, l.unit, ing.unitKind);
    const perBase = new Decimal(cents).div(base);
    return `${brl(custoPorUnidadeComercial(perBase, ing.unitKind))}/${commercialUnit(ing.unitKind)}`;
  } catch {
    return '';
  }
}
