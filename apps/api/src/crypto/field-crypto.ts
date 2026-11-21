import {
  createCipheriv,
  createDecipheriv,
  createHmac,
  randomBytes,
  timingSafeEqual,
} from 'node:crypto';

const VERSION = 'v1';
const IV_BYTES = 12;

/**
 * Criptografia de campo para dados pessoais (CPF, celular) e segredos (TOTP).
 * AES-256-GCM: confidencialidade e integridade. Formato: v1.<iv>.<tag>.<cifra> em base64url.
 *
 * O índice cego (blindIndex) é um HMAC determinístico que permite buscar
 * "existe cliente com este celular?" sem descriptografar a tabela.
 */
export class FieldCrypto {
  private readonly encKey: Buffer;
  private readonly hashKey: Buffer;

  constructor(encryptionKeyB64: string, hashKeyB64: string) {
    this.encKey = Buffer.from(encryptionKeyB64, 'base64');
    this.hashKey = Buffer.from(hashKeyB64, 'base64');
    if (this.encKey.length !== 32 || this.hashKey.length !== 32) {
      throw new Error('FieldCrypto: as chaves precisam ter 32 bytes');
    }
    if (timingSafeEqual(this.encKey, this.hashKey)) {
      throw new Error('FieldCrypto: a chave de criptografia e a de índice precisam ser diferentes');
    }
  }

  encrypt(plaintext: string): string {
    const iv = randomBytes(IV_BYTES);
    const cipher = createCipheriv('aes-256-gcm', this.encKey, iv);
    const data = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
    const tag = cipher.getAuthTag();
    return [VERSION, iv, tag, data]
      .map((p) => (typeof p === 'string' ? p : p.toString('base64url')))
      .join('.');
  }

  decrypt(payload: string): string {
    const parts = payload.split('.');
    if (parts.length !== 4 || parts[0] !== VERSION) {
      throw new Error('FieldCrypto: formato inválido');
    }
    const [, ivB64, tagB64, dataB64] = parts as [string, string, string, string];
    const decipher = createDecipheriv('aes-256-gcm', this.encKey, Buffer.from(ivB64, 'base64url'));
    decipher.setAuthTag(Buffer.from(tagB64, 'base64url'));
    return Buffer.concat([
      decipher.update(Buffer.from(dataB64, 'base64url')),
      decipher.final(),
    ]).toString('utf8');
  }

  /** Normalize antes (ex.: só dígitos) para que o mesmo valor gere o mesmo índice. */
  blindIndex(value: string, purpose: string): string {
    return createHmac('sha256', this.hashKey).update(`${purpose}:${value}`).digest('base64url');
  }
}
