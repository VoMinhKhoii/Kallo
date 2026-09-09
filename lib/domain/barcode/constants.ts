// Re-exported so every existing barcode importer keeps one import path; the
// value itself lives in `lib/core/validation` because core schemas need it and
// `lib/core` may not import from `lib/domain`.
export { MAX_FOOD_ITEM_GRAMS } from '@/lib/core/validation/primitives';
