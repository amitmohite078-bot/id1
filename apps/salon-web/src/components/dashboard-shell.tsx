'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@salonbridge/ui';

const navItems = [
  { href: '/', label: 'Overview' },
  { href: '/bookings', label: 'Bookings Calendar' },
  { href: '/customers', label: 'Customers (CRM)' },
  { href: '/analytics', label: 'Revenue & Analytics' },
  { href: '/onboarding', label: 'Onboarding & Profile' },
  { href: '/services', label: 'Services & Pricing' },
  { href: '/menu-import', label: 'AI Menu Import' },
  { href: '/qr-code', label: 'Salon QR & Standee' },
  { href: '/staff', label: 'Staff & Schedules' },
  { href: '/availability', label: 'Availability Preview' },
];

export function DashboardShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="flex min-h-screen bg-gradient-to-br from-slate-50 via-zinc-50 to-stone-100/40 text-zinc-900 antialiased">
      <aside className="hidden w-64 flex-col border-r border-white/80 bg-white/70 backdrop-blur-2xl p-5 shadow-[4px_0_24px_rgba(100,116,139,0.04)] md:flex">
        <div className="mb-8">
          <div className="flex items-center gap-2">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-zinc-900 text-xs font-bold text-white shadow-sm">
              S
            </span>
            <span className="text-lg font-bold tracking-tight text-zinc-900">SalonBridge</span>
          </div>
          <p className="mt-1 text-xs text-zinc-400">Partner Control Plane</p>
        </div>
        <nav className="flex flex-1 flex-col gap-1.5">
          {navItems.map((item) => {
            const active = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  'rounded-xl px-3.5 py-2.5 text-xs font-medium transition-all duration-200',
                  active
                    ? 'bg-gradient-to-b from-zinc-900 to-zinc-950 text-white shadow-[0_4px_12px_rgba(0,0,0,0.18)] border border-white/10'
                    : 'text-zinc-600 hover:bg-white/80 hover:text-zinc-900 hover:shadow-sm',
                )}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>
      </aside>
      <main className="flex-1 p-6 md:p-10">{children}</main>
    </div>
  );
}

