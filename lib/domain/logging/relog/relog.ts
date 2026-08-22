// Shared types and pure helpers for deterministic relog: the user types `/` in
// the composer, picks a dish (or a whole meal) they have logged before, and the
// server copies the stored `meal_items` rows verbatim — no AI pipeline, no
// re-estimation. Imported by both web client code and server routes/actions, so
// this module must stay pure (no server-only or browser-only imports).
//
// Why verbatim rather than recompute: `meals`/`meal_items` store GOAL-ADJUSTED
// macros and carry no goal/aggression snapshot, so a past dish's accepted
// numbers cannot be re-derived. Same reasoning as `duplicateMealAction`.
import type { IngredientMacrosPer100g } from '@/lib/domain/logging/manual-logging';

/** How far back the picker looks. Longer than the 90-day "recent foods" window
 *  (which is pure recency); our score already decays, so this is only a scan
 *  cap — and seasonal staples like bánh chưng shouldn't vanish. */
export const RELOG_LOOKBACK_DAYS = 365;
export const RELOG_SEARCH_LIMIT = 8;
/** Cap on dishes in one relog write, applied AFTER meal refs expand. 20 staged
 *  meals of 15 dishes each would otherwise be one 300-dish insert. */
export const RELOG_MAX_DISHES = 30;
/** Cap on INGREDIENT ROWS in one relog write. [RELOG_MAX_DISHES] counts groups
 *  (rows sharing `meal_item_order`), but the writer inserts one row per
 *  ingredient — so a few ingredient-heavy meals can satisfy the dish cap and
 *  still be a several-hundred-row insert. Sized well above any real meal:
 *  30 dishes of 10 ingredients is already far past what a person logs. */
export const RELOG_MAX_ROWS = 300;
/** Max staged entries before expansion — mirrors the Zod contract. */
export const RELOG_MAX_STAGED = 20;

// ---------------------------------------------------------------------------
// Candidates (what the picker lists)
// ---------------------------------------------------------------------------

/** Macro summary carried on every candidate so the picker subtitle and the
 *  staged running total render without a second round-trip. These are SUMs of
 *  the stored (already goal-adjusted) row values, so they equal what
 *  `buildPersistedMealItemGroup` computes on read — the numbers agree by
 *  construction rather than by convention. */
export interface RelogMacroSummary {
  totalGrams: number | null;
  caloriesKcal: number | null;
  proteinG: number | null;
  carbohydrateG: number | null;
  fatG: number | null;
}

/** One past dish (a `meal_items` group sharing `meal_item_order`+`meal_item_name`),
 *  deduplicated across history by its case-folded name. */
export interface RelogDishCandidate extends RelogMacroSummary {
  kind: 'dish';
  /** Payload identity: the most recent occurrence of this dish. */
  sourceMealId: string;
  mealItemOrder: number;
  /** Display name, taken from the most recent occurrence. */
  name: string;
  /** How many ingredient rows the dish decomposes into. */
  ingredientCount: number;
  /** Times this dish appears in the lookback window — drives the ranking. */
  occurrenceCount: number;
  lastLoggedAt: string;
}

/** One past meal, deduplicated by its case-folded `raw_input`. Weaker dedup
 *  than a dish name (raw_input is free text), which is why dishes list first. */
export interface RelogMealCandidate extends RelogMacroSummary {
  kind: 'meal';
  sourceMealId: string;
  /** The meal's original text, shown as the row label. */
  name: string;
  /** How many dishes this meal expands into when picked. */
  dishCount: number;
  occurrenceCount: number;
  lastLoggedAt: string;
}

export type RelogCandidate = RelogDishCandidate | RelogMealCandidate;

export interface RelogCandidatesResponse {
  dishes: RelogDishCandidate[];
  meals: RelogMealCandidate[];
}

// ---------------------------------------------------------------------------
// References + staging
// ---------------------------------------------------------------------------

/**
 * What the client posts back on submit. Deliberately carries NO nutrition,
 * grams, or names — only a pointer the server re-resolves under
 * `WHERE user_id = …`. The client is never the source of truth for numbers.
 */
export type RelogRef =
  | { kind: 'dish'; sourceMealId: string; mealItemOrder: number }
  | { kind: 'meal'; sourceMealId: string };

/** One row in the staged list above the composer. `stageId` is client-minted so
 *  duplicate picks of the same dish stay independently removable — keying on
 *  the ref would make "remove" hit the wrong row. `summary` and `label` are
 *  display-only; a stale draft can render a stale subtitle but can never
 *  corrupt a save. */
export interface RelogStagedEntry {
  stageId: string;
  ref: RelogRef;
  label: string;
  /** Ingredient count for a dish, dish count for a meal. */
  partCount: number;
  summary: RelogMacroSummary;
}

export function toStagedEntry(
  candidate: RelogCandidate,
  stageId: string
): RelogStagedEntry {
  const summary: RelogMacroSummary = {
    totalGrams: candidate.totalGrams,
    caloriesKcal: candidate.caloriesKcal,
    proteinG: candidate.proteinG,
    carbohydrateG: candidate.carbohydrateG,
    fatG: candidate.fatG,
  };
  return {
    stageId,
    ref:
      candidate.kind === 'dish'
        ? {
            kind: 'dish',
            sourceMealId: candidate.sourceMealId,
            mealItemOrder: candidate.mealItemOrder,
          }
        : { kind: 'meal', sourceMealId: candidate.sourceMealId },
    label: candidate.name,
    partCount:
      candidate.kind === 'dish'
        ? candidate.ingredientCount
        : candidate.dishCount,
    summary,
  };
}

/** Sum staged macros for the totals line. Per nutrient: sum of non-null values,
 *  or null when no entry carries it — matching `totalsForRows`' convention that
 *  unknown is not zero. */
export function sumStagedMacros(
  entries: RelogStagedEntry[]
): IngredientMacrosPer100g {
  const totals: IngredientMacrosPer100g = {
    caloriesKcal: null,
    proteinG: null,
    carbohydrateG: null,
    fatG: null,
  };
  for (const entry of entries) {
    for (const key of Object.keys(totals) as (keyof typeof totals)[]) {
      const value = entry.summary[key];
      if (value == null) continue;
      totals[key] = (totals[key] ?? 0) + value;
    }
  }
  return totals;
}

/** `meals.raw_input` is NOT NULL and drives the card's label. Derived from the
 *  staged labels — a dish contributes its name, a meal its original text.
 *
 *  Lives here rather than in the writer so the SERVER and the OPTIMISTIC card
 *  share one derivation: the label shown the instant you submit is the label
 *  that gets persisted, with no second source of truth to drift. */
export function buildRelogRawInput(labels: string[]): string {
  const joined = labels.join(', ');
  return joined.length > RELOG_RAW_INPUT_MAX
    ? `${joined.slice(0, RELOG_RAW_INPUT_MAX - 1)}…`
    : joined;
}

const RELOG_RAW_INPUT_MAX = 500;

// ---------------------------------------------------------------------------
// Confidence merging
// ---------------------------------------------------------------------------

const CONFIDENCE_RANK: Record<string, number> = { low: 0, medium: 1, high: 2 };

/**
 * The weakest confidence across the meals a relog draws from. A composed meal
 * is no more confident than its least confident part — hard-coding 'high' (as
 * the manual-logging path does, where the user typed exact grams against
 * verified composition rows) would silently upgrade a 'low' AI estimate just by
 * re-logging it. Unrecognized values are ignored; all-null stays null.
 */
export function weakestConfidence(values: (string | null)[]): string | null {
  let weakest: string | null = null;
  for (const value of values) {
    if (value == null || !(value in CONFIDENCE_RANK)) continue;
    if (weakest === null || CONFIDENCE_RANK[value] < CONFIDENCE_RANK[weakest]) {
      weakest = value;
    }
  }
  return weakest;
}

// ---------------------------------------------------------------------------
// SQL LIKE escaping
// ---------------------------------------------------------------------------

/** Escape the LIKE metacharacters in a user-typed token. Paired with
 *  `ESCAPE '\'` in the query. Without this a lone `%` matches every row —
 *  the un-escaped shape at `lib/domain/ingredients/search/substring-backfill.ts`
 *  that this path deliberately does not copy. */
export function escapeLikeToken(token: string): string {
  return token.replace(/[\\%_]/g, (char) => `\\${char}`);
}

// ---------------------------------------------------------------------------
// `/` token parsing
// ---------------------------------------------------------------------------

/** Vietnamese dish names contain spaces ("Cà phê sữa đá"), so the token cannot
 *  stop at whitespace. Bound it instead, so a long sentence that happens to
 *  start with `/` eventually closes the popup. */
const MAX_TOKEN_WORDS = 4;
const MAX_TOKEN_LENGTH = 40;

export interface SlashToken {
  /** Index of the `/` in the full value. */
  start: number;
  /** Caret position — the token's exclusive end. */
  end: number;
  /** Text after the `/`, possibly empty. */
  query: string;
}

/**
 * Detect an active `/` token immediately left of the caret in the composer.
 *
 * The composer textarea is UNCONTROLLED (draft persistence, auto-resize and IME
 * all depend on that), so this reads the DOM value + caret rather than React
 * state. Returns null when no token is active.
 *
 * The "`/` must start the text or follow whitespace" rule is what keeps
 * `1/2 quả`, `and/or` and `http://x` from ever opening the picker.
 */
export function parseSlashToken(
  value: string,
  caret: number
): SlashToken | null {
  const end = Math.max(0, Math.min(caret, value.length));
  const left = value.slice(0, end);
  const start = left.lastIndexOf('/');
  if (start === -1) return null;

  // Must begin a word: start-of-text, or preceded by whitespace.
  if (start > 0 && !/\s/.test(left[start - 1])) return null;

  const query = left.slice(start + 1);
  // `/ ` (slash then space) is prose, not a trigger.
  if (query.length > 0 && /^\s/.test(query)) return null;
  if (query.length > MAX_TOKEN_LENGTH) return null;
  if (query.split(' ').length > MAX_TOKEN_WORDS) return null;
  // A newline always ends the token.
  if (/[\n\r\t]/.test(query)) return null;

  return { start, end, query };
}

/** Remove an accepted token from the composer text. Returns the new value and
 *  where the caret should land, so the caller can restore it through the
 *  existing imperative `setText`. */
export function stripSlashToken(
  value: string,
  token: SlashToken
): { value: string; caret: number } {
  return {
    value: value.slice(0, token.start) + value.slice(token.end),
    caret: token.start,
  };
}
