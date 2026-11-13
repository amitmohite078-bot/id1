import { z } from 'zod';
import { BookingStatus, PaginationQuerySchema } from './common.js';

export const SalonBookingListQuerySchema = PaginationQuerySchema.extend({
  status: z.enum([
    BookingStatus.PENDING_PAYMENT,
    BookingStatus.CONFIRMED,
    BookingStatus.IN_PROGRESS,
    BookingStatus.COMPLETED,
    BookingStatus.CANCELLED,
    BookingStatus.NO_SHOW,
  ]).optional(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  staffId: z.string().uuid().optional(),
});

export type SalonBookingListQuery = z.infer<typeof SalonBookingListQuerySchema>;

export const UpdateBookingStatusSchema = z.object({
  status: z.enum([
    BookingStatus.CONFIRMED,
    BookingStatus.IN_PROGRESS,
    BookingStatus.COMPLETED,
    BookingStatus.CANCELLED,
    BookingStatus.NO_SHOW,
  ]),
  cancellationReason: z.string().max(500).optional(),
});

export const CreateWalkInBookingSchema = z.object({
  customerName: z.string().min(2).max(120),
  customerPhone: z.string().regex(/^\+[1-9]\d{7,14}$/),
  serviceIds: z.array(z.string().uuid()).min(1).max(10),
  staffId: z.string().uuid().nullable().optional(),
  startAt: z.string().datetime(),
  customerNotes: z.string().max(500).optional(),
});

export const ReplyReviewSchema = z.object({
  reply: z.string().min(2).max(1000),
});

export const AnalyticsQuerySchema = z.object({
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});
