/**
 * Card retrieval: searches curated food cards instead of raw table rows.
 *
 *   vector arms   one per QUERY_FIELDS string → `match_food_card_texts`
 *                 (every distinct string that names a card, max-sim per
 *                 row; one round trip)
 *   lexical arm   rawName → in-memory trigram index over card names
 *   dialect arm   tableName → BM25 over the rows' English names
 *
 * Arms are fused by reciprocal rank, filtered by the legacy eligibility guards,
 * collapsed to one row per concept (grade/salt siblings), narrowed to the
 * user's stated weighing basis (raw / cooked), and cut to CARD_K.
 * All sources compete equally — there is no source preference.
 *
 * Returns `null` when the card index is not ready (see `catalog.ts`).
 */
import {
  attachCandidateNutrition,
  type CardRetrieval,
  type IngredientV2MatchResult,
  type V2MatchCandidate,
} from '@/lib/ai/matching/candidate';
import {
  classifyConfidence,
  type MatchInfo,
  normalizeState,
} from '@/lib/ai/matching/match-constants';
import { isCandidateEligibleForIngredient } from '@/lib/ai/matching/rank/candidate-eligibility';
import {
  explicitWeighState,
  filterByExplicitState,
} from '@/lib/ai/matching/rank/candidate-ranking';
import { rrfOrder } from '@/lib/ai/matching/rank/rrf-fusion';
import type { DecomposedIngredientV2 } from '@/lib/ai/pipeline/contracts/schemas/decomposition-v2';
import type { GeminiClient } from '@/lib/ai/provider/provider';
import { withDeadline } from '@/lib/core/async/with-deadline';
import type { AppDb } from '@/lib/infra/db/client';
import type { CardCatalog, CatalogRow } from './catalog';
import { saltVariant } from './concept-key';
import { cardLabel } from './label';
import { cardQueryStrings, QUERY_FIELDS } from './query-strings';
import { resolveCardBackend } from './search-index/search-index';
import { searchCardVectors, type VectorHit } from './vector-arm';

/** Candidates per ingredient Call 2 sees from card retrieval. */
export const CARD_K = 8;
const ARM_DEPTH = 30;
/**
 * The vector arm's own budget, inside the matching stage deadline
 * (`MATCHING_TIMEOUT_MS`, 10 s), so a stalled embedding or vector query still
 * leaves time for the lexical arms. 8 s, not 4 s: prod's `match_food_cards`
 * took 2.6 s on average and up to 5.6 s on the free-plan database
 * (pg_stat_statements, 2026-10-12), so 4 s dropped half the meals to
 * lexical-only matching.
 */
const VECTOR_ARM_TIMEOUT_MS = 8_000;
/**
 * Kept free for the nutrition fetch after the vector arm (by id: ~3 ms of
 * database time on prod, 55 ms at worst). A call's whole budget is the arm's
 * plus this reserve.
 */
const NUTRITION_RESERVE_MS = 1_000;
const CALL_BUDGET_MS = VECTOR_ARM_TIMEOUT_MS + NUTRITION_RESERVE_MS;

/**
 * Vector hits per query string (one list per query field); empty when the arm
 * fails. A string repeated across fields or ingredients (a field falling back
 * to another, the same food logged twice) is searched once and its hits are
 * shared, since a search runs once per vector. `ok` is false when the arm
 * failed and the call fell back to the lexical arms.
 */
async function vectorArms(
  queries: string[],
  gemini: GeminiClient,
  search: (embeddings: number[][], timeoutMs: number) => Promise<VectorHit[][]>,
  budgetMs: number
): Promise<{ hits: VectorHit[][]; ok: boolean }> {
  const distinct = [...new Set(queries)];
  // No budget left (the nutrition reserve takes it all): start no embedding.
  if (budgetMs <= 0) return { hits: queries.map(() => []), ok: false };
  const t0 = Date.now();
  const left = () => budgetMs - (Date.now() - t0);
  // Set once the deadline passes: an embedding that lands later must not still
  // start a search nobody will read (it would hold a pool connection or a
  // worker slot).
  let expired = false;
  let searched = false;
  try {
    const hits = await withDeadline(
      gemini.generateEmbeddingBatch(distinct).then((embeddings) => {
        if (expired || left() <= 0) return distinct.map((): VectorHit[] => []);
        searched = true;
        return search(embeddings, left());
      }),
      budgetMs
    );
    // An embedding that used up the budget skipped the search: the lexical
    // arms alone ranked this call, and its trace must say so.
    return {
      hits: queries.map((q) => hits[distinct.indexOf(q)]),
      ok: searched,
    };
  } catch (err) {
    expired = true;
    // Matching never blanks out because one arm is down.
    console.error(
      '[card-matching] vector arm failed; using lexical arms only:',
      err
    );
    return { hits: queries.map(() => []), ok: false };
  }
}

const rowName = (row: CatalogRow) => row.nameEn || row.namePrimary;

/**
 * Eligible rows in rank order, one per concept (uncapped: the state filter
 * runs first). The first-ranked row represents its concept, unless the user
 * asked for a salt variant ("unsalted", "không muối") and a lower-ranked
 * sibling is that variant: it then takes the representative's place.
 */
function eligibleRows(
  ranked: string[],
  catalog: CardCatalog,
  ing: DecomposedIngredientV2
): CatalogRow[] {
  // Raw and canonical names together, so the user's own words ("da gà")
  // count as skin intent for the guards.
  const names = `${ing.rawName} ${ing.canonicalName}`;
  const wantedSalt = saltVariant(`${names} ${ing.queryEn ?? ''}`);
  const eligible = (row: CatalogRow) =>
    isCandidateEligibleForIngredient(names, {
      name_primary: row.namePrimary,
      name_en: row.nameEn,
      name_alt: null,
    });
  const slotOfConcept = new Map<string, number>();
  const out: CatalogRow[] = [];
  for (const id of ranked) {
    const row = catalog.rows.get(id);
    if (!row) continue;
    const slot = slotOfConcept.get(row.concept);
    if (slot !== undefined) {
      if (
        wantedSalt &&
        saltVariant(rowName(out[slot])) !== wantedSalt &&
        saltVariant(rowName(row)) === wantedSalt &&
        eligible(row)
      )
        out[slot] = row;
      continue;
    }
    if (!eligible(row)) continue;
    slotOfConcept.set(row.concept, out.length);
    out.push(row);
  }
  return out;
}

function toMatchInfo(
  row: CatalogRow,
  ing: DecomposedIngredientV2,
  bestVector: Map<string, number>
): MatchInfo {
  const vector = bestVector.get(row.id);
  const similarity = vector ?? 0;
  return {
    ingredientName: ing.canonicalName,
    foodCompositionId: row.id,
    matchedName: row.namePrimary,
    ...(row.nameEn ? { matchedNameEn: row.nameEn } : {}),
    similarity,
    confidence: classifyConfidence(similarity),
    state: normalizeState(row.state),
    source: row.source,
    // Found by a vector arm, or only by the lexical / dialect arms.
    matchType: vector === undefined ? 'fuzzy' : 'vector',
  };
}

/** The call's deadline passed before it had a catalog: start no new work. */
export const MATCH_EXPIRED = 'expired' as const;

/**
 * Candidates per ingredient; `null` when card retrieval is not ready (the
 * caller's legacy matcher runs, with time left); MATCH_EXPIRED when the
 * deadline passed (the caller leaves the ingredients unmatched).
 *
 * The whole call is bounded by `deadlineAt` and by CALL_BUDGET_MS from its
 * start: the catalog wait, the vector arm and the nutrition fetch each get
 * only what is left (the arm leaves NUTRITION_RESERVE_MS), so a cold start
 * cannot push matching past the stage deadline (`grounded/grounding.ts`),
 * which fails the meal.
 */
export async function matchCardCandidates(
  ingredients: DecomposedIngredientV2[],
  db: AppDb,
  gemini: GeminiClient,
  opts: { deadlineAt?: number } = {}
): Promise<IngredientV2MatchResult[] | null | typeof MATCH_EXPIRED> {
  const deadlineAt = Math.min(
    opts.deadlineAt ?? Number.POSITIVE_INFINITY,
    Date.now() + CALL_BUDGET_MS
  );
  const remaining = () => deadlineAt - Date.now();
  const backend = await resolveCardBackend(db, deadlineAt);
  if (backend === 'expired') return MATCH_EXPIRED;
  if (!backend) return null;
  const { catalog } = backend;
  if (ingredients.length === 0) return [];
  // A catalog that was already loaded comes back however late it is.
  if (remaining() <= 0) return MATCH_EXPIRED;

  const { hits, ok } = await vectorArms(
    ingredients.flatMap(cardQueryStrings),
    gemini,
    backend.kind === 'index'
      ? backend.search
      : (embeddings) => searchCardVectors(embeddings, db),
    Math.min(VECTOR_ARM_TIMEOUT_MS, remaining() - NUTRITION_RESERVE_MS)
  );
  const retrieval: CardRetrieval = {
    vectorSource: ok ? backend.kind : 'none',
    ...(backend.kind === 'index' && backend.build
      ? { build: backend.build }
      : {}),
  };
  const perIngredient = QUERY_FIELDS.length;

  const results = ingredients.map((ing, i): IngredientV2MatchResult => {
    const ingredientHits = hits.slice(
      i * perIngredient,
      (i + 1) * perIngredient
    );
    const bestVector = new Map<string, number>();
    const arms = ingredientHits.map((list) => {
      for (const h of list)
        bestVector.set(h.id, Math.max(bestVector.get(h.id) ?? 0, h.similarity));
      return list.slice(0, ARM_DEPTH).map((h) => h.id);
    });
    arms.push(catalog.lexical.search(ing.rawName, ARM_DEPTH));
    if (ing.tableName)
      arms.push(catalog.bm25En.search(ing.tableName, ARM_DEPTH));

    const eligible = eligibleRows(rrfOrder(arms), catalog, ing).map((row) => ({
      row,
      info: toMatchInfo(row, ing, bestVector),
    }));
    // The user's stated weighing basis filters the whole pool before the cap,
    // so opposite-state rows ranked above cannot crowd out matching ones.
    const allowed = new Set(
      filterByExplicitState(
        eligible.map((p) => p.info),
        explicitWeighState(ing)
      )
    );
    const candidates = eligible
      .filter((p) => allowed.has(p.info))
      .slice(0, CARD_K)
      .map(
        (p, rank): V2MatchCandidate => ({
          info: p.info,
          nutrition: null,
          inediblePct: null,
          prompt: {
            name: cardLabel(p.row),
            nameEn: p.row.nameEn || null,
            score: 1 - rank * 0.01,
          },
        })
      );
    return { ingredientIndex: i, candidates, retrieval };
  });
  if (remaining() <= 0) return MATCH_EXPIRED;
  // On the artifact path, nutrition comes fresh from Postgres and a candidate
  // Postgres no longer has is dropped: the build may predate a row's deletion,
  // and a meal item naming a deleted row would fail its insert.
  const attached = await withDeadline(
    attachCandidateNutrition(results, db, { fresh: backend.kind === 'index' }),
    remaining(),
    () => new NutritionDeadlineError()
  ).then(
    () => true,
    (err) => {
      if (err instanceof NutritionDeadlineError) return false;
      throw err;
    }
  );
  return attached ? results : MATCH_EXPIRED;
}

class NutritionDeadlineError extends Error {}
