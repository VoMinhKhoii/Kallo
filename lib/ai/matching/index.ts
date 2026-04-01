export { applyIngredientAliases } from './aliases';
export {
  CONFIDENCE_THRESHOLDS,
  classifyConfidence,
  FUZZY_FALLBACK_THRESHOLD,
  FUZZY_SIMILARITY_THRESHOLD,
  type MatchResult,
  matchIngredients,
  rerankCandidates,
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
