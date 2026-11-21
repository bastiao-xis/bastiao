import { createParamDecorator, ExecutionContext, SetMetadata } from '@nestjs/common';
import type { StaffRole } from '@prisma/client';
import type { AuthenticatedStaff } from './auth.types';

export const IS_PUBLIC = 'auth:isPublic';
export const ROLES = 'auth:roles';

/** Rota aberta, sem login da equipe. Toda rota é protegida por padrão. */
export const Public = () => SetMetadata(IS_PUBLIC, true);

/** Restringe a rota a estes perfis. */
export const Roles = (...roles: StaffRole[]) => SetMetadata(ROLES, roles);

export const CurrentStaff = createParamDecorator(
  (_: unknown, ctx: ExecutionContext): AuthenticatedStaff =>
    ctx.switchToHttp().getRequest<{ staff: AuthenticatedStaff }>().staff,
);
