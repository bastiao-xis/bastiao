import { Body, Controller, Delete, Get, HttpCode, Param, Post, Put } from '@nestjs/common';
import { StaffRole } from '@prisma/client';
import type { AuthenticatedStaff, RequestMeta as Meta } from '../auth/auth.types';
import { CurrentStaff, Roles } from '../auth/decorators';
import { RequestMeta } from '../common/request-meta';
import { uuid } from '../common/uuid.pipe';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { StoreAccessService } from '../stores/store-access.service';
import { InventoryService } from './inventory.service';
import {
  adjustmentSchema,
  countSchema,
  minQuantitySchema,
  purchaseSchema,
  type AdjustmentInput,
  type CountInput,
  type MinQuantityInput,
  type PurchaseInput,
} from './schemas';

/** Estoque e compras de uma unidade. Custos são dado financeiro: só gerente e dono. */
@Controller('stores/:storeId')
@Roles(StaffRole.MANAGER, StaffRole.OWNER)
export class StockController {
  constructor(
    private readonly inventory: InventoryService,
    private readonly access: StoreAccessService,
  ) {}

  @Get('stock')
  async stock(
    @Param('storeId', uuid()) storeId: string,
    @CurrentStaff() staff: AuthenticatedStaff,
  ) {
    await this.access.assertAccess(staff, storeId);
    return this.inventory.listStock(storeId);
  }

  @Get('stock/:ingredientId/movements')
  async movements(
    @Param('storeId', uuid()) storeId: string,
    @Param('ingredientId', uuid()) ingredientId: string,
    @CurrentStaff() staff: AuthenticatedStaff,
  ) {
    await this.access.assertAccess(staff, storeId);
    return this.inventory.listMovements(storeId, ingredientId);
  }

  @Put('stock/:ingredientId/min')
  async setMin(
    @Param('storeId', uuid()) storeId: string,
    @Param('ingredientId', uuid()) ingredientId: string,
    @Body(new ZodValidationPipe(minQuantitySchema)) body: MinQuantityInput,
    @CurrentStaff() staff: AuthenticatedStaff,
    @RequestMeta() meta: Meta,
  ) {
    await this.access.assertAccess(staff, storeId);
    return this.inventory.setMinQuantity(storeId, ingredientId, body, staff, meta);
  }

  @Post('stock/adjustments')
  async adjust(
    @Param('storeId', uuid()) storeId: string,
    @Body(new ZodValidationPipe(adjustmentSchema)) body: AdjustmentInput,
    @CurrentStaff() staff: AuthenticatedStaff,
    @RequestMeta() meta: Meta,
  ) {
    await this.access.assertAccess(staff, storeId);
    return this.inventory.adjust(storeId, body, staff, meta);
  }

  @Post('stock/counts')
  async count(
    @Param('storeId', uuid()) storeId: string,
    @Body(new ZodValidationPipe(countSchema)) body: CountInput,
    @CurrentStaff() staff: AuthenticatedStaff,
    @RequestMeta() meta: Meta,
  ) {
    await this.access.assertAccess(staff, storeId);
    return this.inventory.count(storeId, body, staff, meta);
  }

  @Get('purchases')
  async purchases(
    @Param('storeId', uuid()) storeId: string,
    @CurrentStaff() staff: AuthenticatedStaff,
  ) {
    await this.access.assertAccess(staff, storeId);
    return this.inventory.listPurchases(storeId);
  }

  @Get('purchases/:id')
  async purchase(
    @Param('storeId', uuid()) storeId: string,
    @Param('id', uuid()) id: string,
    @CurrentStaff() staff: AuthenticatedStaff,
  ) {
    await this.access.assertAccess(staff, storeId);
    return this.inventory.getPurchase(storeId, id);
  }

  @Post('purchases')
  async createPurchase(
    @Param('storeId', uuid()) storeId: string,
    @Body(new ZodValidationPipe(purchaseSchema)) body: PurchaseInput,
    @CurrentStaff() staff: AuthenticatedStaff,
    @RequestMeta() meta: Meta,
  ) {
    await this.access.assertAccess(staff, storeId);
    return this.inventory.createPurchase(storeId, body, staff, meta);
  }

  @Put('purchases/:id')
  async updatePurchase(
    @Param('storeId', uuid()) storeId: string,
    @Param('id', uuid()) id: string,
    @Body(new ZodValidationPipe(purchaseSchema)) body: PurchaseInput,
    @CurrentStaff() staff: AuthenticatedStaff,
    @RequestMeta() meta: Meta,
  ) {
    await this.access.assertAccess(staff, storeId);
    return this.inventory.updatePurchase(storeId, id, body, staff, meta);
  }

  @Delete('purchases/:id')
  @HttpCode(204)
  async deletePurchase(
    @Param('storeId', uuid()) storeId: string,
    @Param('id', uuid()) id: string,
    @CurrentStaff() staff: AuthenticatedStaff,
    @RequestMeta() meta: Meta,
  ): Promise<void> {
    await this.access.assertAccess(staff, storeId);
    await this.inventory.deletePurchase(storeId, id, staff, meta);
  }

  @Post('purchases/:id/post')
  @HttpCode(200)
  async postPurchase(
    @Param('storeId', uuid()) storeId: string,
    @Param('id', uuid()) id: string,
    @CurrentStaff() staff: AuthenticatedStaff,
    @RequestMeta() meta: Meta,
  ) {
    await this.access.assertAccess(staff, storeId);
    return this.inventory.postPurchase(storeId, id, staff, meta);
  }
}
