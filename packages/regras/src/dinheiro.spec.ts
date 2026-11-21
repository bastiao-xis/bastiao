import { describe, expect, it } from 'vitest';
import { centavos, formatarBRL, lerReais, somar } from './dinheiro';

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

describe('lerReais', () => {
  it('parses Brazilian formats into cents', () => {
    expect(lerReais('200')).toBe(20000);
    expect(lerReais('200,5')).toBe(20050);
    expect(lerReais('19,90')).toBe(1990);
    expect(lerReais('1.234,56')).toBe(123456);
    expect(lerReais('R$ 19,90')).toBe(1990);
    expect(lerReais('0,00')).toBe(0);
  });
  it('returns null for anything ambiguous', () => {
    expect(lerReais('')).toBeNull();
    expect(lerReais('19.90')).toBeNull();
    expect(lerReais('19,999')).toBeNull();
    expect(lerReais('-5')).toBeNull();
    expect(lerReais('abc')).toBeNull();
  });
});
