import { describe, it, expect, vi } from 'vitest';
import { SalonOpsService } from '../salon-ops.service.js';
import type { SalonOpsRepository } from '../salon-ops.repository.js';
import type { SalonRepository } from '../../salon/salon.repository.js';
import type { BookingRepository } from '../../customer/booking.repository.js';
import type { AuthRepository } from '../../auth/auth.repository.js';
import type { NotificationDispatcher } from '../../../lib/notification-dispatcher.js';

describe('SalonOpsService Walk-In Booking', () => {
  it('creates walk-in booking and dispatches WhatsApp alert', async () => {
    const mockOpsRepo = {
      updateBookingStatus: vi.fn(),
      getBookingById: vi.fn(),
    } as unknown as SalonOpsRepository;

    const mockSalonRepo = {
      findServicesByIds: vi.fn().mockResolvedValue([
        { id: 's1', name: 'Haircut', pricePaise: 50000, durationMinutes: 30 },
      ]),
    } as unknown as SalonRepository;

    const mockBookingRepo = {
      createBookingWithItems: vi.fn().mockResolvedValue({
        id: 'b1',
        bookingCode: 'WI-TEST',
      }),
    } as unknown as BookingRepository;

    const mockAuthRepo = {
      findUserByPhone: vi.fn().mockResolvedValue({ id: 'u1' }),
    } as unknown as AuthRepository;

    const mockNotifications = {
      dispatch: vi.fn().mockResolvedValue({ providerMessageId: 'msg-1' }),
    } as NotificationDispatcher;

    const service = new SalonOpsService(
      mockOpsRepo,
      mockSalonRepo,
      mockBookingRepo,
      mockAuthRepo,
      mockNotifications,
    );

    const res = await service.createWalkInBooking('salon-1', {
      customerName: 'Aarav Sharma',
      customerPhone: '+919876543210',
      serviceIds: ['s1'],
      startAt: '2026-12-01T10:00:00.000Z',
    });

    expect(res).toBeDefined();
    expect(res.bookingCode).toBe('WI-TEST');
    expect(mockNotifications.dispatch).toHaveBeenCalledWith(
      expect.objectContaining({
        channel: 'whatsapp',
        recipient: '+919876543210',
        templateKey: 'booking_walkin_confirmed',
      }),
    );
  });
});
