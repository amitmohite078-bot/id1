'use client';

import { useEffect, useState } from 'react';
import { Button } from '@salonbridge/ui';
import { DashboardShell } from '@/components/dashboard-shell';
import { apiFetch } from '@/lib/api';

interface ImportJob {
  id: string;
  sourceType: string;
  status: string;
  inputTokens: number;
  outputTokens: number;
  costPaise: number;
  errorMessage: string | null;
  createdAt: string;
}

interface ImportItem {
  id: string;
  categoryName: string;
  serviceName: string;
  pricePaise: number | null;
  maxPricePaise: number | null;
  isStartingFrom: boolean;
  durationMinutes: number;
  genderTag: string;
  confidence: string;
  reviewStatus: 'pending' | 'approved' | 'rejected';
  flags: string[];
}

interface DiffSummary {
  added: Array<{ serviceName: string; pricePaise: number }>;
  changed: Array<{ serviceName: string; oldPricePaise: number; newPricePaise: number }>;
  unchangedCount: number;
}

interface MenuVersion {
  id: string;
  versionNumber: number;
  createdAt: string;
}

export default function MenuImportPage() {
  const [rawText, setRawText] = useState(
    'Classic Haircut - ₹499\nGold Facial - ₹1200-1500\nBridal Makeup - Starting from 8000',
  );
  const [jobs, setJobs] = useState<ImportJob[]>([]);
  const [activeJob, setActiveJob] = useState<ImportJob | null>(null);
  const [items, setItems] = useState<ImportItem[]>([]);
  const [diff, setDiff] = useState<DiffSummary | null>(null);
  const [versions, setVersions] = useState<MenuVersion[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function loadAll() {
    try {
      const [jobList, versionList] = await Promise.all([
        apiFetch<ImportJob[]>('/api/v1/salon/menu-imports'),
        apiFetch<MenuVersion[]>('/api/v1/salon/menu-versions'),
      ]);
      setJobs(jobList);
      setVersions(versionList);
    } catch {
      // Ignore unauthenticated initial load
    }
  }

  useEffect(() => {
    void loadAll();
  }, []);

  async function openJob(jobId: string) {
    setError(null);
    const data = await apiFetch<{ job: ImportJob; items: ImportItem[] }>(
      `/api/v1/salon/menu-imports/${jobId}`,
    );
    setActiveJob(data.job);
    setItems(data.items);
    setDiff(null);
  }

  async function handleTextImport(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setMessage(null);
    try {
      const job = await apiFetch<ImportJob>('/api/v1/salon/menu-imports', {
        method: 'POST',
        body: JSON.stringify({ sourceType: 'text', rawText }),
      });
      setMessage('Import job queued. Refreshing...');
      await loadAll();
      setTimeout(() => void openJob(job.id), 600);
    } catch (err) {
      setError((err as Error).message);
    }
  }

  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null);
    setMessage(null);
    try {
      const ext = file.name.split('.').pop()?.toLowerCase();
      const sourceType =
        ext === 'csv'
          ? 'csv'
          : ext === 'xlsx' || ext === 'xls'
            ? 'xlsx'
            : ext === 'pdf'
              ? 'pdf'
              : ext === 'docx'
                ? 'docx'
                : 'image';

      const { uploadUrl, fileKey } = await apiFetch<{ uploadUrl: string; fileKey: string }>(
        '/api/v1/salon/menu-imports/upload-url',
        {
          method: 'POST',
          body: JSON.stringify({
            fileName: file.name,
            contentType: file.type || 'application/octet-stream',
            sizeBytes: file.size,
          }),
        },
      );

      await fetch(uploadUrl, {
        method: 'PUT',
        headers: { 'Content-Type': file.type || 'application/octet-stream' },
        body: file,
      });

      const job = await apiFetch<ImportJob>('/api/v1/salon/menu-imports', {
        method: 'POST',
        body: JSON.stringify({ sourceType, fileKey }),
      });
      setMessage(`Uploaded "${file.name}" and queued extraction job.`);
      await loadAll();
      setTimeout(() => void openJob(job.id), 1000);
    } catch (err) {
      setError((err as Error).message);
    }
  }

  async function updateItemStatus(item: ImportItem, reviewStatus: 'approved' | 'rejected') {
    if (!activeJob) return;
    const updated = await apiFetch<ImportItem>(
      `/api/v1/salon/menu-imports/${activeJob.id}/items/${item.id}`,
      {
        method: 'PATCH',
        body: JSON.stringify({ reviewStatus }),
      },
    );
    setItems((prev) => prev.map((i) => (i.id === updated.id ? updated : i)));
  }

  async function updateItemPrice(item: ImportItem, priceInr: string) {
    if (!activeJob) return;
    const paise = Math.round(Number(priceInr) * 100);
    if (!Number.isFinite(paise) || paise < 100) return;
    const updated = await apiFetch<ImportItem>(
      `/api/v1/salon/menu-imports/${activeJob.id}/items/${item.id}`,
      {
        method: 'PATCH',
        body: JSON.stringify({ pricePaise: paise, reviewStatus: 'approved' }),
      },
    );
    setItems((prev) => prev.map((i) => (i.id === updated.id ? updated : i)));
  }

  async function handlePreviewDiff() {
    if (!activeJob) return;
    const d = await apiFetch<DiffSummary>(`/api/v1/salon/menu-imports/${activeJob.id}/diff`);
    setDiff(d);
  }

  async function handlePublish() {
    if (!activeJob) return;
    setError(null);
    try {
      const res = await apiFetch<{ versionNumber: number; createdCount: number; updatedCount: number }>(
        `/api/v1/salon/menu-imports/${activeJob.id}/publish`,
        { method: 'POST', body: JSON.stringify({}) },
      );
      setMessage(
        `Published! Created ${res.createdCount}, updated ${res.updatedCount} services (Snapshot v${res.versionNumber}).`,
      );
      await loadAll();
      await openJob(activeJob.id);
    } catch (err) {
      setError((err as Error).message);
    }
  }

  async function handleRollback(versionNumber: number) {
    setError(null);
    try {
      const res = await apiFetch<{ restoredVersion: number; restoredCount: number }>(
        `/api/v1/salon/menu-versions/${versionNumber}/rollback`,
        { method: 'POST', body: JSON.stringify({}) },
      );
      setMessage(`Rolled back to v${res.restoredVersion} (${res.restoredCount} services restored).`);
      await loadAll();
    } catch (err) {
      setError((err as Error).message);
    }
  }

  return (
    <DashboardShell>
      <div className="mx-auto max-w-5xl space-y-6">
        <header>
          <h1 className="text-2xl font-bold tracking-tight">AI Menu Import Pipeline</h1>
          <p className="text-sm text-zinc-600">
            Upload a rate card photo, PDF, CSV, Excel, or paste menu text. Review extracted rows
            before publishing.
          </p>
        </header>

        {error && <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}
        {message && (
          <p className="rounded-lg bg-emerald-50 p-3 text-sm text-emerald-700">{message}</p>
        )}

        <div className="grid gap-6 md:grid-cols-2">
          <div className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm">
            <h2 className="font-semibold">Upload File (Image / PDF / CSV / XLSX / DOCX)</h2>
            <p className="mt-1 text-xs text-zinc-500">Max 10MB. Uploads directly to S3/MinIO.</p>
            <input
              type="file"
              accept=".jpg,.jpeg,.png,.webp,.pdf,.csv,.xls,.xlsx,.docx"
              onChange={handleFileUpload}
              className="mt-4 block w-full text-sm"
            />
          </div>

          <form
            onSubmit={handleTextImport}
            className="space-y-3 rounded-xl border border-zinc-200 bg-white p-5 shadow-sm"
          >
            <h2 className="font-semibold">Or Paste Menu Text</h2>
            <textarea
              rows={4}
              value={rawText}
              onChange={(e) => setRawText(e.target.value)}
              className="w-full rounded-lg border border-zinc-300 p-2 text-sm"
            />
            <Button type="submit" size="sm">
              Extract Menu Items
            </Button>
          </form>
        </div>

        {jobs.length > 0 && (
          <section className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm">
            <h2 className="mb-3 font-semibold">Recent Import Jobs</h2>
            <div className="flex flex-wrap gap-2">
              {jobs.map((j) => (
                <button
                  key={j.id}
                  onClick={() => void openJob(j.id)}
                  className="rounded-lg border border-zinc-200 px-3 py-1.5 text-xs hover:bg-zinc-50"
                >
                  <span className="font-medium uppercase">{j.sourceType}</span> · {j.status}
                </button>
              ))}
            </div>
          </section>
        )}

        {activeJob && (
          <section className="space-y-4 rounded-xl border border-zinc-200 bg-white p-5 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="font-semibold">Review Extracted Menu ({activeJob.status})</h2>
                <p className="text-xs text-zinc-500">
                  Tokens: {activeJob.inputTokens} in / {activeJob.outputTokens} out
                </p>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={handlePreviewDiff}>
                  Preview Diff
                </Button>
                <Button size="sm" onClick={handlePublish}>
                  Publish Approved
                </Button>
              </div>
            </div>

            {diff && (
              <div className="rounded-lg bg-zinc-50 p-3 text-xs">
                <strong>Diff Summary:</strong> {diff.added.length} new · {diff.changed.length}{' '}
                changed · {diff.unchangedCount} unchanged
              </div>
            )}

            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-zinc-200 text-xs uppercase text-zinc-500">
                  <tr>
                    <th className="py-2 pr-3">Category</th>
                    <th className="py-2 pr-3">Service</th>
                    <th className="py-2 pr-3">Price (₹)</th>
                    <th className="py-2 pr-3">Confidence</th>
                    <th className="py-2 pr-3">Status</th>
                    <th className="py-2">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100">
                  {items.map((item) => {
                    const conf = Number(item.confidence);
                    return (
                      <tr key={item.id}>
                        <td className="py-2 pr-3">{item.categoryName}</td>
                        <td className="py-2 pr-3 font-medium">
                          {item.serviceName}
                          {item.flags.length > 0 && (
                            <span className="ml-2 text-xs text-amber-600">
                              [{item.flags.join(', ')}]
                            </span>
                          )}
                        </td>
                        <td className="py-2 pr-3">
                          <input
                            type="number"
                            defaultValue={item.pricePaise ? item.pricePaise / 100 : ''}
                            onBlur={(e) => void updateItemPrice(item, e.target.value)}
                            className="w-24 rounded border border-zinc-300 px-2 py-1 text-xs"
                          />
                        </td>
                        <td className="py-2 pr-3">
                          <span
                            className={
                              conf >= 0.8 ? 'text-emerald-700' : 'font-medium text-amber-700'
                            }
                          >
                            {Math.round(conf * 100)}%
                          </span>
                        </td>
                        <td className="py-2 pr-3 capitalize">{item.reviewStatus}</td>
                        <td className="flex gap-1 py-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => void updateItemStatus(item, 'approved')}
                          >
                            Approve
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => void updateItemStatus(item, 'rejected')}
                          >
                            Reject
                          </Button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>
        )}

        {versions.length > 0 && (
          <section className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm">
            <h2 className="mb-3 font-semibold">Menu Version History</h2>
            <div className="space-y-2">
              {versions.map((v) => (
                <div
                  key={v.id}
                  className="flex items-center justify-between rounded-lg border border-zinc-100 px-3 py-2 text-sm"
                >
                  <span>Version #{v.versionNumber}</span>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => void handleRollback(v.versionNumber)}
                  >
                    Rollback to v{v.versionNumber}
                  </Button>
                </div>
              ))}
            </div>
          </section>
        )}
      </div>
    </DashboardShell>
  );
}

