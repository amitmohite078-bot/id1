'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@salonbridge/ui';

const navItems = [
  { href: '/', label: 'Metrics & Overview' },
  { href: '/salons', label: 'Salon Approvals' },
  { href: '/users', label: 'User Management' },
  { href: '/plans', label: 'Plans & Coupons' },
  { href: '/moderation', label: 'Moderation Queue' },
  { href: '/audit-logs', label: 'Audit Logs' },
];

export function AdminShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="flex min-h-screen bg-zinc-950 text-zinc-100">
      <aside className="hidden w-64 flex-col border-r border-zinc-800 bg-zinc-900 p-5 md:flex">
        <div className="mb-8">
          <div className="flex items-center gap-2">
            <span className="text-lg font-bold tracking-tight">SalonBridge</span>
            <span className="rounded bg-amber-500/20 px-1.5 py-0.5 text-[10px] font-semibold text-amber-300">
              ADMIN
            </span>
          </div>
          <p className="text-xs text-zinc-400">Platform Control Plane</p>
        </div>
        <nav className="flex flex-1 flex-col gap-1">
          {navItems.map((item) => {
            const active = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  'rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                  active
                    ? 'bg-zinc-800 text-white'
                    : 'text-zinc-400 hover:bg-zinc-800/60 hover:text-white',
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

