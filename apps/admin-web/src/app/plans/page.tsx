'use client';

import { useEffect, useState } from 'react';
import { Button } from '@salonbridge/ui';
import { AdminShell } from '@/components/admin-shell';
import { apiFetch } from '@/lib/api';

interface Plan {
  id: string;
  code: string;
  name: string;
  monthlyPricePaise: number;
  aiImportsPerMonth: number;
  maxStaff: number;
  commissionRateBps: number;
  isActive: boolean;
}

interface Coupon {
  id: string;
  code: string;
  discountType: string;
  discountValue: number;
  validFrom: string;
  validUntil: string;
  isActive: boolean;
}

export default function AdminPlansPage() {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [couponCode, setCouponCode] = useState('');
  const [discountVal, setDiscountVal] = useState('10');
  const [error, setError] = useState<string | null>(null);

  async function loadData() {
    try {
      const [p, c] = await Promise.all([
        apiFetch<Plan[]>('/api/v1/admin/plans'),
        apiFetch<Coupon[]>('/api/v1/admin/coupons'),
      ]);
      setPlans(p);
      setCoupons(c);
    } catch (err) {
      setError((err as Error).message);
    }
  }

  useEffect(() => {
    void loadData();
  }, []);

  async function handleCreateCoupon(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      const now = new Date();
      const nextMonth = new Date();
      nextMonth.setMonth(nextMonth.getMonth() + 1);

      await apiFetch('/api/v1/admin/coupons', {
        method: 'POST',
        body: JSON.stringify({
          code: couponCode.toUpperCase(),
          discountType: 'percent',
          discountValue: Number(discountVal),
          minOrderPaise: 0,
          validFrom: now.toISOString(),
          validUntil: nextMonth.toISOString(),
        }),
      });
      setCouponCode('');
      await loadData();
    } catch (err) {
      setError((err as Error).message);
    }
  }

  return (
    <AdminShell>
      <div className="mx-auto max-w-5xl space-y-6">
        <header>
          <h1 className="text-2xl font-bold tracking-tight">Monetization: Plans & Coupons</h1>
          <p className="text-sm text-zinc-400">
            Configure partner subscription tiers, AI import quotas, and platform-wide promo codes.
          </p>
        </header>

        {error && <p className="rounded-lg bg-red-900/40 p-3 text-xs text-red-300">{error}</p>}

        {/* Plans */}
        <section className="space-y-3">
          <h2 className="text-lg font-semibold text-white">Subscription Plans</h2>
          <div className="grid gap-4 sm:grid-cols-3">
            {plans.map((p) => (
              <div key={p.id} className="rounded-xl border border-zinc-800 bg-zinc-900 p-5 shadow-sm">
                <div className="flex items-center justify-between">
                  <h3 className="font-bold text-white">{p.name}</h3>
                  <span className="rounded bg-zinc-800 px-2 py-0.5 text-[10px] uppercase text-zinc-400">
                    {p.code}
                  </span>
                </div>
                <div className="mt-2 text-xl font-bold text-emerald-400">
                  {p.monthlyPricePaise === 0
                    ? 'Free'
                    : `₹${(p.monthlyPricePaise / 100).toFixed(0)}/mo`}
                </div>
                <ul className="mt-3 space-y-1 text-xs text-zinc-400">
                  <li>• {p.aiImportsPerMonth} AI Menu Imports/mo</li>
                  <li>• Up to {p.maxStaff} staff members</li>
                  <li>• {p.commissionRateBps / 100}% platform commission</li>
                </ul>
              </div>
            ))}
          </div>
        </section>

        {/* Coupons */}
        <section className="space-y-4 rounded-xl border border-zinc-800 bg-zinc-900 p-5 shadow-sm">
          <h2 className="text-lg font-semibold text-white">Create Promo Coupon</h2>
          <form onSubmit={handleCreateCoupon} className="flex flex-wrap gap-3">
            <input
              value={couponCode}
              onChange={(e) => setCouponCode(e.target.value)}
              placeholder="COUPON CODE (e.g. FESTIVE20)"
              className="flex-1 rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-xs uppercase text-white"
              required
            />
            <input
              type="number"
              value={discountVal}
              onChange={(e) => setDiscountVal(e.target.value)}
              placeholder="Discount %"
              className="w-28 rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-xs text-white"
              required
            />
            <Button type="submit" variant="secondary" size="sm">
              Create Coupon
            </Button>
          </form>

          <div className="mt-4 divide-y divide-zinc-800/60">
            {coupons.map((c) => (
              <div key={c.id} className="flex items-center justify-between py-2 text-xs">
                <div>
                  <span className="font-mono font-bold text-amber-300">{c.code}</span>
                  <span className="ml-2 text-zinc-400">
                    ({c.discountValue}% off · valid until {new Date(c.validUntil).toLocaleDateString()})
                  </span>
                </div>
                <span className="rounded bg-emerald-500/20 px-2 py-0.5 text-[10px] text-emerald-300">
                  Active
                </span>
              </div>
            ))}
          </div>
        </section>
      </div>
    </AdminShell>
  );
}

