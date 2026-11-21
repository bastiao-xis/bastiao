import { Controller, Get } from '@nestjs/common';
import { StaffRole } from '@prisma/client';
import type { AuthenticatedStaff } from '../auth/auth.types';
import { CurrentStaff } from '../auth/decorators';
import { PrismaService } from '../prisma/prisma.service';

@Controller('stores')
export class StoresController {
  constructor(private readonly prisma: PrismaService) {}

  /** Unidades que a pessoa logada pode ver. O dono vê todas. */
  @Get()
  list(@CurrentStaff() staff: AuthenticatedStaff) {
    return this.prisma.store.findMany({
      where:
        staff.role === StaffRole.OWNER ? {} : { staffAccess: { some: { staffUserId: staff.id } } },
      select: { id: true, code: true, name: true, timezone: true, active: true },
      orderBy: { name: 'asc' },
    });
  }
}
