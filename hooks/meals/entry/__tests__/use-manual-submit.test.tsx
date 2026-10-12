import { renderHook, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  type ManualSave,
  useManualSave,
  useManualSubmit,
} from '@/hooks/meals/entry/use-manual-submit';
import type { useSaveManualMeal } from '@/hooks/meals/mutations/use-save-manual-meal';
import type {
  IngredientSearchResult,
  ManualMealRow,
} from '@/lib/domain/logging/manual-logging';
import type { MealInputHandle } from '@/lib/domain/logging/meal-input-handle';

const { toast, track } = vi.hoisted(() => ({
  toast: { success: vi.fn(), error: vi.fn() },
  track: vi.fn(),
}));
vi.mock('sonner', () => ({ toast }));
vi.mock('@/lib/infra/telemetry/analytics/track', () => ({ track }));

afterEach(() => {
  vi.clearAllMocks();
});

const rice: IngredientSearchResult = {
  id: 'fct-rice',
  namePrimary: 'Cơm trắng',
  nameEn: null,
  nameAlt: null,
  state: 'cooked',
  similarity: 1,
  per100g: { caloriesKcal: 130, proteinG: 2.7, carbohydrateG: 28, fatG: 0.3 },
};

function composer(rows: ManualMealRow[], name = '') {
  const handle = {
    getManualRows: () => rows,
    getManualName: () => name,
    clear: vi.fn(),
  } as unknown as MealInputHandle;
  return { current: handle };
}

describe('useManualSubmit — the md+ composer rows', () => {
  const rows: ManualMealRow[] = [
    { id: 'r1', query: 'cơm nhà', ingredient: rice, grams: '150' },
    // Incomplete rows are left out, not sent.
    { id: 'r2', query: 'chưa chọn', ingredient: null, grams: '100' },
  ];

  it('saves the complete rows as items and clears once the save lands', async () => {
    const save = vi.fn<ManualSave>(async () => {});
    const inputRef = composer(rows, 'Trưa');
    const { result } = renderHook(() =>
      useManualSubmit({ inputRef, save, isSaving: false })
    );
    result.current();
    expect(save).toHaveBeenCalledWith(
      [{ ingredient: rice, grams: 150, label: 'cơm nhà' }],
      'Trưa'
    );
    await waitFor(() => expect(inputRef.current.clear).toHaveBeenCalled());
  });

  it('keeps the rows when the save fails', async () => {
    const save = vi.fn<ManualSave>(async () => {
      throw new Error('offline');
    });
    const inputRef = composer(rows);
    const { result } = renderHook(() =>
      useManualSubmit({ inputRef, save, isSaving: false })
    );
    result.current();
    await waitFor(() => expect(save).toHaveBeenCalled());
    await Promise.resolve();
    expect(inputRef.current.clear).not.toHaveBeenCalled();
  });

  it('does nothing with no complete row, or while a save is out', () => {
    const save = vi.fn<ManualSave>(async () => {});
    const empty = renderHook(() =>
      useManualSubmit({ inputRef: composer([rows[1]]), save, isSaving: false })
    );
    empty.result.current();
    const busy = renderHook(() =>
      useManualSubmit({ inputRef: composer(rows), save, isSaving: true })
    );
    busy.result.current();
    expect(save).not.toHaveBeenCalled();
  });
});

describe('useManualSave', () => {
  function setup(mutateAsync: () => Promise<unknown>) {
    const saveManualMeal = { mutateAsync: vi.fn(mutateAsync) };
    const scrollToBottom = vi.fn();
    const { result } = renderHook(() =>
      useManualSave({
        saveManualMeal: saveManualMeal as unknown as ReturnType<
          typeof useSaveManualMeal
        >,
        selectedDate: '2026-06-12',
        scrollToBottom,
      })
    );
    return { save: result.current, saveManualMeal, scrollToBottom };
  }
  const items = [{ ingredient: rice, grams: 150 }];

  it('sends a trimmed name, or none when blank, and says it saved once', async () => {
    const { save, saveManualMeal, scrollToBottom } = setup(async () => ({}));
    await save(items, '  Cơm trưa ');
    await save(items, '   ');
    const [named, blank] = saveManualMeal.mutateAsync.mock.calls.map(
      (call) => (call as unknown[])[0] as { name?: string; loggedDate: string }
    );
    expect(named.name).toBe('Cơm trưa');
    expect(blank.name).toBeUndefined();
    expect(named.loggedDate).toBe('2026-06-12');
    expect(scrollToBottom).toHaveBeenCalledTimes(2);
    expect(toast.success).toHaveBeenCalledTimes(2);
    expect(track).toHaveBeenCalledWith('meal_logged', { method: 'manual' });
  });

  it('rejects a failed save without a second toast — the rollback says why', async () => {
    const { save } = setup(async () => {
      throw new Error('offline');
    });
    await expect(save(items, '')).rejects.toThrow('offline');
    // The mutation's onError (rollbackOptimisticMeal) owns the error toast.
    expect(toast.error).not.toHaveBeenCalled();
    expect(toast.success).not.toHaveBeenCalled();
    expect(track).not.toHaveBeenCalled();
  });
});
