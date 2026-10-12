import { act, renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import {
  type IngredientSearchResult,
  MANUAL_MEAL_MAX_ITEMS,
} from '@/lib/domain/logging/manual-logging';
import { useManualSheet } from '../use-manual-sheet';

const food = (id: string): IngredientSearchResult => ({
  id,
  namePrimary: `Food ${id}`,
  nameEn: null,
  nameAlt: null,
  state: 'raw',
  similarity: 1,
  per100g: { caloriesKcal: 100, proteinG: 1, carbohydrateG: null, fatG: 1 },
});

/** The plate's own lifecycle, apart from any drawer: what a close keeps and
 *  what the next open drops. */
describe('useManualSheet', () => {
  it('keeps the plate through a close, and drops it as the next sheet opens', () => {
    const { result, rerender } = renderHook(
      ({ open }) => useManualSheet(open),
      { initialProps: { open: true } }
    );
    act(() => result.current.add(food('a'), 150));
    act(() => result.current.setName('Trưa'));

    // Closed: still the same plate, so the sheet never blanks mid-slide.
    rerender({ open: false });
    expect(result.current.items).toHaveLength(1);
    expect(result.current.name).toBe('Trưa');

    // The next open is a new meal.
    rerender({ open: true });
    expect(result.current.items).toEqual([]);
    expect(result.current.name).toBe('');
  });

  it('never resets while the sheet stays open', () => {
    const { result, rerender } = renderHook(
      ({ open }) => useManualSheet(open),
      { initialProps: { open: true } }
    );
    act(() => result.current.add(food('a'), 100));
    rerender({ open: true });
    expect(result.current.items).toHaveLength(1);
  });

  it('totals an empty plate as 0 and stops at the cap', () => {
    const { result } = renderHook(() => useManualSheet(true));
    expect(result.current.totals.caloriesKcal).toBe(0);
    expect(result.current.full).toBe(false);

    act(() => {
      for (let i = 0; i <= MANUAL_MEAL_MAX_ITEMS; i++) {
        result.current.add(food(String(i)), 100);
      }
    });
    expect(result.current.items).toHaveLength(MANUAL_MEAL_MAX_ITEMS);
    expect(result.current.full).toBe(true);
    // Unknown carbs on every food stay unknown, never 0.
    expect(result.current.totals.carbohydrateG).toBeNull();
  });
});
