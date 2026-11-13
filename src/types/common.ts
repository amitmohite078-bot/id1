import { z } from 'zod';

export const PaginationQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export type PaginationQuery = z.infer<typeof PaginationQuerySchema>;

export const RoleName = {
  CUSTOMER: 'customer',
  SALON_OWNER: 'salon_owner',
  SALON_MANAGER: 'salon_manager',
  SALON_RECEPTIONIST: 'salon_receptionist',
  SALON_STYLIST: 'salon_stylist',
  SUPER_ADMIN: 'super_admin',
} as const;

export type RoleName = (typeof RoleName)[keyof typeof RoleName];

export const SalonStatus = {
  PENDING: 'pending',
  APPROVED: 'approved',
  REJECTED: 'rejected',
  SUSPENDED: 'suspended',
} as const;

export type SalonStatus = (typeof SalonStatus)[keyof typeof SalonStatus];

export const BookingStatus = {
  PENDING_PAYMENT: 'pending_payment',
  CONFIRMED: 'confirmed',
  IN_PROGRESS: 'in_progress',
  COMPLETED: 'completed',
  CANCELLED: 'cancelled',
  NO_SHOW: 'no_show',
} as const;

export type BookingStatus = (typeof BookingStatus)[keyof typeof BookingStatus];

