import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { StaffRole } from '@prisma/client';
import type { AuthenticatedStaff } from '../auth/auth.types';
import { PrismaService } from '../prisma/prisma.service';

/** Todo dado operacional é por unidade: a pessoa só mexe nas unidades a que tem acesso. */
@Injectable()
export class StoreAccessService {
  constructor(private readonly prisma: PrismaService) {}

  async assertAccess(staff: AuthenticatedStaff, storeId: string): Promise<void> {
    const store = await this.prisma.store.findUnique({
      where: { id: storeId },
      select: { id: true },
    });
    if (!store) throw new NotFoundException('Unidade não encontrada.');
    if (staff.role === StaffRole.OWNER) return;
    const access = await this.prisma.staffStoreAccess.findUnique({
      where: { staffUserId_storeId: { staffUserId: staff.id, storeId } },
    });
    if (!access) throw new ForbiddenException('Tu não tens acesso a esta unidade.');
  }
}
