import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';
import {
  RoleName,
  SendOtpRequestSchema,
  VerifyOtpRequestSchema,
} from '@salonbridge/types';
import { requireAuth, requireRoles } from '../../plugins/auth.js';
import type { AuthService } from './auth.service.js';

const ACCESS_COOKIE = 'sb_access';
const REFRESH_COOKIE = 'sb_refresh';

export function registerAuthRoutes(app: FastifyInstance, authService: AuthService) {
  const server = app.withTypeProvider<ZodTypeProvider>();
  const isProd = process.env.NODE_ENV === 'production';

  const setAuthCookies = (
    reply: { setCookie: (name: string, val: string, opts: object) => unknown },
    accessToken: string,
    refreshToken: string,
  ) => {
    reply.setCookie(ACCESS_COOKIE, accessToken, {
      httpOnly: true,
      secure: isProd,
      sameSite: 'lax',
      path: '/',
      maxAge: 15 * 60,
    });
    reply.setCookie(REFRESH_COOKIE, refreshToken, {
      httpOnly: true,
      secure: isProd,
      sameSite: 'lax',
      path: '/api/v1/auth',
      maxAge: 30 * 24 * 60 * 60,
    });
  };

  server.post('/api/v1/auth/otp/send', {
    config: { rateLimit: { max: 5, timeWindow: '1 minute' } },
    schema: {
      tags: ['Auth'],
      summary: 'Send OTP via WhatsApp or SMS',
      body: SendOtpRequestSchema,
    },
    handler: async (request) => {
      const result = await authService.sendOtp(request.body);
      return { data: result };
    },
  });

  server.post('/api/v1/auth/otp/verify', {
    config: { rateLimit: { max: 10, timeWindow: '1 minute' } },
    schema: {
      tags: ['Auth'],
      summary: 'Verify OTP and issue httpOnly JWT session cookies',
      body: VerifyOtpRequestSchema,
    },
    handler: async (request, reply) => {
      const result = await authService.verifyOtp(request.body, {
        userAgent: request.headers['user-agent'],
        ipAddress: request.ip,
      });

      if (result.requiresTwoFactor && 'challengeToken' in result) {
        return {
          data: {
            requiresTwoFactor: true,
            challengeToken: result.challengeToken,
            user: result.user,
          },
        };
      }

      if ('accessToken' in result && 'refreshToken' in result) {
        setAuthCookies(reply, result.accessToken, result.refreshToken);
        return { data: { requiresTwoFactor: false, user: result.user } };
      }

      return { data: result };
    },
  });

  server.post('/api/v1/auth/admin/2fa/setup', {
    preHandler: [requireRoles(RoleName.SUPER_ADMIN)],
    schema: {
      tags: ['Auth'],
      summary: 'Generate TOTP 2FA secret for Super Admin',
    },
    handler: async (request) => {
      const data = await authService.setupAdminTotp(request.user.sub);
      return { data };
    },
  });

  server.post('/api/v1/auth/admin/2fa/verify', {
    preHandler: [requireRoles(RoleName.SUPER_ADMIN)],
    schema: {
      tags: ['Auth'],
      summary: 'Verify TOTP 2FA code for Super Admin session',
      body: z.object({ code: z.string().regex(/^\d{6}$/) }),
    },
    handler: async (request, reply) => {
      const result = await authService.verifyAdminTotp(request.user.sub, request.body.code, {
        userAgent: request.headers['user-agent'],
        ipAddress: request.ip,
      });
      setAuthCookies(reply, result.accessToken, result.refreshToken);
      return { data: { user: result.user } };
    },
  });

  server.post('/api/v1/auth/refresh', {
    schema: {
      tags: ['Auth'],
      summary: 'Rotate refresh token and issue new access token',
    },
    handler: async (request, reply) => {
      const rawRefresh = request.cookies[REFRESH_COOKIE] ?? '';
      const result = await authService.refreshSession(rawRefresh, {
        userAgent: request.headers['user-agent'],
        ipAddress: request.ip,
      });
      setAuthCookies(reply, result.accessToken, result.refreshToken);
      return { data: { user: result.user } };
    },
  });

  server.post('/api/v1/auth/logout', {
    schema: {
      tags: ['Auth'],
      summary: 'Revoke refresh session and clear auth cookies',
    },
    handler: async (request, reply) => {
      await authService.logout(request.cookies[REFRESH_COOKIE]);
      reply.clearCookie(ACCESS_COOKIE, { path: '/' });
      reply.clearCookie(REFRESH_COOKIE, { path: '/api/v1/auth' });
      return { data: { loggedOut: true } };
    },
  });

  server.get('/api/v1/auth/me', {
    preHandler: [requireAuth],
    schema: {
      tags: ['Auth'],
      summary: 'Get authenticated user profile',
    },
    handler: async (request) => {
      const user = await authService.getMe(request.user.sub);
      return { data: { user } };
    },
  });
}

