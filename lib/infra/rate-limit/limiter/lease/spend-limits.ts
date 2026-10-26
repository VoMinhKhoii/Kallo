/**
 * The app-wide AI spend brake. DATA ONLY, and no env overrides — the same
 * rule as `policies.ts`: a ceiling an environment variable can move is one
 * nobody can reason about from the code.
 *
 * $10 a UTC day across every paid AI call. A normal day costs well under $1
 * (about $0.005 a meal), so this only ever trips on an attack or a bug — and
 * when it does, every AI call is refused until the next UTC day.
 */
export const AI_SPEND_DAILY_LIMIT_USD = 10;

/**
 * What a call reserves before it runs, swapped for its real cost when it
 * ends. Sized so a call almost never costs more than it reserved: a meal is
 * about $0.005 on average, and $0.03 covers a big one with rescue runs and
 * split Call 2s. A call that dies before settling keeps its estimate counted.
 */
export const aiSpendEstimatesUsd = {
  /** `/api/analyze-meal`, cheat mode included; dish rescue runs inside it. */
  meal: 0.03,
  /** Nutrition-label OCR, web action and REST route alike. */
  labelOcr: 0.01,
  /** A legacy shadow candidate run. */
  shadow: 0.03,
  /** `/api/analyze-meal/debug`. */
  debug: 0.05,
  /** The admin pipeline replay's live run. */
  replay: 0.05,
} as const;

export type AiSpendKind = keyof typeof aiSpendEstimatesUsd;
