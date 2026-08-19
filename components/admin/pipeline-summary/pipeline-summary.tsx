import { AlertTriangle } from 'lucide-react';
import { derivePipelineDiagnostics } from '@/lib/admin/diagnostics/pipeline-diagnostics';
import type {
  LlmCall,
  RequestRow,
  StageLog,
} from '@/lib/admin/diagnostics/types';
import { formatLanguagePair } from './language-chips';
import { StageList } from './stage-list';
import { Metric } from './stage-primitives';

interface PipelineSummaryProps {
  request: RequestRow;
  stageLogs: StageLog[];
  llmCalls: LlmCall[];
}

export function PipelineSummary({
  request,
  stageLogs,
  llmCalls,
}: PipelineSummaryProps) {
  if (stageLogs.length === 0) {
    return (
      <div className="rounded-lg border border-dashed bg-muted/20 p-4 text-muted-foreground text-sm">
        No pipeline trace recorded for this request. Enable{' '}
        <code className="rounded bg-muted px-1 py-0.5 text-xs">
          PIPELINE_TRACE_ENABLED
        </code>{' '}
        to capture stage logs.
      </div>
    );
  }

  const diagnostics = derivePipelineDiagnostics(stageLogs, llmCalls);
  const {
    languageMetadata,
    matchedCount,
    matchRate,
    totalIngredients,
    totalTokens,
    unmatched,
    erroredStage,
  } = diagnostics;

  return (
    <section
      aria-label="Pipeline summary"
      className="rounded-lg border bg-card"
    >
      {/* Header strip */}
      <div className="flex flex-wrap items-baseline gap-x-6 gap-y-2 border-b px-5 py-3">
        <div className="flex items-baseline gap-2">
          <span className="font-semibold text-sm">Pipeline</span>
          <span className="text-muted-foreground text-xs">
            {stageLogs.length} stages · {llmCalls.length} LLM calls
          </span>
        </div>
        <Metric label="Duration" value={`${request.durationMs ?? '—'} ms`} />
        <Metric
          label="Tokens"
          value={totalTokens > 0 ? totalTokens.toLocaleString() : '—'}
        />
        <Metric
          label="Matched"
          value={
            totalIngredients > 0
              ? `${matchedCount}/${totalIngredients}`
              : `${matchedCount}`
          }
          tone={
            matchRate === null
              ? 'neutral'
              : matchRate >= 0.9
                ? 'good'
                : matchRate >= 0.6
                  ? 'warn'
                  : 'bad'
          }
        />
        <Metric
          label="Unmatched"
          value={String(unmatched.length)}
          tone={unmatched.length === 0 ? 'good' : 'warn'}
        />
        {languageMetadata ? (
          <Metric
            label="Language"
            value={formatLanguagePair(languageMetadata)}
            tone={
              languageMetadata.guardPassed
                ? languageMetadata.retryCount > 0
                  ? 'warn'
                  : 'neutral'
                : 'bad'
            }
          />
        ) : null}
      </div>

      {/* Error banner — always points to the failing stage */}
      {erroredStage && (
        <div className="flex items-start gap-2 border-b bg-red-50 px-5 py-3 text-red-900 text-sm dark:bg-red-950/30 dark:text-red-200">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
          <div className="space-y-0.5">
            <p className="font-medium">
              Failed at <span className="capitalize">{erroredStage.stage}</span>
            </p>
            {erroredStage.error && (
              <p className="font-mono text-xs opacity-80">
                {erroredStage.error}
              </p>
            )}
          </div>
        </div>
      )}

      {/* Pipeline body — 4 stages on a vertical rail */}
      <div className="relative px-5 py-5">
        {/* Vertical rail: 1px neutral; status dots align to it */}
        <div
          className="absolute top-6 bottom-6 left-[27px] w-px bg-border"
          aria-hidden
        />
        <StageList diagnostics={diagnostics} rawInput={request.rawInput} />
      </div>
    </section>
  );
}
