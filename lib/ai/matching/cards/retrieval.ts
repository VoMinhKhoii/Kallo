/**
 * Card retrieval: searches curated food cards instead of raw table rows.
 *
 *   vector arms   one per QUERY_FIELDS string → `match_food_cards` (every
 *                 string that names a card, max-sim per row; one round trip)
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
import { type CardCatalog, type CatalogRow, getCardCatalog } from './catalog';
import { saltVariant } from './concept-key';
import { cardLabel } from './label';
import { cardQueryStrings, QUERY_FIELDS } from './query-strings';
import { searchCardVectors, type VectorHit } from './vector-arm';

/**
 * Candidates per ingredient from card retrieval. The candidate selector ranks
 * all of them; Call 2 sees the first eight (`CALL_TWO_CANDIDATES`).
 */
export const CARD_K = 16;
const ARM_DEPTH = 30;
/**
 * The vector arm's own budget, well inside the matching stage deadline, so a
 * stalled embedding or vector query still leaves time for the lexical arms.
 */
const VECTOR_ARM_TIMEOUT_MS = 4_000;

/** Vector hits per ingredient (one list per query field); empty when the arm fails. */
async function vectorArms(
  queries: string[],
  db: AppDb,
  gemini: GeminiClient
): Promise<VectorHit[][]> {
  // Set once the deadline passes: an embedding that lands later must not still
  // start a vector query nobody will read (it would hold a pool connection).
  let expired = false;
  try {
    return await withDeadline(
      gemini
        .generateEmbeddingBatch(queries)
        .then((embeddings) =>
          expired ? queries.map(() => []) : searchCardVectors(embeddings, db)
        ),
      VECTOR_ARM_TIMEOUT_MS
    );
  } catch (err) {
    expired = true;
    // Matching never blanks out because one arm is down.
    console.error(
      '[card-matching] vector arm failed; using lexical arms only:',
      err
    );
    return queries.map(() => []);
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

export async function matchCardCandidates(
  ingredients: DecomposedIngredientV2[],
  db: AppDb,
  gemini: GeminiClient
): Promise<IngredientV2MatchResult[] | null> {
  const catalog = await getCardCatalog(db);
  if (!catalog) return null;
  if (ingredients.length === 0) return [];

  const hits = await vectorArms(
    ingredients.flatMap(cardQueryStrings),
    db,
    gemini
  );
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
    return { ingredientIndex: i, candidates };
  });
  await attachCandidateNutrition(results, db);
  return results;
}
