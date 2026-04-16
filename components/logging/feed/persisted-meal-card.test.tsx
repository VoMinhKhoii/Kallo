import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import type { PersistedMeal } from '@/lib/actions/meals';
import { PersistedMealCard } from './persisted-meal-card';

const mealWithUnknownMacros: PersistedMeal = {
  id: 'meal-1',
  rawInput: 'Phở bò',
  mealSlot: 'lunch',
  confidenceOverall: 'high',
  loggedAt: '2026-04-06T12:00:00.000Z',
  nutrition: {
    caloriesKcal: null,
    proteinG: null,
    carbohydrateG: null,
    fatG: null,
    fiberG: 4,
    sodiumMg: 240,
    calciumMg: null,
    ironMg: null,
    magnesiumMg: null,
    phosphorusMg: null,
    potassiumMg: null,
    zincMg: null,
    copperMcg: null,
    manganeseMg: null,
    betaCaroteneMcg: null,
    vitaminAMcg: null,
    vitaminDMcg: null,
    vitaminEMg: null,
    vitaminKMcg: null,
    vitaminCMg: null,
    vitaminB1Mg: null,
    vitaminB2Mg: null,
    vitaminPpMg: null,
    vitaminB5Mg: null,
    vitaminB6Mg: null,
    vitaminB9Mcg: null,
    vitaminB12Mcg: null,
    vitaminHMcg: null,
  },
  mealItemGroups: [
    {
      name: 'Phở bò',
      order: 0,
      nutrition: {
        caloriesKcal: null,
        proteinG: null,
        carbohydrateG: null,
        fatG: null,
        fiberG: 4,
        sodiumMg: 240,
        calciumMg: null,
        ironMg: null,
        magnesiumMg: null,
        phosphorusMg: null,
        potassiumMg: null,
        zincMg: null,
        copperMcg: null,
        manganeseMg: null,
        betaCaroteneMcg: null,
        vitaminAMcg: null,
        vitaminDMcg: null,
        vitaminEMg: null,
        vitaminKMcg: null,
        vitaminCMg: null,
        vitaminB1Mg: null,
        vitaminB2Mg: null,
        vitaminPpMg: null,
        vitaminB5Mg: null,
        vitaminB6Mg: null,
        vitaminB9Mcg: null,
        vitaminB12Mcg: null,
        vitaminHMcg: null,
      },
      ingredients: [],
    },
  ],
};

describe('PersistedMealCard', () => {
  it('renders unknown persisted macros as N/A instead of zero', async () => {
    const user = userEvent.setup();
    render(<PersistedMealCard meal={mealWithUnknownMacros} />);

    expect(screen.getByText(/P: N\/A/)).toBeInTheDocument();
    expect(screen.getAllByText('N/A').length).toBeGreaterThan(0);
    expect(screen.queryByText('0 kcal')).not.toBeInTheDocument();

    await user.click(
      screen.getByRole('button', { name: /toggle meal details/i })
    );

    expect(screen.getAllByText(/P:N\/A/).length).toBeGreaterThan(0);
  });
});
