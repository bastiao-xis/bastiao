import { Global, Module } from '@nestjs/common';
import { StoreAccessService } from './store-access.service';
import { StoresController } from './stores.controller';

@Global()
@Module({
  controllers: [StoresController],
  providers: [StoreAccessService],
  exports: [StoreAccessService],
})
export class StoresModule {}
