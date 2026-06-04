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

const V2_MARKER_KEYS = ['decomposition-grounded', 'grounded-estimation'];
const V1_MARKER_KEYS = ['decomposition', 'nutrition'];

function classify(
  promptVersionsUsed: Record<string, string> | null | undefined
): Version {
  if (!promptVersionsUsed || Object.keys(promptVersionsUsed).length === 0) {
    return 'unknown';
  }
  const keys = Object.keys(promptVersionsUsed);
  if (V2_MARKER_KEYS.some((k) => keys.includes(k))) return 'v2';
  if (V1_MARKER_KEYS.some((k) => keys.includes(k))) return 'v1';
  // Future / partial trace formats fall through to 'unknown' rather than
  // being mislabeled as v1.
  return 'unknown';
}

const STYLES: Record<Version, { bg: string; label: string; title: string }> = {
  v2: {
    bg: 'bg-nham-success/15 text-nham-success dark:bg-nham-success/20',
    label: 'V2',
    title:
      'Pipeline v2 — pure-decompose Call 1, CRAG-grounded Call 2 with verdict + grams + macros.',
  },
  v1: {
    bg: 'bg-nham-accent/20 text-nham-text dark:bg-nham-accent/25',
    label: 'V1',
    title:
      'Pipeline v1 (legacy) — decomposition emits grams, nutrition adjusts fat only.',
  },
  unknown: {
    bg: 'bg-nham-hover text-nham-text-muted',
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
      className={`inline-flex rounded-md px-2 py-0.5 font-medium font-sans-display text-[11px] ${s.bg}`}
      title={s.title}
    >
      {s.label}
    </span>
  );
}
