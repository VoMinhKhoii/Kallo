import { ArrowLeft } from 'lucide-react';
import { notFound } from 'next/navigation';
import { z } from 'zod';
import { Link } from '@/i18n/navigation';
import { formatUtcTimestamp } from '@/lib/admin/format';
import { getRequestDetail } from '@/lib/admin/queries';
import { requireAdmin } from '@/lib/admin/require-admin';
import { db } from '@/lib/db';
import { StatusBadge } from '../../_components/status-badge';
import { PipelineSummary } from './_components/pipeline-summary';
import { PipelineVersionBadge } from './_components/pipeline-version-badge';
import { ReplayButton } from './_components/replay-button';
import { RequestDetailTabs } from './_components/request-detail-tabs';
import type {
  CompareLabel,
  StageWithCalls,
} from './_components/stage-timeline';
import { StageTimeline } from './_components/stage-timeline';

export const dynamic = 'force-dynamic';

/**
 * Validate the `pipeline_requests.prompt_versions_used` JSONB blob before
 * passing it to the version badge. The DB column is typed `unknown` after
 * Drizzle's `$type<>()`; an unexpected shape (legacy rows, manual SQL
 * edits, or a future schema change) must not crash the admin page.
 *
 * Per repo guidelines: validate all external inputs with Zod schemas.
 */
const promptVersionsUsedSchema = z.record(z.string(), z.string()).nullable();

function parsePromptVersionsUsed(raw: unknown): Record<string, string> | null {
  const result = promptVersionsUsedSchema.safeParse(raw ?? null);
  return result.success ? result.data : null;
}

interface PageProps {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

function sortJsonKeys(value: unknown): unknown {
  if (value === null || typeof value !== 'object') return value;
  if (Array.isArray(value)) return value.map(sortJsonKeys);

  const record = value as Record<string, unknown>;
  return Object.keys(record)
    .sort()
    .reduce<Record<string, unknown>>((sorted, key) => {
      sorted[key] = sortJsonKeys(record[key]);
      return sorted;
    }, {});
}

const stableJsonString = (value: unknown): string =>
  JSON.stringify(sortJsonKeys(value));

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
        stableJsonString(l.stage.outputJson) ===
        stableJsonString(r.stage.outputJson)
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
          className="inline-flex items-center gap-1 text-nham-text-muted text-sm transition-colors hover:text-nham-text"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          All Requests
        </Link>
      </div>

      {/* Request metadata */}
      <div className="rounded-lg border border-nham-border/60 bg-white/50 p-5 dark:bg-white/[0.02]">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0 space-y-1">
            <h1 className="break-all font-mono text-nham-text-muted text-sm">
              {request.id}
            </h1>
            <p className="font-lora font-semibold text-lg text-nham-text">
              {request.rawInput.length > 100
                ? `${request.rawInput.slice(0, 100)}…`
                : request.rawInput}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <StatusBadge status={request.status} />
            <PipelineVersionBadge
              promptVersionsUsed={parsePromptVersionsUsed(
                request.promptVersionsUsed
              )}
            />
            {request.dryRun && (
              <span
                className="inline-flex rounded-md bg-amber-500/15 px-2 py-0.5 font-medium font-sans-display text-[11px] text-amber-700 dark:bg-amber-400/15 dark:text-amber-300"
                title="This request was created by a dry-run replay (mocked Gemini responses)."
              >
                DRY-RUN
              </span>
            )}
            <ReplayButton requestId={request.id} />
            <ReplayButton dryRun requestId={request.id} />
          </div>
        </div>

        <dl className="mt-4 grid grid-cols-2 gap-x-6 gap-y-2 font-sans-display text-sm sm:grid-cols-4">
          <div className="min-w-0">
            <dt className="text-nham-text-muted text-xs">User</dt>
            <dd className="truncate font-mono text-nham-text">
              {request.userId ?? '—'}
            </dd>
          </div>
          <div>
            <dt className="text-nham-text-muted text-xs">Duration</dt>
            <dd className="text-nham-text tabular-nums">
              {request.durationMs ?? '—'} ms
            </dd>
          </div>
          <div>
            <dt className="text-nham-text-muted text-xs">Triggered at</dt>
            <dd className="text-nham-text tabular-nums">
              {formatUtcTimestamp(request.createdAt)}
            </dd>
          </div>
          {request.replayOfRequestId && (
            <div>
              <dt className="text-nham-text-muted text-xs">Replay of</dt>
              <dd>
                <Link
                  href={`/admin/requests/${request.replayOfRequestId}`}
                  className="font-mono text-nham-accent text-xs hover:underline"
                >
                  {request.replayOfRequestId.slice(0, 8)}…
                </Link>
              </dd>
            </div>
          )}
        </dl>

        {/* Compare controls */}
        {isCompare ? (
          <div className="mt-3 flex items-center gap-2 rounded-md bg-nham-track/50 px-3 py-2 font-sans-display text-nham-text text-sm">
            <span>Comparing with</span>
            <Link
              href={`/admin/requests/${compareId}`}
              className="font-mono text-nham-accent text-xs hover:underline"
            >
              {compareId}
            </Link>
            <Link
              href={`/admin/requests/${id}`}
              className="ml-auto text-nham-text-muted text-xs hover:underline"
            >
              Exit compare
            </Link>
          </div>
        ) : null}
      </div>

      {/* Compare mode is inherently a side-by-side raw view, so it bypasses the
          Summary / Raw-trace tabs and renders both timelines directly. */}
      {isCompare ? (
        <>
          <PipelineSummary
            request={detail.request}
            stageLogs={detail.stageLogs}
            llmCalls={detail.llmCalls}
          />
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <div>
              <p className="mb-2 font-semibold text-nham-text text-sm">
                {id.slice(0, 8)}… (primary)
              </p>
              <StageTimeline stages={left} />
            </div>
            <div>
              <p className="mb-2 font-semibold text-nham-text text-sm">
                {compareId?.slice(0, 8)}… (compare)
              </p>
              <StageTimeline stages={right} />
            </div>
          </div>
        </>
      ) : (
        <RequestDetailTabs
          rawTrace={<StageTimeline stages={left} />}
          summary={
            <PipelineSummary
              request={detail.request}
              stageLogs={detail.stageLogs}
              llmCalls={detail.llmCalls}
            />
          }
        />
      )}
    </div>
  );
}
