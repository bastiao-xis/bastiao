-- CreateEnum
CREATE TYPE "unit_kind" AS ENUM ('MASS', 'VOLUME', 'UNIT');

-- CreateEnum
CREATE TYPE "purchase_status" AS ENUM ('DRAFT', 'POSTED');

-- CreateEnum
CREATE TYPE "stock_movement_type" AS ENUM ('PURCHASE', 'ADJUSTMENT', 'WASTE', 'COUNT');

-- CreateTable
CREATE TABLE "ingredients" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "unit_kind" "unit_kind" NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ingredients_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ingredient_stock" (
    "store_id" UUID NOT NULL,
    "ingredient_id" UUID NOT NULL,
    "quantity" DECIMAL(14,3) NOT NULL DEFAULT 0,
    "avg_cost" DECIMAL(18,6) NOT NULL DEFAULT 0,
    "min_quantity" DECIMAL(14,3),
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ingredient_stock_pkey" PRIMARY KEY ("store_id","ingredient_id")
);

-- CreateTable
CREATE TABLE "suppliers" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "document" TEXT,
    "phone" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "suppliers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "purchases" (
    "id" UUID NOT NULL,
    "store_id" UUID NOT NULL,
    "supplier_id" UUID NOT NULL,
    "status" "purchase_status" NOT NULL DEFAULT 'DRAFT',
    "invoice_number" TEXT,
    "purchased_at" DATE NOT NULL,
    "notes" TEXT,
    "total_cents" INTEGER NOT NULL DEFAULT 0,
    "created_by_id" UUID NOT NULL,
    "posted_by_id" UUID,
    "posted_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "purchases_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "purchase_items" (
    "id" UUID NOT NULL,
    "purchase_id" UUID NOT NULL,
    "ingredient_id" UUID NOT NULL,
    "quantity" DECIMAL(14,3) NOT NULL,
    "unit" TEXT NOT NULL,
    "base_quantity" DECIMAL(14,3) NOT NULL,
    "total_cents" INTEGER NOT NULL,

    CONSTRAINT "purchase_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "stock_movements" (
    "id" UUID NOT NULL,
    "store_id" UUID NOT NULL,
    "ingredient_id" UUID NOT NULL,
    "type" "stock_movement_type" NOT NULL,
    "quantity_delta" DECIMAL(14,3) NOT NULL,
    "quantity_after" DECIMAL(14,3) NOT NULL,
    "unit_cost" DECIMAL(18,6) NOT NULL,
    "avg_cost_after" DECIMAL(18,6) NOT NULL,
    "value_cents" INTEGER NOT NULL,
    "reason" TEXT,
    "purchase_id" UUID,
    "actor_id" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "stock_movements_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ingredients_name_key" ON "ingredients"("name");

-- CreateIndex
CREATE UNIQUE INDEX "suppliers_name_key" ON "suppliers"("name");

-- CreateIndex
CREATE INDEX "purchases_store_id_purchased_at_idx" ON "purchases"("store_id", "purchased_at");

-- CreateIndex
CREATE INDEX "purchase_items_purchase_id_idx" ON "purchase_items"("purchase_id");

-- CreateIndex
CREATE INDEX "stock_movements_store_id_ingredient_id_created_at_idx" ON "stock_movements"("store_id", "ingredient_id", "created_at");

-- CreateIndex
CREATE INDEX "stock_movements_store_id_type_created_at_idx" ON "stock_movements"("store_id", "type", "created_at");

-- AddForeignKey
ALTER TABLE "ingredient_stock" ADD CONSTRAINT "ingredient_stock_store_id_fkey" FOREIGN KEY ("store_id") REFERENCES "stores"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ingredient_stock" ADD CONSTRAINT "ingredient_stock_ingredient_id_fkey" FOREIGN KEY ("ingredient_id") REFERENCES "ingredients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchases" ADD CONSTRAINT "purchases_store_id_fkey" FOREIGN KEY ("store_id") REFERENCES "stores"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchases" ADD CONSTRAINT "purchases_supplier_id_fkey" FOREIGN KEY ("supplier_id") REFERENCES "suppliers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_items" ADD CONSTRAINT "purchase_items_purchase_id_fkey" FOREIGN KEY ("purchase_id") REFERENCES "purchases"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_items" ADD CONSTRAINT "purchase_items_ingredient_id_fkey" FOREIGN KEY ("ingredient_id") REFERENCES "ingredients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_store_id_fkey" FOREIGN KEY ("store_id") REFERENCES "stores"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_ingredient_id_fkey" FOREIGN KEY ("ingredient_id") REFERENCES "ingredients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- O livro do estoque só aceita inserção. Correção se faz com um novo movimento.
CREATE FUNCTION block_changes_append_only() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION '% is append-only', TG_TABLE_NAME;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER stock_movements_append_only
  BEFORE UPDATE OR DELETE ON "stock_movements"
  FOR EACH ROW EXECUTE FUNCTION block_changes_append_only();

-- Garantias que o Prisma não expressa.
ALTER TABLE "purchase_items" ADD CONSTRAINT "purchase_items_quantity_positive" CHECK ("quantity" > 0 AND "base_quantity" > 0);
ALTER TABLE "purchase_items" ADD CONSTRAINT "purchase_items_total_non_negative" CHECK ("total_cents" >= 0);
ALTER TABLE "ingredient_stock" ADD CONSTRAINT "ingredient_stock_avg_cost_non_negative" CHECK ("avg_cost" >= 0);
