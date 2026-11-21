import { randomBytes } from 'node:crypto';

// Banco separado para testes. Na CI, DATABASE_URL vem do workflow.
process.env.NODE_ENV = 'test';
process.env.DATABASE_URL ??=
  'postgresql://bastiao:bastiao@localhost:5432/bastiao_test?schema=public';
process.env.REDIS_URL ??= 'redis://localhost:6379/1';
process.env.JWT_ACCESS_SECRET ??= randomBytes(48).toString('base64');
process.env.JWT_MFA_SECRET ??= randomBytes(48).toString('base64');
process.env.FIELD_ENCRYPTION_KEY ??= randomBytes(32).toString('base64');
process.env.FIELD_HASH_KEY ??= randomBytes(32).toString('base64');
process.env.SESSION_IDLE_MINUTES ??= '30';
