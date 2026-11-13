'use client';

import { useEffect, useState } from 'react';
import { Button } from '@salonbridge/ui';
import { DashboardShell } from '@/components/dashboard-shell';
import { apiFetch } from '@/lib/api';

interface ServiceItem {
  id: string;
  name: string;
  pricePaise: number;
  durationMinutes: number;
  genderTag: string;
  isActive: boolean;
}

export default function ServicesPage() {
  const [services, setServices] = useState<ServiceItem[]>([]);
  const [name, setName] = useState('');
  const [priceInr, setPriceInr] = useState('499');
  const [duration, setDuration] = useState('30');
  const [bulkPct, setBulkPct] = useState('10');
  const [error, setError] = useState<string | null>(null);

  async function loadServices() {
    try {
      const data = await apiFetch<ServiceItem[]>('/api/v1/salon/services');
      setServices(data);
    } catch (err) {
      setError((err as Error).message);
    }
  }

  useEffect(() => {
    void loadServices();
  }, []);

  async function handleAddService(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      await apiFetch('/api/v1/salon/services', {
        method: 'POST',
        body: JSON.stringify({
          name,
          pricePaise: Math.round(Number(priceInr) * 100),
          durationMinutes: Number(duration),
          genderTag: 'unisex',
        }),
      });
      setName('');
      await loadServices();
    } catch (err) {
      setError((err as Error).message);
    }
  }

  async function handleBulkAdjust() {
    setError(null);
    try {
      await apiFetch('/api/v1/salon/services/bulk-price', {
        method: 'POST',
        body: JSON.stringify({ mode: 'percent', value: Number(bulkPct) }),
      });
      await loadServices();
    } catch (err) {
      setError((err as Error).message);
    }
  }

  return (
    <DashboardShell>
      <div className="mx-auto max-w-4xl space-y-6">
        <header className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Services & Pricing</h1>
            <p className="text-sm text-zinc-600">Add services manually or bulk-adjust prices.</p>
          </div>
          <div className="flex items-center gap-2">
            <input
              type="number"
              value={bulkPct}
              onChange={(e) => setBulkPct(e.target.value)}
              className="w-20 rounded-lg border border-zinc-300 px-2 py-1.5 text-sm"
            />
            <span className="text-sm text-zinc-600">%</span>
            <Button variant="outline" size="sm" onClick={handleBulkAdjust}>
              Bulk Adjust All
            </Button>
          </div>
        </header>

        {error && <p className="text-sm text-red-600">{error}</p>}

        <form
          onSubmit={handleAddService}
          className="grid gap-3 rounded-xl border border-zinc-200 bg-white p-4 shadow-sm sm:grid-cols-4"
        >
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Service name (e.g. Haircut)"
            className="rounded-lg border border-zinc-300 px-3 py-2 text-sm sm:col-span-2"
            required
          />
          <input
            type="number"
            value={priceInr}
            onChange={(e) => setPriceInr(e.target.value)}
            placeholder="Price (INR)"
            className="rounded-lg border border-zinc-300 px-3 py-2 text-sm"
            required
          />
          <div className="flex gap-2">
            <input
              type="number"
              value={duration}
              onChange={(e) => setDuration(e.target.value)}
              placeholder="Mins"
              className="w-20 rounded-lg border border-zinc-300 px-3 py-2 text-sm"
              required
            />
            <Button type="submit" className="flex-1">
              Add
            </Button>
          </div>
        </form>

        <div className="overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-sm">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-zinc-200 bg-zinc-50 text-xs uppercase text-zinc-500">
              <tr>
                <th className="px-4 py-3">Service</th>
                <th className="px-4 py-3">Duration</th>
                <th className="px-4 py-3">Price</th>
                <th className="px-4 py-3">Gender</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {services.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-4 py-6 text-center text-zinc-500">
                    No services added yet.
                  </td>
                </tr>
              ) : (
                services.map((s) => (
                  <tr key={s.id}>
                    <td className="px-4 py-3 font-medium">{s.name}</td>
                    <td className="px-4 py-3">{s.durationMinutes} mins</td>
                    <td className="px-4 py-3">₹{(s.pricePaise / 100).toFixed(0)}</td>
                    <td className="px-4 py-3 capitalize">{s.genderTag}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </DashboardShell>
  );
}

