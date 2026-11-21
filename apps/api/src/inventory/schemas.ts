import { z } from 'zod';

const trimmed = (min: number, max: number) => z.string().trim().min(min).max(max);

/** Quantidade como texto ou número, positiva, com até 3 casas. */
export const quantity = z
  .union([z.string(), z.number()])
  .transform((v) => String(v).replace(',', '.'))
  .refine(
    (v) => /^\d+(\.\d{1,3})?$/.test(v) && Number(v) > 0,
    'quantidade inválida (até 3 casas decimais)',
  );

/** Igual a quantity, mas aceita zero (contagem de inventário). */
export const quantityOrZero = z
  .union([z.string(), z.number()])
  .transform((v) => String(v).replace(',', '.'))
  .refine((v) => /^\d+(\.\d{1,3})?$/.test(v), 'quantidade inválida (até 3 casas decimais)');

export const unit = z.enum(['g', 'kg', 'ml', 'L', 'un']);
export const cents = z.number().int().min(0).max(100_000_000);

export const createIngredientSchema = z.object({
  name: trimmed(2, 80),
  unitKind: z.enum(['MASS', 'VOLUME', 'UNIT']),
});
export const updateIngredientSchema = z
  .object({ name: trimmed(2, 80), active: z.boolean() })
  .partial()
  .refine((v) => Object.keys(v).length > 0, 'nada para alterar');

export const createSupplierSchema = z.object({
  name: trimmed(2, 120),
  document: trimmed(11, 18).optional(),
  phone: trimmed(8, 20).optional(),
});
export const updateSupplierSchema = createSupplierSchema
  .extend({ active: z.boolean() })
  .partial()
  .refine((v) => Object.keys(v).length > 0, 'nada para alterar');

export const purchaseSchema = z.object({
  supplierId: z.string().uuid(),
  invoiceNumber: trimmed(1, 60).optional(),
  purchasedAt: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'data no formato AAAA-MM-DD'),
  notes: trimmed(1, 500).optional(),
  items: z
    .array(z.object({ ingredientId: z.string().uuid(), quantity, unit, totalCents: cents }))
    .min(1, 'a compra precisa de pelo menos um item')
    .max(200),
});

export const adjustmentSchema = z.object({
  ingredientId: z.string().uuid(),
  type: z.enum(['ADJUSTMENT_IN', 'ADJUSTMENT_OUT', 'WASTE']),
  quantity,
  unit,
  reason: trimmed(3, 300),
});

export const countSchema = z.object({
  note: trimmed(1, 300).optional(),
  items: z
    .array(z.object({ ingredientId: z.string().uuid(), countedQuantity: quantityOrZero, unit }))
    .min(1)
    .max(500)
    .refine(
      (items) => new Set(items.map((i) => i.ingredientId)).size === items.length,
      'insumo repetido na contagem',
    ),
});

export const minQuantitySchema = z.object({ minQuantity: quantityOrZero.nullable(), unit });

export type CreateIngredient = z.infer<typeof createIngredientSchema>;
export type UpdateIngredient = z.infer<typeof updateIngredientSchema>;
export type CreateSupplier = z.infer<typeof createSupplierSchema>;
export type UpdateSupplier = z.infer<typeof updateSupplierSchema>;
export type PurchaseInput = z.infer<typeof purchaseSchema>;
export type AdjustmentInput = z.infer<typeof adjustmentSchema>;
export type CountInput = z.infer<typeof countSchema>;
export type MinQuantityInput = z.infer<typeof minQuantitySchema>;
