import { z } from 'zod';
import { PaginationQuerySchema } from './common.js';
import { GenderFocusSchema } from './salon.js';

export const SalonSearchQuerySchema = PaginationQuerySchema.extend({
  lat: z.coerce.number().min(-90).max(90).optional(),
  lng: z.coerce.number().min(-180).max(180).optional(),
  radiusKm: z.coerce.number().min(1).max(100).default(15),
  q: z.string().max(120).optional(),
  city: z.string().max(100).optional(),
  genderFocus: GenderFocusSchema.optional(),
  minRating: z.coerce.number().min(0).max(5).optional(),
  maxPricePaise: z.coerce.number().int().positive().optional(),
  amenity: z.string().max(60).optional(),
  sortBy: z.enum(['distance', 'rating', 'price']).default('distance'),
});

export type SalonSearchQuery = z.infer<typeof SalonSearchQuerySchema>;

export const CompareSalonsQuerySchema = z.object({
  ids: z
    .string()
    .transform((s) => s.split(',').map((v) => v.trim()).filter(Boolean))
    .pipe(z.array(z.string().uuid()).min(2).max(4)),
});

export const CreateSlotHoldSchema = z.object({
  salonId: z.string().uuid(),
  staffId: z.string().uuid().nullable().optional(),
  serviceIds: z.array(z.string().uuid()).min(1).max(10),
  startAt: z.string().datetime(),
});

export const CreateBookingSchema = z.object({
  holdId: z.string().uuid().optional(),
  salonId: z.string().uuid(),
  staffId: z.string().uuid().nullable().optional(),
  serviceIds: z.array(z.string().uuid()).min(1).max(10),
  startAt: z.string().datetime(),
  paymentMode: z.enum(['online', 'pay_at_salon']).default('online'),
  couponCode: z.string().max(40).optional(),
  customerNotes: z.string().max(500).optional(),
});

export const RescheduleBookingSchema = z.object({
  startAt: z.string().datetime(),
  staffId: z.string().uuid().nullable().optional(),
});

export const CancelBookingSchema = z.object({
  reason: z.string().max(500).optional(),
});

export const CreateReviewSchema = z.object({
  rating: z.number().int().min(1).max(5),
  comment: z.string().max(1500).optional(),
});
