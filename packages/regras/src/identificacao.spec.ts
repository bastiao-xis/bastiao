import { describe, expect, it } from 'vitest';
import { celularValido, cpfValido, mascararCpf, nomeChamadaValido } from './identificacao';

describe('cpfValido', () => {
  it('accepts valid CPFs with or without punctuation', () => {
    expect(cpfValido('529.982.247-25')).toBe(true);
    expect(cpfValido('52998224725')).toBe(true);
  });
  it('rejects wrong check digits, repeated digits and wrong length', () => {
    expect(cpfValido('529.982.247-26')).toBe(false);
    expect(cpfValido('111.111.111-11')).toBe(false);
    expect(cpfValido('1234567890')).toBe(false);
  });
});

describe('mascararCpf', () => {
  it('masks as ***.456.789-**', () => {
    expect(mascararCpf('123.456.789-09')).toBe('***.456.789-**');
  });
  it('never leaks a partial CPF', () => {
    expect(mascararCpf('123')).toBe('***.***.***-**');
  });
});

describe('celularValido', () => {
  it('requires DDD + 9 digits', () => {
    expect(celularValido('(48) 99999-1234')).toBe(true);
    expect(celularValido('4899991234')).toBe(false);
    expect(celularValido('(48) 3333-1234')).toBe(false);
    expect(celularValido('(08) 99999-1234')).toBe(false);
  });
});

describe('nomeChamadaValido', () => {
  it('accepts 2 to 20 characters after trim', () => {
    expect(nomeChamadaValido('Jo')).toBe(true);
    expect(nomeChamadaValido(' J ')).toBe(false);
    expect(nomeChamadaValido('a'.repeat(21))).toBe(false);
  });
});
