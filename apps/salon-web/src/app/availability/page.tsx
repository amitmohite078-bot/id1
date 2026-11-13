'use client';

import { useEffect, useState } from 'react';
import { Button } from '@salonbridge/ui';
import { DashboardShell } from '@/components/dashboard-shell';
import { apiFetch } from '@/lib/api';

interface ServiceOption {
  id: string;
  name: string;
  durationMinutes: number;
}

interface SlotItem {
  startTime: string;
  endTime: string;
  availableStaffIds: string[];
}

export default function AvailabilityPage() {
  const [services, setServices] = useState<ServiceOption[]>([]);
  const [selectedServiceId, setSelectedServiceId] = useState('');
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [slots, setSlots] = useState<SlotItem[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    apiFetch<ServiceOption[]>('/api/v1/salon/services')
      .then((list) => {
        setServices(list);
        if (list[0]) setSelectedServiceId(list[0].id);
      })
      .catch(() => {});
  }, []);

  async function handleCheck(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedServiceId) return;
    setError(null);
    try {
      const res = await apiFetch<{ slots: SlotItem[] }>(
        `/api/v1/salon/availability?date=${encodeURIComponent(date)}&serviceIds=${encodeURIComponent(selectedServiceId)}`,
      );
      setSlots(res.slots);
    } catch (err) {
      setError((err as Error).message);
    }
  }

  return (
    <DashboardShell>
      <div className="mx-auto max-w-4xl space-y-6">
        <header>
          <h1 className="text-2xl font-bold tracking-tight">Availability Engine Preview</h1>
          <p className="text-sm text-zinc-600">
            Test real-time slot computation factoring in hours, staff shifts, breaks, leaves, and buffers.
          </p>
        </header>

        {error && <p className="text-sm text-red-600">{error}</p>}

        <form
          onSubmit={handleCheck}
          className="flex flex-wrap items-end gap-3 rounded-xl border border-zinc-200 bg-white p-4 shadow-sm"
        >
          <label className="flex-1 text-sm">
            <span className="font-medium">Service</span>
            <select
              value={selectedServiceId}
              onChange={(e) => setSelectedServiceId(e.target.value)}
              className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2"
            >
              {services.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} ({s.durationMinutes} mins)
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm">
            <span className="font-medium">Date</span>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="mt-1 block rounded-lg border border-zinc-300 px-3 py-2"
              required
            />
          </label>
          <Button type="submit">Compute Slots</Button>
        </form>

        <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
          {slots.map((slot) => (
            <div
              key={slot.startTime}
              className="rounded-lg border border-zinc-200 bg-white px-3 py-2 text-center text-sm shadow-sm"
            >
              <div className="font-semibold">{slot.startTime}</div>
              <div className="text-xs text-zinc-500">{slot.availableStaffIds.length} staff</div>
            </div>
          ))}
        </div>
      </div>
    </DashboardShell>
  );
}

