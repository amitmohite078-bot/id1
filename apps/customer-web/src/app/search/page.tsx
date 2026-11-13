'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Button } from '@salonbridge/ui';
import { apiFetch } from '@/lib/api';

interface SalonItem {
  id: string;
  slug: string;
  name: string;
  city: string;
  addressLine1: string;
  avgRating: string;
  reviewCount: number;
  genderFocus: string;
  distanceMeters: number;
}

export default function SearchPage() {
  const [q, setQ] = useState('');
  const [city, setCity] = useState('');
  const [genderFocus, setGenderFocus] = useState('unisex');
  const [salons, setSalons] = useState<SalonItem[]>([]);
  const [compareIds, setCompareIds] = useState<string[]>([]);
  const [viewMode, setViewMode] = useState<'list' | 'map'>('list');
  const [loading, setLoading] = useState(false);
  const [coords, setCoords] = useState<{ lat?: number; lng?: number }>({});

  async function runSearch(overrideCoords?: { lat?: number; lng?: number }) {
    setLoading(true);
    const activeCoords = overrideCoords ?? coords;
    const params = new URLSearchParams();
    if (q) params.set('q', q);
    if (city) params.set('city', city);
    if (genderFocus) params.set('genderFocus', genderFocus);
    if (activeCoords.lat !== undefined && activeCoords.lng !== undefined) {
      params.set('lat', String(activeCoords.lat));
      params.set('lng', String(activeCoords.lng));
      params.set('radiusKm', '20');
      params.set('sortBy', 'distance');
    }

    try {
      const res = await apiFetch<{ items: SalonItem[] }>(
        `/api/v1/public/salons/search?${params.toString()}`,
      );
      setSalons(res.items);
    } finally {
      setLoading(false);
    }
  }

  function handleDetectLocation() {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const c = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        setCoords(c);
        void runSearch(c);
      },
      () => {
        void runSearch();
      },
    );
  }

  function toggleCompare(id: string) {
    setCompareIds((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : prev.length < 4 ? [...prev, id] : prev,
    );
  }

  return (
    <div className="min-h-screen bg-zinc-50 text-zinc-900">
      <header className="border-b border-zinc-200 bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4">
          <Link href="/" className="text-xl font-bold tracking-tight">
            SalonBridge
          </Link>
          <div className="flex items-center gap-3">
            <Link href="/bookings" className="text-sm font-medium text-zinc-700 hover:text-zinc-900">
              My Bookings
            </Link>
            {compareIds.length >= 2 && (
              <Link href={`/compare?ids=${compareIds.join(',')}`}>
                <Button size="sm">Compare ({compareIds.length})</Button>
              </Link>
            )}
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-6">
        <div className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm">
          <div className="grid gap-3 sm:grid-cols-4">
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search salon or service..."
              className="rounded-lg border border-zinc-300 px-3 py-2 text-sm sm:col-span-2"
            />
            <input
              value={city}
              onChange={(e) => setCity(e.target.value)}
              placeholder="City (e.g. Bengaluru)"
              className="rounded-lg border border-zinc-300 px-3 py-2 text-sm"
            />
            <select
              value={genderFocus}
              onChange={(e) => setGenderFocus(e.target.value)}
              className="rounded-lg border border-zinc-300 px-3 py-2 text-sm"
            >
              <option value="unisex">Unisex</option>
              <option value="women">Women</option>
              <option value="men">Men</option>
            </select>
          </div>

          <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-zinc-100 pt-3">
            <div className="flex gap-2">
              <Button size="sm" onClick={() => void runSearch()}>
                {loading ? 'Searching...' : 'Search'}
              </Button>
              <Button size="sm" variant="outline" onClick={handleDetectLocation}>
                Near Me (GPS)
              </Button>
            </div>
            <div className="flex rounded-lg border border-zinc-200 text-xs">
              <button
                onClick={() => setViewMode('list')}
                className={`px-3 py-1.5 font-medium ${viewMode === 'list' ? 'bg-zinc-900 text-white' : 'text-zinc-600'}`}
              >
                List View
              </button>
              <button
                onClick={() => setViewMode('map')}
                className={`px-3 py-1.5 font-medium ${viewMode === 'map' ? 'bg-zinc-900 text-white' : 'text-zinc-600'}`}
              >
                Map Pins
              </button>
            </div>
          </div>
        </div>

        {viewMode === 'map' && (
          <div className="mt-6 flex h-64 items-center justify-center rounded-xl border border-zinc-200 bg-zinc-100 text-sm text-zinc-500">
            Interactive Mapbox / OSM View ({salons.length} pins rendered)
          </div>
        )}

        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {salons.map((salon) => {
            const isComparing = compareIds.includes(salon.id);
            return (
              <div
                key={salon.id}
                className="flex flex-col justify-between rounded-xl border border-zinc-200 bg-white p-5 shadow-sm"
              >
                <div>
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="font-semibold">{salon.name}</h3>
                    <span className="rounded bg-zinc-100 px-2 py-0.5 text-xs font-medium">
                      ★ {salon.avgRating} ({salon.reviewCount})
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-zinc-500">
                    {salon.addressLine1}, {salon.city}
                  </p>
                  {salon.distanceMeters > 0 && (
                    <p className="mt-1 text-xs text-emerald-700">
                      {(salon.distanceMeters / 1000).toFixed(1)} km away
                    </p>
                  )}
                </div>

                <div className="mt-4 flex items-center justify-between border-t border-zinc-100 pt-3">
                  <label className="flex items-center gap-1.5 text-xs text-zinc-600">
                    <input
                      type="checkbox"
                      checked={isComparing}
                      onChange={() => toggleCompare(salon.id)}
                    />
                    Compare
                  </label>
                  <Link href={`/salon/${salon.slug}`}>
                    <Button size="sm">View & Book</Button>
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      </main>
    </div>
  );
}

