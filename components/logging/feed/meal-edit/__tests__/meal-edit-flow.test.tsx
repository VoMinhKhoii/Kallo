import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { PersistedMealCard } from '@/components/logging/feed/persisted/persisted-meal-card';
import type {
  PersistedIngredient,
  PersistedMeal,
} from '@/lib/actions/meals/types';
import type { NutritionValues } from '@/lib/ai/types/nutrition-values';

// The action bar asks the app-wide premium provider, which this test does not
// mount. Unlocked — the gate itself is tested elsewhere.
vi.mock('@/components/billing/premium-guard-provider', () => ({
  usePremiumGuard: () => ({
    locked: () => false,
    requirePremium: () => true,
    openPaywall: vi.fn(),
  }),
}));
vi.mock('@/components/logging/feed/persisted/share-buttons', () => ({
  ShareToCircleButton: () => null,
}));

const n = (kcal: number | null) =>
  ({
    caloriesKcal: kcal,
    proteinG: null,
    carbohydrateG: null,
    fatG: null,
  }) as unknown as NutritionValues;

const ing = (
  id: string,
  grams: number,
  kcal: number,
  unit = 'g'
): PersistedIngredient => ({
  id,
  ingredientName: id,
  foodCompositionId: null,
  estimatedGrams: grams,
  userFacingUnit: unit,
  cookingMethod: null,
  matchConfidence: null,
  nutrition: n(kcal),
});

const meal: PersistedMeal = {
  id: 'meal-1',
  rawInput: 'chicken rice and an iced latte',
  mealSlot: 'lunch',
  confidenceOverall: 'high',
  loggedAt: '2026-10-23T12:00:00.000Z',
  nutrition: n(450),
  mealItemGroups: [
    {
      name: 'Chicken rice',
      order: 0,
      nutrition: n(260),
      ingredients: [ing('rice', 150, 180), ing('chicken', 50, 80)],
    },
    {
      name: 'Iced latte',
      order: 1,
      nutrition: n(190),
      ingredients: [ing('latte', 350, 190, 'ml')],
    },
  ],
  entryMode: 'precise',
  alcoholG: null,
  cheatSliders: null,
  share: null,
};

function renderCard(
  props: Partial<React.ComponentProps<typeof PersistedMealCard>> = {}
) {
  return render(
    <QueryClientProvider client={new QueryClient()}>
      <PersistedMealCard meal={meal} {...props} />
    </QueryClientProvider>
  );
}

async function openEditFromMenu(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole('button', { name: 'moreOptions' }));
  await user.click(await screen.findByRole('menuitem', { name: 'edit' }));
  return screen.findByRole('dialog');
}

describe('editing a saved meal on web', () => {
  it('moves Edit and Remove off the row and into the card menus', async () => {
    renderCard({ onUpdate: vi.fn(), onDelete: vi.fn() });
    expect(screen.queryByRole('button', { name: 'editAmounts' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'remove' })).toBeNull();

    // Right-click the card: the same menu at the pointer.
    fireEvent.contextMenu(
      screen.getByRole('button', { name: 'toggleDetails' })
    );
    expect(
      await screen.findByRole('menuitem', { name: 'edit' })
    ).toBeInTheDocument();
    expect(
      screen.getByRole('menuitem', { name: 'remove' })
    ).toBeInTheDocument();
  });

  it('saves a resized dish as per-row gram overrides', async () => {
    const user = userEvent.setup();
    const onUpdate = vi.fn().mockResolvedValue(undefined);
    renderCard({ onUpdate });
    await openEditFromMenu(user);

    expect(screen.getByText('200 g')).toBeInTheDocument();
    expect(screen.getByText('350 ml')).toBeInTheDocument();
    await user.click(screen.getAllByRole('button', { name: 'moreServing' })[0]);
    expect(screen.getByText('300 g')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'save' }));

    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(onUpdate).toHaveBeenCalledWith({
      edits: [
        { id: 'rice', newGrams: 225 },
        { id: 'chicken', newGrams: 75 },
      ],
      removeIds: [],
    });
  });

  it('removes a dish from its half-serving trash', async () => {
    const user = userEvent.setup();
    const onUpdate = vi.fn().mockResolvedValue(undefined);
    renderCard({ onUpdate });
    await openEditFromMenu(user);

    await user.click(screen.getAllByRole('button', { name: 'lessServing' })[1]);
    await user.click(screen.getByRole('button', { name: 'removeDish' }));
    expect(screen.queryByText('Iced latte')).toBeNull();
    await user.click(screen.getByRole('button', { name: 'save' }));
    await waitFor(() =>
      expect(onUpdate).toHaveBeenCalledWith({ edits: [], removeIds: ['latte'] })
    );
  });

  it('closes an untouched dialog without a request', async () => {
    const user = userEvent.setup();
    const onUpdate = vi.fn();
    renderCard({ onUpdate });
    await openEditFromMenu(user);
    await user.click(screen.getByRole('button', { name: 'save' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(onUpdate).not.toHaveBeenCalled();
  });

  it('keeps the dialog open when the save fails, and while it is in flight', async () => {
    const user = userEvent.setup();
    let fail: (e: Error) => void = () => {};
    const onUpdate = vi.fn(
      () => new Promise<void>((_, reject) => (fail = reject))
    );
    renderCard({ onUpdate });
    await openEditFromMenu(user);
    await user.click(screen.getAllByRole('button', { name: 'moreServing' })[0]);
    await user.click(screen.getByRole('button', { name: 'save' }));

    await user.keyboard('{Escape}');
    expect(screen.getByRole('dialog')).toBeInTheDocument();

    fail(new Error('offline'));
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'save' })).toBeEnabled()
    );
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  it('asks before removing the meal', async () => {
    const user = userEvent.setup();
    const onDelete = vi.fn();
    renderCard({ onDelete });
    await user.click(screen.getByRole('button', { name: 'moreOptions' }));
    await user.click(await screen.findByRole('menuitem', { name: 'remove' }));
    expect(onDelete).not.toHaveBeenCalled();
    expect(await screen.findByRole('alertdialog')).toBeInTheDocument();
  });
});
