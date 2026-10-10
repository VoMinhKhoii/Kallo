import { nameKey } from '@/lib/core/text/name-key';

/** Which decomposition dish a meal item belongs to. */
export interface DishSlot {
  /** Normalized dish name. */
  key: string;
  /** 1-based occurrence among same-name dishes; always 1 for a pooled name. */
  occ: number;
  /**
   * The decomposition has exactly one dish with this name, so every same-name
   * meal item belongs to it.
   */
  pooled: boolean;
}

/**
 * Map meal items (from Call 2, or the decomposition itself) to decomposition
 * dishes by name.
 *
 * - A name the decomposition uses once owns every meal item with that name.
 *   Call 2, Claude Haiku especially, can split one dish into several same-name
 *   items, one ingredient each, and all of them belong to that dish.
 * - A name the decomposition repeats ("1 chén cơm … 1 chén cơm") keeps one
 *   slot per occurrence, matched in order. Two different dishes that share a
 *   name therefore never trade estimates.
 *
 * Each call returns a fresh counter: use one per sequence being walked.
 */
export function createDishSlots(
  decompositionNames: string[]
): (name: string) => DishSlot {
  const count = new Map<string, number>();
  for (const name of decompositionNames) {
    const key = nameKey(name);
    count.set(key, (count.get(key) ?? 0) + 1);
  }
  const seen = new Map<string, number>();
  return (name) => {
    const key = nameKey(name);
    if ((count.get(key) ?? 0) <= 1) return { key, occ: 1, pooled: true };
    const occ = (seen.get(key) ?? 0) + 1;
    seen.set(key, occ);
    return { key, occ, pooled: false };
  };
}
