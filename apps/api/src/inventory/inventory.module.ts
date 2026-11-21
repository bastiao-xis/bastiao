import { Module } from '@nestjs/common';
import { CatalogController } from './catalog.controller';
import { InventoryService } from './inventory.service';
import { StockController } from './stock.controller';

@Module({ controllers: [CatalogController, StockController], providers: [InventoryService] })
export class InventoryModule {}
