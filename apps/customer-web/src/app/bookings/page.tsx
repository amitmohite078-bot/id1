'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Button } from '@salonbridge/ui';
import { apiFetch } from '@/lib/api';

interface BookingItem {
  id: string;
  bookingCode: string;
  salonName: string;
  salonCity: string;
  status: string;
  paymentMode: string;
  startAt: string;
  totalAmountPaise: number;
}

export default function MyBookingsPage() {
  const [bookings, setBookings] = useState<BookingItem[]>([]);
  const [cancelReason, setCancelReason] = useState('');
  const [activeCancelId, setActiveCancelId] = useState<string | null>(null);
  const [refundNotice, setRefundNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function loadBookings() {
    try {
      const list = await apiFetch<BookingItem[]>('/api/v1/customer/bookings');
      setBookings(list);
    } catch {
      // Unauthenticated state
    }
  }

  useEffect(() => {
    void loadBookings();
  }, []);

  async function handleCancel(bookingId: string) {
    setError(null);
    setRefundNotice(null);
    try {
      const res = await apiFetch<{
        refund: { refundPaise: number; refundPercent: number; tier: string };
      }>(`/api/v1/customer/bookings/${bookingId}/cancel`, {
        method: 'POST',
        body: JSON.stringify({ reason: cancelReason }),
      });
      setRefundNotice(
        `Booking cancelled. Refund: ₹${(res.refund.refundPaise / 100).toFixed(0)} (${res.refund.refundPercent}% refund policy applied).`,
      );
      setActiveCancelId(null);
      await loadBookings();
    } catch (err) {
      setError((err as Error).message);
    }
  }

  return (
    <div className="min-h-screen bg-zinc-50 text-zinc-900">
      <header className="border-b border-zinc-200 bg-white">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-4">
          <Link href="/search" className="text-sm font-medium text-zinc-600">
            ← Explore Salons
          </Link>
          <span className="text-lg font-bold">My Bookings</span>
        </div>
      </header>

      <main className="mx-auto max-w-5xl space-y-6 px-4 py-8">
        {error && <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}
        {refundNotice && (
          <p className="rounded-lg bg-emerald-50 p-3 text-sm text-emerald-800">{refundNotice}</p>
        )}

        <div className="space-y-4">
          {bookings.length === 0 ? (
            <div className="rounded-xl border border-zinc-200 bg-white p-8 text-center text-sm text-zinc-500">
              No bookings found. Head to{' '}
              <Link href="/search" className="font-semibold text-zinc-900 underline">
                Search
              </Link>{' '}
              to book your first salon service.
            </div>
          ) : (
            bookings.map((b) => (
              <div
                key={b.id}
                className="flex flex-col justify-between gap-4 rounded-xl border border-zinc-200 bg-white p-5 shadow-sm sm:flex-row sm:items-center"
              >
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold">{b.salonName}</h3>
                    <span className="rounded bg-zinc-100 px-2 py-0.5 text-xs font-medium uppercase">
                      {b.status}
                    </span>
                  </div>
                  <p className="text-xs text-zinc-500">
                    Code: {b.bookingCode} · {new Date(b.startAt).toLocaleString()}
                  </p>
                  <p className="mt-1 text-sm font-medium">
                    ₹{(b.totalAmountPaise / 100).toFixed(0)} ({b.paymentMode})
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  {b.status !== 'cancelled' && b.status !== 'completed' && (
                    <>
                      {activeCancelId === b.id ? (
                        <div className="flex items-center gap-2">
                          <input
                            value={cancelReason}
                            onChange={(e) => setCancelReason(e.target.value)}
                            placeholder="Reason for cancel"
                            className="rounded border border-zinc-300 px-2 py-1 text-xs"
                          />
                          <Button size="sm" variant="danger" onClick={() => void handleCancel(b.id)}>
                            Confirm Cancel
                          </Button>
                        </div>
                      ) : (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setActiveCancelId(b.id)}
                        >
                          Cancel Booking
                        </Button>
                      )}
                    </>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </main>
    </div>
  );
}

