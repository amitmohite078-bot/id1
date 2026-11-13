import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';
import {
  AnalyticsQuerySchema,
  CreateWalkInBookingSchema,
  ReplyReviewSchema,
  RoleName,
  SalonBookingListQuerySchema,
  UpdateBookingStatusSchema,
} from '@salonbridge/types';
import { requireRoles, requireSalonMember } from '../../plugins/auth.js';
import type { SalonOpsService } from './salon-ops.service.js';

const BookingIdParam = z.object({ id: z.string().uuid() });
const ReviewIdParam = z.object({ reviewId: z.string().uuid() });

export function registerSalonOpsRoutes(app: FastifyInstance, opsService: SalonOpsService) {
  const server = app.withTypeProvider<ZodTypeProvider>();
  const salonGuard = [
    requireSalonMember(),
    requireRoles(
      RoleName.SALON_OWNER,
      RoleName.SALON_MANAGER,
      RoleName.SALON_RECEPTIONIST,
      RoleName.SALON_STYLIST,
    ),
  ];

  // 1. Booking Calendar & List
  server.get('/api/v1/salon/bookings', {
    preHandler: salonGuard,
    schema: {
      tags: ['Salon Operations'],
      summary: 'List bookings with status, date, and staff filters',
      querystring: SalonBookingListQuerySchema,
    },
    handler: async (request) => {
      const data = await opsService.listBookings(request.user.salonId!, request.query);
      return { data };
    },
  });

  server.get('/api/v1/salon/bookings/:id', {
    preHandler: salonGuard,
    schema: {
      tags: ['Salon Operations'],
      summary: 'Get single booking details with customer profile and booked items',
      params: BookingIdParam,
    },
    handler: async (request) => {
      const data = await opsService.getBooking(request.user.salonId!, request.params.id);
      return { data };
    },
  });

  server.patch('/api/v1/salon/bookings/:id/status', {
    preHandler: salonGuard,
    schema: {
      tags: ['Salon Operations'],
      summary: 'Update booking status (confirmed, in_progress, completed, cancelled, no_show)',
      params: BookingIdParam,
      body: UpdateBookingStatusSchema,
    },
    handler: async (request) => {
      const data = await opsService.updateBookingStatus(
        request.user.salonId!,
        request.params.id,
        request.body,
      );
      return { data };
    },
  });

  server.post('/api/v1/salon/bookings/walk-in', {
    preHandler: salonGuard,
    schema: {
      tags: ['Salon Operations'],
      summary: 'Create walk-in booking at front-desk',
      body: CreateWalkInBookingSchema,
    },
    handler: async (request, reply) => {
      const data = await opsService.createWalkInBooking(request.user.salonId!, request.body);
      return reply.status(201).send({ data });
    },
  });

  // 2. CRM-Lite
  server.get('/api/v1/salon/customers', {
    preHandler: salonGuard,
    schema: {
      tags: ['Salon Operations'],
      summary: 'List customer directory with visit counts and lifetime spend',
    },
    handler: async (request) => {
      const data = await opsService.listCustomers(request.user.salonId!);
      return { data };
    },
  });

  // 3. Analytics
  server.get('/api/v1/salon/analytics', {
    preHandler: salonGuard,
    schema: {
      tags: ['Salon Operations'],
      summary: 'Get revenue, booking counts, cancellation rate, and top services',
      querystring: AnalyticsQuerySchema,
    },
    handler: async (request) => {
      const data = await opsService.getAnalytics(request.user.salonId!, request.query);
      return { data };
    },
  });

  // 4. Reviews & Replies
  server.get('/api/v1/salon/reviews', {
    preHandler: salonGuard,
    schema: {
      tags: ['Salon Operations'],
      summary: 'List customer reviews for salon',
    },
    handler: async (request) => {
      const data = await opsService.listReviews(request.user.salonId!);
      return { data };
    },
  });

  server.post('/api/v1/salon/reviews/:reviewId/reply', {
    preHandler: salonGuard,
    schema: {
      tags: ['Salon Operations'],
      summary: 'Reply to customer review',
      params: ReviewIdParam,
      body: ReplyReviewSchema,
    },
    handler: async (request) => {
      const data = await opsService.replyReview(
        request.user.salonId!,
        request.params.reviewId,
        request.body.reply,
      );
      return { data };
    },
  });
}
