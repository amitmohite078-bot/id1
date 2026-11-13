'use client';

import { useEffect, useState } from 'react';
import { Button } from '@salonbridge/ui';
import { DashboardShell } from '@/components/dashboard-shell';
import { apiFetch } from '@/lib/api';

interface AnalyticsData {
  summary: {
    totalRevenuePaise: number;
    completedBookings: number;
    cancelledBookings: number;
    noShowBookings: number;
    totalBookings: number;
  };
  topServices: Array<{
    serviceName: string;
    bookingCount: number;
    revenuePaise: number;
  }>;
}

export default function SalonAnalyticsPage() {
  const [startDate, setStartDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 30);
    return d.toISOString().slice(0, 10);
  });
  const [endDate, setEndDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function loadAnalytics() {
    setError(null);
    try {
      const res = await apiFetch<AnalyticsData>(
        `/api/v1/salon/analytics?startDate=${startDate}&endDate=${endDate}`,
      );
      setData(res);
    } catch (err) {
      setError((err as Error).message);
    }
  }

  useEffect(() => {
    void loadAnalytics();
  }, []);

  const totalBookings = data?.summary.totalBookings ?? 0;
  const completed = data?.summary.completedBookings ?? 0;
  const cancelled = data?.summary.cancelledBookings ?? 0;
  const noShows = data?.summary.noShowBookings ?? 0;
  const cancelRate = totalBookings > 0 ? Math.round((cancelled / totalBookings) * 100) : 0;
  const noShowRate = totalBookings > 0 ? Math.round((noShows / totalBookings) * 100) : 0;

  return (
    <DashboardShell>
      <div className="mx-auto max-w-5xl space-y-6">
        <header className="flex flex-wrap items-center justify-between gap-4 rounded-3xl border border-white/80 bg-white/70 p-6 backdrop-blur-xl shadow-[0_15px_35px_-10px_rgba(100,116,139,0.08)] ring-1 ring-zinc-200/50">
          <div>
            <div className="inline-flex items-center gap-1.5 rounded-full bg-zinc-900/5 px-2.5 py-0.5 text-[11px] font-semibold text-zinc-700">
              ✨ Financial Intelligence
            </div>
            <h1 className="mt-1 text-2xl font-bold tracking-tight text-zinc-900">
              Revenue & Performance Analytics
            </h1>
            <p className="text-xs text-zinc-500">
              Track GMV, service volume, peak performance, and cancellation/no-show rates.
            </p>
          </div>
          <div className="flex items-center gap-2 rounded-2xl border border-zinc-200/70 bg-white/80 p-1.5 backdrop-blur-md shadow-sm">
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="rounded-lg border-none bg-transparent px-2.5 py-1 text-xs font-medium text-zinc-800 focus:outline-none"
            />
            <span className="text-xs text-zinc-300">→</span>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="rounded-lg border-none bg-transparent px-2.5 py-1 text-xs font-medium text-zinc-800 focus:outline-none"
            />
            <Button size="sm" onClick={() => void loadAnalytics()}>
              Filter
            </Button>
          </div>
        </header>

        {error && (
          <p className="rounded-2xl border border-red-200 bg-red-50/80 p-4 text-xs text-red-700 backdrop-blur-md">
            {error}
          </p>
        )}

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {/* Card 1: Total Revenue */}
          <div className="rounded-3xl border border-white/90 bg-white/75 p-6 backdrop-blur-2xl shadow-[0_20px_40px_-12px_rgba(100,116,139,0.12)] ring-1 ring-zinc-200/60 transition-all hover:shadow-[0_25px_45px_-12px_rgba(100,116,139,0.18)]">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
                Total Revenue
              </span>
              <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-bold text-emerald-700 border border-emerald-500/20">
                Live GMV
              </span>
            </div>
            <div className="mt-3 text-3xl font-extrabold tracking-tight text-zinc-900">
              ₹{((data?.summary.totalRevenuePaise ?? 0) / 100).toFixed(0)}
            </div>
            <p className="mt-1 text-xs text-zinc-400">From completed appointments</p>
          </div>

          {/* Card 2: Completed Bookings */}
          <div className="rounded-3xl border border-white/90 bg-white/75 p-6 backdrop-blur-2xl shadow-[0_20px_40px_-12px_rgba(100,116,139,0.12)] ring-1 ring-zinc-200/60 transition-all hover:shadow-[0_25px_45px_-12px_rgba(100,116,139,0.18)]">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
                Completed
              </span>
              <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-[10px] font-bold text-zinc-700 border border-zinc-200">
                Volume
              </span>
            </div>
            <div className="mt-3 text-3xl font-extrabold tracking-tight text-zinc-900">
              {completed}
            </div>
            <p className="mt-1 text-xs text-zinc-400">Out of {totalBookings} total appointments</p>
          </div>

          {/* Card 3: Cancellation Rate */}
          <div className="rounded-3xl border border-white/90 bg-white/75 p-6 backdrop-blur-2xl shadow-[0_20px_40px_-12px_rgba(100,116,139,0.12)] ring-1 ring-zinc-200/60 transition-all hover:shadow-[0_25px_45px_-12px_rgba(100,116,139,0.18)]">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
                Cancellation
              </span>
              <span className="rounded-full bg-amber-500/10 px-2 py-0.5 text-[10px] font-bold text-amber-700 border border-amber-500/20">
                Rate
              </span>
            </div>
            <div className="mt-3 text-3xl font-extrabold tracking-tight text-amber-800">
              {cancelRate}%
            </div>
            <p className="mt-1 text-xs text-zinc-400">{cancelled} cancellations recorded</p>
          </div>

          {/* Card 4: No-Show Rate */}
          <div className="rounded-3xl border border-white/90 bg-white/75 p-6 backdrop-blur-2xl shadow-[0_20px_40px_-12px_rgba(100,116,139,0.12)] ring-1 ring-zinc-200/60 transition-all hover:shadow-[0_25px_45px_-12px_rgba(100,116,139,0.18)]">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
                No-Show
              </span>
              <span className="rounded-full bg-red-500/10 px-2 py-0.5 text-[10px] font-bold text-red-700 border border-red-500/20">
                Rate
              </span>
            </div>
            <div className="mt-3 text-3xl font-extrabold tracking-tight text-red-700">
              {noShowRate}%
            </div>
            <p className="mt-1 text-xs text-zinc-400">{noShows} customer no-shows</p>
          </div>
        </div>

        {/* Top Performing Services */}
        <div className="rounded-3xl border border-white/90 bg-white/75 p-6 backdrop-blur-2xl shadow-[0_20px_45px_-12px_rgba(100,116,139,0.12)] ring-1 ring-zinc-200/60">
          <div className="flex items-center justify-between border-b border-zinc-100 pb-4">
            <div>
              <h2 className="text-base font-bold text-zinc-900">Top Performing Services</h2>
              <p className="text-xs text-zinc-400">Ranked by revenue contribution and appointment count</p>
            </div>
            <span className="text-xs font-semibold text-zinc-500">Showing top 5</span>
          </div>

          <div className="mt-2 divide-y divide-zinc-100/80">
            {data?.topServices.length === 0 ? (
              <p className="py-8 text-center text-xs text-zinc-400">
                No service metrics recorded for this date window.
              </p>
            ) : (
              data?.topServices.map((svc) => (
                <div
                  key={svc.serviceName}
                  className="flex items-center justify-between py-3.5 px-3 rounded-2xl transition-colors hover:bg-white/80"
                >
                  <div className="flex items-center gap-3">
                    <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-zinc-900/5 text-xs font-bold text-zinc-700">
                      ★
                    </span>
                    <div>
                      <span className="font-semibold text-zinc-900 text-sm">{svc.serviceName}</span>
                      <p className="text-xs text-zinc-400">{svc.bookingCount} bookings completed</p>
                    </div>
                  </div>
                  <span className="font-bold text-zinc-900 text-sm">
                    ₹{(svc.revenuePaise / 100).toFixed(0)}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </DashboardShell>
  );
}

