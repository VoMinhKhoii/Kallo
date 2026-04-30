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
  // Flatten arrays to first value for Zod (URLSearchParams shape)
  const flat = Object.fromEntries(
    Object.entries(raw).map(([k, v]) => [k, Array.isArray(v) ? v[0] : v])
  );

  const parsed = requestFiltersSchema.safeParse(flat);
  const filters = parsed.success ? parsed.data : requestFiltersSchema.parse({});

  const { rows, total } = await listRequests(db, {
    filter: filters,
    page: filters.page,
    pageSize: filters.pageSize,
    includeReplays: filters.includeReplays,
  });

  const totalPages = Math.max(1, Math.ceil(total / filters.pageSize));

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="font-semibold text-xl">Pipeline Requests</h1>
        <span className="text-muted-foreground text-sm">{total} total</span>
      </div>

      <FiltersForm current={flat} />

      <RequestsTable rows={rows} />

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center gap-2 text-muted-foreground text-sm">
          <span>
            Page {filters.page} of {totalPages}
          </span>
          {filters.page > 1 && (
            <a
              href={`/admin/requests?${new URLSearchParams({ ...flat, page: String(filters.page - 1) }).toString()}`}
              className="rounded border px-2 py-1 hover:bg-muted"
            >
              ← Prev
            </a>
          )}
          {filters.page < totalPages && (
            <a
              href={`/admin/requests?${new URLSearchParams({ ...flat, page: String(filters.page + 1) }).toString()}`}
              className="rounded border px-2 py-1 hover:bg-muted"
            >
              Next →
            </a>
          )}
        </div>
      )}
    </div>
  );
}
