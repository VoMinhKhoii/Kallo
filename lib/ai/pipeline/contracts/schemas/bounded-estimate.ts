import { z } from 'zod';

/**
 * Bounded estimate shape — used for both JSON schema generation and runtime
 * parsing. Note: Gemini's responseJsonSchema cannot include transforms, so
 * we use a plain object schema for JSON schema generation and normalize
 * after parsing.
 */
export const boundedEstimateSchema = z.object({
  low: z.number().min(0).describe('Conservative lower bound'),
  mid: z
    .number()
    .min(0)
    .describe(
      'Most likely estimate. For DB-matched ingredients the server overrides this with the DB-anchored base.'
    ),
  high: z.number().min(0).describe('Conservative upper bound'),
});

/**
 * Normalize a bounded estimate: re-sort if ordering is violated.
 * Logs the original values when re-sorting occurs for observability.
 */
export function normalizeBoundedEstimate(raw: {
  low: number;
  mid: number;
  high: number;
}): { low: number; mid: number; high: number } {
  if (raw.low <= raw.mid && raw.mid <= raw.high) {
    return raw;
  }

  const sorted = [raw.low, raw.mid, raw.high].sort((a, b) => a - b);
  console.warn(
    `[ai/schemas] Re-sorted bounded estimate: {low:${raw.low}, mid:${raw.mid}, high:${raw.high}} → {low:${sorted[0]}, mid:${sorted[1]}, high:${sorted[2]}}`
  );
  return { low: sorted[0], mid: sorted[1], high: sorted[2] };
}
