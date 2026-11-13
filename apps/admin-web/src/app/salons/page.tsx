'use client';

import { useEffect, useState } from 'react';
import { Button } from '@salonbridge/ui';
import { AdminShell } from '@/components/admin-shell';
import { apiFetch } from '@/lib/api';

interface AdminSalon {
  id: string;
  name: string;
  city: string;
  phone: string;
  status: string;
  commissionRateBps: number | null;
  gstin: string | null;
  owner: { name: string | null; phone: string | null; email: string | null };
}

export default function AdminSalonsPage() {
  const [salons, setSalons] = useState<AdminSalon[]>([]);
  const [filterStatus, setFilterStatus] = useState('pending');
  const [commissionRate, setCommissionRate] = useState('800');
  const [error, setError] = useState<string | null>(null);

  async function loadSalons() {
    try {
      const res = await apiFetch<{ items: AdminSalon[] }>(
        `/api/v1/admin/salons?status=${filterStatus}`,
      );
      setSalons(res.items);
    } catch {
      // Unauthenticated
    }
  }

  useEffect(() => {
    void loadSalons();
  }, [filterStatus]);

  async function handleUpdateStatus(id: string, status: string) {
    setError(null);
    try {
      await apiFetch(`/api/v1/admin/salons/${id}/status`, {
        method: 'PATCH',
        body: JSON.stringify({
          status,
          commissionRateBps: Number(commissionRate),
          reason: `Admin set status to ${status}`,
        }),
      });
      await loadSalons();
    } catch (err) {
      setError((err as Error).message);
    }
  }

  return (
    <AdminShell>
      <div className="mx-auto max-w-5xl space-y-6">
        <header className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Salon Approval & Verification</h1>
            <p className="text-sm text-zinc-400">
              Review pending salon listings, verify GSTIN/licenses, and set custom commission rates.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <label className="flex items-center gap-1.5 text-xs text-zinc-400">
              Commission (bps):
              <input
                value={commissionRate}
                onChange={(e) => setCommissionRate(e.target.value)}
                className="w-16 rounded border border-zinc-700 bg-zinc-800 px-2 py-1 text-xs text-white"
              />
            </label>
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="rounded-lg border border-zinc-750 bg-zinc-800 px-3 py-1.5 text-xs text-white"
            >
              <option value="pending">Pending Review</option>
              <option value="approved">Approved</option>
              <option value="rejected">Rejected</option>
              <option value="suspended">Suspended</option>
            </select>
          </div>
        </header>

        {error && <p className="rounded-lg bg-red-900/40 p-3 text-xs text-red-300">{error}</p>}

        <div className="space-y-3">
          {salons.length === 0 ? (
            <p className="rounded-xl border border-zinc-800 bg-zinc-900 p-8 text-center text-sm text-zinc-500">
              No salons found in status "{filterStatus}".
            </p>
          ) : (
            salons.map((s) => (
              <div
                key={s.id}
                className="flex flex-col justify-between gap-4 rounded-xl border border-zinc-800 bg-zinc-900 p-5 sm:flex-row sm:items-center"
              >
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold text-white">{s.name}</h3>
                    <span className="rounded bg-zinc-800 px-2 py-0.5 text-xs font-medium uppercase text-zinc-300">
                      {s.city}
                    </span>
                    <span className="rounded bg-amber-500/20 px-2 py-0.5 text-xs font-semibold text-amber-300 capitalize">
                      {s.status}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-zinc-400">
                    Owner: {s.owner.name ?? 'Unknown'} ({s.owner.phone}) · GSTIN: {s.gstin ?? 'None'}
                  </p>
                  <p className="text-xs text-zinc-500">
                    Commission: {s.commissionRateBps ? `${s.commissionRateBps / 100}%` : 'Default (10%)'}
                  </p>
                </div>

                <div className="flex flex-wrap gap-2">
                  {s.status !== 'approved' && (
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => void handleUpdateStatus(s.id, 'approved')}
                    >
                      Approve Listing
                    </Button>
                  )}
                  {s.status === 'pending' && (
                    <Button
                      size="sm"
                      variant="danger"
                      onClick={() => void handleUpdateStatus(s.id, 'rejected')}
                    >
                      Reject
                    </Button>
                  )}
                  {s.status === 'approved' && (
                    <Button
                      size="sm"
                      variant="danger"
                      onClick={() => void handleUpdateStatus(s.id, 'suspended')}
                    >
                      Suspend
                    </Button>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </AdminShell>
  );
}

