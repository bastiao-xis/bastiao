import { describe, expect, it } from 'vitest';
import { centavos, formatarBRL, somar } from './dinheiro';

describe('dinheiro', () => {
  it('only accepts integer cents', () => {
    expect(() => centavos(19.9)).toThrow();
    expect(() => centavos(Number.NaN)).toThrow();
    expect(centavos(1990)).toBe(1990);
  });

  it('sums without float drift', () => {
    expect(somar(centavos(10), centavos(20))).toBe(30);
  });

  it('formats as BRL', () => {
    expect(formatarBRL(centavos(1990))).toBe('R$ 19,90');
    expect(formatarBRL(centavos(123456))).toBe('R$ 1.234,56');
    expect(formatarBRL(centavos(0))).toBe('R$ 0,00');
  });
});
