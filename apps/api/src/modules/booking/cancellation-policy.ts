export interface PlatformCancellationPolicy {
  freeCancelHoursBefore: number;
  lateCancelRefundPercent: number;
}

export const DEFAULT_CANCELLATION_POLICY: PlatformCancellationPolicy = {
  freeCancelHoursBefore: 4,
  lateCancelRefundPercent: 50,
};

export function computeCancellationRefund(
  totalAmountPaise: number,
  bookingStartAt: Date,
  cancelledAt: Date,
  policy: PlatformCancellationPolicy = DEFAULT_CANCELLATION_POLICY,
): { refundPaise: number; refundPercent: number; tier: 'free' | 'late' | 'past' } {
  const hoursBefore = (bookingStartAt.getTime() - cancelledAt.getTime()) / (60 * 60 * 1000);
  if (hoursBefore < 0) {
    return { refundPaise: 0, refundPercent: 0, tier: 'past' };
  }
  if (hoursBefore >= policy.freeCancelHoursBefore) {
    return { refundPaise: totalAmountPaise, refundPercent: 100, tier: 'free' };
  }
  const refundPaise = Math.round((totalAmountPaise * policy.lateCancelRefundPercent) / 100);
  return {
    refundPaise,
    refundPercent: policy.lateCancelRefundPercent,
    tier: 'late',
  };
}

