import { act, cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createRef } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MealInput, type MealInputHandle } from './meal-input';

const STORAGE_KEY = 'nham:meal-input-draft';

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

  it('keeps item list hidden in normal mode', () => {
    render(<MealInput onSubmit={() => {}} mode="normal" />);

    expect(
      screen.queryByPlaceholderText('manualLogging.qtyPlaceholder')
    ).not.toBeInTheDocument();
  });

  it('shows item list when mode prop is manual', () => {
    render(<MealInput onSubmit={() => {}} mode="manual" />);

    expect(
      screen.getByPlaceholderText('manualLogging.qtyPlaceholder')
    ).toBeVisible();
    expect(
      screen.getByPlaceholderText('manualLogging.namePlaceholder')
    ).toBeVisible();
    expect(
      screen.getByRole('button', { name: 'manualLogging.addItem' })
    ).toBeVisible();
  });

  it('pre-fills first item name from textarea when switching to manual', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    const { rerender } = render(<MealInput onSubmit={() => {}} mode="normal" />);

    await user.type(screen.getByRole('textbox'), 'phở bò');
    rerender(<MealInput onSubmit={() => {}} mode="manual" />);

    expect(
      screen.getByPlaceholderText('manualLogging.namePlaceholder')
    ).toHaveValue('phở bò');
  });

  it('serialises item list back to textarea when switching to normal', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    const { rerender } = render(<MealInput onSubmit={() => {}} mode="manual" />);

    const qtyInput = screen.getByPlaceholderText('manualLogging.qtyPlaceholder');
    const nameInput = screen.getByPlaceholderText('manualLogging.namePlaceholder');
    await user.type(qtyInput, '1 bowl');
    await user.type(nameInput, 'rice');

    rerender(<MealInput onSubmit={() => {}} mode="normal" />);

    expect(screen.getByRole('textbox')).toHaveValue('1 bowl rice');
  });

  it('submit is disabled in manual mode until an item is complete', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    render(<MealInput onSubmit={() => {}} mode="manual" />);

    expect(screen.getByRole('button', { name: /submit/i })).toBeDisabled();

    await user.type(screen.getByPlaceholderText('manualLogging.qtyPlaceholder'), '1 bowl');
    await user.type(screen.getByPlaceholderText('manualLogging.namePlaceholder'), 'rice');

    expect(screen.getByRole('button', { name: /submit/i })).toBeEnabled();
  });

  it('shows summary line in manual mode', () => {
    render(<MealInput onSubmit={() => {}} mode="manual" />);

    expect(
      screen.getByText('manualLogging.summary.noContext')
    ).toBeInTheDocument();
  });
});
