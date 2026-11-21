import { INestApplication } from '@nestjs/common';
import { PrismaClient, StaffRole } from '@prisma/client';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createApp, loginAs, resetDatabase } from './helpers';

describe('inventory', () => {
  let app: INestApplication;
  const prisma = new PrismaClient();
  const http = () => request(app.getHttpServer());
  let storeId: string;
  let otherStoreId: string;
  let auth: { authorization: string };
  let supplierId: string;

  beforeAll(async () => {
    app = await createApp();
  });
  afterAll(async () => {
    await app.close();
    await prisma.$disconnect();
  });
  beforeEach(async () => {
    await resetDatabase(prisma);
    storeId = (await prisma.store.create({ data: { code: 'FLN-01', name: 'Florianópolis' } })).id;
    otherStoreId = (await prisma.store.create({ data: { code: 'SJ-01', name: 'São José' } })).id;
    auth = await loginAs(app, prisma, StaffRole.MANAGER, 'gerente@bastiao.local', [storeId]);
    supplierId = (
      await http().post('/suppliers').set(auth).send({ name: 'Laticínios Serra' }).expect(201)
    ).body.id;
  });

  const ingredient = async (name: string, unitKind: 'MASS' | 'VOLUME' | 'UNIT') =>
    (await http().post('/ingredients').set(auth).send({ name, unitKind }).expect(201)).body
      .id as string;

  const purchase = async (items: object[], store = storeId) =>
    (
      await http()
        .post(`/stores/${store}/purchases`)
        .set(auth)
        .send({ supplierId, purchasedAt: '2026-11-20', items })
        .expect(201)
    ).body;

  const stockOf = async (ingredientId: string) => {
    const res = await http().get(`/stores/${storeId}/stock`).set(auth).expect(200);
    return res.body.find((s: { ingredientId: string }) => s.ingredientId === ingredientId);
  };

  it('is restricted to managers and owners', async () => {
    const cashier = await loginAs(app, prisma, StaffRole.CASHIER, 'caixa@bastiao.local', [storeId]);
    await http().get('/ingredients').set(cashier).expect(403);
    await http().get(`/stores/${storeId}/stock`).set(cashier).expect(403);
  });

  it('blocks stores the manager has no access to', async () => {
    await http().get(`/stores/${otherStoreId}/stock`).set(auth).expect(403);
    await http().get(`/stores/00000000-0000-4000-8000-000000000000/stock`).set(auth).expect(404);
  });

  it('rejects duplicate ingredient names', async () => {
    await ingredient('Queijo', 'MASS');
    await http()
      .post('/ingredients')
      .set(auth)
      .send({ name: 'Queijo', unitKind: 'MASS' })
      .expect(409);
  });

  it('draft purchase does not touch stock; posting applies weighted average cost', async () => {
    const queijo = await ingredient('Queijo', 'MASS');

    // 5 kg por R$ 200,00 → 4 ¢/g
    const first = await purchase([
      { ingredientId: queijo, quantity: '5', unit: 'kg', totalCents: 20000 },
    ]);
    expect(first.status).toBe('DRAFT');
    expect(first.totalCents).toBe(20000);
    expect((await stockOf(queijo)).quantity).toBe('0');

    await http().post(`/stores/${storeId}/purchases/${first.id}/post`).set(auth).expect(200);
    let s = await stockOf(queijo);
    expect(s).toMatchObject({ quantity: '5000', avgCost: '4', valueCents: 20000 });

    // Usa 3 kg (perda registrada), sobra 2 kg a 4 ¢/g.
    await http()
      .post(`/stores/${storeId}/stock/adjustments`)
      .set(auth)
      .send({
        ingredientId: queijo,
        type: 'WASTE',
        quantity: '3',
        unit: 'kg',
        reason: 'teste de baixa',
      })
      .expect(201);

    // Compra 3 kg por R$ 150,00 → (8000 + 15000) / 5000 = 4,6 ¢/g
    const second = await purchase([
      { ingredientId: queijo, quantity: '3000', unit: 'g', totalCents: 15000 },
    ]);
    await http().post(`/stores/${storeId}/purchases/${second.id}/post`).set(auth).expect(200);
    s = await stockOf(queijo);
    expect(s).toMatchObject({ quantity: '5000', avgCost: '4.6', valueCents: 23000 });

    const movements = await http()
      .get(`/stores/${storeId}/stock/${queijo}/movements`)
      .set(auth)
      .expect(200);
    expect(movements.body.map((m: { type: string }) => m.type)).toEqual([
      'PURCHASE',
      'WASTE',
      'PURCHASE',
    ]);
    expect(movements.body[1]).toMatchObject({ quantityDelta: '-3000', valueCents: -12000 });
  });

  it('a posted purchase cannot be posted, edited or deleted again', async () => {
    const pao = await ingredient('Pão de xis', 'UNIT');
    const p = await purchase([{ ingredientId: pao, quantity: 100, unit: 'un', totalCents: 15000 }]);
    await http().post(`/stores/${storeId}/purchases/${p.id}/post`).set(auth).expect(200);
    await http().post(`/stores/${storeId}/purchases/${p.id}/post`).set(auth).expect(409);
    await http()
      .put(`/stores/${storeId}/purchases/${p.id}`)
      .set(auth)
      .send({
        supplierId,
        purchasedAt: '2026-11-20',
        items: [{ ingredientId: pao, quantity: 1, unit: 'un', totalCents: 1 }],
      })
      .expect(409);
    await http().delete(`/stores/${storeId}/purchases/${p.id}`).set(auth).expect(409);
    expect((await stockOf(pao)).quantity).toBe('100');
  });

  it('a draft can be edited and deleted', async () => {
    const pao = await ingredient('Pão de xis', 'UNIT');
    const p = await purchase([{ ingredientId: pao, quantity: 100, unit: 'un', totalCents: 15000 }]);
    const edited = await http()
      .put(`/stores/${storeId}/purchases/${p.id}`)
      .set(auth)
      .send({
        supplierId,
        purchasedAt: '2026-11-21',
        items: [{ ingredientId: pao, quantity: 120, unit: 'un', totalCents: 18000 }],
      })
      .expect(200);
    expect(edited.body.totalCents).toBe(18000);
    expect(edited.body.items).toHaveLength(1);
    await http().delete(`/stores/${storeId}/purchases/${p.id}`).set(auth).expect(204);
    await http().get(`/stores/${storeId}/purchases/${p.id}`).set(auth).expect(404);
  });

  it('refuses a unit that does not match the ingredient', async () => {
    const queijo = await ingredient('Queijo', 'MASS');
    await http()
      .post(`/stores/${storeId}/purchases`)
      .set(auth)
      .send({
        supplierId,
        purchasedAt: '2026-11-20',
        items: [{ ingredientId: queijo, quantity: 1, unit: 'L', totalCents: 100 }],
      })
      .expect(400);
  });

  it('a purchase cannot be read or posted through another store', async () => {
    const owner = await loginAs(app, prisma, StaffRole.OWNER, 'dono@bastiao.local');
    const pao = await ingredient('Pão de xis', 'UNIT');
    const p = await purchase([{ ingredientId: pao, quantity: 10, unit: 'un', totalCents: 1500 }]);
    await http().get(`/stores/${otherStoreId}/purchases/${p.id}`).set(owner).expect(404);
    await http().post(`/stores/${otherStoreId}/purchases/${p.id}/post`).set(owner).expect(404);
  });

  it('does not let a manual adjustment make stock negative', async () => {
    const queijo = await ingredient('Queijo', 'MASS');
    await http()
      .post(`/stores/${storeId}/stock/adjustments`)
      .set(auth)
      .send({
        ingredientId: queijo,
        type: 'ADJUSTMENT_OUT',
        quantity: '1',
        unit: 'g',
        reason: 'teste',
      })
      .expect(422);
  });

  it('inventory count sets the balance and records the difference at average cost', async () => {
    const coca = await ingredient('Coca-Cola 350 ml', 'UNIT');
    const p = await purchase([{ ingredientId: coca, quantity: 24, unit: 'un', totalCents: 7200 }]);
    await http().post(`/stores/${storeId}/purchases/${p.id}/post`).set(auth).expect(200);

    const res = await http()
      .post(`/stores/${storeId}/stock/counts`)
      .set(auth)
      .send({
        note: 'contagem de fechamento',
        items: [{ ingredientId: coca, countedQuantity: '20', unit: 'un' }],
      })
      .expect(201);
    expect(res.body[0]).toMatchObject({
      type: 'COUNT',
      quantityDelta: '-4',
      quantityAfter: '20',
      valueCents: -1200,
    });
    expect(await stockOf(coca)).toMatchObject({ quantity: '20', avgCost: '300' });
  });

  it('flags items below the minimum', async () => {
    const queijo = await ingredient('Queijo', 'MASS');
    await http()
      .put(`/stores/${storeId}/stock/${queijo}/min`)
      .set(auth)
      .send({ minQuantity: '2', unit: 'kg' })
      .expect(200);
    expect(await stockOf(queijo)).toMatchObject({ minQuantity: '2000', belowMinimum: true });
  });

  it('concurrent postings never compute cost over a stale balance', async () => {
    const carne = await ingredient('Bife bovino', 'MASS');
    const a = await purchase([
      { ingredientId: carne, quantity: '10', unit: 'kg', totalCents: 40000 },
    ]);
    const b = await purchase([
      { ingredientId: carne, quantity: '10', unit: 'kg', totalCents: 60000 },
    ]);
    await Promise.all([
      http().post(`/stores/${storeId}/purchases/${a.id}/post`).set(auth).expect(200),
      http().post(`/stores/${storeId}/purchases/${b.id}/post`).set(auth).expect(200),
    ]);
    // Em qualquer ordem: R$ 1.000,00 / 20 kg = 5 ¢/g
    expect(await stockOf(carne)).toMatchObject({
      quantity: '20000',
      avgCost: '5',
      valueCents: 100000,
    });
  });

  it('posting the same purchase twice at the same time only applies once', async () => {
    const carne = await ingredient('Bife bovino', 'MASS');
    const p = await purchase([
      { ingredientId: carne, quantity: '10', unit: 'kg', totalCents: 40000 },
    ]);
    const results = await Promise.all([
      http().post(`/stores/${storeId}/purchases/${p.id}/post`).set(auth),
      http().post(`/stores/${storeId}/purchases/${p.id}/post`).set(auth),
    ]);
    expect(results.map((r) => r.status).sort()).toEqual([200, 409]);
    expect((await stockOf(carne)).quantity).toBe('10000');
  });

  it('stock movements are append-only', async () => {
    const pao = await ingredient('Pão de xis', 'UNIT');
    const p = await purchase([{ ingredientId: pao, quantity: 10, unit: 'un', totalCents: 1500 }]);
    await http().post(`/stores/${storeId}/purchases/${p.id}/post`).set(auth).expect(200);
    await expect(prisma.stockMovement.updateMany({ data: { valueCents: 0 } })).rejects.toThrow(
      /append-only/,
    );
  });
});
