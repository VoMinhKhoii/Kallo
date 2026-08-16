import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { NutritionValues } from '@/lib/ai/types/nutrition-values';
import { NUTRITION_KEYS } from '@/lib/ai/types/nutrition-values';
import { PartialYesterdayPrompt } from './partial-yesterday-prompt';

const mockUseLoggingDay = vi.fn();
vi.mock('@/hooks/meals/use-logging-day', () => ({
  useLoggingDay: (userId: string, date: string) =>
    mockUseLoggingDay(userId, date),
}));

function nutrition(caloriesKcal: number | null): NutritionValues {
  const base = Object.fromEntries(NUTRITION_KEYS.map((key) => [key, null]));
  return { ...base, caloriesKcal } as unknown as NutritionValues;
}

function dayWith(...calories: (number | null)[]) {
  mockUseLoggingDay.mockReturnValue({
    data: {
      persistedMeals: calories.map((c) => ({ nutrition: nutrition(c) })),
      pendingConfirmations: [],
    },
  });
}

describe('PartialYesterdayPrompt', () => {
  const onOpenDay = vi.fn();
  const onDismiss = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  const renderPrompt = () =>
    render(
      <PartialYesterdayPrompt
        userId="user-1"
        yesterday="2026-05-25"
        calorieTarget={2000}
        onOpenDay={onOpenDay}
        onDismiss={onDismiss}
      />
    );

  it('renders when yesterday is under-logged', () => {
    dayWith(400); // 400 < 50% of 2000
    renderPrompt();

    expect(screen.getByRole('status')).toBeInTheDocument();
    expect(screen.getByText('title')).toBeInTheDocument();
  });

  it.each([
    ['the day has no meals', [] as number[]],
    ['the day is at or above the floor', [1200]],
    ['calories are unknown', [null]],
  ])('renders nothing when %s', (_label, calories) => {
    dayWith(...calories);
    const { container } = renderPrompt();

    expect(container).toBeEmptyDOMElement();
  });

  it('opens yesterday when the action button is clicked', () => {
    dayWith(400);
    renderPrompt();

    fireEvent.click(screen.getByRole('button', { name: 'open' }));
    expect(onOpenDay).toHaveBeenCalledWith('2026-05-25');
  });

  it('calls onDismiss when the dismiss button is clicked', () => {
    dayWith(400);
    renderPrompt();

    fireEvent.click(screen.getByRole('button', { name: 'dismiss' }));
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });
});
