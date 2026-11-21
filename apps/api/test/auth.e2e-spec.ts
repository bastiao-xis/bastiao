import { INestApplication } from '@nestjs/common';
import { PrismaClient, StaffRole } from '@prisma/client';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { currentTotp } from '../src/auth/totp';
import { createApp, createStaff, PASSWORD, resetDatabase } from './helpers';

describe('staff auth', () => {
  let app: INestApplication;
  const prisma = new PrismaClient();
  const http = () => request(app.getHttpServer());

  beforeAll(async () => {
    app = await createApp();
  });
  afterAll(async () => {
    await app.close();
    await prisma.$disconnect();
  });
  beforeEach(async () => {
    await resetDatabase(prisma);
  });

  it('protects routes by default', async () => {
    await http().get('/auth/me').expect(401);
    await http().get('/stores').expect(401);
    await http().get('/auth/me').set('authorization', 'Bearer garbage').expect(401);
  });

  it('logs in a cashier with password only and audits it', async () => {
    const user = await createStaff(prisma, StaffRole.CASHIER, 'caixa@bastiao.local');
    const res = await http()
      .post('/auth/login')
      .send({ email: 'CAIXA@bastiao.local', password: PASSWORD })
      .expect(200);
    expect(res.body.status).toBe('AUTHENTICATED');
    expect(res.body.user).toMatchObject({ email: 'caixa@bastiao.local', role: 'CASHIER' });
    expect(JSON.stringify(res.body)).not.toContain('passwordHash');

    const me = await http()
      .get('/auth/me')
      .set('authorization', `Bearer ${res.body.accessToken}`)
      .expect(200);
    expect(me.body.id).toBe(user.id);

    const audit = await prisma.auditLog.findMany({ where: { actorId: user.id } });
    expect(audit.map((a) => a.action)).toContain('auth.login');
  });

  it('gives the same error for unknown email and wrong password', async () => {
    await createStaff(prisma, StaffRole.CASHIER, 'caixa@bastiao.local');
    const a = await http()
      .post('/auth/login')
      .send({ email: 'ninguem@bastiao.local', password: PASSWORD })
      .expect(401);
    const b = await http()
      .post('/auth/login')
      .send({ email: 'caixa@bastiao.local', password: 'errada-errada' })
      .expect(401);
    expect(a.body.message).toBe(b.body.message);
  });

  it('locks the account after 5 wrong passwords', async () => {
    await createStaff(prisma, StaffRole.CASHIER, 'caixa@bastiao.local');
    for (let i = 0; i < 5; i++) {
      await http()
        .post('/auth/login')
        .send({ email: 'caixa@bastiao.local', password: 'errada-errada' })
        .expect(401);
    }
    const res = await http()
      .post('/auth/login')
      .send({ email: 'caixa@bastiao.local', password: PASSWORD })
      .expect(401);
    expect(res.body.message).toMatch(/Muitas tentativas/);
  });

  it('requires a manager to enroll and then use TOTP (RQ-27)', async () => {
    await createStaff(prisma, StaffRole.MANAGER, 'gerente@bastiao.local');
    const first = await http()
      .post('/auth/login')
      .send({ email: 'gerente@bastiao.local', password: PASSWORD })
      .expect(200);
    expect(first.body).toEqual({ status: 'MFA_ENROLLMENT_REQUIRED', mfaToken: expect.any(String) });
    expect(first.body.accessToken).toBeUndefined();

    const enroll = await http()
      .post('/auth/mfa/enroll')
      .send({ mfaToken: first.body.mfaToken })
      .expect(200);
    expect(enroll.body.otpauthUrl).toMatch(/^otpauth:\/\/totp\//);

    const stored = await prisma.staffUser.findUniqueOrThrow({
      where: { email: 'gerente@bastiao.local' },
    });
    expect(stored.totpSecretEnc).not.toContain(enroll.body.secret);

    await http()
      .post('/auth/mfa/enroll/confirm')
      .send({ mfaToken: first.body.mfaToken, code: '000000' })
      .expect(401);
    const confirmed = await http()
      .post('/auth/mfa/enroll/confirm')
      .send({ mfaToken: first.body.mfaToken, code: currentTotp(enroll.body.secret) })
      .expect(200);
    expect(confirmed.body.status).toBe('AUTHENTICATED');
    expect(confirmed.body.user.mfaEnabled).toBe(true);

    // Próximo login: pede o código, e não deixa recadastrar o 2FA só com a senha.
    const second = await http()
      .post('/auth/login')
      .send({ email: 'gerente@bastiao.local', password: PASSWORD })
      .expect(200);
    expect(second.body.status).toBe('MFA_REQUIRED');
    await http().post('/auth/mfa/enroll').send({ mfaToken: second.body.mfaToken }).expect(401);
    const verified = await http()
      .post('/auth/mfa/verify')
      .send({ mfaToken: second.body.mfaToken, code: currentTotp(enroll.body.secret) })
      .expect(200);
    expect(verified.body.status).toBe('AUTHENTICATED');
  });

  it('expires the session after inactivity', async () => {
    await createStaff(prisma, StaffRole.CASHIER, 'caixa@bastiao.local');
    const res = await http()
      .post('/auth/login')
      .send({ email: 'caixa@bastiao.local', password: PASSWORD })
      .expect(200);
    await prisma.staffSession.updateMany({
      data: { lastActivityAt: new Date(Date.now() - 31 * 60_000) },
    });
    await http().get('/auth/me').set('authorization', `Bearer ${res.body.accessToken}`).expect(401);
    await http().post('/auth/refresh').send({ refreshToken: res.body.refreshToken }).expect(401);
  });

  it('rotates refresh tokens and rejects reuse', async () => {
    await createStaff(prisma, StaffRole.CASHIER, 'caixa@bastiao.local');
    const res = await http()
      .post('/auth/login')
      .send({ email: 'caixa@bastiao.local', password: PASSWORD })
      .expect(200);
    const refreshed = await http()
      .post('/auth/refresh')
      .send({ refreshToken: res.body.refreshToken })
      .expect(200);
    expect(refreshed.body.refreshToken).not.toBe(res.body.refreshToken);
    await http().post('/auth/refresh').send({ refreshToken: res.body.refreshToken }).expect(401);
  });

  it('logout revokes the session', async () => {
    await createStaff(prisma, StaffRole.CASHIER, 'caixa@bastiao.local');
    const res = await http()
      .post('/auth/login')
      .send({ email: 'caixa@bastiao.local', password: PASSWORD })
      .expect(200);
    const auth = { authorization: `Bearer ${res.body.accessToken}` };
    await http().post('/auth/logout').set(auth).expect(204);
    await http().get('/auth/me').set(auth).expect(401);
  });

  it('scopes stores by staff access', async () => {
    const a = await prisma.store.create({ data: { code: 'FLN-01', name: 'Florianópolis' } });
    await prisma.store.create({ data: { code: 'SJ-01', name: 'São José' } });
    await createStaff(prisma, StaffRole.CASHIER, 'caixa@bastiao.local', [a.id]);
    const res = await http()
      .post('/auth/login')
      .send({ email: 'caixa@bastiao.local', password: PASSWORD })
      .expect(200);
    const stores = await http()
      .get('/stores')
      .set('authorization', `Bearer ${res.body.accessToken}`)
      .expect(200);
    expect(stores.body.map((s: { code: string }) => s.code)).toEqual(['FLN-01']);
  });

  it('audit log is append-only at the database level', async () => {
    await createStaff(prisma, StaffRole.CASHIER, 'caixa@bastiao.local');
    await http()
      .post('/auth/login')
      .send({ email: 'caixa@bastiao.local', password: PASSWORD })
      .expect(200);
    await expect(prisma.auditLog.updateMany({ data: { action: 'tampered' } })).rejects.toThrow(
      /append-only/,
    );
    await expect(prisma.auditLog.deleteMany({})).rejects.toThrow(/append-only/);
  });
});
