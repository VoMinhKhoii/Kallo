import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import { useState } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type {
  CompleteManualMealRow,
  IngredientSearchResult,
} from '@/lib/domain/logging/manual-logging';
import { ManualSheetLauncher } from '../manual-sheet-launcher';

const chicken: IngredientSearchResult = {
  id: 'fct-chicken',
  namePrimary: 'Ức gà',
  nameEn: 'Chicken, broilers or fryers, breast, meat only, raw',
  nameAlt: null,
  state: 'raw',
  similarity: 1,
  per100g: { caloriesKcal: 120, proteinG: 22.5, carbohydrateG: 0, fatG: 2.6 },
  displayNameEn: 'Skinless chicken breast',
  stateLabel: 'raw',
  brand: null,
  vessel: { family: 'piece', kind: 'poultry' },
};

const yogurt: IngredientSearchResult = {
  id: 'fct-yogurt',
  namePrimary: 'Sữa chua (từ sữa bò)',
  nameEn: 'Yogurt, plain, whole milk',
  nameAlt: null,
  state: 'raw',
  similarity: 1,
  per100g: { caloriesKcal: 61, proteinG: 3.5, carbohydrateG: 4.7, fatG: 3.3 },
  displayNameEn: 'Plain whole-milk yogurt',
  stateLabel: null,
  brand: null,
  vessel: null,
};

vi.mock('@/hooks/meals/queries/use-ingredient-search', () => ({
  useIngredientSearch: (query: string) => ({
    data: query.trim() ? [chicken] : [chicken, yogurt],
    isFetching: false,
    isError: false,
  }),
}));

afterEach(() => {
  cleanup();
});

// Inside the drawers: plain clicks and change events. vaul's drag handling on
// pointerdown needs pointer capture, which jsdom does not implement (the
// weight-log sheet's test does the same).
const click = (element: Element) => fireEvent.click(element);
const type = (element: Element, value: string) =>
  fireEvent.change(element, { target: { value } });
// A closed vaul drawer stays mounted until its close transition ends, which
// jsdom never fires — so Radix leaves the sheet under it `aria-hidden`. Queries
// after a nested sheet closes look past that (a browser unmounts it).
const hidden = { hidden: true } as const;

function Harness({
  onSave,
}: {
  onSave: (rows: CompleteManualMealRow[], name: string) => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  return (
    <ManualSheetLauncher open={open} onOpenChange={setOpen} onSave={onSave} />
  );
}

describe('the phone manual-log sheets', () => {
  it('adds, weighs, edits, names and saves a meal', async () => {
    const onSave = vi.fn(async () => {});
    render(<Harness onSave={onSave} />);

    // The composer's launcher opens the meal sheet: nothing to save yet.
    click(screen.getByRole('button', { name: 'sheetTitle' }));
    expect(await screen.findByRole('dialog', { name: 'title' })).toBeVisible();
    expect(screen.getByRole('button', { name: 'save' })).toBeDisabled();

    // "Add ingredient" stacks the search sheet: recents, meal peeking.
    click(screen.getByRole('button', { name: 'addIngredient' }));
    expect(await screen.findByText('peekEmpty')).toBeInTheDocument();
    expect(screen.getByText('recent')).toBeInTheDocument();
    expect(screen.getByText('per100g')).toBeInTheDocument();
    // The card's state leads; a food whose card names none shows none.
    expect(
      screen.getByText(
        (_, el) => el?.textContent === 'stateRaw · Skinless chicken breast'
      )
    ).toBeInTheDocument();
    expect(screen.getByText('Plain whole-milk yogurt')).toBeInTheDocument();

    type(
      screen.getByRole('searchbox', { name: 'sheetSearchPlaceholder' }),
      'gà'
    );
    expect(screen.getByText('resultsFor')).toBeInTheDocument();

    // The food page opens at its vessel's medium cut.
    click(screen.getByRole('button', { name: 'Ức gà' }));
    expect(await screen.findByText('addToMeal')).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: 'amountSlider' })).toHaveValue(
      '150'
    );
    expect(screen.getByText('medium cut')).toBeInTheDocument();
    expect(
      screen.getByRole('slider', { name: 'amountSlider' })
    ).toHaveAttribute('aria-valuenow', '150');

    // + twice: 170 g is past the cut's ±10%, so the claim reads custom.
    click(screen.getByRole('button', { name: 'increase' }));
    click(screen.getByRole('button', { name: 'increase' }));
    expect(screen.getByRole('textbox', { name: 'amountSlider' })).toHaveValue(
      '170'
    );
    expect(screen.getByText('customAmount')).toBeInTheDocument();
    // The peek strip says what the plate becomes: 170 g × 1.2 = 204 kcal.
    expect(screen.getByText('peekWith')).toBeInTheDocument();

    click(screen.getByText('addToMeal'));
    // Back on the results: marked as added, and Done joins the header.
    await waitFor(() =>
      expect(
        screen.getByRole('button', { name: 'Ức gà, inMeal' })
      ).toBeInTheDocument()
    );
    click(screen.getByRole('button', { name: 'done' }));

    // On the plate; the row reopens its page as an edit.
    const row = await screen.findByRole('button', {
      name: 'Ức gà, 170 g',
      ...hidden,
    });
    expect(
      screen.getByRole('button', { name: 'save', ...hidden })
    ).toBeEnabled();
    expect(
      screen.getByRole('img', { name: '204 kcal', ...hidden })
    ).toBeInTheDocument();
    click(row);
    expect(await screen.findByText('update')).toBeInTheDocument();
    expect(screen.getByText('remove')).toBeInTheDocument();
    click(screen.getByRole('button', { name: 'decrease' }));
    click(screen.getByText('update'));
    expect(
      await screen.findByRole('button', { name: 'Ức gà, 160 g', ...hidden })
    ).toBeInTheDocument();

    type(screen.getByPlaceholderText('Ức gà'), 'Cơm gà trưa');
    click(screen.getByRole('button', { name: 'save', ...hidden }));

    await waitFor(() => expect(onSave).toHaveBeenCalledTimes(1));
    const [rows, name] = onSave.mock.calls[0] as unknown as [
      CompleteManualMealRow[],
      string,
    ];
    expect(name).toBe('Cơm gà trưa');
    expect(rows).toHaveLength(1);
    expect(rows[0].ingredient.id).toBe('fct-chicken');
    expect(rows[0].grams).toBe('160');
  });

  it('keeps the plate when a save fails', async () => {
    const onSave = vi.fn(async () => {
      throw new Error('offline');
    });
    render(<Harness onSave={onSave} />);
    click(screen.getByRole('button', { name: 'sheetTitle' }));
    click(await screen.findByRole('button', { name: 'addIngredient' }));
    click(await screen.findByRole('button', { name: /Sữa chua/ }));
    // No vessel and no state: grams only, no Weighed row.
    expect(screen.queryByRole('slider')).not.toBeInTheDocument();
    expect(screen.queryByText('weighed')).not.toBeInTheDocument();
    click(await screen.findByText('addToMeal'));
    click(await screen.findByRole('button', { name: 'done' }));
    click(await screen.findByRole('button', { name: 'save', ...hidden }));

    await waitFor(() => expect(onSave).toHaveBeenCalled());
    expect(
      screen.getByRole('button', {
        name: 'Sữa chua (từ sữa bò), 100 g',
        ...hidden,
      })
    ).toBeInTheDocument();
  });
});
