import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { ActorType, Prisma, PurchaseStatus, StockMovementType, UnitKind } from '@prisma/client';
import {
  CASAS_QUANTIDADE,
  Decimal,
  entradaPorCompra,
  paraUnidadeBase,
  valorEmCentavos,
  type Unidade,
} from '@bastiao/regras';
import { AuditService } from '../audit/audit.service';
import type { AuthenticatedStaff, RequestMeta } from '../auth/auth.types';
import { PrismaService } from '../prisma/prisma.service';
import type { AdjustmentInput, CountInput, MinQuantityInput, PurchaseInput } from './schemas';

type Tx = Prisma.TransactionClient;

interface StockPosition {
  quantity: Decimal;
  avgCost: Decimal;
}

const purchaseInclude = {
  supplier: { select: { id: true, name: true } },
  items: { include: { ingredient: { select: { id: true, name: true, unitKind: true } } } },
} satisfies Prisma.PurchaseInclude;

@Injectable()
export class InventoryService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  // --- Consulta ---------------------------------------------------------------

  /** Saldo, custo médio e valor em estoque de cada insumo ativo na unidade. */
  async listStock(storeId: string) {
    const [ingredients, stock] = await Promise.all([
      this.prisma.ingredient.findMany({ where: { active: true }, orderBy: { name: 'asc' } }),
      this.prisma.ingredientStock.findMany({ where: { storeId } }),
    ]);
    const byId = new Map(stock.map((s) => [s.ingredientId, s]));
    return ingredients.map((ing) => {
      const s = byId.get(ing.id);
      const quantity = new Decimal(s?.quantity.toString() ?? 0);
      const avgCost = new Decimal(s?.avgCost.toString() ?? 0);
      const minQuantity = s?.minQuantity ? new Decimal(s.minQuantity.toString()) : null;
      return {
        ingredientId: ing.id,
        name: ing.name,
        unitKind: ing.unitKind,
        quantity: quantity.toString(),
        avgCost: avgCost.toString(),
        valueCents: valorEmCentavos(quantity, avgCost),
        minQuantity: minQuantity?.toString() ?? null,
        belowMinimum: minQuantity !== null && quantity.lt(minQuantity),
      };
    });
  }

  listMovements(storeId: string, ingredientId: string) {
    return this.prisma.stockMovement.findMany({
      where: { storeId, ingredientId },
      orderBy: { createdAt: 'desc' },
      take: 200,
    });
  }

  listPurchases(storeId: string) {
    return this.prisma.purchase.findMany({
      where: { storeId },
      include: { supplier: { select: { id: true, name: true } } },
      orderBy: [{ purchasedAt: 'desc' }, { createdAt: 'desc' }],
      take: 200,
    });
  }

  async getPurchase(storeId: string, id: string) {
    const purchase = await this.prisma.purchase.findFirst({
      where: { id, storeId },
      include: purchaseInclude,
    });
    if (!purchase) throw new NotFoundException('Compra não encontrada.');
    return purchase;
  }

  // --- Compras ---------------------------------------------------------------

  async createPurchase(
    storeId: string,
    input: PurchaseInput,
    staff: AuthenticatedStaff,
    meta: RequestMeta,
  ) {
    const items = await this.buildPurchaseItems(input);
    const purchase = await this.prisma.$transaction(async (tx) => {
      const created = await tx.purchase.create({
        data: {
          storeId,
          supplierId: input.supplierId,
          invoiceNumber: input.invoiceNumber ?? null,
          purchasedAt: new Date(`${input.purchasedAt}T00:00:00Z`),
          notes: input.notes ?? null,
          totalCents: items.reduce((sum, i) => sum + i.totalCents, 0),
          createdById: staff.id,
          items: { create: items },
        },
        include: purchaseInclude,
      });
      await this.log(tx, staff, meta, storeId, 'purchase.create', 'purchase', created.id, {
        totalCents: created.totalCents,
        items: items.length,
      });
      return created;
    });
    return purchase;
  }

  async updatePurchase(
    storeId: string,
    id: string,
    input: PurchaseInput,
    staff: AuthenticatedStaff,
    meta: RequestMeta,
  ) {
    const items = await this.buildPurchaseItems(input);
    return this.prisma.$transaction(async (tx) => {
      await this.lockDraft(tx, storeId, id);
      await tx.purchaseItem.deleteMany({ where: { purchaseId: id } });
      const updated = await tx.purchase.update({
        where: { id },
        data: {
          supplierId: input.supplierId,
          invoiceNumber: input.invoiceNumber ?? null,
          purchasedAt: new Date(`${input.purchasedAt}T00:00:00Z`),
          notes: input.notes ?? null,
          totalCents: items.reduce((sum, i) => sum + i.totalCents, 0),
          items: { create: items },
        },
        include: purchaseInclude,
      });
      await this.log(tx, staff, meta, storeId, 'purchase.update', 'purchase', id, {
        totalCents: updated.totalCents,
        items: items.length,
      });
      return updated;
    });
  }

  async deletePurchase(
    storeId: string,
    id: string,
    staff: AuthenticatedStaff,
    meta: RequestMeta,
  ): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      await this.lockDraft(tx, storeId, id);
      await tx.purchase.delete({ where: { id } });
      await this.log(tx, staff, meta, storeId, 'purchase.delete', 'purchase', id, {});
    });
  }

  /**
   * Lança a compra: soma no saldo e recalcula o custo médio ponderado de cada insumo.
   * Tudo numa transação, com trava nas linhas de saldo, para duas operações ao mesmo tempo
   * não calcularem o custo em cima do mesmo saldo antigo.
   */
  async postPurchase(storeId: string, id: string, staff: AuthenticatedStaff, meta: RequestMeta) {
    await this.prisma.$transaction(async (tx) => {
      // A troca DRAFT → POSTED é condicional: lançar duas vezes não soma duas vezes.
      const moved = await tx.purchase.updateMany({
        where: { id, storeId, status: PurchaseStatus.DRAFT },
        data: { status: PurchaseStatus.POSTED, postedById: staff.id, postedAt: new Date() },
      });
      if (moved.count !== 1) {
        const exists = await tx.purchase.findFirst({
          where: { id, storeId },
          select: { status: true },
        });
        if (!exists) throw new NotFoundException('Compra não encontrada.');
        throw new ConflictException('Esta compra já foi lançada.');
      }

      const items = await tx.purchaseItem.findMany({
        where: { purchaseId: id },
        include: { ingredient: { select: { active: true, name: true } } },
        // Ordem fixa de travas evita deadlock entre duas compras com os mesmos insumos.
        orderBy: [{ ingredientId: 'asc' }, { id: 'asc' }],
      });
      for (const item of items) {
        if (!item.ingredient.active) {
          throw new UnprocessableEntityException(`O insumo ${item.ingredient.name} está inativo.`);
        }
        const current = await this.lockStock(tx, storeId, item.ingredientId);
        const next = entradaPorCompra(
          { quantidade: current.quantity, custoMedio: current.avgCost },
          item.baseQuantity.toString(),
          item.totalCents,
        );
        await this.saveStock(tx, storeId, item.ingredientId, next.quantidade, next.custoMedio);
        await tx.stockMovement.create({
          data: {
            storeId,
            ingredientId: item.ingredientId,
            type: StockMovementType.PURCHASE,
            quantityDelta: item.baseQuantity,
            quantityAfter: next.quantidade.toString(),
            unitCost: new Decimal(item.totalCents)
              .div(item.baseQuantity.toString())
              .toDecimalPlaces(6)
              .toString(),
            avgCostAfter: next.custoMedio.toString(),
            valueCents: item.totalCents,
            purchaseId: id,
            actorId: staff.id,
          },
        });
      }
      await this.log(tx, staff, meta, storeId, 'purchase.post', 'purchase', id, {
        items: items.length,
      });
    });
    return this.getPurchase(storeId, id);
  }

  // --- Ajuste, perda e contagem --------------------------------------------------

  /** Entrada ou saída manual sem compra. O custo médio não muda; o movimento é valorizado pelo custo atual. */
  async adjust(
    storeId: string,
    input: AdjustmentInput,
    staff: AuthenticatedStaff,
    meta: RequestMeta,
  ) {
    const ingredient = await this.activeIngredient(input.ingredientId);
    const base = this.toBase(input.quantity, input.unit, ingredient.unitKind);
    const delta = input.type === 'ADJUSTMENT_IN' ? base : base.negated();
    const type = input.type === 'WASTE' ? StockMovementType.WASTE : StockMovementType.ADJUSTMENT;

    return this.prisma.$transaction(async (tx) => {
      const current = await this.lockStock(tx, storeId, ingredient.id);
      const after = current.quantity.plus(delta);
      if (after.lt(0)) {
        throw new UnprocessableEntityException(
          `O saldo de ${ingredient.name} ficaria negativo (saldo atual: ${current.quantity.toString()}).`,
        );
      }
      await this.saveStock(tx, storeId, ingredient.id, after, current.avgCost);
      const movement = await tx.stockMovement.create({
        data: this.movementData(
          storeId,
          ingredient.id,
          type,
          delta,
          after,
          current.avgCost,
          staff.id,
          input.reason,
        ),
      });
      await this.log(
        tx,
        staff,
        meta,
        storeId,
        `stock.${type.toLowerCase()}`,
        'ingredient',
        ingredient.id,
        {
          quantityDelta: delta.toString(),
          reason: input.reason,
        },
      );
      return movement;
    });
  }

  /**
   * Contagem de inventário: o saldo passa a ser o que foi contado. A diferença vira
   * movimento COUNT, valorizado ao custo médio. É a base do CMV real.
   */
  async count(storeId: string, input: CountInput, staff: AuthenticatedStaff, meta: RequestMeta) {
    const ingredients = await this.prisma.ingredient.findMany({
      where: { id: { in: input.items.map((i) => i.ingredientId) } },
    });
    const byId = new Map(ingredients.map((i) => [i.id, i]));
    const lines = input.items
      .map((item) => {
        const ing = byId.get(item.ingredientId);
        if (!ing || !ing.active)
          throw new UnprocessableEntityException('Insumo inexistente ou inativo na contagem.');
        return { ing, counted: this.toBase(item.countedQuantity, item.unit, ing.unitKind) };
      })
      .sort((a, b) => a.ing.id.localeCompare(b.ing.id));

    return this.prisma.$transaction(async (tx) => {
      const result = [];
      for (const { ing, counted } of lines) {
        const current = await this.lockStock(tx, storeId, ing.id);
        const delta = counted.minus(current.quantity);
        await this.saveStock(tx, storeId, ing.id, counted, current.avgCost);
        const movement = await tx.stockMovement.create({
          data: this.movementData(
            storeId,
            ing.id,
            StockMovementType.COUNT,
            delta,
            counted,
            current.avgCost,
            staff.id,
            input.note ?? null,
          ),
        });
        result.push(movement);
      }
      await this.log(tx, staff, meta, storeId, 'stock.count', 'store', storeId, {
        items: lines.length,
        valueCents: result.reduce((sum, m) => sum + m.valueCents, 0),
      });
      return result;
    });
  }

  async setMinQuantity(
    storeId: string,
    ingredientId: string,
    input: MinQuantityInput,
    staff: AuthenticatedStaff,
    meta: RequestMeta,
  ) {
    const ingredient = await this.activeIngredient(ingredientId);
    const min =
      input.minQuantity === null
        ? null
        : this.toBase(input.minQuantity, input.unit, ingredient.unitKind);
    await this.prisma.$transaction(async (tx) => {
      await this.lockStock(tx, storeId, ingredientId);
      await tx.ingredientStock.update({
        where: { storeId_ingredientId: { storeId, ingredientId } },
        data: { minQuantity: min?.toString() ?? null },
      });
      await this.log(tx, staff, meta, storeId, 'stock.min_set', 'ingredient', ingredientId, {
        minQuantity: min?.toString() ?? null,
      });
    });
    return { ingredientId, minQuantity: min?.toString() ?? null };
  }

  // --- Internos ---------------------------------------------------------------

  private async buildPurchaseItems(input: PurchaseInput) {
    const supplier = await this.prisma.supplier.findUnique({ where: { id: input.supplierId } });
    if (!supplier || !supplier.active)
      throw new UnprocessableEntityException('Fornecedor inexistente ou inativo.');
    const ids = [...new Set(input.items.map((i) => i.ingredientId))];
    const ingredients = await this.prisma.ingredient.findMany({ where: { id: { in: ids } } });
    const byId = new Map(ingredients.map((i) => [i.id, i]));
    return input.items.map((item) => {
      const ing = byId.get(item.ingredientId);
      if (!ing || !ing.active)
        throw new UnprocessableEntityException('Insumo inexistente ou inativo na compra.');
      return {
        ingredientId: ing.id,
        quantity: item.quantity,
        unit: item.unit,
        baseQuantity: this.toBase(item.quantity, item.unit, ing.unitKind).toString(),
        totalCents: item.totalCents,
      };
    });
  }

  private toBase(quantity: string, unit: Unidade, kind: UnitKind): Decimal {
    let base: Decimal;
    try {
      base = paraUnidadeBase(quantity, unit, kind);
    } catch (e) {
      throw new BadRequestException((e as Error).message);
    }
    if (base.decimalPlaces() > CASAS_QUANTIDADE)
      throw new BadRequestException('Quantidade com casas demais.');
    return base;
  }

  private async activeIngredient(id: string) {
    const ing = await this.prisma.ingredient.findUnique({ where: { id } });
    if (!ing) throw new NotFoundException('Insumo não encontrado.');
    if (!ing.active) throw new UnprocessableEntityException(`O insumo ${ing.name} está inativo.`);
    return ing;
  }

  private async lockDraft(tx: Tx, storeId: string, id: string): Promise<void> {
    const rows = await tx.$queryRaw<{ status: PurchaseStatus }[]>`
      SELECT status FROM purchases WHERE id = ${id}::uuid AND store_id = ${storeId}::uuid FOR UPDATE`;
    if (rows.length === 0) throw new NotFoundException('Compra não encontrada.');
    if (rows[0]!.status !== PurchaseStatus.DRAFT) {
      throw new ConflictException(
        'Compra lançada não pode ser alterada. Faça um ajuste de estoque.',
      );
    }
  }

  /** Garante a linha de saldo e trava até o fim da transação. */
  private async lockStock(tx: Tx, storeId: string, ingredientId: string): Promise<StockPosition> {
    await tx.$executeRaw`
      INSERT INTO ingredient_stock (store_id, ingredient_id, updated_at)
      VALUES (${storeId}::uuid, ${ingredientId}::uuid, now())
      ON CONFLICT DO NOTHING`;
    const rows = await tx.$queryRaw<{ quantity: Prisma.Decimal; avg_cost: Prisma.Decimal }[]>`
      SELECT quantity, avg_cost FROM ingredient_stock
      WHERE store_id = ${storeId}::uuid AND ingredient_id = ${ingredientId}::uuid
      FOR UPDATE`;
    const row = rows[0]!;
    return {
      quantity: new Decimal(row.quantity.toString()),
      avgCost: new Decimal(row.avg_cost.toString()),
    };
  }

  private saveStock(
    tx: Tx,
    storeId: string,
    ingredientId: string,
    quantity: Decimal,
    avgCost: Decimal,
  ) {
    return tx.ingredientStock.update({
      where: { storeId_ingredientId: { storeId, ingredientId } },
      data: { quantity: quantity.toString(), avgCost: avgCost.toString() },
    });
  }

  private movementData(
    storeId: string,
    ingredientId: string,
    type: StockMovementType,
    delta: Decimal,
    after: Decimal,
    avgCost: Decimal,
    actorId: string,
    reason: string | null,
  ): Prisma.StockMovementUncheckedCreateInput {
    return {
      storeId,
      ingredientId,
      type,
      quantityDelta: delta.toString(),
      quantityAfter: after.toString(),
      unitCost: avgCost.toString(),
      avgCostAfter: avgCost.toString(),
      valueCents: valorEmCentavos(delta, avgCost),
      reason,
      actorId,
    };
  }

  private log(
    tx: Tx,
    staff: AuthenticatedStaff,
    meta: RequestMeta,
    storeId: string,
    action: string,
    entityType: string,
    entityId: string,
    metadata: Prisma.InputJsonObject,
  ) {
    return this.audit.record(
      {
        storeId,
        actorType: ActorType.STAFF,
        actorId: staff.id,
        action,
        entityType,
        entityId,
        metadata,
        ip: meta.ip,
      },
      tx,
    );
  }
}
