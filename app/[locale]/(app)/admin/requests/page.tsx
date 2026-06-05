import { Link } from '@/i18n/navigation';
import { listRequests, requestFiltersSchema } from '@/lib/admin/queries';
import { requireAdmin } from '@/lib/admin/require-admin';
import { db } from '@/lib/db';
import { FiltersForm } from './_components/filters-form';
import { RequestsTable } from './_components/requests-table';

export const dynamic = 'force-dynamic';

export default async function RequestsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireAdmin();

  const raw = await searchParams;
  // Flatten arrays to first value for Zod (URLSearchParams shape) and
  // drop undefined values so the Record is always string-valued.
  const flat: Record<string, string> = Object.fromEntries(
    Object.entries(raw)
      .map(([k, v]) => [k, Array.isArray(v) ? v[0] : v] as const)
      .filter(
        (entry): entry is [string, string] => typeof entry[1] === 'string'
      )
  );

  // Parse field-by-field so a single invalid value (e.g. malformed userId)
  // doesn't discard valid filters. Each field falls back to undefined.
  const fieldShape = requestFiltersSchema.shape;
  const partial: Record<string, unknown> = {};
  for (const key of Object.keys(fieldShape) as (keyof typeof fieldShape)[]) {
    const value = flat[key];
    if (value === undefined) continue;
    const result = fieldShape[key].safeParse(value);
    if (result.success) partial[key] = result.data;
  }
  const filters = requestFiltersSchema.parse(partial);

  const { rows, total } = await listRequests(db, {
    filter: filters,
    page: filters.page,
    pageSize: filters.pageSize,
    includeReplays: filters.includeReplays,
  });

  const totalPages = Math.max(1, Math.ceil(total / filters.pageSize));

  return (
    <div className="mx-auto max-w-6xl space-y-4">
      <div className="flex items-baseline justify-between">
        <h1 className="font-lora font-semibold text-nham-text text-xl tracking-tight">
          Pipeline Requests
        </h1>
        <span className="text-nham-text-muted text-sm tabular-nums">
          {total} total
        </span>
      </div>

      <FiltersForm current={flat} />

      <RequestsTable rows={rows} />

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center gap-2 text-nham-text-muted text-sm">
          <span className="tabular-nums">
            Page {filters.page} of {totalPages}
          </span>
          {filters.page > 1 && (
            <Link
              href={`/admin/requests?${new URLSearchParams({ ...flat, page: String(filters.page - 1) }).toString()}`}
              aria-label="Previous page"
              className="rounded-md border border-nham-border/60 px-2 py-1 text-nham-text transition-colors hover:bg-nham-hover/60"
            >
              ← Prev
            </Link>
          )}
          {filters.page < totalPages && (
            <Link
              href={`/admin/requests?${new URLSearchParams({ ...flat, page: String(filters.page + 1) }).toString()}`}
              aria-label="Next page"
              className="rounded-md border border-nham-border/60 px-2 py-1 text-nham-text transition-colors hover:bg-nham-hover/60"
            >
              Next →
            </Link>
          )}
        </div>
      )}
    </div>
  );
}
