'use client';

import { useEffect, useState } from 'react';
import { Button } from '@salonbridge/ui';
import { DashboardShell } from '@/components/dashboard-shell';
import { apiFetch } from '@/lib/api';

interface SalonQrData {
  bookingUrl: string;
  qrDataUrl: string;
  qrSvg: string;
  salonSlug: string;
  salonName: string;
}

export default function SalonQrPage() {
  const [data, setData] = useState<SalonQrData | null>(null);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    apiFetch<SalonQrData>('/api/v1/salon/qr')
      .then(setData)
      .catch((err) => {
        setError((err as Error).message || 'Please log in to generate your salon QR standee.');
      });
  }, []);

  function handleCopyLink() {
    if (!data) return;
    navigator.clipboard.writeText(data.bookingUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  }

  function handleDownloadPng() {
    if (!data) return;
    const a = document.createElement('a');
    a.href = data.qrDataUrl;
    a.download = `${data.salonSlug}-booking-qr.png`;
    a.click();
  }

  function handleDownloadSvg() {
    if (!data) return;
    const blob = new Blob([data.qrSvg], { type: 'image/svg+xml' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${data.salonSlug}-booking-qr.svg`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function handlePrintStandee() {
    window.print();
  }

  return (
    <DashboardShell>
      <div className="mx-auto max-w-4xl space-y-6">
        <header className="flex flex-wrap items-center justify-between gap-4 print:hidden">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Salon QR Code & Front Desk Standee</h1>
            <p className="text-sm text-zinc-600">
              Give your walk-in and visiting customers a frictionless way to scan, browse your menu,
              and book appointments on their phones.
            </p>
          </div>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={handlePrintStandee}>
              🖨️ Print Standee
            </Button>
            <Button size="sm" onClick={handleDownloadPng}>
              Download PNG
            </Button>
          </div>
        </header>

        {error && (
          <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700 print:hidden">{error}</p>
        )}

        {data ? (
          <div className="grid gap-6 md:grid-cols-2">
            {/* Printable Desk Standee Preview */}
            <div className="flex flex-col items-center justify-center rounded-3xl border border-white/90 bg-white/70 p-8 text-center shadow-[0_20px_45px_-12px_rgba(100,116,139,0.12)] backdrop-blur-2xl ring-1 ring-zinc-200/60 print:border-none print:shadow-none print:p-0 print:bg-transparent">
              {/* Frosted Pearl Spa Desk Standee Card */}
              <div className="w-full max-w-sm rounded-3xl border border-white/90 bg-gradient-to-b from-white/95 via-zinc-50/80 to-white p-7 text-zinc-900 shadow-xl ring-1 ring-zinc-200/80">
                <div className="flex justify-center">
                  <span className="rounded-full bg-zinc-900 px-3.5 py-1 text-[11px] font-semibold tracking-wider text-white uppercase shadow-sm">
                    Scan & Book Instantly
                  </span>
                </div>

                <h2 className="mt-4 text-2xl font-bold tracking-tight text-zinc-900">
                  {data.salonName}
                </h2>
                <p className="mt-1 text-xs text-zinc-500">
                  Browse our full service menu, view real-time rates, and book your next slot
                </p>

                <div className="my-6 flex justify-center">
                  <div className="rounded-2xl border-4 border-zinc-900 bg-white p-3 shadow-lg ring-4 ring-zinc-100 transition-transform hover:scale-105">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={data.qrDataUrl}
                      alt={`${data.salonName} Customer Booking QR Code`}
                      className="h-56 w-56 object-contain"
                    />
                  </div>
                </div>

                <div className="rounded-xl bg-zinc-100/90 p-2.5 text-xs font-medium text-zinc-600 border border-zinc-200/60">
                  Point any phone camera or UPI app at this code to open our salon page
                </div>

                <p className="mt-3 text-[10px] font-medium text-zinc-400">
                  Powered by SalonBridge · salonbridge.in
                </p>
              </div>
            </div>

            {/* Quick Actions & Marketing Tips */}
            <div className="space-y-4 print:hidden">
              <div className="rounded-3xl border border-white/90 bg-white/75 p-6 backdrop-blur-2xl shadow-[0_20px_45px_-12px_rgba(100,116,139,0.12)] ring-1 ring-zinc-200/60">
                <div className="flex items-center gap-2">
                  <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-zinc-900/5 text-xs">🔗</span>
                  <h3 className="font-bold text-zinc-900 text-sm">Direct Customer Booking Link</h3>
                </div>
                <p className="mt-1 text-xs text-zinc-500">
                  Share this link on WhatsApp, Instagram Bio, or Google Business profile:
                </p>
                <div className="mt-3 flex items-center gap-2">
                  <input
                    readOnly
                    value={data.bookingUrl}
                    className="flex-1 truncate rounded-xl border border-zinc-200/80 bg-white/80 px-3.5 py-2 text-xs font-mono text-zinc-800 backdrop-blur-md focus:outline-none"
                  />
                  <Button size="sm" variant="outline" onClick={handleCopyLink}>
                    {copied ? '✓ Copied' : 'Copy'}
                  </Button>
                </div>
              </div>

              <div className="rounded-3xl border border-white/90 bg-white/75 p-6 backdrop-blur-2xl shadow-[0_20px_45px_-12px_rgba(100,116,139,0.12)] ring-1 ring-zinc-200/60">
                <div className="flex items-center gap-2">
                  <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-zinc-900/5 text-xs">📥</span>
                  <h3 className="font-bold text-zinc-900 text-sm">Download Assets</h3>
                </div>
                <p className="mt-1 text-xs text-zinc-500">
                  High-resolution assets for professional printing on acrylic stands or visiting cards:
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Button size="sm" onClick={handleDownloadPng}>
                    Download PNG (High-Res)
                  </Button>
                  <Button size="sm" variant="outline" onClick={handleDownloadSvg}>
                    Download SVG (Vector)
                  </Button>
                  <Button size="sm" variant="outline" onClick={handlePrintStandee}>
                    🖨️ Print Desk Card
                  </Button>
                </div>
              </div>

              <div className="rounded-3xl border border-white/90 bg-white/75 p-6 backdrop-blur-2xl shadow-[0_20px_45px_-12px_rgba(100,116,139,0.12)] ring-1 ring-zinc-200/60">
                <div className="flex items-center gap-2">
                  <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-zinc-900/5 text-xs">📍</span>
                  <h3 className="font-bold text-zinc-900 text-sm">Best Placement in Your Salon</h3>
                </div>
                <ul className="mt-3 space-y-2.5 text-xs text-zinc-600">
                  <li className="flex items-start gap-2.5 rounded-xl bg-white/60 p-2.5 border border-zinc-100">
                    <span className="font-bold text-zinc-900 whitespace-nowrap">1. Reception & Billing:</span>
                    <span>Guests waiting or paying can quickly save your salon or rebook their next slot.</span>
                  </li>
                  <li className="flex items-start gap-2.5 rounded-xl bg-white/60 p-2.5 border border-zinc-100">
                    <span className="font-bold text-zinc-900 whitespace-nowrap">2. Styling Station Mirrors:</span>
                    <span>Clients sitting in your chair have 30–60 minutes to browse and add add-on treatments.</span>
                  </li>
                  <li className="flex items-start gap-2.5 rounded-xl bg-white/60 p-2.5 border border-zinc-100">
                    <span className="font-bold text-zinc-900 whitespace-nowrap">3. Front Door / Window:</span>
                    <span>Passersby can scan after hours to check opening times, prices, and book for tomorrow.</span>
                  </li>
                  <li className="flex items-start gap-2.5 rounded-xl bg-white/60 p-2.5 border border-zinc-100">
                    <span className="font-bold text-zinc-900 whitespace-nowrap">4. Physical Rate Cards:</span>
                    <span>Eliminate outdated paper prices by sending clients straight to your live digital menu.</span>
                  </li>
                </ul>
              </div>
            </div>
          </div>
        ) : (
          <div className="rounded-3xl border border-white/90 bg-white/75 p-8 text-center text-xs text-zinc-500 backdrop-blur-2xl shadow-[0_20px_45px_-12px_rgba(100,116,139,0.12)] ring-1 ring-zinc-200/60">
            Sign in to view and download your salon's personalized QR code.
          </div>
        )}
      </div>
    </DashboardShell>
  );
}
