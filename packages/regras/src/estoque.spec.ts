import { describe, expect, it } from 'vitest';
import {
  custoPorUnidadeComercial,
  entradaPorCompra,
  formatarQuantidade,
  paraUnidadeBase,
  valorEmCentavos,
} from './estoque';

describe('paraUnidadeBase', () => {
  it('converts kg to g and L to ml', () => {
    expect(paraUnidadeBase('2.5', 'kg', 'MASS').toString()).toBe('2500');
    expect(paraUnidadeBase('0.35', 'L', 'VOLUME').toString()).toBe('350');
    expect(paraUnidadeBase(12, 'un', 'UNIT').toString()).toBe('12');
  });

  it('refuses a unit of the wrong kind', () => {
    expect(() => paraUnidadeBase(1, 'L', 'MASS')).toThrow();
    expect(() => paraUnidadeBase(1, 'kg', 'UNIT')).toThrow();
  });
});

describe('entradaPorCompra (custo médio ponderado)', () => {
  it('first purchase sets the cost', () => {
    // 5 kg de queijo por R$ 200,00 → 4 centavos por grama
    const r = entradaPorCompra({ quantidade: 0, custoMedio: 0 }, 5000, 20000);
    expect(r.quantidade.toString()).toBe('5000');
    expect(r.custoMedio.toString()).toBe('4');
  });

  it('weights the new purchase against the remaining stock', () => {
    // Saldo 2 kg a 4 ¢/g (R$ 80) + compra 3 kg por R$ 150 → R$ 230 / 5 kg = 4,6 ¢/g
    const r = entradaPorCompra({ quantidade: 2000, custoMedio: 4 }, 3000, 15000);
    expect(r.quantidade.toString()).toBe('5000');
    expect(r.custoMedio.toString()).toBe('4.6');
  });

  it('keeps fractional cost per base unit', () => {
    // 1 un por R$ 1,00, depois 2 un por R$ 1,00 → 200 ¢ / 3 un = 66,666667 ¢
    const r = entradaPorCompra({ quantidade: 1, custoMedio: 100 }, 2, 100);
    expect(r.custoMedio.toString()).toBe('66.666667');
  });

  it('ignores old cost when stock is zero or negative', () => {
    const r = entradaPorCompra({ quantidade: -500, custoMedio: 10 }, 2000, 8000);
    expect(r.quantidade.toString()).toBe('1500');
    expect(r.custoMedio.toString()).toBe('4');
  });

  it('accepts a free purchase (bonificação) and lowers the average', () => {
    const r = entradaPorCompra({ quantidade: 1000, custoMedio: 4 }, 1000, 0);
    expect(r.custoMedio.toString()).toBe('2');
  });

  it('rejects zero quantity, negative or fractional value', () => {
    const atual = { quantidade: 0, custoMedio: 0 };
    expect(() => entradaPorCompra(atual, 0, 100)).toThrow();
    expect(() => entradaPorCompra(atual, 10, -1)).toThrow();
    expect(() => entradaPorCompra(atual, 10, 10.5)).toThrow();
  });
});

describe('valorEmCentavos', () => {
  it('rounds to whole cents', () => {
    expect(valorEmCentavos(3, '66.666667')).toBe(200);
    expect(valorEmCentavos(150, '4.6')).toBe(690);
  });
});

describe('exibição', () => {
  it('formats base quantities in commercial units', () => {
    expect(formatarQuantidade('2500', 'MASS')).toBe('2,5 kg');
    expect(formatarQuantidade('350', 'VOLUME')).toBe('0,35 L');
    expect(formatarQuantidade('12', 'UNIT')).toBe('12 un');
  });
  it('converts average cost to cents per kg, L or un', () => {
    expect(custoPorUnidadeComercial('4.6', 'MASS')).toBe(4600);
    expect(custoPorUnidadeComercial('66.666667', 'UNIT')).toBe(67);
  });
});
