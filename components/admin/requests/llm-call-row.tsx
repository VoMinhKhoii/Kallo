import type { InferSelectModel } from 'drizzle-orm';
import type { TimelineLlmCall } from '@/lib/admin/diagnostics/request-trace';
import type { RequestDetailLlmCall } from '@/lib/admin/queries/requests';
import type { pipelineLlmCalls } from '@/lib/infra/db/schema';
import { JsonViewer } from './json-viewer';

type BaseLlmCall = InferSelectModel<typeof pipelineLlmCalls>;

type MetadataItem = {
  label: string;
  value: number | string | null | undefined;
  unit?: 'chars' | 'tokens';
};

/** One LLM call nested under its stage: header chips plus prompt/response. */
export function LlmCallRow({
  call,
  index,
}: {
  call: TimelineLlmCall;
  index: number;
}) {
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
