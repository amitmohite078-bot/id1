'use client';

import { use, useEffect, useState } from 'react';
import Link from 'next/link';
import { apiFetch } from '@/lib/api';

interface ComparedSalon {
  id: string;
  name: string;
  city: string;
  avgRating: string;
  reviewCount: number;
  amenities: string[];
  services: Array<{ name: string; pricePaise: number; durationMinutes: number }>;
}

export default function ComparePage({
  searchParams,
}: {
  searchParams: Promise<{ ids?: string }>;
}) {
  const { ids } = use(searchParams);
  const [salons, setSalons] = useState<ComparedSalon[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!ids) return;
    apiFetch<ComparedSalon[]>(`/api/v1/public/salons/compare?ids=${encodeURIComponent(ids)}`)
      .then(setSalons)
      .catch((err) => setError((err as Error).message));
  }, [ids]);

  if (error) {
    return <div className="p-8 text-center text-sm text-red-600">{error}</div>;
  }

  return (
    <div className="min-h-screen bg-zinc-50 text-zinc-900">
      <header className="border-b border-zinc-200 bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4">
          <Link href="/search" className="text-sm font-medium text-zinc-600">
            ← Back to Search
          </Link>
          <span className="text-sm font-semibold">Side-by-Side Comparison</span>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-8">
        <h1 className="text-2xl font-bold tracking-tight">Compare Salons</h1>
        <p className="mt-1 text-sm text-zinc-600">
          Side-by-side pricing, ratings, and amenities across selected salons.
        </p>

        <div className="mt-6 overflow-x-auto rounded-xl border border-zinc-200 bg-white shadow-sm">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-zinc-200 bg-zinc-50">
              <tr>
                <th className="p-4 font-semibold text-zinc-600">Feature</th>
                {salons.map((s) => (
                  <th key={s.id} className="p-4 font-bold text-zinc-900">
                    {s.name}
                    <p className="text-xs font-normal text-zinc-500">{s.city}</p>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              <tr>
                <td className="p-4 font-medium text-zinc-600">Rating</td>
                {salons.map((s) => (
                  <td key={s.id} className="p-4">
                    ★ {s.avgRating} ({s.reviewCount})
                  </td>
                ))}
              </tr>
              <tr>
                <td className="p-4 font-medium text-zinc-600">Services Count</td>
                {salons.map((s) => (
                  <td key={s.id} className="p-4">
                    {s.services.length} services listed
                  </td>
                ))}
              </tr>
              <tr>
                <td className="p-4 font-medium text-zinc-600">Sample Starting Price</td>
                {salons.map((s) => {
                  const minPrice = s.services.reduce(
                    (min, cur) => Math.min(min, cur.pricePaise),
                    Infinity,
                  );
                  return (
                    <td key={s.id} className="p-4 font-semibold text-emerald-800">
                      {minPrice < Infinity ? `From ₹${(minPrice / 100).toFixed(0)}` : 'N/A'}
                    </td>
                  );
                })}
              </tr>
              <tr>
                <td className="p-4 font-medium text-zinc-600">Amenities</td>
                {salons.map((s) => (
                  <td key={s.id} className="p-4 text-xs text-zinc-600">
                    {s.amenities?.join(', ') || 'Standard'}
                  </td>
                ))}
              </tr>
            </tbody>
          </table>
        </div>
      </main>
    </div>
  );
}

