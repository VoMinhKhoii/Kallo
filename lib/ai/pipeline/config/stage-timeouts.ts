/**
 * Per-stage Gemini timeout (ms).
 *
 * Phase B baseline (2026-05-08) showed:
 *   - decomposition cold p95: 10707 ms (lightweight prompt, smaller output)
 *   - nutrition cold p95:     24377 ms (full-meal output, more variance)
 *
 * A single ceiling either aborts legitimate slow nutrition runs (too tight)
 * or wastes ~10 s of recovery time when decomposition genuinely hangs (too
 * loose). Splitting the budget gives each stage a value derived from its
 * own observed p95 + headroom.
 *
 * Defaults:
 *   - decomposition: 20 s  (≈ p95 × 1.9, leaves room for transient 5xx)
 *   - nutrition:     30 s  (≈ p95 × 1.25, the realistic worst case)
 *
 * `LLM_TIMEOUT_MS` is honoured as a global fallback for both when set; the
 * stage-specific envs override it when present.
 */
function readStageTimeoutMs(envKey: string, fallbackMs: number): number {
  const raw = process.env[envKey] ?? process.env.LLM_TIMEOUT_MS;
  if (!raw) return fallbackMs;
  const parsed = Number(raw);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallbackMs;
}

export const DECOMPOSITION_TIMEOUT_MS = readStageTimeoutMs(
  'PIPELINE_DECOMPOSITION_TIMEOUT_MS',
  20_000
);
export const NUTRITION_TIMEOUT_MS = readStageTimeoutMs(
  'PIPELINE_NUTRITION_TIMEOUT_MS',
  30_000
);
