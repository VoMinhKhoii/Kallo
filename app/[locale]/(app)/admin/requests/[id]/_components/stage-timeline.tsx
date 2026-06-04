import type { InferSelectModel } from 'drizzle-orm';
import type { RequestDetailLlmCall } from '@/lib/admin/queries';
import type { pipelineLlmCalls, pipelineStageLogs } from '@/lib/db/schema';
import { cn } from '@/lib/utils';
import {
  type CompareLabel as StatusCompareLabel,
  compareLabelClass,
  statusToneClass,
} from '../../../_components/status-badge';
import { JsonViewer } from './json-viewer';

type StageLog = InferSelectModel<typeof pipelineStageLogs>;
type BaseLlmCall = InferSelectModel<typeof pipelineLlmCalls>;
type LlmCall = BaseLlmCall | RequestDetailLlmCall;

type MetadataItem = {
  label: string;
  value: number | string | null | undefined;
  unit?: 'chars' | 'tokens';
};

export type CompareLabel = StatusCompareLabel;

export interface StageWithCalls {
  stage: StageLog;
  calls: LlmCall[];
  compareLabel?: CompareLabel;
}

interface StageTimelineProps {
  stages: StageWithCalls[];
}

export function StageTimeline({ stages }: StageTimelineProps) {
  if (stages.length === 0) {
    return (
      <p className="py-4 text-center text-nham-text-muted text-sm">
        No stage logs recorded.
      </p>
    );
  }

  return (
    <ol className="space-y-3 font-sans-display">
      {stages.map(({ stage, calls, compareLabel }) => (
        <li
          key={stage.id}
          className="rounded-lg border border-nham-border/60 bg-white/50 dark:bg-white/[0.02]"
        >
          {/* Stage header */}
          <div className="flex flex-wrap items-center gap-2 border-nham-border/60 border-b px-4 py-2">
            <span className="font-mono text-nham-text-muted text-xs">
              #{stage.stageIndex}
            </span>
            <span className="font-semibold text-nham-text capitalize">
              {stage.stage}
            </span>

            <span
              className={cn(
                'inline-flex rounded-md px-1.5 py-0.5 font-medium text-xs capitalize',
                statusToneClass(stage.status)
              )}
            >
              {stage.status}
            </span>

            <span className="text-nham-text-muted text-xs tabular-nums">
              {stage.durationMs} ms
            </span>

            {compareLabel && (
              <span
                className={cn(
                  'ml-auto inline-flex rounded-md px-1.5 py-0.5 font-medium text-xs',
                  compareLabelClass(compareLabel)
                )}
              >
                {compareLabel}
              </span>
            )}
          </div>

          {/* Stage body */}
          <div className="space-y-2 p-4">
            {stage.error && (
              <div className="rounded-md border border-nham-danger/40 bg-nham-danger/10 p-2 font-mono text-nham-danger text-xs">
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
                <p className="font-medium text-nham-text-muted text-xs uppercase tracking-wide">
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
    <div className="rounded-md border border-nham-border/50 bg-nham-track/40 text-xs">
      {/* Call header */}
      <div className="flex flex-wrap items-center gap-2 border-nham-border/50 border-b px-3 py-1.5">
        <span className="font-medium text-nham-text-muted">
          Call {index + 1}
        </span>
        <span className="font-mono text-nham-text">{call.model}</span>
        {call.attempt > 1 ? (
          <span className="rounded bg-amber-500/15 px-1 py-0.5 text-amber-700 dark:bg-amber-400/15 dark:text-amber-300">
            attempt {call.attempt}
          </span>
        ) : null}
        <span className="text-nham-text-muted tabular-nums">
          {call.latencyMs} ms
        </span>
        {totalTokens > 0 ? (
          <span className="text-nham-text-muted tabular-nums">
            {call.inputTokens ?? 0} in / {call.outputTokens ?? 0} out tokens
          </span>
        ) : null}
        {metadataItems.length > 0 ? (
          <MetadataChips items={metadataItems} />
        ) : null}
        {call.error ? (
          <span className="ml-auto rounded bg-nham-danger/15 px-1.5 py-0.5 text-nham-danger">
            error
          </span>
        ) : null}
      </div>

      {/* Call body */}
      <div className="space-y-1.5 p-3">
        {call.error ? (
          <div className="rounded-md border border-nham-danger/40 bg-nham-danger/10 p-1.5 font-mono text-nham-danger">
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
          className="rounded bg-nham-surface px-1.5 py-0.5 text-nham-text-muted tabular-nums"
          key={item.label}
        >
          <span className="font-medium text-nham-text">{item.label}</span>{' '}
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
