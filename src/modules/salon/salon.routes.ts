import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';
import {
  AvailabilityQuerySchema,
  BulkPriceAdjustSchema,
  CreateCategorySchema,
  CreateServiceSchema,
  CreateStaffLeaveSchema,
  CreateStaffSchema,
  OnboardSalonSchema,
  RoleName,
  SalonHourInputSchema,
  UpdateSalonProfileSchema,
  UpdateServiceSchema,
  UpdateStaffSchema,
  UpsertStaffScheduleSchema,
} from '@salonbridge/types';
import { requireRoles, requireSalonMember } from '../../plugins/auth.js';
import type { SalonService } from './salon.service.js';

const UuidParam = z.object({ id: z.string().uuid() });
const StaffLeaveParams = z.object({ id: z.string().uuid(), leaveId: z.string().uuid() });

export function registerSalonRoutes(app: FastifyInstance, salonService: SalonService) {
  const server = app.withTypeProvider<ZodTypeProvider>();
  const ownerOrManager = [
    requireSalonMember(),
    requireRoles(RoleName.SALON_OWNER, RoleName.SALON_MANAGER),
  ];

  // Onboarding (owner has no salonId yet)
  server.post('/api/v1/salon/onboarding', {
    preHandler: [requireRoles(RoleName.SALON_OWNER)],
    schema: {
      tags: ['Salon Dashboard'],
      summary: 'Onboard a new salon (status starts as pending)',
      body: OnboardSalonSchema,
    },
    handler: async (request, reply) => {
      const salon = await salonService.onboardSalon(request.user.sub, request.body);
      return reply.status(201).send({ data: salon });
    },
  });

  server.get('/api/v1/salon/me', {
    preHandler: [requireSalonMember()],
    schema: {
      tags: ['Salon Dashboard'],
      summary: 'Get authenticated salon profile and hours',
    },
    handler: async (request) => {
      const salon = await salonService.getMySalon(request.user.salonId!);
      return { data: salon };
    },
  });

  server.get('/api/v1/salon/qr', {
    preHandler: [requireSalonMember()],
    schema: {
      tags: ['Salon Dashboard'],
      summary: 'Get salon customer booking QR code and marketing URL',
    },
    handler: async (request) => {
      const qr = await salonService.getSalonQr(request.user.salonId!);
      return { data: qr };
    },
  });

  server.get('/api/v1/public/salons/:slug/qr', {
    schema: {
      tags: ['Customer Discovery'],
      summary: 'Get salon public QR code and direct booking URL by slug',
      params: z.object({ slug: z.string().min(1) }),
    },
    handler: async (request) => {
      const qr = await salonService.getPublicSalonQr(request.params.slug);
      return { data: qr };
    },
  });

  server.patch('/api/v1/salon/profile', {
    preHandler: ownerOrManager,
    schema: {
      tags: ['Salon Dashboard'],
      summary: 'Update salon profile and availability settings',
      body: UpdateSalonProfileSchema,
    },
    handler: async (request) => {
      const salon = await salonService.updateProfile(request.user.salonId!, request.body);
      return { data: salon };
    },
  });

  server.put('/api/v1/salon/hours', {
    preHandler: ownerOrManager,
    schema: {
      tags: ['Salon Dashboard'],
      summary: 'Replace weekly salon operating hours',
      body: z.object({ hours: z.array(SalonHourInputSchema).length(7) }),
    },
    handler: async (request) => {
      const hours = await salonService.updateHours(request.user.salonId!, request.body.hours);
      return { data: hours };
    },
  });

  // Staff
  server.get('/api/v1/salon/staff', {
    preHandler: [requireSalonMember()],
    schema: { tags: ['Salon Staff'], summary: 'List salon staff and their skills' },
    handler: async (request) => {
      const list = await salonService.listStaff(request.user.salonId!);
      return { data: list };
    },
  });

  server.post('/api/v1/salon/staff', {
    preHandler: ownerOrManager,
    schema: {
      tags: ['Salon Staff'],
      summary: 'Add a staff member with default schedule and skills',
      body: CreateStaffSchema,
    },
    handler: async (request, reply) => {
      const member = await salonService.createStaff(request.user.salonId!, request.body);
      return reply.status(201).send({ data: member });
    },
  });

  server.patch('/api/v1/salon/staff/:id', {
    preHandler: ownerOrManager,
    schema: {
      tags: ['Salon Staff'],
      summary: 'Update staff member profile or skills',
      params: UuidParam,
      body: UpdateStaffSchema,
    },
    handler: async (request) => {
      const updated = await salonService.updateStaff(
        request.user.salonId!,
        request.params.id,
        request.body,
      );
      return { data: updated };
    },
  });

  server.put('/api/v1/salon/staff/:id/schedule', {
    preHandler: ownerOrManager,
    schema: {
      tags: ['Salon Staff'],
      summary: 'Upsert staff weekly working hours and breaks',
      params: UuidParam,
      body: UpsertStaffScheduleSchema,
    },
    handler: async (request) => {
      const schedule = await salonService.upsertStaffSchedule(
        request.user.salonId!,
        request.params.id,
        request.body.days,
      );
      return { data: schedule };
    },
  });

  server.post('/api/v1/salon/staff/:id/leaves', {
    preHandler: ownerOrManager,
    schema: {
      tags: ['Salon Staff'],
      summary: 'Add full-day or partial leave for staff',
      params: UuidParam,
      body: CreateStaffLeaveSchema,
    },
    handler: async (request, reply) => {
      const leave = await salonService.createStaffLeave(
        request.user.salonId!,
        request.params.id,
        request.body,
      );
      return reply.status(201).send({ data: leave });
    },
  });

  server.delete('/api/v1/salon/staff/:id/leaves/:leaveId', {
    preHandler: ownerOrManager,
    schema: {
      tags: ['Salon Staff'],
      summary: 'Delete a staff leave entry',
      params: StaffLeaveParams,
    },
    handler: async (request) => {
      const deleted = await salonService.deleteStaffLeave(
        request.user.salonId!,
        request.params.id,
        request.params.leaveId,
      );
      return { data: deleted };
    },
  });

  // Categories & Services
  server.get('/api/v1/salon/categories', {
    preHandler: [requireSalonMember()],
    schema: { tags: ['Salon Catalog'], summary: 'List salon service categories' },
    handler: async (request) => {
      const cats = await salonService.listCategories(request.user.salonId!);
      return { data: cats };
    },
  });

  server.post('/api/v1/salon/categories', {
    preHandler: ownerOrManager,
    schema: {
      tags: ['Salon Catalog'],
      summary: 'Create a service category',
      body: CreateCategorySchema,
    },
    handler: async (request, reply) => {
      const cat = await salonService.createCategory(request.user.salonId!, request.body);
      return reply.status(201).send({ data: cat });
    },
  });

  server.get('/api/v1/salon/services', {
    preHandler: [requireSalonMember()],
    schema: { tags: ['Salon Catalog'], summary: 'List salon services' },
    handler: async (request) => {
      const list = await salonService.listServices(request.user.salonId!);
      return { data: list };
    },
  });

  server.post('/api/v1/salon/services', {
    preHandler: ownerOrManager,
    schema: {
      tags: ['Salon Catalog'],
      summary: 'Create a service',
      body: CreateServiceSchema,
    },
    handler: async (request, reply) => {
      const svc = await salonService.createService(request.user.salonId!, request.body);
      return reply.status(201).send({ data: svc });
    },
  });

  server.patch('/api/v1/salon/services/:id', {
    preHandler: ownerOrManager,
    schema: {
      tags: ['Salon Catalog'],
      summary: 'Update a service',
      params: UuidParam,
      body: UpdateServiceSchema,
    },
    handler: async (request) => {
      const svc = await salonService.updateService(
        request.user.salonId!,
        request.params.id,
        request.body,
      );
      return { data: svc };
    },
  });

  server.delete('/api/v1/salon/services/:id', {
    preHandler: ownerOrManager,
    schema: {
      tags: ['Salon Catalog'],
      summary: 'Delete a service',
      params: UuidParam,
    },
    handler: async (request) => {
      const deleted = await salonService.deleteService(request.user.salonId!, request.params.id);
      return { data: deleted };
    },
  });

  server.post('/api/v1/salon/services/bulk-price', {
    preHandler: ownerOrManager,
    schema: {
      tags: ['Salon Catalog'],
      summary: 'Bulk adjust service prices by percentage or flat paise',
      body: BulkPriceAdjustSchema,
    },
    handler: async (request) => {
      const result = await salonService.bulkAdjustPrices(request.user.salonId!, request.body);
      return { data: result };
    },
  });

  // Availability Engine Preview
  server.get('/api/v1/salon/availability', {
    preHandler: [requireSalonMember()],
    schema: {
      tags: ['Salon Availability'],
      summary: 'Compute available booking slots for selected services and date',
      querystring: AvailabilityQuerySchema,
    },
    handler: async (request) => {
      const result = await salonService.getAvailability(request.user.salonId!, request.query);
      return { data: result };
    },
  });
}

