/**
 * Validações de identificação do cliente (Etapa 1, tabela do Processo do Totem):
 * - Celular: DDD + 9 dígitos
 * - CPF: dígitos verificadores, mascarado na tela (***.456.789-**)
 * - Nome para chamada: de 2 a 20 caracteres
 */

export function apenasDigitos(value: string): string {
  return value.replace(/\D/g, '');
}

export function cpfValido(input: string): boolean {
  const cpf = apenasDigitos(input);
  if (cpf.length !== 11 || /^(\d)\1{10}$/.test(cpf)) return false;
  const digito = (len: number): number => {
    let soma = 0;
    for (let i = 0; i < len; i++) soma += Number(cpf[i]) * (len + 1 - i);
    const resto = (soma * 10) % 11;
    return resto === 10 ? 0 : resto;
  };
  return digito(9) === Number(cpf[9]) && digito(10) === Number(cpf[10]);
}

/** Máscara do totem: ***.456.789-** */
export function mascararCpf(input: string): string {
  const cpf = apenasDigitos(input);
  if (cpf.length !== 11) return '***.***.***-**';
  return `***.${cpf.slice(3, 6)}.${cpf.slice(6, 9)}-**`;
}

/** DDD válido (11 a 99, sem zero) + 9 dígitos começando por 9. */
export function celularValido(input: string): boolean {
  return /^[1-9][1-9]9\d{8}$/.test(apenasDigitos(input));
}

export const NOME_CHAMADA_MIN = 2;
export const NOME_CHAMADA_MAX = 20;

export function nomeChamadaValido(input: string): boolean {
  const nome = input.trim();
  return nome.length >= NOME_CHAMADA_MIN && nome.length <= NOME_CHAMADA_MAX;
}
