import crypto from 'node:crypto';
import {
  BookingStatus,
  ErrorCode,
  RoleName,
  type AnalyticsQuerySchema,
  type CreateWalkInBookingSchema,
  type SalonBookingListQuery,
  type UpdateBookingStatusSchema,
} from '@salonbridge/types';
import { AppError } from '../../lib/errors.js';
import type { NotificationDispatcher } from '../../lib/notification-dispatcher.js';
import type { SalonOpsRepository } from './salon-ops.repository.js';
import type { SalonRepository } from '../salon/salon.repository.js';
import type { BookingRepository } from '../customer/booking.repository.js';
import type { AuthRepository } from '../auth/auth.repository.js';

export class SalonOpsService {
  constructor(
    private readonly repo: SalonOpsRepository,
    private readonly salonRepo: SalonRepository,
    private readonly bookingRepo: BookingRepository,
    private readonly authRepo: AuthRepository,
    private readonly notifications: NotificationDispatcher,
  ) {}

  async listBookings(salonId: string, query: SalonBookingListQuery) {
    return this.repo.listBookings(salonId, query);
  }

  async getBooking(salonId: string, bookingId: string) {
    const booking = await this.repo.getBookingById(salonId, bookingId);
    if (!booking) {
      throw new AppError(404, ErrorCode.NOT_FOUND, 'Booking not found');
    }
    return booking;
  }

  async updateBookingStatus(
    salonId: string,
    bookingId: string,
    input: typeof UpdateBookingStatusSchema._type,
  ) {
    const booking = await this.repo.getBookingById(salonId, bookingId);
    if (!booking) {
      throw new AppError(404, ErrorCode.NOT_FOUND, 'Booking not found');
    }

    const updated = await this.repo.updateBookingStatus(
      salonId,
      bookingId,
      input.status,
      input.cancellationReason,
    );

    // Send WhatsApp notification on confirmation or cancellation
    if (booking.customer?.phone) {
      await this.notifications.dispatch({
        userId: booking.customerId,
        channel: 'whatsapp',
        recipient: booking.customer.phone,
        templateKey: `booking_${input.status}`,
        payload: {
          bookingCode: booking.bookingCode,
          status: input.status,
          startAt: booking.startAt,
        },
      });
    }

    return updated;
  }

  async createWalkInBooking(
    salonId: string,
    input: typeof CreateWalkInBookingSchema._type,
  ) {
    // 1. Find or create customer account for walk-in guest
    let user = await this.authRepo.findUserByPhone(input.customerPhone);
    if (!user) {
      user = await this.authRepo.createUserWithRole({
        phone: input.customerPhone,
        fullName: input.customerName,
        roleName: RoleName.CUSTOMER,
      });
    }

    const services = await this.salonRepo.findServicesByIds(salonId, input.serviceIds);
    if (services.length !== input.serviceIds.length) {
      throw new AppError(400, ErrorCode.VALIDATION_ERROR, 'One or more services not found');
    }

    const subtotalPaise = services.reduce((acc, s) => acc + s.pricePaise, 0);
    const startAt = new Date(input.startAt);
    let currentStart = startAt.getTime();
    const itemsData = services.map((s) => {
      const itemStart = new Date(currentStart);
      const itemEnd = new Date(currentStart + s.durationMinutes * 60 * 1000);
      currentStart = itemEnd.getTime();
      return {
        serviceId: s.id,
        staffId: input.staffId ?? null,
        serviceNameSnapshot: s.name,
        pricePaise: s.pricePaise,
        durationMinutes: s.durationMinutes,
        startAt: itemStart,
        endAt: itemEnd,
      };
    });

    const bookingCode = `WI-${Date.now().toString(36).toUpperCase()}-${crypto.randomBytes(2).toString('hex').toUpperCase()}`;

    const booking = await this.bookingRepo.createBookingWithItems({
      bookingCode,
      customerId: user.id,
      salonId,
      status: BookingStatus.CONFIRMED,
      paymentMode: 'pay_at_salon',
      startAt,
      endAt: new Date(currentStart),
      subtotalPaise,
      discountPaise: 0,
      totalAmountPaise: subtotalPaise,
      commissionPaise: 0,
      customerNotes: input.customerNotes ? `Walk-in: ${input.customerNotes}` : 'Walk-in booking',
      items: itemsData,
    });

    if (!booking) {
      throw new AppError(409, ErrorCode.SLOT_UNAVAILABLE, 'Time slot unavailable for walk-in appointment');
    }

    // Send confirmation to walk-in guest
    await this.notifications.dispatch({
      userId: user.id,
      channel: 'whatsapp',
      recipient: input.customerPhone,
      templateKey: 'booking_walkin_confirmed',
      payload: { bookingCode, startAt: input.startAt },
    });

    return booking;
  }

  async listCustomers(salonId: string) {
    return this.repo.listSalonCustomers(salonId);
  }

  async getAnalytics(salonId: string, input: typeof AnalyticsQuerySchema._type) {
    return this.repo.getAnalytics(salonId, input.startDate, input.endDate);
  }

  async listReviews(salonId: string) {
    return this.repo.listSalonReviews(salonId);
  }

  async replyReview(salonId: string, reviewId: string, reply: string) {
    const updated = await this.repo.replyToReview(salonId, reviewId, reply);
    if (!updated) {
      throw new AppError(404, ErrorCode.NOT_FOUND, 'Review not found');
    }
    return updated;
  }
}
