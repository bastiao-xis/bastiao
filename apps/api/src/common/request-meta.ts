import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { Request } from 'express';
import type { RequestMeta as Meta } from '../auth/auth.types';

export const RequestMeta = createParamDecorator((_: unknown, ctx: ExecutionContext): Meta => {
  const req = ctx.switchToHttp().getRequest<Request>();
  return { ip: req.ip ?? null, userAgent: req.get('user-agent') ?? null };
});
