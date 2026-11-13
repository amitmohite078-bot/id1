'use client';

import { useEffect, useState } from 'react';
import { Button } from '@salonbridge/ui';
import { AdminShell } from '@/components/admin-shell';
import { apiFetch } from '@/lib/api';

interface AdminUser {
  id: string;
  phone: string | null;
  email: string | null;
  fullName: string | null;
  status: string;
  totpEnabled: boolean;
  createdAt: string;
}

export default function AdminUsersPage() {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [error, setError] = useState<string | null>(null);

  async function loadUsers() {
    try {
      const res = await apiFetch<{ items: AdminUser[] }>('/api/v1/admin/users');
      setUsers(res.items);
    } catch (err) {
      setError((err as Error).message);
    }
  }

  useEffect(() => {
    void loadUsers();
  }, []);

  async function handleToggleStatus(user: AdminUser) {
    const nextStatus = user.status === 'active' ? 'blocked' : 'active';
    setError(null);
    try {
      await apiFetch(`/api/v1/admin/users/${user.id}/status`, {
        method: 'PATCH',
        body: JSON.stringify({
          status: nextStatus,
          reason: `Admin changed status to ${nextStatus}`,
        }),
      });
      await loadUsers();
    } catch (err) {
      setError((err as Error).message);
    }
  }

  return (
    <AdminShell>
      <div className="mx-auto max-w-5xl space-y-6">
        <header>
          <h1 className="text-2xl font-bold tracking-tight">User Management</h1>
          <p className="text-sm text-zinc-400">
            View registered customers and salon owners, monitor activity, and manage account access.
          </p>
        </header>

        {error && <p className="rounded-lg bg-red-900/40 p-3 text-xs text-red-300">{error}</p>}

        <div className="overflow-hidden rounded-xl border border-zinc-800 bg-zinc-900 shadow-sm">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-zinc-800 bg-zinc-950 text-zinc-400 uppercase">
              <tr>
                <th className="px-4 py-3">Name</th>
                <th className="px-4 py-3">Phone</th>
                <th className="px-4 py-3">Email</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Joined</th>
                <th className="px-4 py-3">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800/60">
              {users.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-6 text-center text-zinc-500">
                    No users found.
                  </td>
                </tr>
              ) : (
                users.map((u) => (
                  <tr key={u.id}>
                    <td className="px-4 py-3 font-medium text-white">{u.fullName ?? 'Guest'}</td>
                    <td className="px-4 py-3 text-zinc-300">{u.phone ?? '—'}</td>
                    <td className="px-4 py-3 text-zinc-300">{u.email ?? '—'}</td>
                    <td className="px-4 py-3">
                      <span
                        className={`rounded px-2 py-0.5 text-[10px] font-semibold uppercase ${
                          u.status === 'active'
                            ? 'bg-emerald-500/20 text-emerald-300'
                            : 'bg-red-500/20 text-red-300'
                        }`}
                      >
                        {u.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-zinc-400">
                      {new Date(u.createdAt).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3">
                      <Button
                        size="sm"
                        variant={u.status === 'active' ? 'danger' : 'secondary'}
                        onClick={() => void handleToggleStatus(u)}
                      >
                        {u.status === 'active' ? 'Block' : 'Unblock'}
                      </Button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </AdminShell>
  );
}

