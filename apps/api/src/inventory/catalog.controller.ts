import { Body, Controller, Get, NotFoundException, Param, Patch, Post } from '@nestjs/common';
import { ActorType, StaffRole } from '@prisma/client';
import { AuditService } from '../audit/audit.service';
import type { AuthenticatedStaff, RequestMeta as Meta } from '../auth/auth.types';
import { CurrentStaff, Roles } from '../auth/decorators';
import { uniqueOr409 } from '../common/prisma-errors';
import { RequestMeta } from '../common/request-meta';
import { uuid } from '../common/uuid.pipe';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { PrismaService } from '../prisma/prisma.service';
import {
  createIngredientSchema,
  createSupplierSchema,
  updateIngredientSchema,
  updateSupplierSchema,
  type CreateIngredient,
  type CreateSupplier,
  type UpdateIngredient,
  type UpdateSupplier,
} from './schemas';

/** Cadastros que valem para todas as unidades: insumos e fornecedores. */
@Controller()
@Roles(StaffRole.MANAGER, StaffRole.OWNER)
export class CatalogController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  @Get('ingredients')
  listIngredients() {
    return this.prisma.ingredient.findMany({ orderBy: { name: 'asc' } });
  }

  @Post('ingredients')
  async createIngredient(
    @Body(new ZodValidationPipe(createIngredientSchema)) body: CreateIngredient,
    @CurrentStaff() staff: AuthenticatedStaff,
    @RequestMeta() meta: Meta,
  ) {
    const created = await uniqueOr409(
      this.prisma.ingredient.create({ data: body }),
      'Já existe um insumo com esse nome.',
    );
    await this.log(staff, meta, 'ingredient.create', 'ingredient', created.id, body);
    return created;
  }

  /** A unidade (peso, volume, unidade) não muda depois do cadastro: mudaria o sentido do saldo. */
  @Patch('ingredients/:id')
  async updateIngredient(
    @Param('id', uuid()) id: string,
    @Body(new ZodValidationPipe(updateIngredientSchema)) body: UpdateIngredient,
    @CurrentStaff() staff: AuthenticatedStaff,
    @RequestMeta() meta: Meta,
  ) {
    await this.findOr404('ingredient', id);
    const updated = await uniqueOr409(
      this.prisma.ingredient.update({ where: { id }, data: body }),
      'Já existe um insumo com esse nome.',
    );
    await this.log(staff, meta, 'ingredient.update', 'ingredient', id, body);
    return updated;
  }

  @Get('suppliers')
  listSuppliers() {
    return this.prisma.supplier.findMany({ orderBy: { name: 'asc' } });
  }

  @Post('suppliers')
  async createSupplier(
    @Body(new ZodValidationPipe(createSupplierSchema)) body: CreateSupplier,
    @CurrentStaff() staff: AuthenticatedStaff,
    @RequestMeta() meta: Meta,
  ) {
    const created = await uniqueOr409(
      this.prisma.supplier.create({ data: body }),
      'Já existe um fornecedor com esse nome.',
    );
    await this.log(staff, meta, 'supplier.create', 'supplier', created.id, { name: body.name });
    return created;
  }

  @Patch('suppliers/:id')
  async updateSupplier(
    @Param('id', uuid()) id: string,
    @Body(new ZodValidationPipe(updateSupplierSchema)) body: UpdateSupplier,
    @CurrentStaff() staff: AuthenticatedStaff,
    @RequestMeta() meta: Meta,
  ) {
    await this.findOr404('supplier', id);
    const updated = await uniqueOr409(
      this.prisma.supplier.update({ where: { id }, data: body }),
      'Já existe um fornecedor com esse nome.',
    );
    await this.log(staff, meta, 'supplier.update', 'supplier', id, { fields: Object.keys(body) });
    return updated;
  }

  private async findOr404(kind: 'ingredient' | 'supplier', id: string): Promise<void> {
    const found =
      kind === 'ingredient'
        ? await this.prisma.ingredient.findUnique({ where: { id }, select: { id: true } })
        : await this.prisma.supplier.findUnique({ where: { id }, select: { id: true } });
    if (!found)
      throw new NotFoundException(
        kind === 'ingredient' ? 'Insumo não encontrado.' : 'Fornecedor não encontrado.',
      );
  }

  private log(
    staff: AuthenticatedStaff,
    meta: Meta,
    action: string,
    entityType: string,
    entityId: string,
    metadata: object,
  ) {
    return this.audit.record({
      actorType: ActorType.STAFF,
      actorId: staff.id,
      action,
      entityType,
      entityId,
      metadata: metadata as never,
      ip: meta.ip,
    });
  }
}
