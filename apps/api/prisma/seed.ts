// Seed de desenvolvimento: uma unidade de exemplo e o primeiro usuário dono.
// Não cria produto nem preço: isso vem do ERP na Fase 2.
import { PrismaClient, StaffRole } from '@prisma/client';
import { hashPassword } from '../src/auth/password';

async function main(): Promise<void> {
  if (process.env.NODE_ENV === 'production') throw new Error('Seed não roda em produção.');
  const email = process.env.SEED_OWNER_EMAIL;
  const password = process.env.SEED_OWNER_PASSWORD;
  if (!email || !password) throw new Error('Defina SEED_OWNER_EMAIL e SEED_OWNER_PASSWORD no .env');

  const prisma = new PrismaClient();
  try {
    const store = await prisma.store.upsert({
      where: { code: 'DEV-01' },
      update: {},
      create: { code: 'DEV-01', name: 'Unidade de desenvolvimento' },
    });
    await prisma.staffUser.upsert({
      where: { email: email.toLowerCase() },
      update: {},
      create: {
        email: email.toLowerCase(),
        name: 'Dono (dev)',
        role: StaffRole.OWNER,
        passwordHash: await hashPassword(password),
        stores: { create: { storeId: store.id } },
      },
    });
    console.log(`Seed ok: unidade ${store.code}, dono ${email}`);
  } finally {
    await prisma.$disconnect();
  }
}

void main();
