/**
 * Matching that starts while Call 1 is still streaming. Each meal item is
 * matched the moment its JSON object closes in the stream, so by the time
 * Call 1 finishes most of the meal's candidates are already fetched. The final
 * decomposition reuses a streamed result only for an ingredient whose
 * matching inputs are identical; anything else (a retry, a repair, an item
 * the stream never closed) is matched as usual.
 */
import type { MealDecompositionV2 } from '@/lib/ai/pipeline/contracts/schemas/decomposition-v2';
import type { GeminiClient } from '@/lib/ai/provider/provider';
import { capitalizeFirst } from '@/lib/core/text/capitalize';
import type { AppDb } from '@/lib/infra/db/client';
import type { IngredientV2MatchResult } from './candidate';
import { matchCardCandidates } from './cards/retrieval';
import { matchIngredients } from './match-ingredients';

type Ingredient =
  MealDecompositionV2['mealItems'][number]['ingredients'][number];

/** Every input card retrieval reads, as it will read it after Call 1's clean-up. */
const matchKey = (ing: Ingredient) =>
  JSON.stringify([
    capitalizeFirst(ing.rawName ?? ''),
    capitalizeFirst(ing.canonicalName ?? ''),
    ing.queryEn ?? null,
    ing.nameVi ?? null,
    ing.tableName ?? null,
    ing.stateHint ?? null,
    ing.explicitMass ?? null,
  ]);

/**
 * The meal items whose objects have closed in a partial Call 1 JSON, in order.
 * A string-aware bracket scan over the `mealItems` array; a malformed item is
 * skipped, never thrown.
 */
export function completedMealItems(
  accumulated: string
): Array<{ ingredients?: Ingredient[] }> {
  const key = accumulated.indexOf('"mealItems"');
  const open = key < 0 ? -1 : accumulated.indexOf('[', key);
  if (open < 0) return [];
  const items: Array<{ ingredients?: Ingredient[] }> = [];
  let depth = 0;
  let start = -1;
  let inString = false;
  let escaped = false;
  for (let i = open + 1; i < accumulated.length; i++) {
    const c = accumulated[i];
    if (inString) {
      if (escaped) escaped = false;
      else if (c === '\\') escaped = true;
      else if (c === '"') inString = false;
      continue;
    }
    if (c === '"') inString = true;
    else if (c === '{' || c === '[') {
      if (depth === 0 && c === '{') start = i;
      depth++;
    } else if (c === '}' || c === ']') {
      if (depth === 0) break; // the mealItems array closed
      depth--;
      if (depth === 0 && c === '}' && start >= 0) {
        try {
          items.push(JSON.parse(accumulated.slice(start, i + 1)));
        } catch {
          // A malformed item is matched later with the rest.
        }
        start = -1;
      }
    }
  }
  return items;
}

export interface StreamedMatching {
  /** Feed Call 1's accumulated stream text. */
  onChunk: (accumulated: string) => void;
  /** Match the final ingredients, reusing what the stream already fetched. */
  match: (
    ingredients: Ingredient[],
    dishCookingMethods: Array<string | null>,
    legacy: { k: number; concurrency: number }
  ) => Promise<IngredientV2MatchResult[]>;
}

export function createStreamedMatching(
  db: AppDb,
  gemini: GeminiClient
): StreamedMatching {
  const started = new Map<string, Promise<IngredientV2MatchResult | null>>();
  // Ingredients waiting for the next batch. One batch runs at a time and takes
  // everything that streamed in meanwhile: the instance shares a small pool of
  // database connections (DB_POOL_MAX) across all its requests, so a query per
  // meal item would queue behind each other (and behind every other request)
  // instead of overlapping.
  let pending: Array<{
    ing: Ingredient;
    resolve: (r: IngredientV2MatchResult | null) => void;
  }> = [];
  let inFlight = false;
  const flush = () => {
    if (inFlight || pending.length === 0) return;
    inFlight = true;
    const batch = pending;
    pending = [];
    matchCardCandidates(
      batch.map((p) => p.ing),
      db,
      gemini
    )
      .catch(() => null)
      .then((results) => {
        batch.forEach((p, i) => {
          p.resolve(results?.[i] ?? null);
        });
        inFlight = false;
        flush();
      });
  };
  let seen = 0;
  return {
    onChunk(accumulated) {
      const items = completedMealItems(accumulated);
      // A retried attempt streams from scratch.
      if (items.length < seen) seen = 0;
      for (const item of items.slice(seen)) {
        for (const raw of item.ingredients ?? []) {
          // An attempt that left out a name (a schema slip Call 1 is re-asked
          // for) would embed an empty search text, which fails the whole
          // batch's vector search; the matching after Call 1 covers it.
          if (!raw?.rawName?.trim() || !raw.canonicalName?.trim()) continue;
          if (started.has(matchKey(raw))) continue;
          // Cleaned up exactly as Call 1's result is, so a reused result names
          // the ingredient the way the final decomposition does.
          const ing = {
            ...raw,
            rawName: capitalizeFirst(raw.rawName),
            canonicalName: capitalizeFirst(raw.canonicalName),
          };
          started.set(
            matchKey(ing),
            new Promise((resolve) => pending.push({ ing, resolve }))
          );
        }
      }
      seen = items.length;
      flush();
    },
    async match(ingredients, dishCookingMethods, legacy) {
      const early = await Promise.all(
        ingredients.map((ing) => started.get(matchKey(ing)) ?? null)
      );
      const missing = early.flatMap((r, i) => (r ? [] : [i]));
      const late = missing.length
        ? await matchIngredients(
            missing.map((i) => ingredients[i]),
            missing.map((i) => dishCookingMethods[i]),
            db,
            gemini,
            legacy
          )
        : [];
      let next = 0;
      return early.map((r, i) => ({
        ...(r ?? late[next++]),
        ingredientIndex: i,
      }));
    },
  };
}
