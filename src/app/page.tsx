'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Button } from '@salonbridge/ui';
import { DashboardShell } from '@/components/dashboard-shell';
import { apiFetch } from '@/lib/api';

interface SalonSummary {
  id: string;
  name: string;
  status: string;
  city: string;
  slotIntervalMinutes: number;
  bufferMinutes: number;
  maxConcurrentBookings: number;
}

export default function SalonOverviewPage() {
  const [phone, setPhone] = useState('+919876543210');
  const [otp, setOtp] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [devOtp, setDevOtp] = useState<string | null>(null);
  const [salon, setSalon] = useState<SalonSummary | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    apiFetch<SalonSummary>('/api/v1/salon/me')
      .then(setSalon)
      .catch(() => setSalon(null));
  }, []);

  async function handleSendOtp(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      const res = await apiFetch<{ sent: boolean; devOtp?: string }>('/api/v1/auth/otp/send', {
        method: 'POST',
        body: JSON.stringify({ phone, channel: 'whatsapp', purpose: 'login' }),
      });
      setOtpSent(true);
      if (res.devOtp) {
        setDevOtp(res.devOtp);
        setOtp(res.devOtp);
      }
    } catch (err) {
      setError((err as Error).message);
    }
  }

  async function handleVerifyOtp(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      await apiFetch('/api/v1/auth/otp/verify', {
        method: 'POST',
        body: JSON.stringify({ phone, code: otp, appScope: 'salon' }),
      });
      const me = await apiFetch<SalonSummary>('/api/v1/salon/me').catch(() => null);
      setSalon(me);
    } catch (err) {
      setError((err as Error).message);
    }
  }

  return (
    <DashboardShell>
      <div className="mx-auto max-w-4xl space-y-6">
        <header>
          <h1 className="text-2xl font-bold tracking-tight">Salon Partner Overview</h1>
          <p className="text-sm text-zinc-600">
            Manage your salon profile, service catalog, staff schedules, and real-time availability.
          </p>
        </header>

        {salon ? (
          <div className="rounded-3xl border border-white/90 bg-white/75 p-8 backdrop-blur-2xl shadow-[0_20px_45px_-12px_rgba(100,116,139,0.12)] ring-1 ring-zinc-200/60">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xl font-bold tracking-tight text-zinc-900">{salon.name}</h2>
                <p className="text-xs text-zinc-500">{salon.city} · Partner Center</p>
              </div>
              <span className="rounded-full bg-amber-500/10 px-3 py-1 text-xs font-semibold capitalize text-amber-700 border border-amber-500/20">
                Status: {salon.status}
              </span>
            </div>
            <div className="mt-6 grid grid-cols-3 gap-4 border-t border-zinc-100/80 pt-6 text-sm">
              <div className="rounded-2xl border border-white/80 bg-white/60 p-4 shadow-sm backdrop-blur-md">
                <span className="text-xs font-semibold uppercase tracking-wider text-zinc-400">Slot Interval</span>
                <p className="mt-1 text-lg font-bold text-zinc-900">{salon.slotIntervalMinutes} mins</p>
              </div>
              <div className="rounded-2xl border border-white/80 bg-white/60 p-4 shadow-sm backdrop-blur-md">
                <span className="text-xs font-semibold uppercase tracking-wider text-zinc-400">Buffer Time</span>
                <p className="mt-1 text-lg font-bold text-zinc-900">{salon.bufferMinutes} mins</p>
              </div>
              <div className="rounded-2xl border border-white/80 bg-white/60 p-4 shadow-sm backdrop-blur-md">
                <span className="text-xs font-semibold uppercase tracking-wider text-zinc-400">Max Concurrent</span>
                <p className="mt-1 text-lg font-bold text-zinc-900">{salon.maxConcurrentBookings}</p>
              </div>
            </div>

            <div className="mt-6 flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-white/90 bg-gradient-to-r from-white/90 to-zinc-50/80 p-5 shadow-sm backdrop-blur-xl ring-1 ring-zinc-200/50">
              <div>
                <h3 className="font-bold text-zinc-900 text-sm">Customer Front Desk QR Standee</h3>
                <p className="text-xs text-zinc-500">
                  Print your acrylic salon counter standee or download vector files in Frosted Pearl style.
                </p>
              </div>
              <Link href="/qr-code">
                <Button size="sm">Get Salon Standee →</Button>
              </Link>
            </div>
          </div>
        ) : (
          <div className="rounded-3xl border border-white/90 bg-white/75 p-8 backdrop-blur-2xl shadow-[0_20px_45px_-12px_rgba(100,116,139,0.12)] ring-1 ring-zinc-200/60">
            <h2 className="text-lg font-bold text-zinc-900">Partner Sign In (WhatsApp OTP)</h2>
            <p className="mt-1 text-xs text-zinc-500">
              Sign in with your phone number, then complete salon onboarding.
            </p>
            {error && <p className="mt-3 text-xs text-red-600">{error}</p>}
            {!otpSent ? (
              <form onSubmit={handleSendOtp} className="mt-4 flex flex-wrap gap-3">
                <input
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="+919876543210"
                  className="rounded-xl border border-zinc-200/80 bg-white/80 px-3.5 py-2 text-xs backdrop-blur-md focus:border-zinc-400 focus:outline-none"
                  required
                />
                <Button type="submit">Send WhatsApp OTP</Button>
              </form>
            ) : (
              <div className="mt-4 space-y-3">
                <div className="flex items-center justify-between rounded-xl bg-emerald-50/80 border border-emerald-200/60 p-3 text-xs text-emerald-800">
                  <span>✓ OTP generated for {phone}</span>
                  {devOtp && (
                    <span className="font-mono font-bold bg-white px-2 py-0.5 rounded-lg border border-emerald-300">
                      Code: {devOtp}
                    </span>
                  )}
                </div>
                <form onSubmit={handleVerifyOtp} className="flex flex-wrap items-center gap-3">
                  <input
                    value={otp}
                    onChange={(e) => setOtp(e.target.value)}
                    placeholder="6-digit OTP"
                    className="rounded-xl border border-zinc-200/80 bg-white/80 px-3.5 py-2 text-xs font-mono font-bold backdrop-blur-md focus:border-zinc-400 focus:outline-none"
                    required
                  />
                  <Button type="submit">Verify & Sign In</Button>
                  <button
                    type="button"
                    onClick={() => { setOtpSent(false); setOtp(''); }}
                    className="text-xs text-zinc-500 underline hover:text-zinc-800"
                  >
                    Change Number
                  </button>
                </form>
              </div>
            )}
            <div className="mt-5 border-t border-zinc-100/80 pt-4">
              <Link href="/onboarding" className="text-xs font-semibold text-zinc-900 underline hover:text-zinc-700">
                Go to Salon Onboarding →
              </Link>
            </div>
          </div>
        )}
      </div>
    </DashboardShell>
  );
}
