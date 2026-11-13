import type { FastifyRequest } from 'fastify';
import { ErrorCode, type RoleName } from '@salonbridge/types';
import { AppError } from '../lib/errors.js';

export interface AccessTokenPayload {
  sub: string;
  roles: string[];
  salonId: string | null;
  twoFactorVerified?: boolean;
}

declare module '@fastify/jwt' {
  interface FastifyJWT {
    payload: AccessTokenPayload;
    user: AccessTokenPayload;
  }
}

export async function requireAuth(request: FastifyRequest): Promise<void> {
  try {
    await request.jwtVerify();
  } catch {
    throw new AppError(401, ErrorCode.UNAUTHORIZED, 'Authentication required');
  }
}

export function requireRoles(...allowedRoles: RoleName[]) {
  return async (request: FastifyRequest): Promise<void> => {
    await requireAuth(request);
    const userRoles = request.user.roles ?? [];
    const hasRole = allowedRoles.some((r) => userRoles.includes(r));
    if (!hasRole) {
      throw new AppError(403, ErrorCode.FORBIDDEN, 'Insufficient role permissions');
    }
  };
}

export function requireSuperAdmin2FA() {
  return async (request: FastifyRequest): Promise<void> => {
    await requireAuth(request);
    if (!request.user.roles.includes('super_admin')) {
      throw new AppError(403, ErrorCode.FORBIDDEN, 'Super Admin access required');
    }
    if (!request.user.twoFactorVerified) {
      throw new AppError(403, ErrorCode.TWO_FACTOR_REQUIRED, '2FA verification required');
    }
  };
}

export function requireSalonMember() {
  return async (request: FastifyRequest): Promise<void> => {
    await requireAuth(request);
    if (!request.user.salonId) {
      throw new AppError(403, ErrorCode.FORBIDDEN, 'No active salon membership');
    }
  };
}

export function requireAdminIpAllowlist(allowlistCsv: string) {
  const allowed = allowlistCsv
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

  return async (request: FastifyRequest): Promise<void> => {
    if (allowed.length === 0) return;
    if (!allowed.includes(request.ip)) {
      throw new AppError(403, ErrorCode.FORBIDDEN, 'IP address not allow-listed for admin access');
    }
  };
}

