import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'SalonBridge Partner — Salon Dashboard',
  description: 'Manage your salon menu, AI rate-card imports, staff schedules, and bookings.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-zinc-50 text-zinc-900 antialiased">{children}</body>
    </html>
  );
}

