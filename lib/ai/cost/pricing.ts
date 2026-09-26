import type { AttemptTokens } from '@/lib/ai/provider/provider';

/**
 * Live per-1M-token USD rates for the models we call, and the one function
 * that turns recorded token usage into dollars.
 *
 * Source: https://ai.google.dev/gemini-api/docs/pricing (paid tier, text
 * input), read 2026-09-25. Vertex bills the same list rates for these models.
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

export const RATES_AS_OF = '2026-09-25';

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
};

/** One attempt's token counts and the model that produced them. */
export interface TokenUsage extends AttemptTokens {
  model: string;
}

/** USD for one call, or null when the model has no rate on file. */
export function costUsd(usage: TokenUsage): number | null {
  const rate = MODEL_RATES[usage.model];
  if (!rate) return null;
  const input = usage.inputTokens ?? 0;
  const cached = Math.min(usage.cachedTokens ?? 0, input);
  const output = (usage.outputTokens ?? 0) + (usage.thoughtTokens ?? 0);
  return (
    ((input - cached) * rate.inputPerMTokUsd +
      cached * rate.cachedInputPerMTokUsd +
      output * rate.outputPerMTokUsd) /
    1_000_000
  );
}
