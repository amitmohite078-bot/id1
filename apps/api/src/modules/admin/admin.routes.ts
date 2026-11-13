import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';
import {
  AdminSalonListQuerySchema,
  CreateCouponSchema,
  CreatePlanSchema,
  ModerateReviewSchema,
  PaginationQuerySchema,
  UpdateSalonStatusSchema,
  UpdateUserStatusSchema,
} from '@salonbridge/types';
import { requireAdminIpAllowlist, requireSuperAdmin2FA } from '../../plugins/auth.js';
import type { AdminService } from './admin.service.js';

const SalonIdParam = z.object({ id: z.string().uuid() });
const UserIdParam = z.object({ id: z.string().uuid() });
const ReviewIdParam = z.object({ reviewId: z.string().uuid() });

export function registerAdminRoutes(
  app: FastifyInstance,
  adminService: AdminService,
  adminIpAllowlist: string,
) {
  const server = app.withTypeProvider<ZodTypeProvider>();
  const adminGuard = [requireSuperAdmin2FA(), requireAdminIpAllowlist(adminIpAllowlist)];

  // 1. Platform Metrics
  server.get('/api/v1/admin/metrics', {
    preHandler: adminGuard,
    schema: {
      tags: ['Super Admin'],
      summary: 'Platform-wide GMV, salon approvals, AI import stats, and top cities',
    },
    handler: async () => {
      const data = await adminService.getPlatformMetrics();
      return { data };
    },
  });

  // 2. Salon Approvals & Status
  server.get('/api/v1/admin/salons', {
    preHandler: adminGuard,
    schema: {
      tags: ['Super Admin'],
      summary: 'List salons with filter by pending/approved/suspended status',
      querystring: AdminSalonListQuerySchema,
    },
    handler: async (request) => {
      const data = await adminService.listSalons(request.query);
      return { data };
    },
  });

  server.patch('/api/v1/admin/salons/:id/status', {
    preHandler: adminGuard,
    schema: {
      tags: ['Super Admin'],
      summary: 'Approve, reject, or suspend a salon listing and set custom commission rate',
      params: SalonIdParam,
      body: UpdateSalonStatusSchema,
    },
    handler: async (request) => {
      const data = await adminService.updateSalonStatus(
        request.params.id,
        request.user.sub,
        request.body,
        request.ip,
      );
      return { data };
    },
  });

  // 3. User Management
  server.get('/api/v1/admin/users', {
    preHandler: adminGuard,
    schema: {
      tags: ['Super Admin'],
      summary: 'List platform users',
      querystring: PaginationQuerySchema,
    },
    handler: async (request) => {
      const data = await adminService.listUsers(request.query.page, request.query.limit);
      return { data };
    },
  });

  server.patch('/api/v1/admin/users/:id/status', {
    preHandler: adminGuard,
    schema: {
      tags: ['Super Admin'],
      summary: 'Block or unblock a user account',
      params: UserIdParam,
      body: UpdateUserStatusSchema,
    },
    handler: async (request) => {
      const data = await adminService.updateUserStatus(
        request.params.id,
        request.user.sub,
        request.body,
        request.ip,
      );
      return { data };
    },
  });

  // 4. Monetization (Plans & Coupons)
  server.get('/api/v1/admin/plans', {
    preHandler: adminGuard,
    schema: { tags: ['Super Admin'], summary: 'List subscription plans' },
    handler: async () => {
      const data = await adminService.listPlans();
      return { data };
    },
  });

  server.post('/api/v1/admin/plans', {
    preHandler: adminGuard,
    schema: {
      tags: ['Super Admin'],
      summary: 'Create a subscription plan',
      body: CreatePlanSchema,
    },
    handler: async (request, reply) => {
      const data = await adminService.createPlan(request.body, request.user.sub, request.ip);
      return reply.status(201).send({ data });
    },
  });

  server.get('/api/v1/admin/coupons', {
    preHandler: adminGuard,
    schema: { tags: ['Super Admin'], summary: 'List platform coupons' },
    handler: async () => {
      const data = await adminService.listCoupons();
      return { data };
    },
  });

  server.post('/api/v1/admin/coupons', {
    preHandler: adminGuard,
    schema: {
      tags: ['Super Admin'],
      summary: 'Create a promo code/coupon',
      body: CreateCouponSchema,
    },
    handler: async (request, reply) => {
      const data = await adminService.createCoupon(request.body, request.user.sub, request.ip);
      return reply.status(201).send({ data });
    },
  });

  // 5. Moderation & Audit Logs
  server.get('/api/v1/admin/reviews/reported', {
    preHandler: adminGuard,
    schema: { tags: ['Super Admin'], summary: 'List reported reviews queue' },
    handler: async () => {
      const data = await adminService.listReportedReviews();
      return { data };
    },
  });

  server.patch('/api/v1/admin/reviews/:reviewId', {
    preHandler: adminGuard,
    schema: {
      tags: ['Super Admin'],
      summary: 'Hide or restore a reported review',
      params: ReviewIdParam,
      body: ModerateReviewSchema,
    },
    handler: async (request) => {
      const data = await adminService.moderateReview(
        request.params.reviewId,
        request.user.sub,
        request.body,
        request.ip,
      );
      return { data };
    },
  });

  server.get('/api/v1/admin/audit-logs', {
    preHandler: adminGuard,
    schema: { tags: ['Super Admin'], summary: 'View immutable platform audit logs' },
    handler: async () => {
      const data = await adminService.listAuditLogs(50);
      return { data };
    },
  });
}

