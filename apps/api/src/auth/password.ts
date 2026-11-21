import { hash, verify } from '@node-rs/argon2';

// Argon2id com parâmetros recomendados pela OWASP (19 MiB, 2 iterações).
const OPTIONS = { memoryCost: 19456, timeCost: 2, parallelism: 1 } as const;

export const MIN_PASSWORD_LENGTH = 12;

export async function hashPassword(plain: string): Promise<string> {
  if (plain.length < MIN_PASSWORD_LENGTH) {
    throw new Error(`A senha precisa ter pelo menos ${MIN_PASSWORD_LENGTH} caracteres`);
  }
  return hash(plain, OPTIONS);
}

export async function verifyPassword(hashed: string, plain: string): Promise<boolean> {
  try {
    return await verify(hashed, plain);
  } catch {
    return false;
  }
}

// Hash fixo para gastar o mesmo tempo quando o e-mail não existe (evita descobrir e-mails por tempo de resposta).
let dummyHash: Promise<string> | undefined;
export function dummyVerify(plain: string): Promise<boolean> {
  dummyHash ??= hash('dummy-password-for-timing', OPTIONS);
  return dummyHash.then((h) => verifyPassword(h, plain)).then(() => false);
}
