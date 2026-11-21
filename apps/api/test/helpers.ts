import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { PrismaClient, StaffRole } from '@prisma/client';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { currentTotp, generateTotpSecret } from '../src/auth/totp';
import { FieldCrypto } from '../src/crypto/field-crypto';
import { hashPassword } from '../src/auth/password';

export async function createApp(): Promise<INestApplication> {
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
  const app = moduleRef.createNestApplication();
  await app.init();
  return app;
}

export async function resetDatabase(prisma: PrismaClient): Promise<void> {
  await prisma.$executeRawUnsafe(
    'TRUNCATE stock_movements, purchase_items, purchases, ingredient_stock, suppliers, ingredients, ' +
      'audit_logs, staff_sessions, staff_store_access, staff_users, stores RESTART IDENTITY CASCADE',
  );
}

export const PASSWORD = 'senha-de-teste-123';

export async function createStaff(
  prisma: PrismaClient,
  role: StaffRole,
  email: string,
  storeIds: string[] = [],
) {
  return prisma.staffUser.create({
    data: {
      email,
      name: email.split('@')[0]!,
      role,
      passwordHash: await hashPassword(PASSWORD),
      stores: { create: storeIds.map((storeId) => ({ storeId })) },
    },
  });
}

/** Cria um usuário (com 2FA já ativo, se o perfil exigir), entra e devolve o cabeçalho de autorização. */
export async function loginAs(
  app: INestApplication,
  prisma: PrismaClient,
  role: StaffRole,
  email: string,
  storeIds: string[] = [],
): Promise<{ authorization: string }> {
  const user = await createStaff(prisma, role, email, storeIds);
  const secret = generateTotpSecret();
  await prisma.staffUser.update({
    where: { id: user.id },
    data: { totpSecretEnc: app.get(FieldCrypto).encrypt(secret), totpEnabledAt: new Date() },
  });
  const http = request(app.getHttpServer());
  const login = await http.post('/auth/login').send({ email, password: PASSWORD }).expect(200);
  let body = login.body;
  if (body.status === 'MFA_REQUIRED') {
    body = (
      await request(app.getHttpServer())
        .post('/auth/mfa/verify')
        .send({ mfaToken: body.mfaToken, code: currentTotp(secret) })
        .expect(200)
    ).body;
  }
  return { authorization: `Bearer ${body.accessToken}` };
}
