export { applyIngredientAliases, resolveAlias } from './aliases';
export {
  CONFIDENCE_THRESHOLDS,
  classifyConfidence,
  FAO_VECTOR_THRESHOLD,
  FUZZY_FALLBACK_THRESHOLD,
  FUZZY_SIMILARITY_THRESHOLD,
  type MatchOptions,
  type MatchResult,
  matchIngredients,
  rerankCandidates,
  SOURCE_FAO,
  SOURCE_USDA,
  USDA_VECTOR_THRESHOLD,
  VECTOR_SIMILARITY_THRESHOLD,
} from './cascade';
export {
  cacheQueryEmbedding,
  clearMemoryCache,
  getMemoryCacheStats,
  normalizeIngredientKey,
  resolveQueryEmbedding,
} from './embedding-cache';
export {
  fetchNutritionPer100g,
  logUnmatchedIngredients,
  parseNutritionRow,
} from './nutrition-db';
export {
  createSpeculativeMatcher,
  extractIngredientNames,
} from './speculative';
