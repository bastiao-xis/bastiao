import {
  centavos,
  custoPorUnidadeComercial,
  formatarBRL,
  formatarQuantidade,
  UNIDADE_COMERCIAL,
  UNIDADES_POR_TIPO,
} from '@bastiao/regras';
import type { UnitKind } from '@bastiao/api-client';

export const brl = (c: number) => formatarBRL(centavos(c));
export const qty = (base: string, kind: UnitKind) => formatarQuantidade(base, kind);
export const costPerUnit = (avgCost: string, kind: UnitKind) =>
  `${formatarBRL(centavos(custoPorUnidadeComercial(avgCost, kind)))}/${UNIDADE_COMERCIAL[kind]}`;
export const unitsFor = (kind: UnitKind) => UNIDADES_POR_TIPO[kind];
export const commercialUnit = (kind: UnitKind) => UNIDADE_COMERCIAL[kind];
export const KIND_LABEL: Record<UnitKind, string> = {
  MASS: 'Peso',
  VOLUME: 'Volume',
  UNIT: 'Unidade',
};
export const dateBR = (iso: string) =>
  new Date(iso).toLocaleDateString('pt-BR', { timeZone: 'UTC' });
export const dateTimeBR = (iso: string) => new Date(iso).toLocaleString('pt-BR');

/** Aceita vírgula ou ponto; devolve com ponto, ou null se inválido. */
export function readQuantity(text: string, allowZero = false): string | null {
  const v = text.trim().replace(',', '.');
  if (!/^\d+(\.\d{1,3})?$/.test(v)) return null;
  if (!allowZero && Number(v) <= 0) return null;
  return v;
}

export function errorMessage(e: unknown): string {
  if (e && typeof e === 'object' && 'body' in e) {
    const body = (
      e as { body: { message?: unknown; issues?: Array<{ path: string; message: string }> } }
    ).body;
    if (body?.issues?.length) return body.issues.map((i) => `${i.path}: ${i.message}`).join('; ');
    if (typeof body?.message === 'string') return body.message;
  }
  return e instanceof Error ? e.message : 'Algo deu errado.';
}
