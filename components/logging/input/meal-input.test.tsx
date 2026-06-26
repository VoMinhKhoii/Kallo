import { act, cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createRef } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { IngredientSearchResult } from '@/lib/logging/manual-logging';
import { MealInput, type MealInputHandle } from './meal-input';

const STORAGE_KEY = 'nham:meal-input-draft';
const MANUAL_ROWS_KEY = 'nham:meal-input-manual-items-v3';

const riceResult: IngredientSearchResult = {
  id: 'fct-rice',
  namePrimary: 'Cơm trắng',
  nameEn: 'White rice',
  nameAlt: null,
  state: 'cooked',
  similarity: 0.9,
  per100g: { caloriesKcal: 130, proteinG: 2.7, carbohydrateG: 28, fatG: 0.3 },
};

// Stable return object: useQuery data is referentially stable across renders;
// the mock must be too, or the combobox's render-adjustment would loop.
const searchHookResult = { data: [riceResult], isFetching: false };
vi.mock('@/hooks/meals/use-ingredient-search', () => ({
  useIngredientSearch: () => searchHookResult,
}));

beforeEach(() => {
  localStorage.clear();
  vi.useFakeTimers({ shouldAdvanceTime: true });
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe('MealInput localStorage persistence', () => {
  it('restores draft from localStorage on mount', () => {
    localStorage.setItem(STORAGE_KEY, 'saved draft');
    render(<MealInput onSubmit={() => {}} />);
    const textarea = screen.getByRole('textbox');
    expect(textarea).toHaveValue('saved draft');
  });

  it('saves input to localStorage after debounce', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    render(<MealInput onSubmit={() => {}} />);
    const textarea = screen.getByRole('textbox');

    await user.type(textarea, 'phở bò');
    // Debounce hasn't fired yet
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull();

    // Advance past debounce
    vi.advanceTimersByTime(600);
    expect(localStorage.getItem(STORAGE_KEY)).toBe('phở bò');
  });

  it('clears localStorage when clear() is called via ref', () => {
    localStorage.setItem(STORAGE_KEY, 'old draft');
    const ref = createRef<MealInputHandle>();
    render(<MealInput ref={ref} onSubmit={() => {}} />);

    act(() => ref.current?.clear());
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
    expect(screen.getByRole('textbox')).toHaveValue('');
  });

  it('getText() returns current textarea value', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    const ref = createRef<MealInputHandle>();
    render(<MealInput ref={ref} onSubmit={() => {}} />);

    await user.type(screen.getByRole('textbox'), 'bún chả');
    expect(ref.current?.getText()).toBe('bún chả');
  });

  it('setText() updates textarea value and localStorage', () => {
    const ref = createRef<MealInputHandle>();
    render(<MealInput ref={ref} onSubmit={() => {}} />);

    act(() => ref.current?.setText('cơm tấm'));
    expect(screen.getByRole('textbox')).toHaveValue('cơm tấm');
    expect(localStorage.getItem(STORAGE_KEY)).toBe('cơm tấm');
  });

  it('submit button is disabled when input is empty', () => {
    render(<MealInput onSubmit={() => {}} />);
    expect(screen.getByRole('button', { name: /submit/i })).toBeDisabled();
  });

  it('submit button is enabled when input has content', () => {
    localStorage.setItem(STORAGE_KEY, 'food');
    render(<MealInput onSubmit={() => {}} />);
    expect(screen.getByRole('button', { name: /submit/i })).toBeEnabled();
  });

  it('keeps the ingredient rows hidden in normal mode', () => {
    render(<MealInput onSubmit={() => {}} mode="normal" />);

    expect(
      screen.queryByPlaceholderText('manualLogging.searchPlaceholder')
    ).not.toBeInTheDocument();
  });

  it('shows ingredient search rows when mode prop is manual', () => {
    render(<MealInput onSubmit={() => {}} mode="manual" />);

    expect(
      screen.getByPlaceholderText('manualLogging.searchPlaceholder')
    ).toBeVisible();
    expect(
      screen.getByPlaceholderText('manualLogging.gramsPlaceholder')
    ).toBeVisible();
    expect(
      screen.getByRole('button', { name: 'manualLogging.addItem' })
    ).toBeVisible();
  });

  it('submit is disabled in manual mode until a row has an ingredient and grams', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    render(<MealInput onSubmit={() => {}} mode="manual" />);

    expect(screen.getByRole('button', { name: /submit/i })).toBeDisabled();

    await user.click(
      screen.getByPlaceholderText('manualLogging.searchPlaceholder')
    );
    await user.click(screen.getByRole('option', { name: /Cơm trắng/ }));
    expect(screen.getByRole('button', { name: /submit/i })).toBeDisabled();

    await user.type(
      screen.getByPlaceholderText('manualLogging.gramsPlaceholder'),
      '150'
    );
    expect(screen.getByRole('button', { name: /submit/i })).toBeEnabled();
  });

  it('getManualRows() returns the picked ingredient with grams', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    const ref = createRef<MealInputHandle>();
    render(<MealInput ref={ref} onSubmit={() => {}} mode="manual" />);

    await user.click(
      screen.getByPlaceholderText('manualLogging.searchPlaceholder')
    );
    await user.click(screen.getByRole('option', { name: /Cơm trắng/ }));
    await user.type(
      screen.getByPlaceholderText('manualLogging.gramsPlaceholder'),
      '150'
    );

    const rows = ref.current?.getManualRows() ?? [];
    expect(rows).toHaveLength(1);
    expect(rows[0].ingredient?.id).toBe('fct-rice');
    expect(rows[0].grams).toBe('150');
  });

  it('persists manual rows to the v3 draft key and restores them on mount', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    const { unmount } = render(<MealInput onSubmit={() => {}} mode="manual" />);

    await user.click(
      screen.getByPlaceholderText('manualLogging.searchPlaceholder')
    );
    await user.click(screen.getByRole('option', { name: /Cơm trắng/ }));
    await user.type(
      screen.getByPlaceholderText('manualLogging.gramsPlaceholder'),
      '150'
    );
    act(() => {
      vi.advanceTimersByTime(600);
    });
    expect(localStorage.getItem(MANUAL_ROWS_KEY)).not.toBeNull();
    unmount();

    render(<MealInput onSubmit={() => {}} mode="manual" />);
    expect(
      screen.getByPlaceholderText('manualLogging.searchPlaceholder')
    ).toHaveValue('Cơm trắng');
    expect(
      screen.getByPlaceholderText('manualLogging.gramsPlaceholder')
    ).toHaveValue('150');
  });

  it('drops an incompatible legacy manual draft on read', () => {
    localStorage.setItem(
      'nham:meal-input-manual-items',
      JSON.stringify([{ id: '1', qty: '1 bowl', name: 'rice' }])
    );

    render(<MealInput onSubmit={() => {}} mode="manual" />);

    expect(localStorage.getItem('nham:meal-input-manual-items')).toBeNull();
    expect(
      screen.getByPlaceholderText('manualLogging.searchPlaceholder')
    ).toHaveValue('');
  });

  it('clear() resets manual rows and the draft', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    const ref = createRef<MealInputHandle>();
    render(<MealInput ref={ref} onSubmit={() => {}} mode="manual" />);

    await user.click(
      screen.getByPlaceholderText('manualLogging.searchPlaceholder')
    );
    await user.click(screen.getByRole('option', { name: /Cơm trắng/ }));
    await user.type(
      screen.getByPlaceholderText('manualLogging.gramsPlaceholder'),
      '150'
    );

    act(() => ref.current?.clear());

    expect(localStorage.getItem(MANUAL_ROWS_KEY)).toBeNull();
    expect(
      screen.getByPlaceholderText('manualLogging.searchPlaceholder')
    ).toHaveValue('');
    expect(ref.current?.getManualRows()[0]?.ingredient).toBeNull();
  });
});
