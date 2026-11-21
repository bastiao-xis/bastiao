import { createHash, randomBytes } from 'node:crypto';
import { Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ActorType, StaffUser } from '@prisma/client';
import { AuditService } from '../audit/audit.service';
import { ENV, type Env } from '../config/env';
import { FieldCrypto } from '../crypto/field-crypto';
import { PrismaService } from '../prisma/prisma.service';
import type {
  AccessTokenPayload,
  AuthenticatedStaff,
  LoginResult,
  MfaTokenPayload,
  RequestMeta,
  StaffProfile,
} from './auth.types';
import { dummyVerify, verifyPassword } from './password';
import { LOCKOUT_MINUTES, MAX_FAILED_LOGINS, MFA_TOKEN_TTL_SECONDS, requiresMfa } from './policy';
import { generateTotpSecret, totpUri, verifyTotp } from './totp';

const INVALID_CREDENTIALS = 'E-mail ou senha inválidos.';
const INVALID_CODE = 'Código inválido.';
const SESSION_EXPIRED = 'Sessão expirada. Entre de novo.';

function sha256(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly crypto: FieldCrypto,
    private readonly audit: AuditService,
    @Inject(ENV) private readonly env: Env,
  ) {}

  async login(email: string, password: string, meta: RequestMeta): Promise<LoginResult> {
    const user = await this.prisma.staffUser.findUnique({
      where: { email: email.trim().toLowerCase() },
    });
    if (!user || !user.active) {
      await dummyVerify(password);
      throw new UnauthorizedException(INVALID_CREDENTIALS);
    }
    this.assertNotLocked(user);

    if (!(await verifyPassword(user.passwordHash, password))) {
      await this.registerFailure(user, 'auth.login_failed', meta);
      throw new UnauthorizedException(INVALID_CREDENTIALS);
    }

    if (requiresMfa(user.role)) {
      const stage = user.totpEnabledAt ? 'verify' : 'enroll';
      const mfaToken = await this.signMfaToken(user.id, stage);
      return stage === 'verify'
        ? { status: 'MFA_REQUIRED', mfaToken }
        : { status: 'MFA_ENROLLMENT_REQUIRED', mfaToken };
    }

    return this.startSession(user, meta);
  }

  async verifyMfa(mfaToken: string, code: string, meta: RequestMeta): Promise<LoginResult> {
    const user = await this.userFromMfaToken(mfaToken, 'verify');
    this.assertNotLocked(user);
    if (!user.totpSecretEnc || !user.totpEnabledAt)
      throw new UnauthorizedException(SESSION_EXPIRED);
    if (!verifyTotp(this.crypto.decrypt(user.totpSecretEnc), code)) {
      await this.registerFailure(user, 'auth.mfa_failed', meta);
      throw new UnauthorizedException(INVALID_CODE);
    }
    return this.startSession(user, meta);
  }

  async beginMfaEnrollment(mfaToken: string): Promise<{ secret: string; otpauthUrl: string }> {
    const user = await this.userFromMfaToken(mfaToken, 'enroll');
    const secret = generateTotpSecret();
    await this.prisma.staffUser.update({
      where: { id: user.id },
      data: { totpSecretEnc: this.crypto.encrypt(secret), totpEnabledAt: null },
    });
    return { secret, otpauthUrl: totpUri(user.email, secret) };
  }

  async confirmMfaEnrollment(
    mfaToken: string,
    code: string,
    meta: RequestMeta,
  ): Promise<LoginResult> {
    const user = await this.userFromMfaToken(mfaToken, 'enroll');
    this.assertNotLocked(user);
    if (!user.totpSecretEnc) throw new UnauthorizedException('Comece o cadastro do 2FA de novo.');
    if (!verifyTotp(this.crypto.decrypt(user.totpSecretEnc), code)) {
      await this.registerFailure(user, 'auth.mfa_failed', meta);
      throw new UnauthorizedException(INVALID_CODE);
    }
    const enabled = await this.prisma.staffUser.update({
      where: { id: user.id },
      data: { totpEnabledAt: new Date() },
    });
    await this.audit.record({
      actorType: ActorType.STAFF,
      actorId: user.id,
      action: 'auth.mfa_enrolled',
      entityType: 'staff_user',
      entityId: user.id,
      ip: meta.ip,
    });
    return this.startSession(enabled, meta);
  }

  async refresh(refreshToken: string, meta: RequestMeta): Promise<LoginResult> {
    const session = await this.prisma.staffSession.findUnique({
      where: { refreshTokenHash: sha256(refreshToken) },
      include: { staffUser: true },
    });
    if (!session || !this.isSessionAlive(session) || !session.staffUser.active) {
      throw new UnauthorizedException(SESSION_EXPIRED);
    }
    const newRefresh = randomBytes(32).toString('base64url');
    const now = new Date();
    // Rotação condicional: se duas chamadas usarem o mesmo refresh, só uma vence.
    const rotated = await this.prisma.staffSession.updateMany({
      where: { id: session.id, refreshTokenHash: session.refreshTokenHash, revokedAt: null },
      data: {
        refreshTokenHash: sha256(newRefresh),
        lastActivityAt: now,
        ip: meta.ip ?? session.ip,
      },
    });
    if (rotated.count !== 1) throw new UnauthorizedException(SESSION_EXPIRED);
    return this.tokensFor(session.staffUser, session.id, newRefresh);
  }

  async logout(staff: AuthenticatedStaff, meta: RequestMeta): Promise<void> {
    await this.prisma.staffSession.updateMany({
      where: { id: staff.sessionId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    await this.audit.record({
      actorType: ActorType.STAFF,
      actorId: staff.id,
      action: 'auth.logout',
      entityType: 'staff_session',
      entityId: staff.sessionId,
      ip: meta.ip,
    });
  }

  /** Usado pelo guard em toda requisição: valida o token, a sessão e renova a inatividade. */
  async authenticateAccessToken(token: string): Promise<AuthenticatedStaff> {
    let payload: AccessTokenPayload;
    try {
      payload = await this.jwt.verifyAsync<AccessTokenPayload>(token, {
        secret: this.env.JWT_ACCESS_SECRET,
      });
    } catch {
      throw new UnauthorizedException(SESSION_EXPIRED);
    }
    if (payload.typ !== 'access') throw new UnauthorizedException(SESSION_EXPIRED);

    const session = await this.prisma.staffSession.findUnique({
      where: { id: payload.sid },
      include: { staffUser: { select: { active: true, role: true } } },
    });
    if (
      !session ||
      session.staffUserId !== payload.sub ||
      !this.isSessionAlive(session) ||
      !session.staffUser.active
    ) {
      throw new UnauthorizedException(SESSION_EXPIRED);
    }
    await this.prisma.staffSession.update({
      where: { id: session.id },
      data: { lastActivityAt: new Date() },
    });
    // O perfil vem do banco, não do token: rebaixar alguém vale na hora.
    return { id: payload.sub, sessionId: session.id, role: session.staffUser.role };
  }

  async profile(userId: string): Promise<StaffProfile> {
    const user = await this.prisma.staffUser.findUniqueOrThrow({ where: { id: userId } });
    return this.toProfile(user);
  }

  // ---------------------------------------------------------------------------

  private isSessionAlive(session: {
    revokedAt: Date | null;
    expiresAt: Date;
    lastActivityAt: Date;
  }): boolean {
    const now = Date.now();
    const idleLimit = session.lastActivityAt.getTime() + this.env.SESSION_IDLE_MINUTES * 60_000;
    return !session.revokedAt && session.expiresAt.getTime() > now && idleLimit > now;
  }

  private assertNotLocked(user: StaffUser): void {
    if (user.lockedUntil && user.lockedUntil.getTime() > Date.now()) {
      throw new UnauthorizedException('Muitas tentativas. Tente de novo em alguns minutos.');
    }
  }

  private async registerFailure(user: StaffUser, action: string, meta: RequestMeta): Promise<void> {
    const failed = user.failedLoginCount + 1;
    const lock = failed >= MAX_FAILED_LOGINS;
    await this.prisma.staffUser.update({
      where: { id: user.id },
      data: {
        failedLoginCount: lock ? 0 : failed,
        lockedUntil: lock ? new Date(Date.now() + LOCKOUT_MINUTES * 60_000) : user.lockedUntil,
      },
    });
    await this.audit.record({
      actorType: ActorType.STAFF,
      actorId: user.id,
      action: lock ? 'auth.locked' : action,
      entityType: 'staff_user',
      entityId: user.id,
      ip: meta.ip,
    });
  }

  private async startSession(user: StaffUser, meta: RequestMeta): Promise<LoginResult> {
    const refreshToken = randomBytes(32).toString('base64url');
    const session = await this.prisma.$transaction(async (tx) => {
      await tx.staffUser.update({
        where: { id: user.id },
        data: { failedLoginCount: 0, lockedUntil: null },
      });
      const created = await tx.staffSession.create({
        data: {
          staffUserId: user.id,
          refreshTokenHash: sha256(refreshToken),
          expiresAt: new Date(Date.now() + this.env.SESSION_ABSOLUTE_HOURS * 3_600_000),
          ip: meta.ip ?? null,
          userAgent: meta.userAgent?.slice(0, 300) ?? null,
        },
      });
      await this.audit.record(
        {
          actorType: ActorType.STAFF,
          actorId: user.id,
          action: 'auth.login',
          entityType: 'staff_session',
          entityId: created.id,
          ip: meta.ip,
        },
        tx,
      );
      return created;
    });
    return this.tokensFor(user, session.id, refreshToken);
  }

  private async tokensFor(
    user: StaffUser,
    sessionId: string,
    refreshToken: string,
  ): Promise<LoginResult> {
    const payload: AccessTokenPayload = {
      sub: user.id,
      sid: sessionId,
      role: user.role,
      typ: 'access',
    };
    const accessToken = await this.jwt.signAsync(payload, {
      secret: this.env.JWT_ACCESS_SECRET,
      expiresIn: this.env.ACCESS_TOKEN_TTL_SECONDS,
    });
    return {
      status: 'AUTHENTICATED',
      accessToken,
      refreshToken,
      expiresIn: this.env.ACCESS_TOKEN_TTL_SECONDS,
      user: this.toProfile(user),
    };
  }

  private signMfaToken(userId: string, stage: MfaTokenPayload['stage']): Promise<string> {
    const payload: MfaTokenPayload = { sub: userId, typ: 'mfa', stage };
    return this.jwt.signAsync(payload, {
      secret: this.env.JWT_MFA_SECRET,
      expiresIn: MFA_TOKEN_TTL_SECONDS,
    });
  }

  private async userFromMfaToken(
    token: string,
    stage: MfaTokenPayload['stage'],
  ): Promise<StaffUser> {
    let payload: MfaTokenPayload;
    try {
      payload = await this.jwt.verifyAsync<MfaTokenPayload>(token, {
        secret: this.env.JWT_MFA_SECRET,
      });
    } catch {
      throw new UnauthorizedException(SESSION_EXPIRED);
    }
    if (payload.typ !== 'mfa' || payload.stage !== stage)
      throw new UnauthorizedException(SESSION_EXPIRED);
    const user = await this.prisma.staffUser.findUnique({ where: { id: payload.sub } });
    if (!user || !user.active) throw new UnauthorizedException(SESSION_EXPIRED);
    // Quem já tem 2FA ativo não pode recadastrar só com a senha.
    if (stage === 'enroll' && user.totpEnabledAt) throw new UnauthorizedException(SESSION_EXPIRED);
    return user;
  }

  private toProfile(user: StaffUser): StaffProfile {
    return {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      mfaEnabled: user.totpEnabledAt !== null,
    };
  }
}
