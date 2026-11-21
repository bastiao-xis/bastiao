'use client';

import type { Supplier } from '@bastiao/api-client';
import { useState, type FormEvent } from 'react';
import { api } from '../../../lib/api';
import { errorMessage } from '../../../lib/format';
import { useLoad } from '../../../lib/useLoad';

export default function SuppliersPage() {
  const { data, error, reload } = useLoad(() => api.suppliers.list(), []);
  const [form, setForm] = useState({ name: '', document: '', phone: '' });
  const [msg, setMsg] = useState<string | null>(null);

  async function create(e: FormEvent) {
    e.preventDefault();
    setMsg(null);
    try {
      await api.suppliers.create({
        name: form.name,
        document: form.document || undefined,
        phone: form.phone || undefined,
      });
      setForm({ name: '', document: '', phone: '' });
      await reload();
    } catch (err) {
      setMsg(errorMessage(err));
    }
  }

  async function toggle(s: Supplier) {
    try {
      await api.suppliers.update(s.id, { active: !s.active });
      await reload();
    } catch (err) {
      setMsg(errorMessage(err));
    }
  }

  return (
    <>
      <h1>Fornecedores</h1>
      <form className="card row" onSubmit={create}>
        <label style={{ flex: 1, minWidth: 200 }}>
          Nome
          <input
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            required
          />
        </label>
        <label>
          CNPJ/CPF (opcional)
          <input
            value={form.document}
            onChange={(e) => setForm({ ...form, document: e.target.value })}
          />
        </label>
        <label>
          Telefone (opcional)
          <input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
        </label>
        <button type="submit">Cadastrar</button>
      </form>
      {(error || msg) && <p className="error">{error ?? msg}</p>}
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Fornecedor</th>
              <th>CNPJ/CPF</th>
              <th>Telefone</th>
              <th>Situação</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {data?.map((s) => (
              <tr key={s.id}>
                <td>{s.name}</td>
                <td>{s.document ?? '—'}</td>
                <td>{s.phone ?? '—'}</td>
                <td>
                  {s.active ? (
                    <span className="badge ok">Ativo</span>
                  ) : (
                    <span className="badge">Inativo</span>
                  )}
                </td>
                <td className="num">
                  <button className="secondary" onClick={() => toggle(s)}>
                    {s.active ? 'Inativar' : 'Reativar'}
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
