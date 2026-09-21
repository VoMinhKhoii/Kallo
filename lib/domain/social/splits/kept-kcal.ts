import { TOTAL_PARTS } from '@/lib/domain/social/splits/parts';

/**
 * What the sharer is left holding, in calories, given the parts they kept.
 *
 * The share button states the consequence rather than the action — "Chia sẻ
 * với 3 người · còn 416 kcal" — and this is the number after the dot. On the
 * whole-portion tab the sharer keeps every part, so it reads as the untouched
 * meal; on a split it shrinks as they hand runs away.
 *
 * Null in, null out: a meal whose calories never resolved has no honest figure
 * to show here, and the caller falls back to a button label without one rather
 * than printing a confident 0.
 */
export function keptKcal(
  totalKcal: number | null,
  keptParts: number
): number | null {
  if (totalKcal == null) return null;
  return Math.round((totalKcal * keptParts) / TOTAL_PARTS);
}
