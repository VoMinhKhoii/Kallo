import type { FuzzyMatchRow } from '@/lib/ai/matching/match-constants';

export interface RrfCandidate {
  canonicalName: string;
  source: 'fao' | 'usda';
  similarity: number;
  state: 'raw' | 'cooked' | 'unknown';
}

export interface RrfCaptureInput {
  vectorRowsFao: FuzzyMatchRow[];
  vectorRowsUsda: FuzzyMatchRow[];
  fuzzyRowsFao: FuzzyMatchRow[];
  fuzzyRowsUsda: FuzzyMatchRow[];
  topK: number;
}

export interface RrfCaptureOutput {
  vectorTop: RrfCandidate[];
  fuzzyTop: RrfCandidate[];
  topVectorEqualsTopFuzzy: boolean;
}

export interface RrfMeasurement {
  topVectorEqualsTopFuzzy: boolean;
  latencyMs: number;
}

function normalizeState(raw: string): RrfCandidate['state'] {
  if (raw === 'raw' || raw === 'cooked') return raw;
  return 'unknown';
}

function tag(
  rows: FuzzyMatchRow[],
  source: RrfCandidate['source']
): RrfCandidate[] {
  return rows.map((row) => ({
    canonicalName: row.name_primary,
    source,
    similarity: row.similarity,
    state: normalizeState(row.state),
  }));
}

function mergeAndTruncate(
  fao: RrfCandidate[],
  usda: RrfCandidate[],
  topK: number
): RrfCandidate[] {
  return [...fao, ...usda]
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, topK);
}

export function captureRrfCandidates(input: RrfCaptureInput): RrfCaptureOutput {
  const vectorTop = mergeAndTruncate(
    tag(input.vectorRowsFao, 'fao'),
    tag(input.vectorRowsUsda, 'usda'),
    input.topK
  );
  const fuzzyTop = mergeAndTruncate(
    tag(input.fuzzyRowsFao, 'fao'),
    tag(input.fuzzyRowsUsda, 'usda'),
    input.topK
  );
  const topVectorEqualsTopFuzzy =
    vectorTop.length > 0 &&
    fuzzyTop.length > 0 &&
    vectorTop[0].canonicalName === fuzzyTop[0].canonicalName &&
    vectorTop[0].source === fuzzyTop[0].source;

  return { vectorTop, fuzzyTop, topVectorEqualsTopFuzzy };
}

/**
 * Capture one sampled comparison of the vector and fuzzy arms and append it to
 * the run's measurement list. Measurement only — nothing here feeds the match
 * decision.
 */
export function pushRrfMeasurement(args: {
  rrfMeasurements: RrfMeasurement[] | undefined;
  ingredientName: string;
  vectorRowsFao: FuzzyMatchRow[];
  vectorRowsUsda: FuzzyMatchRow[];
  fuzzyRowsFao: FuzzyMatchRow[];
  fuzzyRowsUsda: FuzzyMatchRow[];
  latencyMs: number;
}) {
  const captured = captureRrfCandidates({
    vectorRowsFao: args.vectorRowsFao,
    vectorRowsUsda: args.vectorRowsUsda,
    fuzzyRowsFao: args.fuzzyRowsFao,
    fuzzyRowsUsda: args.fuzzyRowsUsda,
    topK: 3,
  });
  args.rrfMeasurements?.push({
    topVectorEqualsTopFuzzy: captured.topVectorEqualsTopFuzzy,
    latencyMs: args.latencyMs,
  });
}
