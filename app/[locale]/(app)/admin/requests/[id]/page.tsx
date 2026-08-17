import { ArrowLeft } from 'lucide-react';
import { notFound } from 'next/navigation';
import { z } from 'zod';
import { PipelineSummary } from '@/components/admin/pipeline-summary/pipeline-summary';
import { PipelineVersionBadge } from '@/components/admin/requests/pipeline-version-badge';
import { ReplayButton } from '@/components/admin/requests/replay-button';
import { StageTimeline } from '@/components/admin/requests/stage-timeline';
import { Link } from '@/i18n/navigation';
import { requireAdmin } from '@/lib/admin/authz/require-admin';
import {
  buildStagesWithCalls,
  computeCompareDiff,
  parsePromptVersionsUsed,
} from '@/lib/admin/diagnostics/request-trace';
import { getRequestDetail } from '@/lib/admin/queries/requests';
import { formatUtcTimestamp } from '@/lib/core/text/utc-timestamp';
import { db } from '@/lib/infra/db';

export const dynamic = 'force-dynamic';

interface PageProps {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

const STATUS_STYLES: Record<string, string> = {
  success:
    'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
  error: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
  pending:
    'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400',
};

export default async function RequestDetailPage({
  params,
  searchParams,
}: PageProps) {
  await requireAdmin();

  const { id } = await params;
  if (!z.string().uuid().safeParse(id).success) notFound();
  const sp = await searchParams;
  const compareId = typeof sp.compare === 'string' ? sp.compare : undefined;
  if (compareId && !z.string().uuid().safeParse(compareId).success) notFound();

  const [detail, compareDetail] = await Promise.all([
    getRequestDetail(db, id),
    compareId ? getRequestDetail(db, compareId) : Promise.resolve(null),
  ]);

  if (!detail) notFound();
  if (compareId && !compareDetail) notFound();

  const primaryStages = buildStagesWithCalls(detail);

  const isCompare = compareDetail !== null;

  const { left, right } = isCompare
    ? computeCompareDiff(primaryStages, buildStagesWithCalls(compareDetail))
    : { left: primaryStages, right: [] };

  const { request } = detail;

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      {/* Back link */}
      <div>
        <Link
          href="/admin/requests"
          className="inline-flex items-center gap-1 text-muted-foreground text-sm hover:text-foreground"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          All Requests
        </Link>
      </div>

      {/* Request metadata */}
      <div className="rounded-lg border bg-card p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-1">
            <h1 className="font-mono text-muted-foreground text-sm">
              {request.id}
            </h1>
            <p className="font-semibold text-lg">
              {request.rawInput.length > 100
                ? `${request.rawInput.slice(0, 100)}…`
                : request.rawInput}
            </p>
          </div>

          <div className="flex items-center gap-3">
            <span
              className={`inline-flex rounded px-2 py-1 font-medium text-xs ${STATUS_STYLES[request.status] ?? 'bg-muted text-muted-foreground'}`}
            >
              {request.status}
            </span>
            <PipelineVersionBadge
              promptVersionsUsed={parsePromptVersionsUsed(
                request.promptVersionsUsed
              )}
            />
            {request.dryRun && (
              <span
                className="inline-flex rounded bg-amber-100 px-2 py-1 font-medium text-amber-900 text-xs dark:bg-amber-900/30 dark:text-amber-200"
                title="This request was created by a dry-run replay (mocked Gemini responses)."
              >
                DRY-RUN
              </span>
            )}
            <ReplayButton requestId={request.id} />
            <ReplayButton requestId={request.id} dryRun />
          </div>
        </div>

        <dl className="mt-4 grid grid-cols-2 gap-x-6 gap-y-2 text-sm sm:grid-cols-4">
          <div>
            <dt className="text-muted-foreground text-xs">User</dt>
            <dd className="font-mono">{request.userId ?? '—'}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground text-xs">Duration</dt>
            <dd className="tabular-nums">{request.durationMs ?? '—'} ms</dd>
          </div>
          <div>
            <dt className="text-muted-foreground text-xs">Triggered at</dt>
            <dd className="tabular-nums">
              {formatUtcTimestamp(request.createdAt)}
            </dd>
          </div>
          {request.replayOfRequestId && (
            <div>
              <dt className="text-muted-foreground text-xs">Replay of</dt>
              <dd>
                <Link
                  href={`/admin/requests/${request.replayOfRequestId}`}
                  className="font-mono text-xs hover:underline"
                >
                  {request.replayOfRequestId.slice(0, 8)}…
                </Link>
              </dd>
            </div>
          )}
        </dl>

        {/* Compare controls */}
        {isCompare ? (
          <div className="mt-3 flex items-center gap-2 rounded-md bg-muted/40 px-3 py-2 text-sm">
            <span>Comparing with</span>
            <Link
              href={`/admin/requests/${compareId}`}
              className="font-mono text-xs hover:underline"
            >
              {compareId}
            </Link>
            <Link
              href={`/admin/requests/${id}`}
              className="ml-auto text-muted-foreground text-xs hover:underline"
            >
              Exit compare
            </Link>
          </div>
        ) : null}
      </div>

      {/* High-signal pipeline summary (always visible — diagnostic-first) */}
      <PipelineSummary
        request={detail.request}
        stageLogs={detail.stageLogs}
        llmCalls={detail.llmCalls}
      />

      {/* Timeline */}
      {isCompare ? (
        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className="mb-2 font-semibold text-sm">
              {id.slice(0, 8)}… (primary)
            </p>
            <StageTimeline stages={left} />
          </div>
          <div>
            <p className="mb-2 font-semibold text-sm">
              {compareId?.slice(0, 8)}… (compare)
            </p>
            <StageTimeline stages={right} />
          </div>
        </div>
      ) : (
        <StageTimeline stages={left} />
      )}
    </div>
  );
}
