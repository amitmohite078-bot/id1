'use client';

import { useEffect, useState } from 'react';
import { Button } from '@salonbridge/ui';
import { AdminShell } from '@/components/admin-shell';
import { apiFetch } from '@/lib/api';

interface ReportedReview {
  review: {
    id: string;
    rating: number;
    comment: string | null;
    isReported: boolean;
    isHidden: boolean;
    createdAt: string;
  };
  salonName: string;
}

export default function AdminModerationPage() {
  const [reviews, setReviews] = useState<ReportedReview[]>([]);
  const [error, setError] = useState<string | null>(null);

  async function loadReported() {
    try {
      const list = await apiFetch<ReportedReview[]>('/api/v1/admin/reviews/reported');
      setReviews(list);
    } catch (err) {
      setError((err as Error).message);
    }
  }

  useEffect(() => {
    void loadReported();
  }, []);

  async function handleToggleVisibility(reviewId: string, currentHidden: boolean) {
    setError(null);
    try {
      await apiFetch(`/api/v1/admin/reviews/${reviewId}`, {
        method: 'PATCH',
        body: JSON.stringify({ isHidden: !currentHidden, reason: 'Moderated by Super Admin' }),
      });
      await loadReported();
    } catch (err) {
      setError((err as Error).message);
    }
  }

  return (
    <AdminShell>
      <div className="mx-auto max-w-5xl space-y-6">
        <header>
          <h1 className="text-2xl font-bold tracking-tight">Content Moderation Queue</h1>
          <p className="text-sm text-zinc-400">
            Review reported customer reviews, abusive content, and manage review visibility.
          </p>
        </header>

        {error && <p className="rounded-lg bg-red-900/40 p-3 text-xs text-red-300">{error}</p>}

        <div className="space-y-3">
          {reviews.length === 0 ? (
            <p className="rounded-xl border border-zinc-800 bg-zinc-900 p-8 text-center text-sm text-zinc-500">
              No reported reviews in moderation queue.
            </p>
          ) : (
            reviews.map((item) => (
              <div
                key={item.review.id}
                className="flex flex-col justify-between gap-4 rounded-xl border border-zinc-800 bg-zinc-900 p-5 sm:flex-row sm:items-center"
              >
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-white">{item.salonName}</span>
                    <span className="rounded bg-amber-500/20 px-2 py-0.5 text-xs text-amber-300">
                      ★ {item.review.rating} / 5
                    </span>
                    {item.review.isHidden && (
                      <span className="rounded bg-red-500/20 px-2 py-0.5 text-xs text-red-300">
                        HIDDEN
                      </span>
                    )}
                  </div>
                  <p className="mt-2 text-xs text-zinc-300">
                    "{item.review.comment ?? 'No written comment'}"
                  </p>
                  <p className="mt-1 text-[10px] text-zinc-500">
                    Reported on {new Date(item.review.createdAt).toLocaleDateString()}
                  </p>
                </div>

                <div>
                  <Button
                    size="sm"
                    variant={item.review.isHidden ? 'secondary' : 'danger'}
                    onClick={() => void handleToggleVisibility(item.review.id, item.review.isHidden)}
                  >
                    {item.review.isHidden ? 'Restore Review' : 'Hide Review'}
                  </Button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </AdminShell>
  );
}

