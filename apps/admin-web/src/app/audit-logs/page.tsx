'use client';

import { useEffect, useState } from 'react';
import { AdminShell } from '@/components/admin-shell';
import { apiFetch } from '@/lib/api';

interface AuditLogItem {
  log: {
    id: string;
    action: string;
    resourceType: string;
    resourceId: string | null;
    ipAddress: string | null;
    createdAt: string;
    metadata: Record<string, unknown>;
  };
  actorEmail: string | null;
  actorName: string | null;
}

export default function AuditLogsPage() {
  const [logs, setLogs] = useState<AuditLogItem[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    apiFetch<AuditLogItem[]>('/api/v1/admin/audit-logs')
      .then(setLogs)
      .catch((err) => setError((err as Error).message));
  }, []);

  return (
    <AdminShell>
      <div className="mx-auto max-w-5xl space-y-6">
        <header>
          <h1 className="text-2xl font-bold tracking-tight">Platform Audit Trail</h1>
          <p className="text-sm text-zinc-400">
            Immutable log of all administrative actions, status overrides, and policy changes.
          </p>
        </header>

        {error && <p className="rounded-lg bg-red-900/40 p-3 text-xs text-red-300">{error}</p>}

        <div className="overflow-hidden rounded-xl border border-zinc-800 bg-zinc-900 shadow-sm">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-zinc-800 bg-zinc-950 text-zinc-400 uppercase">
              <tr>
                <th className="px-4 py-3">Timestamp</th>
                <th className="px-4 py-3">Actor</th>
                <th className="px-4 py-3">Action</th>
                <th className="px-4 py-3">Resource</th>
                <th className="px-4 py-3">IP Address</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800/60">
              {logs.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-6 text-center text-zinc-500">
                    No administrative audit events recorded yet.
                  </td>
                </tr>
              ) : (
                logs.map((item) => (
                  <tr key={item.log.id}>
                    <td className="px-4 py-3 text-zinc-400">
                      {new Date(item.log.createdAt).toLocaleString()}
                    </td>
                    <td className="px-4 py-3 font-medium text-white">
                      {item.actorEmail ?? item.actorName ?? 'System'}
                    </td>
                    <td className="px-4 py-3 font-mono text-amber-300">{item.log.action}</td>
                    <td className="px-4 py-3 text-zinc-300">
                      {item.log.resourceType}: {item.log.resourceId?.slice(0, 8)}...
                    </td>
                    <td className="px-4 py-3 text-zinc-400">{item.log.ipAddress ?? '127.0.0.1'}</td>
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

