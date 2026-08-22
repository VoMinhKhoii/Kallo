import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { MealEntry } from '@/lib/core/types/dashboard';
import { MealList } from '../meal-list';

const MEAL: MealEntry = {
  id: 'meal-1',
  label: 'Phở bò',
  calories: 553,
  loggedAt: '2026-04-29T01:00:00.000Z',
  proteinG: 38,
  carbsG: 62,
  fatG: 18,
};

describe('MealList', () => {
  it('says what the meal was, when, and what it came to', () => {
    render(<MealList meals={[MEAL]} />);

    expect(screen.getByText('Phở bò')).toBeInTheDocument();
    expect(screen.getByText('553')).toBeInTheDocument();
    // The clock time is the viewer's, so assert the element rather than a zone.
    expect(screen.getByRole('time')).toHaveAttribute('dateTime', MEAL.loggedAt);
  });

  it('draws the composition under the figure', () => {
    render(<MealList meals={[MEAL]} />);

    expect(screen.getByText(/P:\s*38g/)).toBeInTheDocument();
    expect(screen.getByText(/C:\s*62g/)).toBeInTheDocument();
    expect(screen.getByText(/F:\s*18g/)).toBeInTheDocument();
  });

  it('drops the composition for a meal whose macros were never resolved', () => {
    render(
      <MealList
        meals={[{ ...MEAL, proteinG: null, carbsG: null, fatG: null }]}
      />
    );

    // The name and the figure still stand; only the split it cannot draw goes.
    expect(screen.getByText('Phở bò')).toBeInTheDocument();
    expect(screen.queryByText(/P:/)).not.toBeInTheDocument();
  });

  it('offers the empty day a prompt, not an empty list', () => {
    render(<MealList meals={[]} />);

    expect(screen.getByText('noMealsToday')).toBeInTheDocument();
    expect(screen.getByText('mealReceiptsHint')).toBeInTheDocument();
  });
});
