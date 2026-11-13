import { describe, it, expect } from 'vitest';
import { computeCancellationRefund } from '../cancellation-policy.js';

describe('Platform Cancellation Policy', () => {
  const policy = { freeCancelHoursBefore: 4, lateCancelRefundPercent: 50 };
  const bookingStart = new Date('2026-12-01T14:00:00.000Z');

  it('awards 100% refund when cancelled 5 hours before', () => {
    const cancelledAt = new Date('2026-12-01T09:00:00.000Z'); // 5h before
    const res = computeCancellationRefund(100000, bookingStart, cancelledAt, policy);
    expect(res).toEqual({
      refundPaise: 100000,
      refundPercent: 100,
      tier: 'free',
    });
  });

  it('awards 50% refund when cancelled 2 hours before', () => {
    const cancelledAt = new Date('2026-12-01T12:00:00.000Z'); // 2h before
    const res = computeCancellationRefund(100000, bookingStart, cancelledAt, policy);
    expect(res).toEqual({
      refundPaise: 50000,
      refundPercent: 50,
      tier: 'late',
    });
  });

  it('awards 0% refund when cancelled after start time', () => {
    const cancelledAt = new Date('2026-12-01T14:15:00.000Z'); // 15m past
    const res = computeCancellationRefund(100000, bookingStart, cancelledAt, policy);
    expect(res).toEqual({
      refundPaise: 0,
      refundPercent: 0,
      tier: 'past',
    });
  });
});

