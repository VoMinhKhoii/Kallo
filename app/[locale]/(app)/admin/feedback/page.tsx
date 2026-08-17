import { Link } from '@/i18n/navigation';
import { requireAdmin } from '@/lib/admin/authz/require-admin';
import {
  feedbackFiltersSchema,
  listFeedback,
} from '@/lib/admin/queries/feedback';
import { db } from '@/lib/db';
import { FeedbackFilters } from './_components/feedback-filters';
import { FeedbackTable } from './_components/feedback-table';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Feedback · Kallo Admin',
  robots: { index: false, follow: false },
};

export default async function AdminFeedbackPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireAdmin();

  const raw = await searchParams;
  const flat: Record<string, string> = Object.fromEntries(
    Object.entries(raw)
      .map(([k, v]) => [k, Array.isArray(v) ? v[0] : v] as const)
      .filter(
        (entry): entry is [string, string] => typeof entry[1] === 'string'
      )
  );

  // Parse field-by-field so one invalid value doesn't discard valid filters.
  const fieldShape = feedbackFiltersSchema.shape;
  const partial: Record<string, unknown> = {};
  for (const key of Object.keys(fieldShape) as (keyof typeof fieldShape)[]) {
    const value = flat[key];
    if (value === undefined) continue;
    const result = fieldShape[key].safeParse(value);
    if (result.success) partial[key] = result.data;
  }
  const filters = feedbackFiltersSchema.parse(partial);

  const { rows, total } = await listFeedback(db, {
    filter: { type: filters.type, status: filters.status },
    page: filters.page,
    pageSize: filters.pageSize,
  });

  const totalPages = Math.max(1, Math.ceil(total / filters.pageSize));

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="font-semibold text-xl">Feedback</h1>
        <div className="flex items-center gap-3 text-muted-foreground text-sm">
          <span>{total} total</span>
          <Link href="/admin/requests" className="hover:underline">
            Requests →
          </Link>
        </div>
      </div>

      <FeedbackFilters current={flat} />

      <FeedbackTable rows={rows} />

      {totalPages > 1 && (
        <div className="flex items-center gap-2 text-muted-foreground text-sm">
          <span>
            Page {filters.page} of {totalPages}
          </span>
          {filters.page > 1 && (
            <Link
              href={`/admin/feedback?${new URLSearchParams({ ...flat, page: String(filters.page - 1) }).toString()}`}
              aria-label="Previous page"
              className="rounded border px-2 py-1 hover:bg-muted"
            >
              ← Prev
            </Link>
          )}
          {filters.page < totalPages && (
            <Link
              href={`/admin/feedback?${new URLSearchParams({ ...flat, page: String(filters.page + 1) }).toString()}`}
              aria-label="Next page"
              className="rounded border px-2 py-1 hover:bg-muted"
            >
              Next →
            </Link>
          )}
        </div>
      )}
    </div>
  );
}
