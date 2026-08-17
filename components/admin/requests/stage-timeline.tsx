import type {
  CompareLabel,
  StageWithCalls,
} from '@/lib/admin/diagnostics/request-trace';
import { cn } from '@/lib/core/ui/cn';
import { JsonViewer } from './json-viewer';
import { LlmCallRow } from './llm-call-row';

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
