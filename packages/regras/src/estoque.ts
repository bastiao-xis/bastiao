import Decimal from 'decimal.js';

/**
 * Estoque e custo de insumos.
 *
 * Cada insumo tem uma unidade-base: grama (MASS), mililitro (VOLUME) ou unidade (UNIT).
 * Toda quantidade é guardada na unidade-base. O custo médio é em centavos por unidade-base,
 * com casas decimais (ex.: 0,0425 centavo por grama), porque o valor por grama é fracionário.
 */

export type TipoUnidade = 'MASS' | 'VOLUME' | 'UNIT';
export type Unidade = 'g' | 'kg' | 'ml' | 'L' | 'un';

export const UNIDADES_POR_TIPO: Record<TipoUnidade, readonly Unidade[]> = {
  MASS: ['g', 'kg'],
  VOLUME: ['ml', 'L'],
  UNIT: ['un'],
};

export const UNIDADE_BASE: Record<TipoUnidade, Unidade> = { MASS: 'g', VOLUME: 'ml', UNIT: 'un' };

const FATOR: Record<Unidade, number> = { g: 1, kg: 1000, ml: 1, L: 1000, un: 1 };

/** Casas decimais guardadas para quantidade (na unidade-base) e para custo médio. */
export const CASAS_QUANTIDADE = 3;
export const CASAS_CUSTO = 6;

export function paraUnidadeBase(
  quantidade: Decimal.Value,
  unidade: Unidade,
  tipo: TipoUnidade,
): Decimal {
  if (!UNIDADES_POR_TIPO[tipo].includes(unidade)) {
    throw new Error(`Unidade ${unidade} não serve para insumo do tipo ${tipo}`);
  }
  return new Decimal(quantidade).times(FATOR[unidade]).toDecimalPlaces(CASAS_QUANTIDADE);
}

export interface PosicaoEstoque {
  /** Quantidade atual na unidade-base. Pode ser negativa se houve baixa sem saldo. */
  quantidade: Decimal.Value;
  /** Custo médio atual, em centavos por unidade-base. */
  custoMedio: Decimal.Value;
}

/**
 * Custo médio ponderado por compras.
 *
 *   novo custo = (saldo × custo atual + valor pago) ÷ (saldo + quantidade comprada)
 *
 * Se o saldo atual for zero ou negativo, o custo anterior não tem mais peso, e o novo
 * custo médio é o custo desta compra.
 */
export function entradaPorCompra(
  atual: PosicaoEstoque,
  quantidadeComprada: Decimal.Value,
  valorPagoCentavos: number,
): { quantidade: Decimal; custoMedio: Decimal } {
  const qtdCompra = new Decimal(quantidadeComprada);
  if (qtdCompra.lte(0)) throw new Error('A quantidade comprada precisa ser maior que zero');
  if (!Number.isSafeInteger(valorPagoCentavos) || valorPagoCentavos < 0) {
    throw new Error('O valor pago precisa ser em centavos inteiros, sem valor negativo');
  }
  const saldo = new Decimal(atual.quantidade);
  const custo = new Decimal(atual.custoMedio);
  const novaQtd = saldo.plus(qtdCompra);

  const novoCusto = saldo.lte(0)
    ? new Decimal(valorPagoCentavos).div(qtdCompra)
    : saldo.times(custo).plus(valorPagoCentavos).div(novaQtd);

  return {
    quantidade: novaQtd.toDecimalPlaces(CASAS_QUANTIDADE),
    custoMedio: novoCusto.toDecimalPlaces(CASAS_CUSTO),
  };
}

/** Valor de uma quantidade ao custo médio, arredondado para centavos inteiros. */
export function valorEmCentavos(quantidade: Decimal.Value, custoMedio: Decimal.Value): number {
  return new Decimal(quantidade)
    .times(custoMedio)
    .toDecimalPlaces(0, Decimal.ROUND_HALF_UP)
    .toNumber();
}

export { Decimal };

/** Unidade comercial de exibição: kg, L ou un. */
export const UNIDADE_COMERCIAL: Record<TipoUnidade, Unidade> = {
  MASS: 'kg',
  VOLUME: 'L',
  UNIT: 'un',
};

/** Ex.: 2500 g → "2,5 kg"; 12 un → "12 un". */
export function formatarQuantidade(quantidadeBase: Decimal.Value, tipo: TipoUnidade): string {
  const unidade = UNIDADE_COMERCIAL[tipo];
  const valor = new Decimal(quantidadeBase).div(FATOR[unidade]).toDecimalPlaces(3);
  return `${valor.toNumber().toLocaleString('pt-BR', { maximumFractionDigits: 3 })} ${unidade}`;
}

/** Custo médio por unidade comercial, em centavos inteiros. Ex.: 4,6 ¢/g → 4600 ¢/kg. */
export function custoPorUnidadeComercial(custoMedioBase: Decimal.Value, tipo: TipoUnidade): number {
  return new Decimal(custoMedioBase)
    .times(FATOR[UNIDADE_COMERCIAL[tipo]])
    .toDecimalPlaces(0, Decimal.ROUND_HALF_UP)
    .toNumber();
}
