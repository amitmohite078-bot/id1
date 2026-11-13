'use client';

import { useEffect, useState } from 'react';
import { Button } from '@salonbridge/ui';
import { AdminShell } from '@/components/admin-shell';
import { apiFetch } from '@/lib/api';

interface PlatformMetrics {
  salons: {
    totalSalons: number;
    approvedSalons: number;
    pendingSalons: number;
  };
  users: number;
  bookings: {
    totalGmvPaise: number;
    totalCommissionPaise: number;
    completedBookings: number;
    totalBookings: number;
  };
  aiImports: {
    totalImportJobs: number;
    successfulImports: number;
    totalCostPaise: number;
    totalTokens: number;
  };
  topCities: Array<{ city: string; salonCount: number }>;
}

export default function AdminOverviewPage() {
  const [metrics, setMetrics] = useState<PlatformMetrics | null>(null);
  const [phone, setPhone] = useState('+919999999999');
  const [otp, setOtp] = useState('');
  const [totpCode, setTotpCode] = useState('');
  const [step, setStep] = useState<'phone' | 'otp' | 'totp' | 'authed'>('phone');
  const [devOtp, setDevOtp] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function loadMetrics() {
    try {
      const data = await apiFetch<PlatformMetrics>('/api/v1/admin/metrics');
      setMetrics(data);
      setStep('authed');
    } catch {
      setStep('phone');
    }
  }

  useEffect(() => {
    void loadMetrics();
  }, []);

  async function handleSendOtp(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      const res = await apiFetch<{ sent: boolean; devOtp?: string }>('/api/v1/auth/otp/send', {
        method: 'POST',
        body: JSON.stringify({ phone, channel: 'whatsapp', purpose: 'login' }),
      });
      setDevOtp(res.devOtp ?? null);
      setStep('otp');
    } catch (err) {
      setError((err as Error).message);
    }
  }

  async function handleVerifyOtp(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      const res = await apiFetch<{ requiresTwoFactor: boolean }>('/api/v1/auth/otp/verify', {
        method: 'POST',
        body: JSON.stringify({ phone, code: otp, appScope: 'admin' }),
      });
      if (res.requiresTwoFactor) {
        setStep('totp');
      } else {
        await loadMetrics();
      }
    } catch (err) {
      setError((err as Error).message);
    }
  }

  async function handleVerifyTotp(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      await apiFetch('/api/v1/auth/admin/2fa/verify', {
        method: 'POST',
        body: JSON.stringify({ code: totpCode }),
      });
      await loadMetrics();
    } catch (err) {
      setError((err as Error).message);
    }
  }

  return (
    <AdminShell>
      <div className="mx-auto max-w-5xl space-y-6">
        <header>
          <h1 className="text-2xl font-bold tracking-tight">Platform Control Plane</h1>
          <p className="text-sm text-zinc-400">
            System health, financial GMV, salon approvals, and AI extraction monitoring.
          </p>
        </header>

        {step !== 'authed' ? (
          <div className="max-w-md rounded-xl border border-zinc-800 bg-zinc-900 p-6 shadow-sm">
            <h2 className="font-semibold text-white">Super Admin 2FA Sign-In</h2>
            <p className="mt-1 text-xs text-zinc-400">
              Mandatory phone OTP followed by Authenticator TOTP verification.
            </p>
            {error && <p className="mt-3 text-xs text-red-400">{error}</p>}

            {step === 'phone' && (
              <form onSubmit={handleSendOtp} className="mt-4 space-y-3">
                <input
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-white"
                  required
                />
                <Button type="submit" variant="secondary" className="w-full">
                  Send WhatsApp OTP
                </Button>
              </form>
            )}

            {step === 'otp' && (
              <form onSubmit={handleVerifyOtp} className="mt-4 space-y-3">
                <input
                  value={otp}
                  onChange={(e) => setOtp(e.target.value)}
                  placeholder="6-digit OTP"
                  className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-white"
                  required
                />
                {devOtp && <span className="text-xs text-emerald-400">Dev OTP: {devOtp}</span>}
                <Button type="submit" variant="secondary" className="w-full">
                  Verify OTP
                </Button>
              </form>
            )}

            {step === 'totp' && (
              <form onSubmit={handleVerifyTotp} className="mt-4 space-y-3">
                <input
                  value={totpCode}
                  onChange={(e) => setTotpCode(e.target.value)}
                  placeholder="6-digit Authenticator Code"
                  className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-white"
                  required
                />
                <Button type="submit" variant="secondary" className="w-full">
                  Verify 2FA TOTP
                </Button>
              </form>
            )}
          </div>
        ) : (
          metrics && (
            <div className="space-y-6">
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-5">
                  <span className="text-xs font-medium text-zinc-400 uppercase">Gross GMV</span>
                  <div className="mt-2 text-2xl font-bold text-emerald-400">
                    ₹{(metrics.bookings.totalGmvPaise / 100).toFixed(0)}
                  </div>
                  <p className="mt-1 text-xs text-zinc-500">
                    Platform Commission: ₹{(metrics.bookings.totalCommissionPaise / 100).toFixed(0)}
                  </p>
                </div>

                <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-5">
                  <span className="text-xs font-medium text-zinc-400 uppercase">Salons</span>
                  <div className="mt-2 text-2xl font-bold text-white">
                    {metrics.salons.approvedSalons}{' '}
                    <span className="text-sm font-normal text-amber-400">
                      ({metrics.salons.pendingSalons} pending)
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-zinc-500">Total: {metrics.salons.totalSalons}</p>
                </div>

                <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-5">
                  <span className="text-xs font-medium text-zinc-400 uppercase">Registered Users</span>
                  <div className="mt-2 text-2xl font-bold text-white">{metrics.users}</div>
                  <p className="mt-1 text-xs text-zinc-500">
                    {metrics.bookings.completedBookings} completed visits
                  </p>
                </div>

                <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-5">
                  <span className="text-xs font-medium text-zinc-400 uppercase">AI Menu Imports</span>
                  <div className="mt-2 text-2xl font-bold text-indigo-400">
                    {metrics.aiImports.successfulImports} / {metrics.aiImports.totalImportJobs}
                  </div>
                  <p className="mt-1 text-xs text-zinc-500">
                    Tokens: {metrics.aiImports.totalTokens} (₹{(metrics.aiImports.totalCostPaise / 100).toFixed(2)})
                  </p>
                </div>
              </div>

              <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-5">
                <h2 className="font-semibold text-white">Top Active Cities</h2>
                <div className="mt-3 flex flex-wrap gap-2">
                  {metrics.topCities.map((c) => (
                    <span
                      key={c.city}
                      className="rounded-lg border border-zinc-700 bg-zinc-800/80 px-3 py-1 text-xs font-medium text-zinc-200"
                    >
                      {c.city} ({c.salonCount} salons)
                    </span>
                  ))}
                </div>
              </div>
            </div>
          )
        )}
      </div>
    </AdminShell>
  );
}
