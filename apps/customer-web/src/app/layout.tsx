import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'SalonBridge — Discover, Compare & Book Salons Near You',
  description: 'Find top-rated salons, compare prices side-by-side, and book your slot instantly.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-zinc-50 text-zinc-900 antialiased">{children}</body>
    </html>
  );
}

