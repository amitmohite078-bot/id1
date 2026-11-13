import crypto from 'node:crypto';
import {
  ErrorCode,
  type CancelBookingSchema,
  type CreateBookingSchema,
  type CreateReviewSchema,
  type CreateSlotHoldSchema,
  type SalonSearchQuery,
} from '@salonbridge/types';
import { AppError } from '../../lib/errors.js';
import type { PaymentProvider } from '../../lib/payment-provider.js';
import { computeCancellationRefund } from '../booking/cancellation-policy.js';
import type { DiscoveryRepository } from './discovery.repository.js';
import type { BookingRepository } from './booking.repository.js';
import type { SalonRepository } from '../salon/salon.repository.js';

export class CustomerService {
  constructor(
    private readonly discoveryRepo: DiscoveryRepository,
    private readonly bookingRepo: BookingRepository,
    private readonly salonRepo: SalonRepository,
    private readonly paymentProvider: PaymentProvider,
  ) {}

  async searchSalons(query: SalonSearchQuery) {
    return this.discoveryRepo.searchSalons(query);
  }

  async getSalonDetail(slug: string) {
    const detail = await this.discoveryRepo.getSalonDetailBySlug(slug);
    if (!detail) {
      throw new AppError(404, ErrorCode.NOT_FOUND, 'Salon not found');
    }
    return detail;
  }

  async compareSalons(salonIds: string[]) {
    return this.discoveryRepo.compareSalons(salonIds);
  }

  async createSlotHold(customerId: string, input: typeof CreateSlotHoldSchema._type) {
    const salon = await this.salonRepo.findSalonById(input.salonId);
    if (!salon || salon.status !== 'approved') {
      throw new AppError(404, ErrorCode.NOT_FOUND, 'Salon not found or inactive');
    }

    const services = await this.salonRepo.findServicesByIds(input.salonId, input.serviceIds);
    if (services.length !== input.serviceIds.length) {
      throw new AppError(400, ErrorCode.VALIDATION_ERROR, 'One or more services not found');
    }

    const totalDuration = services.reduce((acc, s) => acc + s.durationMinutes, 0);
    const startAt = new Date(input.startAt);
    const endAt = new Date(startAt.getTime() + totalDuration * 60 * 1000);
    const expiresAt = new Date(Date.now() + 7 * 60 * 1000); // 7-minute TTL

    const hold = await this.bookingRepo.createSlotHold({
      salonId: input.salonId,
      staffId: input.staffId ?? null,
      customerId,
      startAt,
      endAt,
      expiresAt,
    });

    return { holdId: hold.id, expiresAt: hold.expiresAt, totalDurationMinutes: totalDuration };
  }

  async createBooking(customerId: string, input: typeof CreateBookingSchema._type) {
    const salon = await this.salonRepo.findSalonById(input.salonId);
    if (!salon || salon.status !== 'approved') {
      throw new AppError(404, ErrorCode.NOT_FOUND, 'Salon not found');
    }

    const services = await this.salonRepo.findServicesByIds(input.salonId, input.serviceIds);
    if (services.length !== input.serviceIds.length) {
      throw new AppError(400, ErrorCode.VALIDATION_ERROR, 'One or more services not found');
    }

    const subtotalPaise = services.reduce((acc, s) => acc + s.pricePaise, 0);
    const discountPaise = 0; // Coupons can be extended here
    const totalAmountPaise = Math.max(0, subtotalPaise - discountPaise);

    // Platform commission (default 10% = 1000 bps if not customized per salon)
    const commissionBps = salon.commissionRateBps ?? 1000;
    const commissionPaise = Math.round((totalAmountPaise * commissionBps) / 10000);

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

    const bookingCode = `SB-${Date.now().toString(36).toUpperCase()}-${crypto.randomBytes(2).toString('hex').toUpperCase()}`;

    const booking = await this.bookingRepo.createBookingWithItems({
      bookingCode,
      customerId,
      salonId: input.salonId,
      status: input.paymentMode === 'online' ? 'pending_payment' : 'confirmed',
      paymentMode: input.paymentMode,
      startAt,
      endAt: new Date(currentStart),
      subtotalPaise,
      discountPaise,
      totalAmountPaise,
      commissionPaise,
      couponCode: input.couponCode,
      customerNotes: input.customerNotes,
      items: itemsData,
    });

    if (!booking) {
      throw new AppError(
        409,
        ErrorCode.SLOT_UNAVAILABLE,
        'Selected time slot is no longer available. Please choose another slot.',
      );
    }

    if (input.holdId) {
      await this.bookingRepo.deleteSlotHold(input.holdId);
    }

    let paymentOrder = null;
    if (input.paymentMode === 'online') {
      const salonTransferAmountPaise = Math.max(0, totalAmountPaise - commissionPaise);
      paymentOrder = await this.paymentProvider.createOrder({
        amountPaise: totalAmountPaise,
        currency: 'INR',
        receipt: booking.bookingCode,
        salonLinkedAccountId: salon.razorpayAccountId,
        salonTransferAmountPaise,
      });

      await this.bookingRepo.recordPayment({
        bookingId: booking.id,
        salonId: salon.id,
        provider: paymentOrder.provider,
        providerOrderId: paymentOrder.providerOrderId,
        amountPaise: totalAmountPaise,
        status: 'created',
      });
    }

    return { booking, paymentOrder };
  }

  async listBookings(customerId: string) {
    return this.bookingRepo.listCustomerBookings(customerId);
  }

  async cancelBooking(customerId: string, bookingId: string, input: typeof CancelBookingSchema._type) {
    const booking = await this.bookingRepo.getCustomerBookingById(customerId, bookingId);
    if (!booking) {
      throw new AppError(404, ErrorCode.NOT_FOUND, 'Booking not found');
    }
    if (booking.status === 'cancelled' || booking.status === 'completed') {
      throw new AppError(400, ErrorCode.VALIDATION_ERROR, `Booking cannot be cancelled in status ${booking.status}`);
    }

    const refundCalc = computeCancellationRefund(
      booking.totalAmountPaise,
      booking.startAt,
      new Date(),
    );

    const updated = await this.bookingRepo.updateBookingStatus(bookingId, 'cancelled', {
      cancellationReason: input.reason,
      cancelledBy: customerId,
      cancelledAt: new Date(),
    });

    return {
      booking: updated,
      refund: refundCalc,
    };
  }

  async createReview(customerId: string, bookingId: string, input: typeof CreateReviewSchema._type) {
    const booking = await this.bookingRepo.getCustomerBookingById(customerId, bookingId);
    if (!booking) {
      throw new AppError(404, ErrorCode.NOT_FOUND, 'Booking not found');
    }
    if (booking.status !== 'completed') {
      throw new AppError(400, ErrorCode.VALIDATION_ERROR, 'Reviews can only be submitted after a completed booking');
    }

    return this.bookingRepo.createReview({
      bookingId,
      salonId: booking.salonId,
      customerId,
      rating: input.rating,
      comment: input.comment,
    });
  }

  async toggleFavorite(customerId: string, salonId: string) {
    return this.bookingRepo.toggleFavorite(customerId, salonId);
  }
}

