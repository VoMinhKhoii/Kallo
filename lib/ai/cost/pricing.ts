/**
 * Live per-1M-token USD rates for the models we call.
 *
 * Sources: https://ai.google.dev/gemini-api/docs/pricing (paid tier, text
 * input), read 2026-09-25 — Vertex bills the same list rates for these
 * models; https://platform.claude.com/docs/en/about-claude/pricing, read
 * 2026-10-10 (Claude: prompts up to 100k tokens; a 5-minute cache write bills
 * 1.25x input — `CACHE_WRITE_INPUT_MULTIPLIER`, not a field here).
 * Re-check the page when a model is added or a cost number looks wrong — a
 * stale rate silently skews every cost report built on this file.
 */
export interface ModelRate {
  inputPerMTokUsd: number;
  /** Rate for prompt tokens served from the (implicit or explicit) cache. */
  cachedInputPerMTokUsd: number;
  /** Rate for response tokens, thinking tokens included. */
  outputPerMTokUsd: number;
}

export const MODEL_RATES: Record<string, ModelRate> = {
  'gemini-3.1-flash-lite': {
    inputPerMTokUsd: 0.25,
    cachedInputPerMTokUsd: 0.025,
    outputPerMTokUsd: 1.5,
  },
  // Google's named replacement for 3.1-flash-lite (shutdown 2027-05-07).
  'gemini-3.5-flash-lite': {
    inputPerMTokUsd: 0.3,
    cachedInputPerMTokUsd: 0.03,
    outputPerMTokUsd: 2.5,
  },
  'gemini-3.6-flash': {
    inputPerMTokUsd: 0.75,
    cachedInputPerMTokUsd: 0.075,
    outputPerMTokUsd: 3.75,
  },
  'gemini-3-flash-preview': {
    inputPerMTokUsd: 0.5,
    cachedInputPerMTokUsd: 0.05,
    outputPerMTokUsd: 3.0,
  },
  'gemini-2.5-flash-lite': {
    inputPerMTokUsd: 0.1,
    cachedInputPerMTokUsd: 0.01,
    outputPerMTokUsd: 0.4,
  },
  'gemini-2.5-flash': {
    inputPerMTokUsd: 0.3,
    cachedInputPerMTokUsd: 0.03,
    outputPerMTokUsd: 2.5,
  },
  'claude-haiku-5-5': {
    inputPerMTokUsd: 0.1,
    cachedInputPerMTokUsd: 0.01,
    outputPerMTokUsd: 0.5,
  },
};

/**
 * Claude bills prompt tokens written to its 5-minute cache at 1.25x input.
 * Gemini's implicit cache has no write charge, so its attempts report 0.
 */
export const CACHE_WRITE_INPUT_MULTIPLIER = 1.25;

/** The token counts one attempt was billed for, as the budget row stores them. */
export interface BilledTokens {
  /** Every prompt token, cached reads and cache writes included. */
  inputTokens: number;
  /** Part of `inputTokens` read from the cache. */
  cachedTokens: number;
  /** Part of `inputTokens` written to the cache. */
  cacheWriteTokens: number;
  outputTokens: number;
  /** Billed at the output rate, on top of `outputTokens`. */
  thoughtTokens: number;
}

/** USD for one attempt, or null for a model missing from the rate card. */
export function attemptCostUsd(
  model: string,
  tokens: BilledTokens
): number | null {
  const rate = MODEL_RATES[model];
  if (!rate) return null;
  const { inputTokens, cachedTokens, cacheWriteTokens } = tokens;
  const freshInput = Math.max(0, inputTokens - cachedTokens - cacheWriteTokens);
  return (
    (freshInput * rate.inputPerMTokUsd +
      cachedTokens * rate.cachedInputPerMTokUsd +
      cacheWriteTokens * rate.inputPerMTokUsd * CACHE_WRITE_INPUT_MULTIPLIER +
      (tokens.outputTokens + tokens.thoughtTokens) * rate.outputPerMTokUsd) /
    1e6
  );
}
