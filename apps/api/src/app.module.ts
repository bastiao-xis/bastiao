import { Module } from '@nestjs/common';
import { AuditModule } from './audit/audit.module';
import { AuthModule } from './auth/auth.module';
import { ConfigModule } from './config/config.module';
import { CryptoModule } from './crypto/crypto.module';
import { HealthController } from './health/health.controller';
import { InventoryModule } from './inventory/inventory.module';
import { PrismaModule } from './prisma/prisma.module';
import { RedisModule } from './redis/redis.module';
import { StoresModule } from './stores/stores.module';

@Module({
  imports: [
    ConfigModule,
    PrismaModule,
    RedisModule,
    CryptoModule,
    AuditModule,
    AuthModule,
    StoresModule,
    InventoryModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}
