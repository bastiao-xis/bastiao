import { Body, Controller, Get, HttpCode, Post } from '@nestjs/common';
import { z } from 'zod';
import { RequestMeta } from '../common/request-meta';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { AuthService } from './auth.service';
import type { AuthenticatedStaff, RequestMeta as Meta } from './auth.types';
import { CurrentStaff, Public } from './decorators';

const loginSchema = z.object({ email: z.string().email(), password: z.string().min(1).max(200) });
const mfaTokenSchema = z.object({ mfaToken: z.string().min(1) });
const mfaCodeSchema = mfaTokenSchema.extend({ code: z.string().regex(/^\d{6}$/, '6 dígitos') });
const refreshSchema = z.object({ refreshToken: z.string().min(1) });

@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Public()
  @Post('login')
  @HttpCode(200)
  login(
    @Body(new ZodValidationPipe(loginSchema)) body: z.infer<typeof loginSchema>,
    @RequestMeta() meta: Meta,
  ) {
    return this.auth.login(body.email, body.password, meta);
  }

  @Public()
  @Post('mfa/verify')
  @HttpCode(200)
  verifyMfa(
    @Body(new ZodValidationPipe(mfaCodeSchema)) body: z.infer<typeof mfaCodeSchema>,
    @RequestMeta() meta: Meta,
  ) {
    return this.auth.verifyMfa(body.mfaToken, body.code, meta);
  }

  @Public()
  @Post('mfa/enroll')
  @HttpCode(200)
  beginEnrollment(
    @Body(new ZodValidationPipe(mfaTokenSchema)) body: z.infer<typeof mfaTokenSchema>,
  ) {
    return this.auth.beginMfaEnrollment(body.mfaToken);
  }

  @Public()
  @Post('mfa/enroll/confirm')
  @HttpCode(200)
  confirmEnrollment(
    @Body(new ZodValidationPipe(mfaCodeSchema)) body: z.infer<typeof mfaCodeSchema>,
    @RequestMeta() meta: Meta,
  ) {
    return this.auth.confirmMfaEnrollment(body.mfaToken, body.code, meta);
  }

  @Public()
  @Post('refresh')
  @HttpCode(200)
  refresh(
    @Body(new ZodValidationPipe(refreshSchema)) body: z.infer<typeof refreshSchema>,
    @RequestMeta() meta: Meta,
  ) {
    return this.auth.refresh(body.refreshToken, meta);
  }

  @Post('logout')
  @HttpCode(204)
  async logout(
    @CurrentStaff() staff: AuthenticatedStaff,
    @RequestMeta() meta: Meta,
  ): Promise<void> {
    await this.auth.logout(staff, meta);
  }

  @Get('me')
  me(@CurrentStaff() staff: AuthenticatedStaff) {
    return this.auth.profile(staff.id);
  }
}
