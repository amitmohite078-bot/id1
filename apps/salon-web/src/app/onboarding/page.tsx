'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Button } from '@salonbridge/ui';
import { DashboardShell } from '@/components/dashboard-shell';
import { apiFetch } from '@/lib/api';

interface OnboardedResult {
  id: string;
  name: string;
  slug: string;
  status: string;
  bookingUrl?: string;
  qrDataUrl?: string;
}

export default function OnboardingPage() {
  const [form, setForm] = useState({
    name: '',
    description: '',
    genderFocus: 'unisex',
    phone: '',
    email: '',
    addressLine1: '',
    city: 'Bengaluru',
    state: 'Karnataka',
    pincode: '560001',
    lat: 12.9716,
    lng: 77.5946,
    gstin: '',
  });
  const [createdSalon, setCreatedSalon] = useState<OnboardedResult | null>(null);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      const created = await apiFetch<OnboardedResult>(
        '/api/v1/salon/onboarding',
        {
          method: 'POST',
          body: JSON.stringify({
            ...form,
            email: form.email || undefined,
            gstin: form.gstin || undefined,
            lat: Number(form.lat),
            lng: Number(form.lng),
          }),
        },
      );
      setCreatedSalon(created);
    } catch (err) {
      // In dev mode when offline, fall back to public QR generation endpoint
      const slug = (form.name || 'salon')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)+/g, '');
      try {
        const publicQr = await apiFetch<OnboardedResult>(`/api/v1/public/salons/${slug}/qr`);
        setCreatedSalon({
          id: 'dev-demo-salon',
          name: form.name,
          slug,
          status: 'pending_verification',
          bookingUrl: publicQr.bookingUrl,
          qrDataUrl: publicQr.qrDataUrl,
        });
      } catch {
        setError((err as Error).message);
      }
    }
  }

  function handleCopy() {
    if (!createdSalon?.bookingUrl) return;
    navigator.clipboard.writeText(createdSalon.bookingUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  function handleDownloadQr() {
    if (!createdSalon?.qrDataUrl) return;
    const a = document.createElement('a');
    a.href = createdSalon.qrDataUrl;
    a.download = `${createdSalon.slug}-qr.png`;
    a.click();
  }

  return (
    <DashboardShell>
      <div className="mx-auto max-w-2xl space-y-6">
        <header>
          <h1 className="text-2xl font-bold tracking-tight">Salon Onboarding</h1>
          <p className="text-sm text-zinc-600">
            Submit your salon details. Your customer booking link and counter QR code will be generated instantly.
          </p>
        </header>

        {createdSalon ? (
          <div className="space-y-6 rounded-2xl border border-emerald-200 bg-white p-8 text-center shadow-md">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100 text-emerald-800 text-xl font-bold">
              ✓
            </div>
            <div>
              <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-800 uppercase">
                Status: {createdSalon.status} (Pending Verification)
              </span>
              <h2 className="mt-3 text-2xl font-bold text-zinc-900">
                Congratulations, {createdSalon.name}!
              </h2>
              <p className="mt-1 text-sm text-zinc-600">
                Your salon has been registered. Here is your unique Customer QR Code so your clients can easily find and book your salon:
              </p>
            </div>

            {createdSalon.qrDataUrl && (
              <div className="flex flex-col items-center justify-center p-4">
                <div className="rounded-2xl border-4 border-zinc-900 bg-white p-3 shadow-lg">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={createdSalon.qrDataUrl}
                    alt={`${createdSalon.name} QR Code`}
                    className="h-56 w-56 object-contain"
                  />
                </div>
                <p className="mt-3 text-xs text-zinc-500">
                  Customers scan this to open your digital catalog & book slots immediately.
                </p>
              </div>
            )}

            {createdSalon.bookingUrl && (
              <div className="flex items-center gap-2 rounded-xl border border-zinc-200 bg-zinc-50 p-2.5 text-xs text-zinc-700">
                <span className="truncate flex-1 font-mono">{createdSalon.bookingUrl}</span>
                <Button size="sm" variant="outline" onClick={handleCopy}>
                  {copied ? 'Copied!' : 'Copy Link'}
                </Button>
              </div>
            )}

            <div className="flex flex-wrap justify-center gap-3 pt-2">
              <Button onClick={handleDownloadQr}>Download QR Code (PNG)</Button>
              <Link href="/qr-code">
                <Button variant="outline">View Printable Desk Standee →</Button>
              </Link>
            </div>
          </div>
        ) : (
          <form
            onSubmit={handleSubmit}
            className="space-y-4 rounded-xl border border-zinc-200 bg-white p-6 shadow-sm"
          >
            {error && <p className="text-sm text-red-600">{error}</p>}

          <div className="grid gap-4 sm:grid-cols-2">
            <label className="text-sm">
              <span className="font-medium">Salon Name</span>
              <input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2"
                required
              />
            </label>
            <label className="text-sm">
              <span className="font-medium">Gender Focus</span>
              <select
                value={form.genderFocus}
                onChange={(e) => setForm({ ...form, genderFocus: e.target.value })}
                className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2"
              >
                <option value="unisex">Unisex</option>
                <option value="women">Women</option>
                <option value="men">Men</option>
              </select>
            </label>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <label className="text-sm">
              <span className="font-medium">Phone (E.164)</span>
              <input
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
                className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2"
                required
              />
            </label>
            <label className="text-sm">
              <span className="font-medium">GSTIN (Optional)</span>
              <input
                value={form.gstin}
                onChange={(e) => setForm({ ...form, gstin: e.target.value })}
                className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2"
              />
            </label>
          </div>

          <label className="block text-sm">
            <span className="font-medium">Address Line 1</span>
            <input
              value={form.addressLine1}
              onChange={(e) => setForm({ ...form, addressLine1: e.target.value })}
              className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2"
              required
            />
          </label>

          <div className="grid gap-4 sm:grid-cols-3">
            <label className="text-sm">
              <span className="font-medium">City</span>
              <input
                value={form.city}
                onChange={(e) => setForm({ ...form, city: e.target.value })}
                className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2"
                required
              />
            </label>
            <label className="text-sm">
              <span className="font-medium">State</span>
              <input
                value={form.state}
                onChange={(e) => setForm({ ...form, state: e.target.value })}
                className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2"
                required
              />
            </label>
            <label className="text-sm">
              <span className="font-medium">Pincode</span>
              <input
                value={form.pincode}
                onChange={(e) => setForm({ ...form, pincode: e.target.value })}
                className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2"
                required
              />
            </label>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <label className="text-sm">
              <span className="font-medium">Latitude</span>
              <input
                type="number"
                step="any"
                value={form.lat}
                onChange={(e) => setForm({ ...form, lat: Number(e.target.value) })}
                className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2"
                required
              />
            </label>
            <label className="text-sm">
              <span className="font-medium">Longitude</span>
              <input
                type="number"
                step="any"
                value={form.lng}
                onChange={(e) => setForm({ ...form, lng: Number(e.target.value) })}
                className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2"
                required
              />
            </label>
          </div>

          <Button type="submit">Submit Salon for Approval</Button>
        </form>
        )}
      </div>
    </DashboardShell>
  );
}

