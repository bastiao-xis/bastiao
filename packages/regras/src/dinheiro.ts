/**
 * Dinheiro sempre em centavos inteiros. Nunca use float para valor.
 * Esta camada só formata e soma: o valor em si vem sempre do ERP.
 */
export type Centavos = number & { readonly __brand: 'Centavos' };

export function centavos(value: number): Centavos {
  if (!Number.isSafeInteger(value)) {
    throw new Error(`Valor em centavos precisa ser inteiro: ${value}`);
  }
  return value as Centavos;
}

export function somar(...valores: Centavos[]): Centavos {
  return centavos(valores.reduce((acc, v) => acc + v, 0));
}

const formatter = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });

/** Formata para exibição. Ex.: 1990 → "R$ 19,90". */
export function formatarBRL(valor: Centavos): string {
  // Intl usa espaço não separável; normalizamos para espaço comum.
  return formatter.format(valor / 100).replace(/\u00a0/g, ' ');
}
