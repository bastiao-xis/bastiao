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

/**
 * Lê um valor digitado em reais e devolve centavos. Aceita "200", "200,5", "1.234,56", "R$ 19,90".
 * Devolve null se o texto não for um valor válido (nunca chuta).
 */
export function lerReais(texto: string): Centavos | null {
  const limpo = texto.replace(/R\$\s?/i, '').trim();
  if (!/^\d{1,3}(\.\d{3})*(,\d{1,2})?$|^\d+(,\d{1,2})?$/.test(limpo)) return null;
  const [inteiro, decimal = ''] = limpo.replace(/\./g, '').split(',');
  return centavos(Number(inteiro) * 100 + Number(decimal.padEnd(2, '0')));
}
