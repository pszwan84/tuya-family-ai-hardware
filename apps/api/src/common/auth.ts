import { CanActivate, type ExecutionContext, Injectable, createParamDecorator } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import type { Request } from 'express';
import { ApiError } from './api-error';

export type UserClaims = {
  sub: string;
  type: 'user';
  familyId: string;
  role: 'grandparent' | 'middle' | 'child';
  isMinor: boolean;
  displayName: string;
  loginIdentifier: string;
};

export type DeviceClaims = {
  sub: string;
  type: 'device';
  familyId: string;
  ownerId: string;
};

export type AnyClaims = UserClaims | DeviceClaims;

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(private readonly jwt: JwtService) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request & { claims?: AnyClaims }>();
    const header = request.headers.authorization;
    if (!header?.startsWith('Bearer ')) throw new ApiError('UNAUTHENTICATED');
    try {
      const claims = this.jwt.verify<AnyClaims>(header.slice(7));
      request.claims = claims;
      return true;
    } catch {
      throw new ApiError('UNAUTHENTICATED');
    }
  }
}

export const CurrentClaims = createParamDecorator((_data: unknown, context: ExecutionContext): AnyClaims => {
  const request = context.switchToHttp().getRequest<Request & { claims?: AnyClaims }>();
  if (!request.claims) throw new ApiError('UNAUTHENTICATED');
  return request.claims;
});

export function requireUser(claims: AnyClaims): UserClaims {
  if (claims.type !== 'user') throw new ApiError('FORBIDDEN');
  return claims;
}

export function requireDevice(claims: AnyClaims): DeviceClaims {
  if (claims.type !== 'device') throw new ApiError('FORBIDDEN');
  return claims;
}