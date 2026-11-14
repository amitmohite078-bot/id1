'use client';

import { useEffect, useState } from 'react';
import { Button } from '@salonbridge/ui';
import { DashboardShell } from '@/components/dashboard-shell';
import { apiFetch } from '@/lib/api';

interface SalonBooking {
  id: string;
  bookingCode: string;
  customerName: string | null;
  customerPhone: string | null;
  status: string;
  paymentMode: string;
  startAt: string;
  totalAmountPaise: number;
  items: Array<{ serviceNameSnapshot: string; durationMinutes: number }>;
}

export default function SalonBookingsPage() {
  const [bookings, setBookings] = useState<SalonBooking[]>([]);
  const [filterStatus, setFilterStatus] = useState<string>('');
  const [walkInName, setWalkInName] = useState('');
  const [walkInPhone, setWalkInPhone] = useState('');
  const [services, setServices] = useState<Array<{ id: string; name: string }>>([]);
  const [selectedServiceId, setSelectedServiceId] = useState('');
  const [walkInTime, setWalkInTime] = useState(() => new Date().toISOString().slice(0, 16));
  const [error, setError] = useState<string | null>(null);

  async function loadBookings() {
    try {
      const qs = filterStatus ? `?status=${filterStatus}` : '';
      const res = await apiFetch<{ items: SalonBooking[] }>(`/api/v1/salon/bookings${qs}`);
      setBookings(res.items);
    } catch {
      // Unauthenticated state
    }
  }

  useEffect(() => {
    void loadBookings();
    apiFetch<Array<{ id: string; name: string }>>('/api/v1/salon/services')
      .then((list) => {
        setServices(list);
        if (list[0]) setSelectedServiceId(list[0].id);
      })
      .catch(() => {});
  }, [filterStatus]);

  async function updateStatus(id: string, status: string) {
    try {
      await apiFetch(`/api/v1/salon/bookings/${id}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status }),
      });
      await loadBookings();
    } catch (err) {
      setError((err as Error).message);
    }
  }

  async function handleCreateWalkIn(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      await apiFetch('/api/v1/salon/bookings/walk-in', {
        method: 'POST',
        body: JSON.stringify({
          customerName: walkInName,
          customerPhone: walkInPhone,
          serviceIds: [selectedServiceId],
          startAt: new Date(walkInTime).toISOString(),
        }),
      });
      setWalkInName('');
      await loadBookings();
    } catch (err) {
      setError((err as Error).message);
    }
  }

  return (
    <DashboardShell>
      <div className="mx-auto max-w-5xl space-y-6">
        <header className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Booking Management & Calendar</h1>
            <p className="text-sm text-zinc-600">Track online appointments and book front-desk walk-ins.</p>
          </div>
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="rounded-lg border border-zinc-300 px-3 py-1.5 text-sm"
          >
            <option value="">All Statuses</option>
            <option value="confirmed">Confirmed</option>
            <option value="in_progress">In Progress</option>
            <option value="completed">Completed</option>
            <option value="cancelled">Cancelled</option>
            <option value="no_show">No Show</option>
          </select>
        </header>

        {error && <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}

        <form
          onSubmit={handleCreateWalkIn}
          className="grid gap-3 rounded-xl border border-zinc-200 bg-white p-4 shadow-sm sm:grid-cols-4"
        >
          <input
            value={walkInName}
            onChange={(e) => setWalkInName(e.target.value)}
            placeholder="Walk-in guest name"
            className="rounded-lg border border-zinc-300 px-3 py-2 text-sm"
            required
          />
          <input
            value={walkInPhone}
            onChange={(e) => setWalkInPhone(e.target.value)}
            placeholder="+91..."
            className="rounded-lg border border-zinc-300 px-3 py-2 text-sm"
            required
          />
          <select
            value={selectedServiceId}
            onChange={(e) => setSelectedServiceId(e.target.value)}
            className="rounded-lg border border-zinc-300 px-3 py-2 text-sm"
          >
            {services.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
          <Button type="submit">Add Walk-In</Button>
        </form>

        <div className="space-y-3">
          {bookings.map((b) => (
            <div
              key={b.id}
              className="flex flex-col justify-between gap-3 rounded-xl border border-zinc-200 bg-white p-4 shadow-sm sm:flex-row sm:items-center"
            >
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-semibold">{b.customerName ?? 'Guest'}</span>
                  <span className="text-xs text-zinc-500">({b.customerPhone})</span>
                  <span className="rounded bg-zinc-100 px-2 py-0.5 text-xs font-medium uppercase">
                    {b.status}
                  </span>
                </div>
                <p className="mt-1 text-xs text-zinc-600">
                  {b.items.map((i) => i.serviceNameSnapshot).join(', ')} ·{' '}
                  {new Date(b.startAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </p>
                <p className="text-xs font-semibold text-emerald-800">
                  ₹{(b.totalAmountPaise / 100).toFixed(0)} ({b.paymentMode})
                </p>
              </div>

              <div className="flex flex-wrap gap-1.5">
                {b.status === 'confirmed' && (
                  <Button size="sm" onClick={() => void updateStatus(b.id, 'in_progress')}>
                    Start
                  </Button>
                )}
                {b.status === 'in_progress' && (
                  <Button size="sm" onClick={() => void updateStatus(b.id, 'completed')}>
                    Complete
                  </Button>
                )}
                {b.status !== 'completed' && b.status !== 'cancelled' && (
                  <>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => void updateStatus(b.id, 'no_show')}
                    >
                      No Show
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => void updateStatus(b.id, 'cancelled')}
                    >
                      Cancel
                    </Button>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </DashboardShell>
  );
}
