import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { scryptSync, timingSafeEqual } from 'node:crypto';
import { ApiError } from '../../common/api-error';
import type { UserClaims } from '../../common/auth';
import { ConfigService } from '../../infra/config.service';
import { PrismaService } from '../../infra/prisma.service';

const SALT = 'fah-demo-salt';

export function hashPassword(password: string): string {
  return scryptSync(password, SALT, 32).toString('hex');
}

export function verifyPassword(password: string, hash: string): boolean {
  const derived = Buffer.from(hashPassword(password));
  const known = Buffer.from(hash);
  return derived.length === known.length && timingSafeEqual(derived, known);
}

export type LoginResult = {
  token: string;
  user: { userId: string; displayName: string; role: string; isMinor: boolean };
  family: { familyId: string; name: string };
  role: string;
};

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {}

  private async issue(userId: string): Promise<LoginResult> {
    const user = await this.prisma.user.findUnique({ where: { userId }, include: { family: true } });
    if (!user) throw new ApiError('UNAUTHENTICATED');
    const claims: UserClaims = {
      sub: user.userId,
      type: 'user',
      familyId: user.familyId,
      role: user.role,
      isMinor: user.isMinor,
      displayName: user.displayName,
      loginIdentifier: user.loginIdentifier,
    };
    const token = this.jwt.sign(claims);
    return {
      token,
      user: { userId: user.userId, displayName: user.displayName, role: user.role, isMinor: user.isMinor },
      family: { familyId: user.family.familyId, name: user.family.name },
      role: user.role,
    };
  }

  async login(identifier: string, password: string): Promise<LoginResult> {
    const user = await this.prisma.user.findUnique({ where: { loginIdentifier: identifier } });
    if (!user || !verifyPassword(password, user.passwordHash)) throw new ApiError('UNAUTHENTICATED');
    return this.issue(user.userId);
  }

  async demoSwitch(memberKey: string, demoKey: string | undefined): Promise<LoginResult> {
    if (!this.config.demoMode) throw new ApiError('FORBIDDEN');
    if (demoKey !== this.config.demoSwitchKey) throw new ApiError('FORBIDDEN');
    const user = await this.prisma.user.findUnique({ where: { loginIdentifier: memberKey } });
    if (!user) throw new ApiError('NOT_FOUND');
    return this.issue(user.userId);
  }

  async me(userId: string) {
    const user = await this.prisma.user.findUnique({ where: { userId }, include: { family: true } });
    if (!user) throw new ApiError('NOT_FOUND');
    return {
      user: { userId: user.userId, displayName: user.displayName, role: user.role, isMinor: user.isMinor },
      family: { familyId: user.family.familyId, name: user.family.name },
      permissions: user.role === 'middle' ? ['share', 'manage_member', 'device'] : ['share'],
    };
  }
}