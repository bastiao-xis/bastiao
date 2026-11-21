'use client';

import type { Ingredient, UnitKind } from '@bastiao/api-client';
import { useState, type FormEvent } from 'react';
import { api } from '../../../lib/api';
import { errorMessage, KIND_LABEL } from '../../../lib/format';
import { useLoad } from '../../../lib/useLoad';

export default function IngredientsPage() {
  const { data, error, reload } = useLoad(() => api.ingredients.list(), []);
  const [name, setName] = useState('');
  const [unitKind, setUnitKind] = useState<UnitKind>('MASS');
  const [msg, setMsg] = useState<string | null>(null);

  async function create(e: FormEvent) {
    e.preventDefault();
    setMsg(null);
    try {
      await api.ingredients.create({ name, unitKind });
      setName('');
      await reload();
    } catch (err) {
      setMsg(errorMessage(err));
    }
  }

  async function rename(ing: Ingredient) {
    const next = window.prompt('Novo nome do insumo', ing.name);
    if (!next || next === ing.name) return;
    try {
      await api.ingredients.update(ing.id, { name: next });
      await reload();
    } catch (err) {
      setMsg(errorMessage(err));
    }
  }

  async function toggle(ing: Ingredient) {
    try {
      await api.ingredients.update(ing.id, { active: !ing.active });
      await reload();
    } catch (err) {
      setMsg(errorMessage(err));
    }
  }

  return (
    <>
      <h1>Insumos</h1>
      <form className="card row" onSubmit={create}>
        <label style={{ flex: 1, minWidth: 200 }}>
          Nome
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Ex.: Queijo mussarela"
            required
          />
        </label>
        <label>
          Controlado por
          <select value={unitKind} onChange={(e) => setUnitKind(e.target.value as UnitKind)}>
            <option value="MASS">Peso (g / kg)</option>
            <option value="VOLUME">Volume (ml / L)</option>
            <option value="UNIT">Unidade (un)</option>
          </select>
        </label>
        <button type="submit">Cadastrar</button>
      </form>
      <p className="muted">
        A forma de controle não muda depois do cadastro. O custo vem das compras lançadas, nunca é
        digitado aqui.
      </p>
      {(error || msg) && <p className="error">{error ?? msg}</p>}
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Insumo</th>
              <th>Controle</th>
              <th>Situação</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {data?.map((ing) => (
              <tr key={ing.id}>
                <td>{ing.name}</td>
                <td>{KIND_LABEL[ing.unitKind]}</td>
                <td>
                  {ing.active ? (
                    <span className="badge ok">Ativo</span>
                  ) : (
                    <span className="badge">Inativo</span>
                  )}
                </td>
                <td className="num">
                  <button className="secondary" onClick={() => rename(ing)}>
                    Renomear
                  </button>{' '}
                  <button className="secondary" onClick={() => toggle(ing)}>
                    {ing.active ? 'Inativar' : 'Reativar'}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
