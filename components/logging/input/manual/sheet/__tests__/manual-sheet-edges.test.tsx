import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
import { useState } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ManualSheetItem } from '@/lib/domain/logging/manual-display';
import type {
  CompleteManualMealRow,
  IngredientSearchResult,
} from '@/lib/domain/logging/manual-logging';
import { ManualFoodPage } from '../manual-food-page';
import { ManualMealSheet } from '../manual-meal-sheet';
import { ManualSheetLauncher } from '../manual-sheet-launcher';
import type { ManualSheetState } from '../use-manual-sheet';

const food = (
  id: string,
  namePrimary: string,
  per100g: IngredientSearchResult['per100g']
): IngredientSearchResult => ({
  id,
  namePrimary,
  nameEn: null,
  nameAlt: null,
  state: 'raw',
  similarity: 1,
  per100g,
  displayNameEn: null,
  stateLabel: null,
  brand: null,
  vessel: null,
});

const yogurt = food('fct-yogurt', 'Sữa chua', {
  caloriesKcal: 61,
  proteinG: 3.5,
  carbohydrateG: 4.7,
  fatG: 3.3,
});
/** A row with no energy figure: its calories are unknown, never 0. */
const mystery = food('fct-mystery', 'Lá mơ lông', {
  caloriesKcal: null,
  proteinG: 4.1,
  carbohydrateG: null,
  fatG: null,
});

vi.mock('@/hooks/meals/queries/use-ingredient-search', () => ({
  useIngredientSearch: (query: string) => ({
    data: query.trim() ? [mystery] : [yogurt, mystery],
    isFetching: false,
    isError: false,
  }),
}));

afterEach(() => {
  cleanup();
});

// Plain events inside vaul drawers (jsdom has no pointer capture), and
// queries that look past the aria-hidden a closed nested drawer leaves behind
// until its transition ends — see manual-sheets.test.tsx.
const click = (element: Element) => fireEvent.click(element);
const hidden = { hidden: true } as const;
/** The meal sheet's own X — the add sheet over it has one too. (Under that
 *  aria-hidden the meal dialog has no accessible name; find it by its field.) */
const mealClose = () =>
  within(
    screen.getByText('mealName').closest('[role="dialog"]') as HTMLElement
  ).getByRole('button', { name: 'close', ...hidden });

/** A plate that already holds `items`, outside any launcher. */
function plate(items: ManualSheetItem[]): ManualSheetState {
  return {
    items,
    name: '',
    setName: vi.fn(),
    add: vi.fn(),
    update: vi.fn(),
    remove: vi.fn(),
    itemFor: (id) => items.find((item) => item.ingredient.id === id) ?? null,
    reset: vi.fn(),
  };
}

function Launcher({
  onSave,
}: {
  onSave: (rows: CompleteManualMealRow[], name: string) => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  return (
    <ManualSheetLauncher open={open} onOpenChange={setOpen} onSave={onSave} />
  );
}

/** Launcher → meal sheet → add sheet → yogurt at 100 g → Done. */
async function addYogurt() {
  click(screen.getByRole('button', { name: 'sheetTitle' }));
  click(await screen.findByRole('button', { name: 'addIngredient' }));
  click(await screen.findByRole('button', { name: /Sữa chua/ }));
  click(await screen.findByText('addToMeal'));
  click(await screen.findByRole('button', { name: 'done' }));
  await screen.findByRole('button', { name: 'Sữa chua, 100 g', ...hidden });
}

describe('the phone manual-log sheets at their edges', () => {
  it('a full plate turns "Add ingredient" off and says why', () => {
    const items = Array.from({ length: 30 }, (_, i) => ({
      id: `item-${i}`,
      ingredient: food(`fct-${i}`, `Food ${i}`, yogurt.per100g),
      grams: 100,
    }));
    render(
      <ManualMealSheet
        open
        onOpenChange={vi.fn()}
        meal={plate(items)}
        onSave={vi.fn()}
      />
    );
    const add = screen.getByRole('button', { name: /addIngredient/ });
    expect(add).toBeDisabled();
    expect(add).toHaveTextContent('mealFull');
    expect(screen.getByRole('button', { name: 'save' })).toBeEnabled();
  });

  it('unknown calories read "—" on the ring and the row, never 0', () => {
    render(
      <ManualMealSheet
        open
        onOpenChange={vi.fn()}
        meal={plate([{ id: 'item-1', ingredient: mystery, grams: 100 }])}
        onSave={vi.fn()}
      />
    );
    expect(screen.getByRole('img', { name: '— kcal' })).toBeInTheDocument();
    expect(screen.getByText('4.1 g')).toBeInTheDocument();
    expect(screen.getAllByText('— g')).toHaveLength(2);
    expect(
      screen.getByRole('button', { name: 'Lá mơ lông, 100 g' })
    ).toHaveTextContent('—');
  });

  it('an empty plate reads 0, not "—"', () => {
    render(
      <ManualMealSheet
        open
        onOpenChange={vi.fn()}
        meal={plate([])}
        onSave={vi.fn()}
      />
    );
    expect(screen.getByRole('img', { name: '0 kcal' })).toBeInTheDocument();
    expect(screen.getAllByText('0 g')).toHaveLength(3);
  });

  it('a full plate blocks a new food on its page, never an update', () => {
    const props = {
      food: yogurt,
      grams: 100,
      onGrams: vi.fn(),
      onCommit: vi.fn(),
      onClose: vi.fn(),
    };
    const { rerender } = render(
      <ManualFoodPage {...props} inMeal={false} mealFull />
    );
    expect(screen.getByRole('button', { name: 'addToMeal' })).toBeDisabled();
    expect(screen.getByText('mealFull')).toBeInTheDocument();
    click(screen.getByRole('button', { name: 'addToMeal' }));
    expect(props.onCommit).not.toHaveBeenCalled();

    rerender(<ManualFoodPage {...props} inMeal mealFull />);
    expect(screen.getByRole('button', { name: 'update' })).toBeEnabled();
    expect(screen.queryByText('mealFull')).not.toBeInTheDocument();
  });

  it('a food with unknown calories promises no total in the strip', async () => {
    render(<Launcher onSave={vi.fn(async () => {})} />);
    click(screen.getByRole('button', { name: 'sheetTitle' }));
    click(await screen.findByRole('button', { name: 'addIngredient' }));
    click(await screen.findByRole('button', { name: /Lá mơ lông/ }));
    expect(await screen.findByText('addToMeal')).toBeInTheDocument();
    expect(screen.queryByText('peekWith')).not.toBeInTheDocument();
  });

  it('closing the meal sheet discards its plate; the next open is empty', async () => {
    const onSave = vi.fn(async () => {});
    render(<Launcher onSave={onSave} />);
    await addYogurt();

    // Closed by its own X — a controlled close, which vaul's animation
    // callbacks never hear about.
    click(mealClose());
    // Closed, the plate is still drawn while the sheet slides away…
    expect(
      screen.getByRole('button', { name: 'Sữa chua, 100 g', ...hidden })
    ).toBeInTheDocument();
    // …and the next open starts a new meal.
    click(screen.getByRole('button', { name: 'sheetTitle', ...hidden }));
    expect(
      screen.queryByRole('button', { name: 'Sữa chua, 100 g', ...hidden })
    ).not.toBeInTheDocument();
    expect(screen.getByPlaceholderText('mealNameEmpty')).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'save', ...hidden })
    ).toBeDisabled();
    expect(onSave).not.toHaveBeenCalled();
  });

  it('Save fires once, and the sheet holds still while it is out', async () => {
    let finish = () => {};
    const onSave = vi.fn(
      () => new Promise<void>((resolve) => (finish = resolve))
    );
    render(<Launcher onSave={onSave} />);
    await addYogurt();

    const save = screen.getByRole('button', { name: 'save', ...hidden });
    click(save);
    click(save);
    await waitFor(() => expect(save).toBeDisabled());
    expect(onSave).toHaveBeenCalledTimes(1);
    expect(mealClose()).toBeDisabled();
    expect(
      screen.getByRole('button', { name: 'addIngredient', ...hidden })
    ).toBeDisabled();
    expect(screen.getByPlaceholderText('Sữa chua')).toBeDisabled();

    finish();
    await waitFor(() =>
      expect(
        screen.queryByRole('dialog', { name: 'title' })
      ).not.toBeInTheDocument()
    );
    expect(onSave).toHaveBeenCalledTimes(1);
  });
});
