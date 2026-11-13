import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';
import {
  CancelBookingSchema,
  CompareSalonsQuerySchema,
  CreateBookingSchema,
  CreateReviewSchema,
  CreateSlotHoldSchema,
  RoleName,
  SalonSearchQuerySchema,
} from '@salonbridge/types';
import { requireAuth, requireRoles } from '../../plugins/auth.js';
import type { CustomerService } from './customer.service.js';

const SlugParam = z.object({ slug: z.string().min(1) });
const BookingIdParam = z.object({ id: z.string().uuid() });
const SalonIdParam = z.object({ salonId: z.string().uuid() });

export function registerCustomerRoutes(app: FastifyInstance, customerService: CustomerService) {
  const server = app.withTypeProvider<ZodTypeProvider>();

  // 1. Discovery (Public)
  server.get('/api/v1/public/salons/search', {
    config: { rateLimit: { max: 100, timeWindow: '1 minute' } },
    schema: {
      tags: ['Customer Discovery'],
      summary: 'Search nearby salons by PostGIS coordinates, filters, and sorting',
      querystring: SalonSearchQuerySchema,
    },
    handler: async (request) => {
      const data = await customerService.searchSalons(request.query);
      return { data };
    },
  });

  server.get('/api/v1/public/salons/compare', {
    schema: {
      tags: ['Customer Discovery'],
      summary: 'Side-by-side comparison for 2-4 salons',
      querystring: CompareSalonsQuerySchema,
    },
    handler: async (request) => {
      const data = await customerService.compareSalons(request.query.ids);
      return { data };
    },
  });

  server.get('/api/v1/public/salons/:slug', {
    schema: {
      tags: ['Customer Discovery'],
      summary: 'Get salon detail page by slug with photos, hours, services, staff, and reviews',
      params: SlugParam,
    },
    handler: async (request) => {
      const data = await customerService.getSalonDetail(request.params.slug);
      return { data };
    },
  });

  // 2. Customer Booking Flow (Requires Customer Role)
  server.post('/api/v1/customer/holds', {
    preHandler: [requireRoles(RoleName.CUSTOMER)],
    schema: {
      tags: ['Customer Bookings'],
      summary: 'Hold a slot for 7 minutes during checkout to prevent double-booking',
      body: CreateSlotHoldSchema,
    },
    handler: async (request, reply) => {
      const data = await customerService.createSlotHold(request.user.sub, request.body);
      return reply.status(201).send({ data });
    },
  });

  server.post('/api/v1/customer/bookings', {
    preHandler: [requireRoles(RoleName.CUSTOMER)],
    schema: {
      tags: ['Customer Bookings'],
      summary: 'Confirm a booking and initiate Razorpay Route split payment or Pay at Salon',
      body: CreateBookingSchema,
    },
    handler: async (request, reply) => {
      const data = await customerService.createBooking(request.user.sub, request.body);
      return reply.status(201).send({ data });
    },
  });

  server.get('/api/v1/customer/bookings', {
    preHandler: [requireRoles(RoleName.CUSTOMER)],
    schema: {
      tags: ['Customer Bookings'],
      summary: 'List my past and upcoming bookings',
    },
    handler: async (request) => {
      const data = await customerService.listBookings(request.user.sub);
      return { data };
    },
  });

  server.post('/api/v1/customer/bookings/:id/cancel', {
    preHandler: [requireRoles(RoleName.CUSTOMER)],
    schema: {
      tags: ['Customer Bookings'],
      summary: 'Cancel booking with platform-enforced refund policy calculation',
      params: BookingIdParam,
      body: CancelBookingSchema,
    },
    handler: async (request) => {
      const data = await customerService.cancelBooking(
        request.user.sub,
        request.params.id,
        request.body,
      );
      return { data };
    },
  });

  server.post('/api/v1/customer/bookings/:id/reviews', {
    preHandler: [requireRoles(RoleName.CUSTOMER)],
    schema: {
      tags: ['Customer Bookings'],
      summary: 'Review and rate a completed booking',
      params: BookingIdParam,
      body: CreateReviewSchema,
    },
    handler: async (request, reply) => {
      const data = await customerService.createReview(
        request.user.sub,
        request.params.id,
        request.body,
      );
      return reply.status(201).send({ data });
    },
  });

  server.post('/api/v1/customer/favorites/:salonId', {
    preHandler: [requireRoles(RoleName.CUSTOMER)],
    schema: {
      tags: ['Customer Discovery'],
      summary: 'Toggle favorite for a salon',
      params: SalonIdParam,
    },
    handler: async (request) => {
      const data = await customerService.toggleFavorite(request.user.sub, request.params.salonId);
      return { data };
    },
  });
}

