import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { StaffRole } from '@prisma/client';
import type { Request } from 'express';
import { AuthService } from './auth.service';
import type { AuthenticatedStaff } from './auth.types';
import { IS_PUBLIC, ROLES } from './decorators';

/** Guard global: exige login da equipe em toda rota que não for @Public(). */
@Injectable()
export class StaffAuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly auth: AuthService,
  ) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const targets = [ctx.getHandler(), ctx.getClass()];
    if (this.reflector.getAllAndOverride<boolean>(IS_PUBLIC, targets)) return true;

    const req = ctx.switchToHttp().getRequest<Request & { staff?: AuthenticatedStaff }>();
    const header = req.get('authorization') ?? '';
    const [scheme, token] = header.split(' ');
    if (scheme !== 'Bearer' || !token) throw new UnauthorizedException('Entre para continuar.');

    req.staff = await this.auth.authenticateAccessToken(token);

    const roles = this.reflector.getAllAndOverride<StaffRole[] | undefined>(ROLES, targets);
    if (roles && !roles.includes(req.staff.role)) {
      throw new ForbiddenException('Teu perfil não tem acesso a isso.');
    }
    return true;
  }
}
