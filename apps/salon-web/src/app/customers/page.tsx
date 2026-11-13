'use client';

import { useEffect, useState } from 'react';
import { DashboardShell } from '@/components/dashboard-shell';
import { apiFetch } from '@/lib/api';

interface CustomerSummary {
  customerId: string;
  fullName: string | null;
  phone: string | null;
  totalVisits: number;
  totalSpentPaise: number;
  lastVisit: string | null;
}

export default function SalonCustomersPage() {
  const [customers, setCustomers] = useState<CustomerSummary[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    apiFetch<CustomerSummary[]>('/api/v1/salon/customers')
      .then(setCustomers)
      .catch((err) => setError((err as Error).message));
  }, []);

  return (
    <DashboardShell>
      <div className="mx-auto max-w-5xl space-y-6">
        <header>
          <h1 className="text-2xl font-bold tracking-tight">Customer Directory (CRM-Lite)</h1>
          <p className="text-sm text-zinc-600">
            View repeat customers, visit frequency, lifetime spend, and past appointment history.
          </p>
        </header>

        {error && <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}

        <div className="overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-sm">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-zinc-200 bg-zinc-50 text-xs uppercase text-zinc-500">
              <tr>
                <th className="px-4 py-3">Customer</th>
                <th className="px-4 py-3">Phone</th>
                <th className="px-4 py-3">Total Visits</th>
                <th className="px-4 py-3">Lifetime Spend</th>
                <th className="px-4 py-3">Last Visit</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {customers.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-6 text-center text-zinc-500">
                    No completed customer visits recorded yet.
                  </td>
                </tr>
              ) : (
                customers.map((c) => (
                  <tr key={c.customerId}>
                    <td className="px-4 py-3 font-semibold">{c.fullName ?? 'Guest'}</td>
                    <td className="px-4 py-3 text-zinc-600">{c.phone ?? '—'}</td>
                    <td className="px-4 py-3 font-medium">
                      <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-xs">
                        {c.totalVisits} visit{c.totalVisits > 1 ? 's' : ''}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-semibold text-emerald-800">
                      ₹{(c.totalSpentPaise / 100).toFixed(0)}
                    </td>
                    <td className="px-4 py-3 text-xs text-zinc-500">
                      {c.lastVisit ? new Date(c.lastVisit).toLocaleDateString() : '—'}
                    </td>
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

