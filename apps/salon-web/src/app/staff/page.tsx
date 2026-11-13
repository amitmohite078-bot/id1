'use client';

import { useEffect, useState } from 'react';
import { Button } from '@salonbridge/ui';
import { DashboardShell } from '@/components/dashboard-shell';
import { apiFetch } from '@/lib/api';

interface StaffMember {
  id: string;
  displayName: string;
  title: string | null;
  isActive: boolean;
  serviceIds: string[];
}

export default function StaffPage() {
  const [staffList, setStaffList] = useState<StaffMember[]>([]);
  const [displayName, setDisplayName] = useState('');
  const [title, setTitle] = useState('');
  const [error, setError] = useState<string | null>(null);

  async function loadStaff() {
    try {
      const data = await apiFetch<StaffMember[]>('/api/v1/salon/staff');
      setStaffList(data);
    } catch (err) {
      setError((err as Error).message);
    }
  }

  useEffect(() => {
    void loadStaff();
  }, []);

  async function handleAddStaff(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      await apiFetch('/api/v1/salon/staff', {
        method: 'POST',
        body: JSON.stringify({ displayName, title: title || undefined, serviceIds: [] }),
      });
      setDisplayName('');
      setTitle('');
      await loadStaff();
    } catch (err) {
      setError((err as Error).message);
    }
  }

  return (
    <DashboardShell>
      <div className="mx-auto max-w-4xl space-y-6">
        <header>
          <h1 className="text-2xl font-bold tracking-tight">Staff & Schedules</h1>
          <p className="text-sm text-zinc-600">
            Add stylists and specialists. Each new member starts with a Mon–Sat 10:00–20:00 schedule.
          </p>
        </header>

        {error && <p className="text-sm text-red-600">{error}</p>}

        <form
          onSubmit={handleAddStaff}
          className="flex flex-wrap gap-3 rounded-xl border border-zinc-200 bg-white p-4 shadow-sm"
        >
          <input
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            placeholder="Staff name"
            className="flex-1 rounded-lg border border-zinc-300 px-3 py-2 text-sm"
            required
          />
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Title (e.g. Senior Stylist)"
            className="flex-1 rounded-lg border border-zinc-300 px-3 py-2 text-sm"
          />
          <Button type="submit">Add Staff</Button>
        </form>

        <div className="grid gap-4 sm:grid-cols-2">
          {staffList.map((member) => (
            <div key={member.id} className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold">{member.displayName}</h3>
                <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-medium text-emerald-800">
                  {member.isActive ? 'Active' : 'Inactive'}
                </span>
              </div>
              <p className="mt-1 text-sm text-zinc-500">{member.title ?? 'Specialist'}</p>
            </div>
          ))}
        </div>
      </div>
    </DashboardShell>
  );
}

