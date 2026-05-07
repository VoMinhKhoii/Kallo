import type { InferSelectModel } from 'drizzle-orm';
import type { RequestDetailLlmCall } from '@/lib/admin/queries';
import type { pipelineLlmCalls, pipelineStageLogs } from '@/lib/db/schema';
import { cn } from '@/lib/utils';
import { JsonViewer } from './json-viewer';

type StageLog = InferSelectModel<typeof pipelineStageLogs>;
type BaseLlmCall = InferSelectModel<typeof pipelineLlmCalls>;
type LlmCall = BaseLlmCall | RequestDetailLlmCall;

type MetadataItem = {
  label: string;
  value: number | string | null | undefined;
  unit?: 'chars' | 'tokens';
};

export type CompareLabel = 'unchanged' | 'changed' | 'only-here';

export interface StageWithCalls {
  stage: StageLog;
  calls: LlmCall[];
  compareLabel?: CompareLabel;
}

interface StageTimelineProps {
  stages: StageWithCalls[];
}

const STAGE_STATUS_STYLES: Record<string, string> = {
  success:
    'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
  error: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
  skipped: 'bg-gray-100 text-gray-600 dark:bg-gray-800/50 dark:text-gray-400',
};

const COMPARE_LABEL_STYLES: Record<CompareLabel, string> = {
  unchanged: 'bg-blue-50 text-blue-700 dark:bg-blue-900/20 dark:text-blue-400',
  changed:
    'bg-orange-50 text-orange-700 dark:bg-orange-900/20 dark:text-orange-400',
  'only-here':
    'bg-purple-50 text-purple-700 dark:bg-purple-900/20 dark:text-purple-400',
};

export function StageTimeline({ stages }: StageTimelineProps) {
  if (stages.length === 0) {
    return (
      <p className="py-4 text-center text-muted-foreground text-sm">
        No stage logs recorded.
      </p>
    );
  }

  return (
    <ol className="space-y-3">
      {stages.map(({ stage, calls, compareLabel }) => (
        <li key={stage.id} className="rounded-lg border bg-card">
          {/* Stage header */}
          <div className="flex flex-wrap items-center gap-2 border-b px-4 py-2">
            <span className="font-mono text-muted-foreground text-xs">
              #{stage.stageIndex}
            </span>
            <span className="font-semibold capitalize">{stage.stage}</span>

            <span
              className={cn(
                'inline-flex rounded px-1.5 py-0.5 font-medium text-xs',
                STAGE_STATUS_STYLES[stage.status] ??
                  'bg-muted text-muted-foreground'
              )}
            >
              {stage.status}
            </span>

            <span className="text-muted-foreground text-xs tabular-nums">
              {stage.durationMs} ms
            </span>

            {compareLabel && (
              <span
                className={cn(
                  'ml-auto inline-flex rounded px-1.5 py-0.5 font-medium text-xs',
                  COMPARE_LABEL_STYLES[compareLabel]
                )}
              >
                {compareLabel}
              </span>
            )}
          </div>

          {/* Stage body */}
          <div className="space-y-2 p-4">
            {stage.error && (
              <div className="rounded border border-red-200 bg-red-50 p-2 font-mono text-red-700 text-xs dark:border-red-900 dark:bg-red-950/40 dark:text-red-400">
                {stage.error}
              </div>
            )}

            <JsonViewer label="Input" value={stage.inputJson} />
            <JsonViewer
              label="Output"
              value={stage.outputJson}
              defaultOpen={stage.status === 'success'}
            />

            {/* LLM calls nested under this stage */}
            {calls.length > 0 && (
              <div className="mt-3 space-y-2">
                <p className="font-medium text-muted-foreground text-xs uppercase tracking-wide">
                  LLM Calls ({calls.length})
                </p>
                {calls.map((call, idx) => (
                  <LlmCallRow key={call.id} call={call} index={idx} />
                ))}
              </div>
            )}
          </div>
        </li>
      ))}
    </ol>
  );
}

function LlmCallRow({ call, index }: { call: LlmCall; index: number }) {
  const totalTokens = (call.inputTokens ?? 0) + (call.outputTokens ?? 0);
  const metadata = 'metadata' in call ? call.metadata : null;
  const metadataItems = getVisibleMetadataItems(call, metadata);

  return (
    <div className="rounded border bg-muted/20 text-xs">
      {/* Call header */}
      <div className="flex flex-wrap items-center gap-2 border-b px-3 py-1.5">
        <span className="font-medium text-muted-foreground">
          Call {index + 1}
        </span>
        <span className="font-mono">{call.model}</span>
        {call.attempt > 1 ? (
          <span className="rounded bg-yellow-100 px-1 py-0.5 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400">
            attempt {call.attempt}
          </span>
        ) : null}
        <span className="text-muted-foreground tabular-nums">
          {call.latencyMs} ms
        </span>
        {totalTokens > 0 ? (
          <span className="text-muted-foreground tabular-nums">
            {call.inputTokens ?? 0} in / {call.outputTokens ?? 0} out tokens
          </span>
        ) : null}
        {metadataItems.length > 0 ? (
          <MetadataChips items={metadataItems} />
        ) : null}
        {call.error ? (
          <span className="ml-auto rounded bg-red-100 px-1.5 py-0.5 text-red-700 dark:bg-red-900/30 dark:text-red-400">
            error
          </span>
        ) : null}
      </div>

      {/* Call body */}
      <div className="space-y-1.5 p-3">
        {call.error ? (
          <div className="rounded border border-red-200 bg-red-50 p-1.5 font-mono text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-400">
            {call.error}
          </div>
        ) : null}
        <JsonViewer label="Prompt" value={call.promptRendered} />
        <JsonViewer label="Response" value={call.responseRaw} />
      </div>
    </div>
  );
}

function getVisibleMetadataItems(
  call: BaseLlmCall,
  metadata: RequestDetailLlmCall['metadata'] | null
): MetadataItem[] {
  if (!metadata) return [];

  const items: MetadataItem[] = [
    { label: 'Provider', value: metadata.provider },
    { label: 'Region', value: metadata.region },
    { label: 'Cache', value: metadata.cacheStatus },
    {
      label: 'Input',
      value:
        metadata.inputTokens !== call.inputTokens ? metadata.inputTokens : null,
      unit: 'tokens',
    },
    {
      label: 'Output',
      value:
        metadata.outputTokens !== call.outputTokens
          ? metadata.outputTokens
          : null,
      unit: 'tokens',
    },
    { label: 'Cached', value: metadata.cachedTokens, unit: 'tokens' },
    { label: 'Thought', value: metadata.thoughtTokens, unit: 'tokens' },
    { label: 'Prompt', value: metadata.promptChars, unit: 'chars' },
    { label: 'Schema', value: metadata.schemaChars, unit: 'chars' },
  ];
  return items.filter(
    (item) => item.value !== null && item.value !== undefined
  );
}

function MetadataChips({ items }: { items: MetadataItem[] }) {
  return (
    <div className="flex min-w-0 flex-wrap items-center gap-1.5">
      {items.map((item) => (
        <span
          className="rounded bg-background px-1.5 py-0.5 text-muted-foreground tabular-nums"
          key={item.label}
        >
          <span className="font-medium text-foreground">{item.label}</span>{' '}
          {formatMetadataValue(item)}
        </span>
      ))}
    </div>
  );
}

function formatMetadataValue(item: MetadataItem): string {
  if (item.unit === 'chars') return `${item.value} chars`;
  if (item.unit === 'tokens') return `${item.value} tokens`;
  return String(item.value);
}
