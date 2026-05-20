/**
 * Pipeline-version badge for the admin requests/[id] page header.
 *
 * Distinguishes v1 vs v2 runs by inspecting `pipelineRequests.promptVersionsUsed`:
 *   - v2 (grounded): prompt keys include `decomposition-grounded` and/or
 *     `grounded-estimation` (set by buildLlmStageTrace inside the
 *     grounded-orchestrator).
 *   - v1 (legacy): prompt keys are `decomposition` / `nutrition`.
 *   - unknown: PIPELINE_TRACE_ENABLED was false, or trace context absent.
 *
 * No DB migration needed — the signal already lives in the existing JSONB
 * column that v1 populates today.
 */
import type { ReactNode } from 'react';

interface Props {
  promptVersionsUsed: Record<string, string> | null | undefined;
}

type Version = 'v2' | 'v1' | 'unknown';

function classify(
  promptVersionsUsed: Record<string, string> | null | undefined
): Version {
  if (!promptVersionsUsed || Object.keys(promptVersionsUsed).length === 0) {
    return 'unknown';
  }
  const keys = Object.keys(promptVersionsUsed);
  if (
    keys.includes('decomposition-grounded') ||
    keys.includes('grounded-estimation')
  ) {
    return 'v2';
  }
  return 'v1';
}

const STYLES: Record<Version, { bg: string; label: string; title: string }> = {
  v2: {
    bg: 'bg-emerald-100 text-emerald-900 dark:bg-emerald-900/30 dark:text-emerald-200',
    label: 'V2',
    title:
      'Pipeline v2 — pure-decompose Call 1, CRAG-grounded Call 2 with verdict + grams + macros.',
  },
  v1: {
    bg: 'bg-slate-100 text-slate-900 dark:bg-slate-700/40 dark:text-slate-200',
    label: 'V1',
    title:
      'Pipeline v1 (legacy) — decomposition emits grams, nutrition adjusts fat only.',
  },
  unknown: {
    bg: 'bg-muted text-muted-foreground',
    label: 'PIPELINE: ?',
    title:
      'No prompt versions recorded. Either PIPELINE_TRACE_ENABLED=false or trace context was absent for this request.',
  },
};

export function PipelineVersionBadge({ promptVersionsUsed }: Props): ReactNode {
  const v = classify(promptVersionsUsed);
  const s = STYLES[v];
  return (
    <span
      className={`inline-flex rounded px-2 py-1 font-medium text-xs ${s.bg}`}
      title={s.title}
    >
      {s.label}
    </span>
  );
}
