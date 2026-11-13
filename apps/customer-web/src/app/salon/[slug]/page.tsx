'use client';

import { use, useEffect, useState } from 'react';
import Link from 'next/link';
import { Button } from '@salonbridge/ui';
import { apiFetch } from '@/lib/api';

interface ServiceItem {
  id: string;
  name: string;
  pricePaise: number;
  durationMinutes: number;
}

interface SalonDetail {
  salon: {
    id: string;
    slug: string;
    name: string;
    description: string;
    city: string;
    avgRating: string;
    reviewCount: number;
    amenities: string[];
  };
  services: ServiceItem[];
  reviews: Array<{ id: string; rating: number; comment: string; createdAt: string }>;
}

export default function SalonDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = use(params);
  const [data, setData] = useState<SalonDetail | null>(null);
  const [selectedServices, setSelectedServices] = useState<string[]>([]);
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [slots, setSlots] = useState<Array<{ startTime: string; startAt: string }>>([]);
  const [selectedSlot, setSelectedSlot] = useState<string | null>(null);
  const [holdId, setHoldId] = useState<string | null>(null);
  const [holdExpiresAt, setHoldExpiresAt] = useState<string | null>(null);
  const [bookingSuccess, setBookingSuccess] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    apiFetch<SalonDetail>(`/api/v1/public/salons/${slug}`).then(setData).catch(() => {});
  }, [slug]);

  function toggleService(id: string) {
    setSelectedServices((prev) =>
      prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id],
    );
  }

  async function loadSlots() {
    if (!data || selectedServices.length === 0) return;
    setError(null);
    try {
      const qs = new URLSearchParams({ date, serviceIds: selectedServices.join(',') });
      const res = await apiFetch<{ slots: Array<{ startTime: string; startAt: string }> }>(
        `/api/v1/salon/availability?${qs.toString()}`,
      );
      setSlots(res.slots);
    } catch (err) {
      setError((err as Error).message);
    }
  }

  async function handleLockSlot(slot: { startTime: string; startAt: string }) {
    if (!data) return;
    setError(null);
    setSelectedSlot(slot.startAt);
    try {
      const hold = await apiFetch<{ holdId: string; expiresAt: string }>(
        '/api/v1/customer/holds',
        {
          method: 'POST',
          body: JSON.stringify({
            salonId: data.salon.id,
            serviceIds: selectedServices,
            startAt: slot.startAt,
          }),
        },
      );
      setHoldId(hold.holdId);
      setHoldExpiresAt(hold.expiresAt);
    } catch (err) {
      setError((err as Error).message);
    }
  }

  async function handleConfirmBooking(paymentMode: 'online' | 'pay_at_salon') {
    if (!data || !selectedSlot) return;
    setError(null);
    try {
      const res = await apiFetch<{
        booking: { bookingCode: string; totalAmountPaise: number; status: string };
        paymentOrder: { providerOrderId: string; keyId: string } | null;
      }>('/api/v1/customer/bookings', {
        method: 'POST',
        body: JSON.stringify({
          holdId: holdId || undefined,
          salonId: data.salon.id,
          serviceIds: selectedServices,
          startAt: selectedSlot,
          paymentMode,
        }),
      });

      setBookingSuccess(
        `Booking confirmed! Code: ${res.booking.bookingCode} (Amount: ₹${(res.booking.totalAmountPaise / 100).toFixed(0)})`,
      );
    } catch (err) {
      setError((err as Error).message);
    }
  }

  if (!data) {
    return <div className="p-8 text-center text-sm text-zinc-500">Loading salon details...</div>;
  }

  const totalPricePaise = data.services
    .filter((s) => selectedServices.includes(s.id))
    .reduce((acc, s) => acc + s.pricePaise, 0);

  return (
    <div className="min-h-screen bg-zinc-50 text-zinc-900">
      <header className="border-b border-zinc-200 bg-white">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-4">
          <Link href="/search" className="text-sm font-medium text-zinc-600 hover:text-zinc-900">
            ← Back to Search
          </Link>
          <Link href="/bookings" className="text-sm font-medium text-zinc-700">
            My Bookings
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-5xl space-y-6 px-4 py-6">
        <div className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm">
          <div className="flex items-start justify-between">
            <div>
              <h1 className="text-2xl font-bold">{data.salon.name}</h1>
              <p className="mt-1 text-sm text-zinc-500">{data.salon.city}</p>
            </div>
            <span className="rounded-lg bg-zinc-100 px-3 py-1 text-sm font-semibold">
              ★ {data.salon.avgRating} ({data.salon.reviewCount} reviews)
            </span>
          </div>
          <p className="mt-3 text-sm text-zinc-600">{data.salon.description}</p>
        </div>

        {error && <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}
        {bookingSuccess && (
          <p className="rounded-lg bg-emerald-50 p-4 text-sm font-medium text-emerald-800">
            {bookingSuccess}
          </p>
        )}

        <div className="grid gap-6 md:grid-cols-3">
          <div className="space-y-4 rounded-xl border border-zinc-200 bg-white p-5 shadow-sm md:col-span-2">
            <h2 className="font-semibold">1. Choose Services</h2>
            <div className="divide-y divide-zinc-100">
              {data.services.map((s) => {
                const checked = selectedServices.includes(s.id);
                return (
                  <label
                    key={s.id}
                    className="flex cursor-pointer items-center justify-between py-3 text-sm"
                  >
                    <div>
                      <span className="font-medium">{s.name}</span>
                      <p className="text-xs text-zinc-500">{s.durationMinutes} mins</p>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="font-semibold">₹{(s.pricePaise / 100).toFixed(0)}</span>
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggleService(s.id)}
                      />
                    </div>
                  </label>
                );
              })}
            </div>
          </div>

          <div className="space-y-4 rounded-xl border border-zinc-200 bg-white p-5 shadow-sm">
            <h2 className="font-semibold">2. Choose Slot & Book</h2>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-full rounded-lg border border-zinc-300 p-2 text-sm"
            />
            <Button
              size="sm"
              variant="outline"
              className="w-full"
              onClick={loadSlots}
              disabled={selectedServices.length === 0}
            >
              Find Available Slots
            </Button>

            <div className="grid grid-cols-2 gap-2 pt-2">
              {slots.map((s) => (
                <button
                  key={s.startTime}
                  onClick={() => void handleLockSlot(s)}
                  className={`rounded border px-2 py-1.5 text-xs font-medium ${
                    selectedSlot === s.startAt
                      ? 'border-zinc-900 bg-zinc-900 text-white'
                      : 'border-zinc-200 hover:bg-zinc-50'
                  }`}
                >
                  {s.startTime}
                </button>
              ))}
            </div>

            {holdId && (
              <div className="rounded bg-amber-50 p-2 text-xs text-amber-800">
                Slot locked for 7 minutes! Complete checkout below.
              </div>
            )}

            <div className="border-t border-zinc-100 pt-3">
              <div className="flex justify-between text-sm font-semibold">
                <span>Total:</span>
                <span>₹{(totalPricePaise / 100).toFixed(0)}</span>
              </div>
              <div className="mt-3 flex flex-col gap-2">
                <Button
                  disabled={!selectedSlot}
                  onClick={() => void handleConfirmBooking('online')}
                >
                  Pay Online (UPI / Card)
                </Button>
                <Button
                  disabled={!selectedSlot}
                  variant="outline"
                  onClick={() => void handleConfirmBooking('pay_at_salon')}
                >
                  Pay at Salon
                </Button>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

