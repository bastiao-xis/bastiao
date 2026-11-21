import { Controller, Get, HttpException, HttpStatus, Inject } from '@nestjs/common';
import type Redis from 'ioredis';
import { Public } from '../auth/decorators';
import { PrismaService } from '../prisma/prisma.service';
import { REDIS } from '../redis/redis.module';

@Controller('health')
export class HealthController {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(REDIS) private readonly redis: Redis,
  ) {}

  @Public()
  @Get()
  async check(): Promise<{ status: 'ok'; database: 'up'; redis: 'up' }> {
    const [db, cache] = await Promise.allSettled([
      this.prisma.$queryRaw`SELECT 1`,
      this.redis.ping(),
    ]);
    if (db.status === 'rejected' || cache.status === 'rejected') {
      throw new HttpException(
        {
          status: 'error',
          database: db.status === 'fulfilled' ? 'up' : 'down',
          redis: cache.status === 'fulfilled' ? 'up' : 'down',
        },
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    }
    return { status: 'ok', database: 'up', redis: 'up' };
  }
}
