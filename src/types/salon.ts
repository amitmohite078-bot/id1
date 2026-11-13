import { z } from 'zod';

export const GenderFocusSchema = z.enum(['men', 'women', 'unisex']);

export const SalonHourInputSchema = z.object({
  dayOfWeek: z.number().int().min(0).max(6),
  openTime: z.string().regex(/^\d{2}:\d{2}$/).nullable(),
  closeTime: z.string().regex(/^\d{2}:\d{2}$/).nullable(),
  isClosed: z.boolean().default(false),
});

export const OnboardSalonSchema = z.object({
  name: z.string().min(2).max(180),
  description: z.string().max(2000).optional(),
  genderFocus: GenderFocusSchema.default('unisex'),
  phone: z.string().regex(/^\+[1-9]\d{7,14}$/, 'Phone must be E.164 format'),
  email: z.string().email().optional(),
  addressLine1: z.string().min(3).max(255),
  addressLine2: z.string().max(255).optional(),
  city: z.string().min(2).max(100),
  state: z.string().min(2).max(100),
  pincode: z.string().min(4).max(16),
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  gstin: z.string().max(20).optional(),
  licenseDocKey: z.string().optional(),
  amenities: z.array(z.string().max(60)).default([]),
  hours: z.array(SalonHourInputSchema).length(7).optional(),
});

export type OnboardSalonInput = z.infer<typeof OnboardSalonSchema>;

export const UpdateSalonProfileSchema = z.object({
  name: z.string().min(2).max(180).optional(),
  description: z.string().max(2000).optional(),
  genderFocus: GenderFocusSchema.optional(),
  phone: z.string().regex(/^\+[1-9]\d{7,14}$/).optional(),
  email: z.string().email().nullable().optional(),
  addressLine1: z.string().min(3).max(255).optional(),
  addressLine2: z.string().max(255).nullable().optional(),
  city: z.string().min(2).max(100).optional(),
  state: z.string().min(2).max(100).optional(),
  pincode: z.string().min(4).max(16).optional(),
  lat: z.number().min(-90).max(90).optional(),
  lng: z.number().min(-180).max(180).optional(),
  gstin: z.string().max(20).nullable().optional(),
  amenities: z.array(z.string().max(60)).optional(),
  manualBookingApproval: z.boolean().optional(),
  slotIntervalMinutes: z.number().int().min(5).max(60).optional(),
  bufferMinutes: z.number().int().min(0).max(60).optional(),
  maxConcurrentBookings: z.number().int().min(1).max(50).optional(),
});

export type UpdateSalonProfileInput = z.infer<typeof UpdateSalonProfileSchema>;

export const CreateStaffSchema = z.object({
  displayName: z.string().min(2).max(120),
  title: z.string().max(100).optional(),
  bio: z.string().max(1000).optional(),
  serviceIds: z.array(z.string().uuid()).default([]),
});

export type CreateStaffInput = z.infer<typeof CreateStaffSchema>;

export const UpdateStaffSchema = CreateStaffSchema.partial().extend({
  isActive: z.boolean().optional(),
});

export const StaffScheduleDaySchema = z.object({
  dayOfWeek: z.number().int().min(0).max(6),
  startTime: z.string().regex(/^\d{2}:\d{2}$/),
  endTime: z.string().regex(/^\d{2}:\d{2}$/),
  breakStart: z.string().regex(/^\d{2}:\d{2}$/).nullable().optional(),
  breakEnd: z.string().regex(/^\d{2}:\d{2}$/).nullable().optional(),
  isOff: z.boolean().default(false),
});

export const UpsertStaffScheduleSchema = z.object({
  days: z.array(StaffScheduleDaySchema).min(1).max(7),
});

export const CreateStaffLeaveSchema = z.object({
  leaveDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Format must be YYYY-MM-DD'),
  startTime: z.string().regex(/^\d{2}:\d{2}$/).nullable().optional(),
  endTime: z.string().regex(/^\d{2}:\d{2}$/).nullable().optional(),
  reason: z.string().max(255).optional(),
});

export const CreateCategorySchema = z.object({
  name: z.string().min(2).max(120),
  sortOrder: z.number().int().min(0).default(0),
});

export const CreateServiceSchema = z.object({
  categoryId: z.string().uuid().nullable().optional(),
  name: z.string().min(2).max(180),
  description: z.string().max(1000).optional(),
  pricePaise: z.number().int().min(100).max(10_000_000),
  compareAtPricePaise: z.number().int().min(100).max(10_000_000).nullable().optional(),
  durationMinutes: z.number().int().min(5).max(480),
  genderTag: GenderFocusSchema.default('unisex'),
  isCombo: z.boolean().default(false),
});

export const UpdateServiceSchema = CreateServiceSchema.partial().extend({
  isActive: z.boolean().optional(),
});

export const BulkPriceAdjustSchema = z.object({
  mode: z.enum(['percent', 'flat_paise']),
  value: z.number().min(-90).max(500),
  categoryId: z.string().uuid().optional(),
});

export const AvailabilityQuerySchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be YYYY-MM-DD'),
  serviceIds: z
    .union([z.string().uuid(), z.array(z.string().uuid())])
    .transform((v) => (Array.isArray(v) ? v : [v])),
  staffId: z.string().uuid().optional(),
});

