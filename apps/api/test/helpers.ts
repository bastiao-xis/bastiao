import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { PrismaClient, StaffRole } from '@prisma/client';
import { AppModule } from '../src/app.module';
import { hashPassword } from '../src/auth/password';

export async function createApp(): Promise<INestApplication> {
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
  const app = moduleRef.createNestApplication();
  await app.init();
  return app;
}

export async function resetDatabase(prisma: PrismaClient): Promise<void> {
  await prisma.$executeRawUnsafe(
    'TRUNCATE audit_logs, staff_sessions, staff_store_access, staff_users, stores RESTART IDENTITY CASCADE',
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
