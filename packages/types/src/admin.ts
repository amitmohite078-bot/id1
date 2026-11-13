import { z } from 'zod';
import { PaginationQuerySchema, SalonStatus } from './common.js';

export const AdminSalonListQuerySchema = PaginationQuerySchema.extend({
  status: z.enum([
    SalonStatus.PENDING,
    SalonStatus.APPROVED,
    SalonStatus.REJECTED,
    SalonStatus.SUSPENDED,
  ]).optional(),
  city: z.string().optional(),
  q: z.string().optional(),
});

export type AdminSalonListQuery = z.infer<typeof AdminSalonListQuerySchema>;

export const UpdateSalonStatusSchema = z.object({
  status: z.enum([
    SalonStatus.APPROVED,
    SalonStatus.REJECTED,
    SalonStatus.SUSPENDED,
    SalonStatus.PENDING,
  ]),
  reason: z.string().max(500).optional(),
  commissionRateBps: z.number().int().min(0).max(5000).optional(),
});

export const UpdateUserStatusSchema = z.object({
  status: z.enum(['active', 'blocked']),
  reason: z.string().max(500).optional(),
});

export const CreatePlanSchema = z.object({
  code: z.string().min(2).max(30),
  name: z.string().min(2).max(80),
  monthlyPricePaise: z.number().int().min(0),
  aiImportsPerMonth: z.number().int().min(0),
  maxStaff: z.number().int().min(1),
  commissionRateBps: z.number().int().min(0).max(5000),
  features: z.record(z.string(), z.boolean()).default({}),
});

export const CreateCouponSchema = z.object({
  code: z.string().min(3).max(40),
  discountType: z.enum(['percent', 'flat']),
  discountValue: z.number().int().positive(),
  maxDiscountPaise: z.number().int().positive().nullable().optional(),
  minOrderPaise: z.number().int().min(0).default(0),
  usageLimit: z.number().int().positive().nullable().optional(),
  validFrom: z.string().datetime(),
  validUntil: z.string().datetime(),
  salonId: z.string().uuid().nullable().optional(),
});

export const ModerateReviewSchema = z.object({
  isHidden: z.boolean(),
  reason: z.string().max(500).optional(),
});

