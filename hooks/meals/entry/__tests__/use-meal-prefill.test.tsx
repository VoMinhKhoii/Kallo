import { renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { useMealPrefill } from '@/hooks/meals/entry/use-meal-prefill';
import type { MealInputHandle } from '@/lib/domain/logging/meal-input-handle';

describe('URL meal prefill', () => {
  it('fills and focuses, cleans the URL, and waits for the user to send', () => {
    const setText = vi.fn();
    const focus = vi.fn();
    const handleSubmit = vi.fn(async () => {});
    const onInitialMealApplied = vi.fn();
    const args = {
      initialMeal: 'phở bò',
      isCheat: false,
      isAnalyzing: false,
      inputRef: { current: { setText, focus } as unknown as MealInputHandle },
      onInitialMealApplied,
      handleSubmit,
    };
    const { rerender } = renderHook(() => useMealPrefill(args));
    rerender();
    expect(setText).toHaveBeenCalledExactlyOnceWith('phở bò');
    expect(focus).toHaveBeenCalledOnce();
    expect(onInitialMealApplied).toHaveBeenCalledOnce();
    expect(handleSubmit).not.toHaveBeenCalled();
  });

  it('accepts the same text on a later arrival after the URL was cleaned', () => {
    const setText = vi.fn();
    const args = {
      isCheat: false,
      isAnalyzing: false,
      inputRef: {
        current: { setText, focus: vi.fn() } as unknown as MealInputHandle,
      },
      onInitialMealApplied: vi.fn(),
      handleSubmit: vi.fn(async () => {}),
    };
    const { rerender } = renderHook(
      ({ initialMeal }: { initialMeal?: string }) =>
        useMealPrefill({ ...args, initialMeal }),
      { initialProps: { initialMeal: 'phở bò' } as { initialMeal?: string } }
    );
    rerender({ initialMeal: undefined });
    rerender({ initialMeal: 'phở bò' });
    expect(setText).toHaveBeenCalledTimes(2);
    expect(args.handleSubmit).not.toHaveBeenCalled();
  });
});
