import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getRequestDetail } from '@/lib/admin/queries';
import { requireAdmin } from '@/lib/admin/require-admin';
import { db } from '@/lib/db';
import { ReplayButton } from './_components/replay-button';
import type {
  CompareLabel,
  StageWithCalls,
} from './_components/stage-timeline';
import { StageTimeline } from './_components/stage-timeline';

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

/** Align two stage arrays by stageIndex and compute compare labels. */
function computeCompareDiff(
  leftStages: StageWithCalls[],
  rightStages: StageWithCalls[]
): {
  left: StageWithCalls[];
  right: StageWithCalls[];
} {
  const rightByIndex = new Map(rightStages.map((s) => [s.stage.stageIndex, s]));
  const leftByIndex = new Map(leftStages.map((s) => [s.stage.stageIndex, s]));

  const allIndexes = new Set([
    ...leftStages.map((s) => s.stage.stageIndex),
    ...rightStages.map((s) => s.stage.stageIndex),
  ]);

  const newLeft: StageWithCalls[] = [];
  const newRight: StageWithCalls[] = [];

  for (const idx of [...allIndexes].sort((a, b) => a - b)) {
    const l = leftByIndex.get(idx);
    const r = rightByIndex.get(idx);

    let label: CompareLabel;
    if (!l) {
      label = 'only-here';
    } else if (!r) {
      label = 'only-here';
    } else {
      label =
        JSON.stringify(l.stage.outputJson) ===
        JSON.stringify(r.stage.outputJson)
          ? 'unchanged'
          : 'changed';
    }

    if (l) newLeft.push({ ...l, compareLabel: label });
    if (r) newRight.push({ ...r, compareLabel: label });
  }

  return { left: newLeft, right: newRight };
}

/** Join llmCalls into stages in-memory (stageLogId is not a DB FK). */
function buildStagesWithCalls(
  detail: NonNullable<Awaited<ReturnType<typeof getRequestDetail>>>
): StageWithCalls[] {
  return detail.stageLogs.map((stage) => ({
    stage,
    calls: detail.llmCalls.filter((c) => c.stageLogId === stage.id),
  }));
}

export default async function RequestDetailPage({
  params,
  searchParams,
}: PageProps) {
  await requireAdmin();

  const { id } = await params;
  const sp = await searchParams;
  const compareId = typeof sp.compare === 'string' ? sp.compare : undefined;

  const [detail, compareDetail] = await Promise.all([
    getRequestDetail(db, id),
    compareId ? getRequestDetail(db, compareId) : Promise.resolve(null),
  ]);

  if (!detail) notFound();

  const primaryStages = buildStagesWithCalls(detail);

  const isCompare = compareDetail !== null;

  const { left, right } = isCompare
    ? computeCompareDiff(primaryStages, buildStagesWithCalls(compareDetail))
    : { left: primaryStages, right: [] };

  const { request } = detail;

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-6">
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
            <ReplayButton requestId={request.id} />
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
              {request.createdAt.toISOString().replace('T', ' ').slice(0, 19)}{' '}
              UTC
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
