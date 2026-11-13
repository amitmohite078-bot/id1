import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'SalonBridge Admin — Platform Control Plane',
  description: 'Super Admin panel for salon approvals, monetization, moderation, and audit logs.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-zinc-950 text-zinc-50 antialiased">{children}</body>
    </html>
  );
}

